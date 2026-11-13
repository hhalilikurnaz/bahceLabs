"""9J-3 kaynaklar arası tutarlılık: kayan sapma (drift) kuralları — saf + gerçek veritabanı (IMERG ↔ ERA5, yağmur ölçeri ↔ ERA5)."""

from datetime import date, timedelta

import pytest
from sqlalchemy import text

from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.izleme import uyum

from .test_irrigation_panel import kur
from .test_water_api import TODAY, factory, user_client  # noqa: F401

K = load_catalog().izleme


def test_mutlak_kayma_sicaklik_taban_sapma():
    # 1A tabanı +4,6 °C; son pencere +4,8 → uyumlu; +6,2 → drift (> 1,0)
    d, s, durum = uyum.mutlak_kayma([4.8] * 30, 4.6, K.drift_ta_c, K.drift_min_gun)
    assert durum == "uyumlu" and s == pytest.approx(0.2)
    assert uyum.mutlak_kayma([6.2] * 30, 4.6, K.drift_ta_c, K.drift_min_gun)[2] == "drift"
    assert uyum.mutlak_kayma([6.2] * 5, 4.6, K.drift_ta_c, K.drift_min_gun)[2] == "yetersiz"  # az gün
    assert uyum.mutlak_kayma([4.0] * 30, None, K.drift_ta_c, K.drift_min_gun)[2] == "yetersiz"  # taban yok


def test_oransal_kayma_medyan_ve_esik():
    sabit = [1.0, 1.05, 0.95, 1.0, 1.02, 0.98, 1.0, 1.01, 0.99]
    assert uyum.oransal_kayma(sabit, 3, 0.35)[3] == "uyumlu"
    kaymis = sabit[:6] + [1.6, 1.7, 1.65]  # son 3 ay ≈ +%65
    son, taban, g, durum = uyum.oransal_kayma(kaymis, 3, 0.35)
    assert durum == "drift" and g == pytest.approx(0.65, abs=0.05) and taban == pytest.approx(1.0, abs=0.03)
    assert uyum.oransal_kayma([1.0, 1.0, 1.0], 3, 0.35)[3] == "yetersiz"  # taban için yeterli geçmiş yok


async def _imerg_yaz(factory, gid, oran_aylik: list[float]) -> None:  # noqa: F811
    """Son N tam ayda her gün ERA5 (= 2 mm) ve IMERG (= 2/oran mm) satırı."""
    from bahcelab_backend.domain.water.era5_sync import garden_cell

    async with factory() as s:
        cell, _, _ = await garden_cell(s, gid)
        await s.execute(text("DELETE FROM dogrulama_gozlem WHERE garden_id = :g AND source_id = 'imerg-daily'"), {"g": gid})
        ilk = date(TODAY.year, TODAY.month, 1)
        for i, oran in enumerate(reversed(oran_aylik), start=1):
            ay0 = date((ilk - timedelta(days=30 * i)).year, (ilk - timedelta(days=30 * i)).month, 1)
            for d in range(25):
                t = ay0 + timedelta(days=d)
                await s.execute(text("INSERT INTO era5_daily (cell_id, tarih, yagis_mm, hava_kaynak) VALUES (:c, :t, 2.0, 'era5_land') ON CONFLICT (cell_id, tarih) DO UPDATE SET yagis_mm = 2.0, hava_kaynak = 'era5_land'"), {"c": cell, "t": t})
                await s.execute(text("INSERT INTO dogrulama_gozlem (garden_id, source_id, indeks, tarih, deger, guncelleme) VALUES (:g, 'imerg-daily', 'yagis_mm', :t, :v, now())"), {"g": gid, "t": t, "v": 2.0 / oran})
        await s.commit()


async def test_era5_imerg_aylik_uyumlu_ve_drift(user_client, factory):  # noqa: F811
    gid = await kur(user_client, factory)
    await _imerg_yaz(factory, gid, [1.0, 1.02, 0.98, 1.0, 1.01, 0.99, 1.0, 1.0, 1.0])
    async with factory() as s:
        r = await uyum.era5_imerg_aylik(s, gid, TODAY, K)
    assert r.durum == "uyumlu" and r.n >= 8 and abs(r.sapma or 0) < 0.1
    await _imerg_yaz(factory, gid, [1.0, 1.02, 0.98, 1.0, 1.01, 0.99, 1.7, 1.8, 1.75])  # son 3 ay ERA5/IMERG ≈ ×1,75
    async with factory() as s:
        r2 = await uyum.era5_imerg_aylik(s, gid, TODAY, K)
        await uyum.yaz(s, TODAY, r2)
        await uyum.yaz(s, TODAY, r2)  # idempotent (aynı gün/kontrol/bahçe tek satır)
        await s.commit()
        n = (await s.execute(text("SELECT count(*) FROM izleme_uyum WHERE kontrol = 'era5_imerg_aylik' AND garden_id = :g"), {"g": gid})).scalar_one()
    assert r2.durum == "drift" and (r2.sapma or 0) > 0.35 and n == 1


async def test_veri_yoksa_yetersiz_uydurma_yok(user_client, factory):  # noqa: F811
    gid = await kur(user_client, factory)
    async with factory() as s:
        assert (await uyum.olcer_era5(s, gid, TODAY, K)).durum == "yetersiz"  # ölçer kaydı yok
        assert (await uyum.era5_meteostat_tmax(s, gid, [], K)).durum == "yetersiz"
        assert (await uyum.etc_wapor(s, gid, {}, K)).durum == "yetersiz"
