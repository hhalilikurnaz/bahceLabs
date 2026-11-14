"""«Bugün» bahçenin yerel günüdür (shared/clock): UTC gün sınırında (İstanbul 00:30 = UTC 21:30 önceki gün) ve gün sonunda (23:30) plan, olay, besleme/geri doldurma günleri doğru."""

from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest
import time_machine
from sqlalchemy import text

from bahcelab_backend.domain.acquisitions.backfill import BackfillService
from bahcelab_backend.domain.agro.service import AgroService
from bahcelab_backend.domain.irrigation.service import IrrigationService
from bahcelab_backend.shared.clock import (
    bahce_bugunu,
    bugun,
    geojson_zaman_dilimi,
    zaman_dilimi_adi,
)

from .test_irrigation_panel import kur
from .test_water_api import factory, user_client  # noqa: F401

IST = ZoneInfo("Europe/Istanbul")
SINIRLAR = [
    (datetime(2026, 10, 15, 0, 30, tzinfo=IST), date(2026, 10, 15)),  # UTC 14 Eki 21:30: UTC günü bir geride
    (datetime(2026, 10, 15, 23, 30, tzinfo=IST), date(2026, 10, 15)),  # UTC 20:30: aynı gün
    (datetime(2026, 11, 1, 0, 30, tzinfo=IST), date(2026, 11, 1)),  # ay sınırı: UTC hâlâ 31 Eki
]


@pytest.mark.parametrize(("an", "beklenen"), SINIRLAR)
def test_bugun_istanbul_gunu_utc_gunu_degil(an, beklenen):
    with time_machine.travel(an, tick=False):
        assert bugun() == beklenen
        assert bugun("Europe/Istanbul") == beklenen
        assert datetime.now(ZoneInfo("UTC")).date() <= beklenen  # UTC günü ayrışabilir; uygulama günü ayrışmaz


def test_turkiye_disi_bahce_kendi_yerel_gununu_kullanir():
    assert zaman_dilimi_adi(38.7, 27.9) == "Europe/Istanbul"
    assert zaman_dilimi_adi(40.7, -74.0) == "Etc/GMT+5"  # New York ≈ UTC−5 (POSIX işaretiyle ters)
    assert zaman_dilimi_adi(35.0, 139.7) == "Etc/GMT-9"
    assert geojson_zaman_dilimi({"type": "Polygon", "coordinates": [[[27.9, 38.7], [27.91, 38.7], [27.91, 38.71], [27.9, 38.7]]]}) == "Europe/Istanbul"
    with time_machine.travel(datetime(2026, 10, 15, 0, 30, tzinfo=IST), tick=False):  # İstanbul 00:30 → UTC−5'te 14 Eki 16:30
        assert bugun("Etc/GMT+5") == date(2026, 10, 14)


@pytest.mark.parametrize(("an", "beklenen"), SINIRLAR)
async def test_plan_durum_olay_ve_besleme_gunleri_sinirda_dogru(user_client, factory, an, beklenen):  # noqa: F811
    gid = await kur(user_client, factory)
    with time_machine.travel(an, tick=False):
        async with factory() as s:
            assert await bahce_bugunu(s, gid) == beklenen  # olay (compute_events_for), seri, sistem kontrol kaydı bu yardımcıdan
            ws = (await s.execute(text("SELECT workspace_id FROM gardens WHERE id = :g"), {"g": gid})).scalar()
            row = await IrrigationService(s, ws).gardens.get(gid)
            assert IrrigationService(s, ws)._today(row) == beklenen  # sulama planı günü
            assert AgroService.__new__(AgroService)._today(row) == beklenen  # Durum günü (jeton süresi sahte saatte dolacağı için servis katmanında)
        # besleme/geri doldurma ayları: ay sınırında (UTC 31 Eki 21:30) son ay KASIM olmalı
        svc = BackfillService.__new__(BackfillService)
        svc.settings = type("S", (), {"acq_start": "2026-09-01", "acq_radar_start": "2026-09-01", "acq_landsat_start": "2026-09-01"})()  # type: ignore[assignment]
        aylar = svc.month_range()
        assert aylar[-1] == date(beklenen.year, beklenen.month, 1)


async def test_api_bahce_zaman_dilimini_istemciye_verir(user_client, factory):  # noqa: F811
    gid = await kur(user_client, factory)
    veri = (await user_client.get(f"/gardens/{gid}")).json()
    assert veri["zaman_dilimi"] == "Europe/Istanbul"
    assert any(g["zaman_dilimi"] == "Europe/Istanbul" for g in (await user_client.get("/gardens")).json())
