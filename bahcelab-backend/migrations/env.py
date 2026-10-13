import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import Base
from bahcelab_backend.domain.agro import models as agro_models  # noqa: F401
from bahcelab_backend.domain.notifications import models as notification_models  # noqa: F401
from bahcelab_backend.domain.auth import models as auth_models  # noqa: F401
from bahcelab_backend.domain.gardens import models as garden_models  # noqa: F401
from bahcelab_backend.domain.multiyear import models as multiyear_models  # noqa: F401
from bahcelab_backend.domain.acquisitions import models as acquisition_models  # noqa: F401
from bahcelab_backend.domain.ndvi import models as ndvi_models  # noqa: F401
from bahcelab_backend.domain.planning import models  # noqa: F401
from bahcelab_backend.domain.weather import models as weather_models  # noqa: F401
from bahcelab_backend.domain.events import models as event_models  # noqa: F401
from bahcelab_backend.domain.water import models as water_models  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.database_url)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
