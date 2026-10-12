"""Veriyi değiştiren betikler için ortak güvenlik çerçevesi.

Kurallar: varsayılan --dry-run (yazmak için --apply); zorunlu kapsam (--user e-posta ya da --garden kimlik); --apply'da önce pg_dump
yedeği; etkilenecek kayıt sayısını gösterip «evet» onayı (--yes yalnız otomasyon için). Bağlantı bilgisi DATABASE_URL'den,
konteyner adı DB_CONTAINER'dan, yedek klasörü BACKUP_DIR'den okunur.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from bahcelab_backend.config import get_settings


def parser(description: str) -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=description)
    scope = p.add_mutually_exclusive_group(required=True)
    scope.add_argument("--user", help="Kapsam: bu e-postanın bahçeleri")
    scope.add_argument("--garden", action="append", help="Kapsam: bahçe kimliği (birden çok verilebilir)")
    p.add_argument("--apply", action="store_true", help="Değişikliği uygula (varsayılan: yalnız dry-run)")
    p.add_argument("--yes", action="store_true", help="Onay sorma (yalnız otomasyon; yedek yine alınır)")
    return p


def log(event: str, **fields: object) -> None:
    """Yapılandırılmış satır (JSON): betik çıktısı izlenebilir ve aranabilir."""
    print(json.dumps({"zaman": datetime.now().isoformat(timespec="seconds"), "olay": event, **fields}, ensure_ascii=False, default=str), flush=True)


def backup(label: str) -> Path:
    """`docker exec <DB_CONTAINER> pg_dump -Fc` ile tam yedek; dosya yolu döner. Başarısızsa betik durur."""
    settings = get_settings()
    url = urlparse(settings.database_url.replace("+asyncpg", ""))
    folder = Path(settings.backup_dir)
    if not folder.is_absolute():
        folder = Path(__file__).resolve().parents[2] / folder
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / f"{datetime.now():%Y%m%d-%H%M%S}_{label}.dump"
    cmd = ["docker", "exec", settings.db_container, "pg_dump", "-U", url.username or "", "-d", (url.path or "/").lstrip("/"), "-Fc"]
    with target.open("wb") as fh:
        result = subprocess.run(cmd, stdout=fh, stderr=subprocess.PIPE, check=False)
    if result.returncode != 0 or target.stat().st_size == 0:
        target.unlink(missing_ok=True)
        sys.exit(f"Yedek alınamadı, işlem yapılmadı: {result.stderr.decode(errors='replace').strip()}")
    log("yedek", dosya=str(target), boyut_bayt=target.stat().st_size)
    return target


def confirm(summary: dict[str, object], *, assume_yes: bool) -> bool:
    log("ozet", **summary)
    if assume_yes:
        return True
    return input("Devam etmek için «evet» yazın: ").strip().lower() == "evet"
