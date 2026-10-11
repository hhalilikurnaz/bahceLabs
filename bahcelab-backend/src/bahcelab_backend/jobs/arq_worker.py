"""arq işçisi: `make worker` (= `arq bahcelab_backend.jobs.arq_worker.WorkerSettings`). Redis gerekir (docker compose `redis`)."""

from __future__ import annotations

from typing import Any

from arq import cron
from arq.connections import RedisSettings

from bahcelab_backend.config import Settings, get_settings
from bahcelab_backend.database import async_session_factory
from bahcelab_backend.domain.weather.provider import get_provider
from bahcelab_backend.jobs import registry


def _wrap(spec: registry.JobSpec) -> Any:
    async def job(ctx: dict[str, Any]) -> str:
        result = await spec.fn(async_session_factory, get_provider())
        return repr(result)

    job.__name__ = spec.name  # arq işi adıyla bulur
    return job


def minute_slots(interval_minutes: int) -> set[int]:
    """Aralığa göre saat içindeki dakikalar (60 dk → {0}, 30 dk → {0, 30}, 15 dk → {0, 15, 30, 45})."""
    step = max(1, min(60, interval_minutes))
    return set(range(0, 60, step))


def build_settings(settings: Settings) -> dict[str, Any]:
    specs = registry.job_specs(settings)
    functions = [_wrap(s) for s in specs]
    cron_jobs = [cron(fn, minute=minute_slots(s.interval_minutes), run_at_startup=False, unique=True) for fn, s in zip(functions, specs, strict=True)]
    return {"functions": functions, "cron_jobs": cron_jobs, "redis_settings": RedisSettings.from_dsn(settings.redis_url)}


async def process_garden_year(ctx: dict[str, Any], garden_id: str, year: int) -> str:
    """Çok yıllık analiz: bir bahçe × yıl görevi (ADR 0011). Aynı görev iki kez çalışmaz (`_job_id` + idempotent `claim_year`)."""
    import uuid

    from bahcelab_backend.domain.imagery.registry import get_imagery_provider
    from bahcelab_backend.domain.multiyear.runner import YearRunner
    from bahcelab_backend.shared.storage import get_storage

    runner = YearRunner(async_session_factory, get_imagery_provider(), get_storage())
    return await runner.run_year(uuid.UUID(garden_id), year)


class WorkerSettings:
    _built = build_settings(get_settings())
    functions = [*_built["functions"], process_garden_year]
    cron_jobs = _built["cron_jobs"]
    redis_settings = _built["redis_settings"]
