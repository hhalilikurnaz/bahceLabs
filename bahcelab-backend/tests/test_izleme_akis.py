"""9J-1 akış tazeliği + iç uyarı + 9J-2 veri kontrolleri (gerçek veritabanı; ağ yok)."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.agro.catalog import AkisKurali, load_catalog
from bahcelab_backend.domain.izleme import akis, uyari, veri_kontrol

from .test_irrigation_panel import kur
from .test_water_api import TODAY, factory, seed, user_client  # noqa: F401

K = load_catalog().izleme


def test_siniflandirma_katalog_esikleriyle():
    a = AkisKurali(ad="x", beklenen_gun=1, kabul_gecikme_gun=7, kopuk_gun=14)
    assert [akis.siniflandir(g, a) for g in (0, 7, 7.5, 14, 15, None)] == ["taze", "taze", "gecikmeli", "gecikmeli", "kopuk", "bos"]
    assert set(K.akislar) >= {"era5", "openmeteo_tahmin", "imerg", "meteostat", "sentinel2", "sentinel1", "landsat", "smap", "wapor", "ecostress", "tarife"}  # istenen tüm akışlar katalogda
    with pytest.raises(ValueError, match="kopuk_gun"):
        AkisKurali(ad="x", beklenen_gun=1, kabul_gecikme_gun=7, kopuk_gun=5)


def test_bosluk_sayimi_yalniz_serinin_ortasindaki_eksik_gunler():
    g = {TODAY - timedelta(days=d) for d in (30, 29, 26, 25, 20)}  # 28,27 ve 24..21 eksik
    assert akis.bosluk_say(g, TODAY, 60, TODAY - timedelta(days=20)) == 6
    assert akis.bosluk_say({TODAY - timedelta(days=3)}, TODAY, 60, TODAY) == 0


async def test_akis_durumlari_gercek_tablolardan_ve_tarife_kopuk(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)  # ERA5 hücresi + toprak tohumlu
    async with factory() as s:
        d = {x.akis: x for x in await akis.akis_durumlari(s, TODAY)}
    assert d["era5"].son_veri is not None and d["era5"].durum in ("taze", "gecikmeli", "kopuk")
    assert d["tarife"].durum == "bos" and "boş" in d["tarife"].neden  # katalogda fiyat/tarih yok: sayı uydurulmaz
    assert d["sentinel2"].durum in ("taze", "gecikmeli", "kopuk", "bos") and all(x.ad for x in d.values())
    # son veriyi 30 gün geriye çek → ERA5 kopuk
    async with factory() as s:
        await s.execute(text("UPDATE era5_daily SET hava_kaynak = 'model' WHERE tarih > :t"), {"t": TODAY - timedelta(days=30)})
        await s.commit()
        d2 = {x.akis: x for x in await akis.akis_durumlari(s, TODAY)}
    assert d2["era5"].durum == "kopuk" and d2["era5"].gecikme_gun is not None and d2["era5"].gecikme_gun >= 30
    assert gid


async def test_ic_uyari_kopuk_hemen_gecikmeli_iki_gun_ve_yalniz_ic_ekip(user_client, factory, monkeypatch):  # noqa: F811
    await seed(user_client, factory)
    me = (await user_client.get("/auth/me")).json()
    async with factory() as s:
        await s.execute(text("DELETE FROM izleme_akis"))
        # imerg: dün gecikmeli, bugün gecikmeli → 2 ardışık gün; era5: bugün kopuk
        for t, a, dr in ((TODAY - timedelta(days=1), "imerg", "gecikmeli"), (TODAY, "imerg", "gecikmeli"), (TODAY, "era5", "kopuk"), (TODAY, "landsat", "taze")):
            await s.execute(text("INSERT INTO izleme_akis (tarih, akis, durum) VALUES (:t, :a, :d)"), {"t": t, "a": a, "d": dr})
        await s.commit()
        u = {a: (d, g) for a, d, g in await akis.uyari_gerektirenler(s, TODAY)}
    assert u["era5"][0] == "kopuk" and u["imerg"] == ("gecikmeli", str(TODAY - timedelta(days=1))) and "landsat" not in u
    # tek gün gecikmeli → uyarı yok
    async with factory() as s:
        await s.execute(text("DELETE FROM izleme_akis WHERE akis = 'imerg' AND tarih = :t"), {"t": TODAY - timedelta(days=1)})
        await s.commit()
        assert "imerg" not in {a for a, _, _ in await akis.uyari_gerektirenler(s, TODAY)}
    # bildirim: INTERNAL_EMAILS boşsa kimseye gitmez; listedeki kullanıcıya anında, ikinci çağrıda tekrar yok
    uy = [uyari.IcUyari("akis:era5:kopuk:x", "ERA5 kopuk", "son veri 30 gün önce")]
    monkeypatch.setattr(get_settings(), "internal_emails", "")
    async with factory() as s:
        assert await uyari.yayinla(s, uy) == 0
    monkeypatch.setattr(get_settings(), "internal_emails", me["email"])
    async with factory() as s:
        assert await uyari.yayinla(s, uy) == 1
        assert await uyari.yayinla(s, uy) == 0
        await s.commit()
    ogeler = (await user_client.get("/notifications?durum=hepsi")).json()["ogeler"]
    assert any("İç izleme" in o["baslik"] and o["baglanti"] == "/ic/kalite" for o in ogeler)


def test_kontrol_deger_aralik_sicrama_birim():
    k = K.kontroller
    assert [b.kural for b in veri_kontrol.kontrol_deger("yagis_mm", TODAY, 400.0, 2.0, k["yagis_mm"])] == ["aralik", "sicrama"]
    kel = veri_kontrol.kontrol_deger("t_max_c", TODAY, 305.0, 30.0, k["t_max_c"])
    assert kel[0].siddet == "sert" and "Kelvin" in kel[0].ayrinti
    assert veri_kontrol.kontrol_deger("ndvi", TODAY, 0.8, 0.7, k["ndvi"]) == [] and veri_kontrol.kontrol_deger("ndvi", TODAY, 1.4, None, k["ndvi"])[0].siddet == "sert"
    assert veri_kontrol.kontrol_deger("et0_mm", TODAY, None, None, k["et0_mm"]) == []
    assert [b.kural for b in veri_kontrol.kontrol_deger("et0_mm", TODAY, 11.0, 1.0, k["et0_mm"])] == ["sicrama"]  # aralıkta ama ani sıçrama: yumuşak


async def test_tarama_supheli_degeri_silmez_bayraklar_idempotent_ve_sert_olan_kovaya_girmez(user_client, factory):  # noqa: F811
    gid = await kur(user_client, factory)  # profilli bahçe (panel hesaplanır)
    async with factory() as s:
        from bahcelab_backend.domain.water.era5_sync import garden_cell

        cell, _, _ = await garden_cell(s, gid)
        await s.execute(text("DELETE FROM veri_bayrak WHERE kaynak = 'era5' AND anahtar = :c"), {"c": str(cell)})  # önceki koşudan kalan bayrak olmasın
        gun = TODAY - timedelta(days=3)
        await s.execute(text("UPDATE era5_daily SET yagis_mm = 400, t_max = 305 WHERE cell_id = :c AND tarih = :t"), {"c": cell, "t": gun})
        await s.execute(text("DELETE FROM era5_daily WHERE cell_id = :c AND tarih = :t"), {"c": cell, "t": TODAY - timedelta(days=6)})  # serinin ortasında eksik gün
        await s.commit()
    async with factory() as s:
        n1 = await veri_kontrol.tara_era5(s, datetime(2000, 1, 1, tzinfo=UTC), TODAY)
        await s.commit()
        sayi1 = (await s.execute(text("SELECT count(*) FROM veri_bayrak WHERE kaynak = 'era5' AND anahtar = :c"), {"c": str(cell)})).scalar_one()
        await veri_kontrol.tara_era5(s, datetime(2000, 1, 1, tzinfo=UTC), TODAY)
        await s.commit()
        sayi2 = (await s.execute(text("SELECT count(*) FROM veri_bayrak WHERE kaynak = 'era5' AND anahtar = :c"), {"c": str(cell)})).scalar_one()
        assert n1 >= 3 and sayi1 == sayi2  # idempotent: tekrar tarama bayrak sayısını değiştirmez
        b = {(x[0], x[1]): x[2] for x in (await s.execute(text("SELECT degisken, kural, siddet FROM veri_bayrak WHERE kaynak = 'era5' AND anahtar = :c AND tarih = :t"), {"c": str(cell), "t": gun})).all()}
        assert b[("yagis_mm", "aralik")] == "sert" and b[("t_max_c", "aralik")] == "sert"
        assert (await s.execute(text("SELECT count(*) FROM veri_bayrak WHERE kural = 'eksik_gun' AND anahtar = :c AND tarih = :t"), {"c": str(cell), "t": TODAY - timedelta(days=6)})).scalar_one() == 1
        # şüpheli değer SİLİNMEDİ
        assert float((await s.execute(text("SELECT yagis_mm FROM era5_daily WHERE cell_id = :c AND tarih = :t"), {"c": cell, "t": gun})).scalar_one()) == 400.0
    # kova: sert bayraklı (400 mm) yağış plana GİRMEZ → o gün veri eksik
    p = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()
    assert p["durum"] == "hazir"
    g = next(x for x in p["sektorler"][0]["gunler"] if x["tarih"] == str(gun))
    assert g["yagis_mm"] is None and g["veri_eksik"] is True  # 400 mm (sert bayraklı) kovaya girmedi: o gün veri eksik


async def test_tarama_son_taramadan_beri_degisenleri_yakalar_eski_tarihli_satir_guncellenince_yeniden_taranir(user_client, factory):  # noqa: F811
    gid = await kur(user_client, factory)
    eski_gun = TODAY - timedelta(days=100)
    async with factory() as s:
        from bahcelab_backend.domain.water.era5_sync import garden_cell

        cell, _, _ = await garden_cell(s, gid)
        await s.execute(text("DELETE FROM veri_bayrak WHERE kaynak = 'era5' AND anahtar = :c"), {"c": str(cell)})
        await s.execute(text("DELETE FROM izleme_tarama"))
        await s.commit()
        ilk = await veri_kontrol.tara(s, TODAY)  # ilk koşu: son 30 gün (seed satırları yeni yazıldı)
        await s.commit()
        isaret = (await s.execute(text("SELECT son_tarama FROM izleme_tarama WHERE kaynak = 'veri'"))).scalar_one()
        assert ilk >= 0 and isaret is not None
        # tarama işaretçisi 5 dk geri alınır (kesinleşmemiş yazımlar kaçmasın): tekrar tarama idempotent, YENİ bayrak üretmez
        before = (await s.execute(text("SELECT count(*) FROM veri_bayrak WHERE kaynak = 'era5' AND anahtar = :c"), {"c": str(cell)})).scalar_one()
        await veri_kontrol.tara(s, TODAY)
        await s.commit()
        assert (await s.execute(text("SELECT count(*) FROM veri_bayrak WHERE kaynak = 'era5' AND anahtar = :c"), {"c": str(cell)})).scalar_one() == before
        # işaretçiyi şimdiye çek (5 dk örtüşmeyi atla): eski tarihli satır DOKUNULMADAN taranmaz
        await s.execute(text("UPDATE izleme_tarama SET son_tarama = clock_timestamp() WHERE kaynak = 'veri'"))
        await s.commit()
        assert await veri_kontrol.tara(s, TODAY) == 0
        await s.execute(text("UPDATE izleme_tarama SET son_tarama = clock_timestamp() WHERE kaynak = 'veri'"))
        await s.commit()
        # 100 gün ÖNCEKİ satır sonradan değişti (ör. ERA5 kesinleşmesi): tetikleyici `guncelleme`yi ilerletir → yeniden taranır, imkânsız değer bayraklanır
        await s.execute(text("UPDATE era5_daily SET yagis_mm = 400 WHERE cell_id = :c AND tarih = :t"), {"c": cell, "t": eski_gun})
        await s.commit()
        assert await veri_kontrol.tara(s, TODAY) >= 1
        await s.commit()
        b = (await s.execute(text("SELECT siddet FROM veri_bayrak WHERE kaynak = 'era5' AND anahtar = :c AND tarih = :t AND kural = 'aralik' AND degisken = 'yagis_mm'"), {"c": str(cell), "t": eski_gun})).scalar_one()
        assert b == "sert"
        # değer düzeltildi (kesinleşen veri 5 mm): satır yine yeniden taranır ve eski bayrak KALKAR
        await s.execute(text("UPDATE era5_daily SET yagis_mm = 5 WHERE cell_id = :c AND tarih = :t"), {"c": cell, "t": eski_gun})
        await s.commit()
        await veri_kontrol.tara(s, TODAY)
        await s.commit()
        assert (await s.execute(text("SELECT count(*) FROM veri_bayrak WHERE kaynak = 'era5' AND anahtar = :c AND tarih = :t AND kural = 'aralik'"), {"c": str(cell), "t": eski_gun})).scalar_one() == 0
        # WaPOR NRT → final: eta_baglam satırı güncellenince taranır (ET 0–12 mm/gün)
        await s.execute(text("INSERT INTO eta_baglam (garden_id, kaynak, bas, bit, et_mm_gun, piksel_dokunan, piksel_gecerli) VALUES (:g, 'wapor-l1', :b, :b, 2.5, 2, 2)"), {"g": gid, "b": TODAY - timedelta(days=50)})
        await s.commit()
        await veri_kontrol.tara(s, TODAY)
        await s.execute(text("UPDATE eta_baglam SET et_mm_gun = 40 WHERE garden_id = :g"), {"g": gid})
        await s.commit()
        assert await veri_kontrol.tara(s, TODAY) >= 1
        await s.commit()
        assert (await s.execute(text("SELECT siddet FROM veri_bayrak WHERE kaynak = 'wapor' AND anahtar = :g"), {"g": str(gid)})).scalar_one() == "sert"
