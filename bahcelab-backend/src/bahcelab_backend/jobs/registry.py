"""İş kayıt defteri: ad → (gövde, çalışma aralığı). Zamanlayıcı (inline ya da arq) yalnızca bu listeyi bilir;
Adım 9'daki sahne işleme kuyruğu da aynı arayüze (`JobQueue`) bağlanır."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from bahcelab_backend.config import Settings
from bahcelab_backend.domain.weather.provider import WeatherProvider
from bahcelab_backend.jobs import tasks
from bahcelab_backend.jobs.tasks import JobResult, SessionFactory

JobFn = Callable[[SessionFactory, WeatherProvider], Awaitable[JobResult]]


@dataclass(frozen=True)
class JobSpec:
    name: str
    fn: JobFn
    interval_minutes: int
    hour: int | None = None  # arq: günlük işler için çalışma saati (None = interval_minutes dakika dilimleri)


def job_specs(settings: Settings) -> list[JobSpec]:
    # Sıra önemlidir: önce hava tazelenir, sonra tazelenmiş veriyle risk/bildirim üretilir
    return [
        JobSpec("refresh_weather", tasks.refresh_weather, settings.job_weather_interval_minutes),
        JobSpec("generate_notifications", tasks.generate_notifications, settings.job_notifications_interval_minutes),
        JobSpec("refresh_acquisitions", tasks.refresh_acquisitions, settings.job_acquisitions_interval_minutes, hour=settings.job_acquisitions_hour),
    ]


def find(settings: Settings, name: str) -> JobSpec:
    for spec in job_specs(settings):
        if spec.name == name:
            return spec
    raise KeyError(f"Bilinmeyen iş: {name}")
