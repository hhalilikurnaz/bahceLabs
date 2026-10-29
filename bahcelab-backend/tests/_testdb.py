"""Test veritabanı: testler geliştirme verisine DOKUNMAZ; her pytest işçisi (xdist: gw0, gw1, …) kendi veritabanını kullanır.

`conftest.py` bunu `bahcelab_backend` içe aktarılmadan ÖNCE çağırır: DATABASE_URL ortam değişkeni işçi veritabanına çevrilir,
veritabanı yoksa oluşturulur (PostGIS dahil) ve Alembic ile `head`'e getirilir (güncelse hızlı geçer).
"""

from __future__ import annotations

import asyncio
import os
import re
import threading
from pathlib import Path

import asyncpg
from alembic import command
from alembic.config import Config

ROOT = Path(__file__).resolve().parents[1]


def _dev_url() -> str:
    if url := os.environ.get("DATABASE_URL"):
        return url
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith("DATABASE_URL="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("DATABASE_URL bulunamadı")


def _worker_suffix() -> str:
    worker = os.environ.get("PYTEST_XDIST_WORKER")
    return f"_{worker}" if worker else ""


async def _ensure_database(admin_dsn: str, name: str, test_dsn: str) -> None:
    conn = await asyncpg.connect(admin_dsn)
    try:
        if not await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", name):
            await conn.execute(f'CREATE DATABASE "{name}"')
    finally:
        await conn.close()
    conn = await asyncpg.connect(test_dsn)
    try:
        await conn.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    finally:
        await conn.close()


_LOCK_CONNECTIONS: list[asyncpg.Connection] = []  # referans tutulmazsa bağlantı toplanır ve kilit düşer
_LOCK_LOOP: asyncio.AbstractEventLoop | None = None  # kilit bağlantısını yaşatan arka plan döngüsü (süreç bitince bağlantı kapanır → kilit kendiliğinden düşer)


def _hold_database_lock(test_dsn: str, name: str) -> None:
    """Bu işçi veritabanını SAHİPLEN: aynı veritabanını kullanan ikinci bir pytest oturumu (ya da öldürülmüş koşudan artakalan işçi) testleri sessizce bozar —
    biri kullanıcıları siler, öbürü beklenmedik 401 alır. Bu yüzden kilit alınamazsa net bir hata ile DURULUR."""
    global _LOCK_LOOP
    loop = asyncio.new_event_loop()
    threading.Thread(target=loop.run_forever, daemon=True, name="testdb-kilidi").start()

    async def take() -> bool:
        conn = await asyncpg.connect(test_dsn)  # bağlantı bilerek kapatılmaz: kilit oturum ömrü boyunca tutulur
        _LOCK_CONNECTIONS.append(conn)
        return bool(await conn.fetchval("SELECT pg_try_advisory_lock(hashtext($1))", f"bahcelab-testdb:{name}"))

    if not asyncio.run_coroutine_threadsafe(take(), loop).result(timeout=30):
        raise RuntimeError(
            f"Test veritabanı «{name}» başka bir pytest oturumu tarafından kullanılıyor. Aynı anda iki koşu (ya da öldürülmüş bir koşudan artakalan işçi) testleri bozar: "
            "`ps aux | grep pytest` ile artakalan süreçleri bulup sonlandırın, sonra yeniden koşun."
        )
    _LOCK_LOOP = loop


def prepare() -> str:
    """İşçi veritabanını hazırlar; DATABASE_URL'i ona yönlendirir. Dönüş: kullanılan veritabanı adı."""
    dev = _dev_url()
    match = re.match(r"^(?P<head>.*/)(?P<db>[^/?]+)(?P<tail>\?.*)?$", dev)
    if match is None:
        raise RuntimeError("DATABASE_URL çözümlenemedi")
    name = f"{match['db']}_test{_worker_suffix()}"
    test_url = f"{match['head']}{name}{match['tail'] or ''}"
    plain = lambda u: u.replace("postgresql+asyncpg://", "postgresql://")  # noqa: E731
    asyncio.run(_ensure_database(plain(dev), name, plain(test_url)))
    _hold_database_lock(plain(test_url), name)
    os.environ["DATABASE_URL"] = test_url
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "migrations"))
    command.upgrade(cfg, "head")
    return name
