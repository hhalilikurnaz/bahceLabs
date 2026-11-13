"""9J işleri (günlük + haftalık) uçtan uca: gerçek veritabanı, ağ yok (Meteostat uyumu kapalı)."""

import pytest
from sqlalchemy import text

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.izleme import isler

from .test_irrigation_panel import kur
from .test_water_api import TODAY, factory, user_client  # noqa: F401


async def test_gunluk_is_akis_goruntusu_uyari_ve_tarama(user_client, factory, monkeypatch):  # noqa: F811
    gid = await kur(user_client, factory)
    me = (await user_client.get("/auth/me")).json()
    monkeypatch.setattr(get_settings(), "internal_emails", me["email"])
    r = await isler.gunluk(factory, TODAY)
    assert r["akis"] == 11 and r["hata"] == 0 and r["bayrak"] >= 0
    async with factory() as s:
        satir = {x[0]: x[1] for x in (await s.execute(text("SELECT akis, durum FROM izleme_akis WHERE tarih = :t"), {"t": TODAY})).all()}
        assert satir["tarife"] == "bos" and len(satir) == 11
    # ikinci koşu aynı gün: idempotent (snapshot üzerine yazılır, aynı iç uyarı ikinci kez gitmez)
    r2 = await isler.gunluk(factory, TODAY)
    assert r2["uyari"] == 0 and r2["hata"] == 0
    assert gid


async def test_haftalik_is_uyum_serilerini_yazar_yetersizse_uydurmaz(user_client, factory):  # noqa: F811
    gid = await kur(user_client, factory)
    r = await isler.haftalik(factory, TODAY, agdan=False)
    assert r["hata"] == 0 and r["kontrol"] >= 2
    async with factory() as s:
        d = {x[0]: x[1] for x in (await s.execute(text("SELECT kontrol, durum FROM izleme_uyum WHERE garden_id = :g"), {"g": gid})).all()}
    assert d["era5_imerg_aylik"] == "yetersiz" and d["olcer_era5"] == "yetersiz"  # veri yok: drift UYDURULMAZ
    assert pytest is not None
