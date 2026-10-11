"""İş kuyruğu arayüzü. Adım 9 (sahne işleme / çok yıllık bölgeler) bu arayüz üzerinden iş ekler.

- `InlineQueue`: işi hemen (aynı süreçte) çalıştırır — testler ve Redis'siz geliştirme.
- `ArqQueue`: işi Redis'e koyar; `make worker` işçisi çalıştırır.
"""

from __future__ import annotations

from typing import Any, Protocol

from bahcelab_backend.config import Settings
from bahcelab_backend.domain.weather.provider import WeatherProvider
from bahcelab_backend.jobs import registry
from bahcelab_backend.jobs.tasks import JobResult, SessionFactory


class JobQueue(Protocol):
    async def enqueue(self, name: str) -> JobResult | None: ...


class InlineQueue:
    def __init__(self, settings: Settings, factory: SessionFactory, provider: WeatherProvider) -> None:
        self.settings, self.factory, self.provider = settings, factory, provider

    async def enqueue(self, name: str) -> JobResult | None:
        return await registry.find(self.settings, name).fn(self.factory, self.provider)


class ArqQueue:
    """`pool`: `arq.create_pool(...)` sonucu (testte sahte nesne verilebilir)."""

    def __init__(self, pool: Any) -> None:
        self.pool = pool

    async def enqueue(self, name: str) -> JobResult | None:
        # `_job_id` aynı işin birden fazla kez sıraya girmesini önler (idempotent ekleme)
        await self.pool.enqueue_job(name, _job_id=f"job-{name}")
        return None


async def run_all(settings: Settings, factory: SessionFactory, provider: WeatherProvider) -> dict[str, JobResult]:
    """Tüm işleri sırayla çalıştırır (hava → bildirim). Testlerde ve elle tetiklemede kullanılır."""
    return {spec.name: await spec.fn(factory, provider) for spec in registry.job_specs(settings)}
