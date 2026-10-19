from tests import _testdb

_testdb.prepare()  # bahcelab_backend içe aktarılmadan ÖNCE: DATABASE_URL işçi test veritabanına yönlenir (geliştirme verisine dokunulmaz)

import uuid
from collections.abc import AsyncGenerator
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
import time_machine
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import get_db_session
from bahcelab_backend.main import create_app

TEST_EMAIL_DOMAIN = "@pytest.example.com"
TEST_PASSWORD = "test-sifre-123"


# Saat SABİT: testlerin «bugün»ü sistem saatine ya da gece yarısına bağlı değildir. Başlangıç anı Europe/Istanbul 2026-10-10 12:00; saat bu andan itibaren
# ilerler (tick), böylece asyncio zamanlayıcıları ve zaman aşımları çalışır, ama koşu gece yarısını GEÇEMEZ (12 saat pay). `pytest_configure`: toplama
# aşamasında modül düzeyindeki `TODAY = datetime.now(...)` sabitleri de sabit saati görür.
FIXED_NOW = datetime(2026, 10, 10, 12, 0, tzinfo=ZoneInfo("Europe/Istanbul"))
_clock: time_machine.travel | None = None


def pytest_configure(config):  # noqa: ANN001, ANN201
    global _clock
    _clock = time_machine.travel(FIXED_NOW, tick=True)
    _clock.start()


def pytest_unconfigure(config):  # noqa: ANN001, ANN201
    if _clock is not None:
        _clock.stop()


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture
def test_engine():
    # Her test kendi event loop'unda çalışır; havuzlanmış bağlantılar loop'lar arası taşınamaz
    return create_async_engine(get_settings().database_url, poolclass=NullPool)


@pytest.fixture
def app(test_engine, tmp_path):
    settings = get_settings()
    previous = (settings.registration_enabled, settings.ndvi_enabled, settings.storage_dir, settings.acq_auto_backfill, settings.soilgrids_enabled, settings.era5_auto_feed, settings.hls_enabled)
    settings.registration_enabled = True
    # Testler ağa çıkmaz ve arka plan işi başlatmaz; NDVI testleri bunu kendileri açar
    settings.ndvi_enabled = False
    settings.acq_auto_backfill = False  # geçmiş doldurma testleri hizmeti kendileri sürer (ağsız sahte sağlayıcı)
    settings.soilgrids_enabled = False  # testler SoilGrids'e çıkmaz (toprak satırı tohumlanır)
    settings.hls_enabled = False  # HLS (Planetary Computer) testlerde çağrılmaz; sahte sağlayıcıyla servis doğrudan sınanır
    settings.era5_auto_feed = False  # bahçe eklenince ERA5 beslemesi testlerde kendiliğinden başlamaz (besleme testleri açar)
    settings.storage_dir = str(tmp_path / "uploads")

    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    async def override_session() -> AsyncGenerator[AsyncSession, None]:
        async with factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    application = create_app()
    application.dependency_overrides[get_db_session] = override_session
    yield application
    settings.registration_enabled, settings.ndvi_enabled, settings.storage_dir, settings.acq_auto_backfill, settings.soilgrids_enabled, settings.era5_auto_feed, settings.hls_enabled = previous


def make_client(app) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture
async def client(app):
    async with make_client(app) as ac:
        yield ac


@pytest.fixture
async def cleanup_users(test_engine):
    """Testlerin açtığı kullanıcıları, çalışma alanlarını ve planlarını siler."""
    yield
    async with test_engine.begin() as conn:
        params = {"pattern": f"%{TEST_EMAIL_DOMAIN}"}
        await conn.execute(
            text(
                "DELETE FROM simulation_plans WHERE workspace_id IN ("
                " SELECT m.workspace_id FROM workspace_members m"
                " JOIN users u ON u.id = m.user_id WHERE u.email LIKE :pattern)"
            ),
            params,
        )
        await conn.execute(
            text(
                "DELETE FROM workspaces WHERE id IN ("
                " SELECT m.workspace_id FROM workspace_members m"
                " JOIN users u ON u.id = m.user_id WHERE u.email LIKE :pattern)"
            ),
            params,
        )
        await conn.execute(text("DELETE FROM users WHERE email LIKE :pattern"), params)


def unique_email() -> str:
    return f"user-{uuid.uuid4().hex[:12]}{TEST_EMAIL_DOMAIN}"


async def register(client: AsyncClient, email: str | None = None, name: str = "Test Kullanıcı"):
    email = email or unique_email()
    response = await client.post(
        "/auth/register", json={"name": name, "email": email, "password": TEST_PASSWORD}
    )
    return email, response
