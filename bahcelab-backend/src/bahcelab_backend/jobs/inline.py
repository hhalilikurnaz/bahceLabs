"""Süreç içi periyodik zamanlayıcı (Redis gerektirmez): geliştirme ve tek sunuculu küçük kurulumlar için."""

from __future__ import annotations

import asyncio
import contextlib
import logging

from bahcelab_backend.config import Settings
from bahcelab_backend.domain.weather.provider import WeatherProvider
from bahcelab_backend.jobs import registry
from bahcelab_backend.jobs.tasks import SessionFactory

logger = logging.getLogger(__name__)


class InlineScheduler:
    def __init__(self, settings: Settings, factory: SessionFactory, provider: WeatherProvider) -> None:
        self.settings, self.factory, self.provider = settings, factory, provider
        self._tasks: list[asyncio.Task[None]] = []

    async def _loop(self, spec: registry.JobSpec) -> None:
        if spec.hour is not None:  # günlük iş: açılışta hemen değil, ilk aralıktan sonra (ağır sahne taraması)
            await asyncio.sleep(spec.interval_minutes * 60)
        while True:
            try:
                result = await spec.fn(self.factory, self.provider)
                logger.info("İş %s tamamlandı: %s", spec.name, result)
            except Exception:  # noqa: BLE001
                logger.exception("İş %s başarısız", spec.name)
            await asyncio.sleep(spec.interval_minutes * 60)

    def start(self) -> None:
        for spec in registry.job_specs(self.settings):
            self._tasks.append(asyncio.create_task(self._loop(spec), name=f"job-{spec.name}"))

    async def stop(self) -> None:
        for task in self._tasks:
            task.cancel()
        for task in self._tasks:
            with contextlib.suppress(asyncio.CancelledError):
                await task
        self._tasks.clear()
