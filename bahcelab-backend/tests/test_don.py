# ruff: noqa: F811
"""ADIM 10 · Dilim 1 (ADR 0031): gece don riski (saf mantık), topografya profili, API, iş (bildirim kapısı), geri bildirim → kural performansı, olay yeniden değerlendirmesi."""

import json
import uuid
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import numpy as np
import pytest
from pyproj import Transformer
from sqlalchemy import text

from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.don import isler, olay_yd, risk, servis, topografya
from bahcelab_backend.domain.don.risk import SaatlikModel
from bahcelab_backend.domain.don.tahmin import Sahte
from bahcelab_backend.domain.izleme import kural_performans

from .test_water_api import GEOMETRY, factory, seed, user_client  # noqa: F401

KURAL = load_catalog().don


def gun_modeli(model: str, sabah: date, tmin: float, bulut: float = 20.0, ruzgar: float = 1.0) -> SaatlikModel:
    """SENTETİK saatlik seri (yalnız birim testi): sabah günü 24 saat, minimum 06:00'da."""
    zaman = [f"{sabah.isoformat()}T{h:02d}:00" for h in range(24)]
    t = [tmin + 0.4 * abs(h - 6) for h in range(24)]
    return SaatlikModel(model, zaman, t, [bulut] * 24, [ruzgar] * 24)


def uc_model(sabah: date, tmins: tuple[float, float, float], bulut: float = 20.0, ruzgar: float = 1.0) -> list[SaatlikModel]:
    return [gun_modeli(m, sabah, t, bulut, ruzgar) for m, t in zip(KURAL.modeller, tmins, strict=True)]


# ------------------------------------------------------------------ saf mantık
def test_kritik_sicaklik_evreye_gore_ve_yaprak_odun_yok():
    assert risk.kritik_sicaklik("tomurcuklanma", KURAL) == (-2.8, ["cicek"])
    assert risk.kritik_sicaklik("ciceklenme", KURAL) == (-2.8, ["cicek"])
    assert risk.kritik_sicaklik("meyve_tutumu", KURAL) == (-0.8, ["yeni_meyve"])
    assert risk.kritik_sicaklik("meyve_gelisimi", KURAL) == (-1.4, ["yesil_meyve"])
    assert risk.kritik_sicaklik("olgunlasma", KURAL) == (-0.8, ["olgun_meyve"])
    assert risk.kritik_sicaklik(None, KURAL) is None
    assert KURAL.kritik_c["yaprak"] is None and KURAL.kritik_c["odun"] is None  # kaynak yok: modelde YOK (mühendis girdisi bekleniyor)
    assert KURAL.durum == "dogrulanmadi"


@pytest.mark.parametrize(("en_soguk", "beklenen"), [(-1.5, "uyari"), (-0.8, "uyari"), (-0.7, "izle"), (0.2, "izle"), (0.3, "yok"), (5.0, "yok")])
def test_seviye_kritik_artı_2_uyari_artı_3_izle(en_soguk, beklenen):
    sabah = date(2026, 2, 22)
    o = risk.gece_ozeti(uc_model(sabah, (en_soguk, en_soguk + 1.0, en_soguk + 2.0)), sabah - timedelta(days=1), -2.8, KURAL)
    assert o is not None and o.en_soguk_c == round(en_soguk + 0.0, 1) or o.en_soguk_c == en_soguk
    k = risk.karar(o, -2.8, KURAL)
    assert k.seviye == beklenen and k.soz == {"uyari": "yüksek", "izle": "orta", "yok": "düşük"}[beklenen]


def test_en_soguk_model_esas_ve_olasilik_tek_yonlu():
    sabah = date(2026, 2, 22)
    o = risk.gece_ozeti(uc_model(sabah, (4.0, 3.0, -1.0)), sabah - timedelta(days=1), -0.8, KURAL)
    assert o is not None and o.en_soguk_c == -1.0 and o.kac_model_uzlasi == 1  # tek model uzlaşı eşiği altında; yine de en soğuk esas
    sicak = risk.gece_ozeti(uc_model(sabah, (6.0, 6.0, 6.0)), sabah - timedelta(days=1), -0.8, KURAL)
    assert sicak is not None and risk.karar(o, -0.8, KURAL).olasilik > risk.karar(sicak, -0.8, KURAL).olasilik
    assert "temkinli" in risk.TEMKIN_NOTU and "EN SOĞUĞU" in risk.NASIL


def test_eksik_model_dislanir_yetersizse_none():
    sabah = date(2026, 2, 22)
    ms = uc_model(sabah, (0.0, 0.0, 0.0))
    kisa = SaatlikModel("icon_seamless", ms[1].zaman[:10], ms[1].t2m[:10])
    assert risk.gece_ozeti([ms[0], kisa, ms[2]], sabah - timedelta(days=1), -0.8, KURAL) is not None  # 2 model yeter
    assert risk.gece_ozeti([ms[0], kisa], sabah - timedelta(days=1), -0.8, KURAL) is None  # 1 model: yetersiz → uydurma yok


def test_kural_b_ve_c_katalogdan():
    sabah = date(2026, 2, 22)
    gece = sabah - timedelta(days=1)
    tek = risk.gece_ozeti(uc_model(sabah, (-1.0, 4.0, 4.0)), gece, -0.8, KURAL)
    assert tek is not None
    assert risk.karar(tek, -0.8, KURAL).seviye == "uyari"  # A (seçilen): en soğuk yeter
    b = KURAL.model_copy(update={"uyari_kural": "B"})
    assert risk.karar(tek, -0.8, b).seviye == "izle"  # B: ≥ 2 model uzlaşısı yok
    c = KURAL.model_copy(update={"uyari_kural": "C"})
    bulutlu = risk.gece_ozeti(uc_model(sabah, (-1.0, -1.0, -1.0), bulut=90.0, ruzgar=1.0), gece, -0.8, KURAL)
    acik = risk.gece_ozeti(uc_model(sabah, (-1.0, -1.0, -1.0), bulut=10.0, ruzgar=1.0), gece, -0.8, KURAL)
    assert bulutlu is not None and acik is not None
    assert risk.karar(bulutlu, -0.8, c).seviye == "izle" and risk.karar(acik, -0.8, c).seviye == "uyari"


# ------------------------------------------------------------------ topografya
def _pencere(egim_der: float, lat: float, lng: float, km: float) -> topografya.Pencere:
    epsg = topografya._utm_epsg(lat, lng)
    cx, cy = Transformer.from_crs(4326, epsg, always_xy=True).transform(lng, lat)
    n = int(km * 1000 / 30)
    x = (np.arange(2 * n + 1) - n) * 30.0
    z = np.tile(100.0 + np.tan(np.radians(egim_der)) * x, (2 * n + 1, 1))  # doğuya yükselen düzlem
    return topografya.Pencere(z.astype("float32"), cx - n * 30.0, cy + n * 30.0, epsg)


async def test_topografya_yalniz_rolyef_ve_egim_saglaninca_bahce_ici_uretir(user_client, factory):
    gid = await seed(user_client, factory)
    async with factory() as s:
        eg = await topografya.hesapla(s, gid, KURAL, pencere_fn=lambda la, lo, km: _pencere(0.5, la, lo, km))  # düz: üretilmez
        assert eg is not None and eg["bahce_ici"]["uygun"] is False and "yükseklik farkı" in eg["bahce_ici"]["neden"]
        assert "hucreler" not in eg["bahce_ici"] and abs(eg["profil"]["tpi300_m"]) < 1.0
        assert await topografya.hesapla(s, gid, KURAL, pencere_fn=lambda la, lo, km: _pencere(0.5, la, lo, km)) is None  # aynı geometri/sürüm: yeniden hesaplanmaz
        await s.execute(text("DELETE FROM bahce_topografya WHERE garden_id = :g"), {"g": gid})
        dik = await topografya.hesapla(s, gid, KURAL, pencere_fn=lambda la, lo, km: _pencere(25.0, la, lo, km))  # dik yamaç
        await s.commit()
    assert dik is not None
    bi = dik["bahce_ici"]
    assert bi["uygun"] is True and bi["rolyef_m"] >= KURAL.rolyef_min_m and bi["egim_ort_der"] >= KURAL.egim_min_der and len(bi["hucreler"]) > 0
    g = [h["goreli_soguk"] for h in bi["hucreler"]]
    assert min(g) >= 0.0 and max(g) <= 1.0 and max(g) - min(g) > 0.5  # alçak (batı) kısım daha soğuk sıralanır
    r = await user_client.get(f"/gardens/{gid}/don/goreli-soguk")
    assert r.status_code == 200 and r.json()["uygun"] is True and len(r.json()["hucreler"]) == len(g)


def _duz(la: float, lo: float, km: float) -> topografya.Pencere:  # ağsız: düz sentetik DEM
    return _pencere(0.5, la, lo, km)


# ------------------------------------------------------------------ servis + API
def _sahte(gun0: date, tmins: list[tuple[float, float, float]]) -> Sahte:
    """gun0 akşamından başlayan geceler için üç modelin saatlik serisi (sentetik)."""
    modeller = {m: [] for m in KURAL.modeller}
    for i, tm in enumerate(tmins):
        for m, sm in zip(KURAL.modeller, uc_model(gun0 + timedelta(days=i + 1), tm), strict=True):
            modeller[m].append(sm)
    birlesik = [SaatlikModel(m, [z for sm in v for z in sm.zaman], [t for sm in v for t in sm.t2m], [b for sm in v for b in sm.bulut], [w for sm in v for w in sm.ruzgar]) for m, v in modeller.items()]
    return Sahte(birlesik)


async def test_risk_yaz_api_geri_bildirim_ve_kural_performansi(user_client, factory):
    gid = await seed(user_client, factory)
    r0 = await user_client.get(f"/gardens/{gid}/don")
    assert r0.status_code == 200 and r0.json()["geceler"] == [] and r0.json()["veri_yok_nedeni"]  # veri yokken neden yazılır (uydurma yok)
    bugun = date(2026, 10, 10)  # olgunlaşma evresi: kritik −0,8 °C
    async with factory() as s:
        yazilan = await servis.hesapla_ve_yaz(s, gid, _sahte(bugun, [(-1.5, -0.5, 0.5), (2.0, 3.0, 4.0), (3.0, 4.0, 5.0)]), KURAL, bugun)
        await s.commit()
    assert [y["seviye"] for y in yazilan] == ["uyari", "izle", "yok"]
    r = await user_client.get(f"/gardens/{gid}/don")
    j = r.json()
    assert r.status_code == 200 and len(j["geceler"]) >= 1 and j["temkin_notu"].startswith("Uyarılarımız bilerek temkinlidir") and "nasil" in j and j["esik_durumu"].startswith("ön değer")
    g0 = next(x for x in j["geceler"] if x["gece"] == bugun.isoformat())
    assert g0["olasilik_sozu"] == "yüksek" and g0["kritik_c"] == -0.8 and "olasilik" not in g0  # kullanıcıya sözcük, sayı değil
    assert (await user_client.post(f"/gardens/{gid}/don/geri-bildirim", json={"gece": bugun.isoformat(), "yanit": "olmadi"})).status_code == 204
    assert (await user_client.post(f"/gardens/{gid}/don/geri-bildirim", json={"gece": "2020-01-01", "yanit": "oldu"})).status_code == 422  # üretilmemiş gece
    assert (await user_client.post(f"/gardens/{gid}/don/geri-bildirim", json={"gece": bugun.isoformat(), "yanit": "belki"})).status_code == 422
    async with factory() as s:
        kp = [x for x in await kural_performans.kural_performansi(s, date(2026, 10, 1), date(2026, 10, 31)) if x.kural == "don_uyari"]
    assert len(kp) == 1 and kp[0].uretilen == 1 and kp[0].yanit == 1 and kp[0].isabet_n == 1 and kp[0].durum == "olculemiyor"  # tek yanıt: eşik altı → isabet uydurulmaz
    assert (await user_client.get(f"/gardens/{uuid.uuid4()}/don")).status_code == 404


async def test_is_bildirim_kapisi_18_uyari_ve_sabah_sorusu(user_client, factory):
    gid = await seed(user_client, factory)
    ist = ZoneInfo("Europe/Istanbul")
    gun = date(2026, 10, 10)
    saglayici = _sahte(gun, [(-1.5, -0.5, 0.5), (3.0, 4.0, 5.0), (3.0, 4.0, 5.0)])

    async def say(tur: str) -> int:
        async with factory() as s:
            return int((await s.execute(text("SELECT count(*) FROM notifications WHERE garden_id = :g AND tur = :t"), {"g": gid, "t": tur})).scalar() or 0)

    kapali = await isler.don_isi(factory, saglayici, pencere_fn=_duz, simdi=datetime(2026, 10, 10, 18, 5, tzinfo=ist), kural=KURAL)
    assert kapali["risk"] >= 1 and kapali["uyari_bildirimi"] == 0 and await say("don_gece") == 0  # kapı kapalı: yalnız hesap
    acik = KURAL.model_copy(update={"bildirim_acik": True})
    a = await isler.don_isi(factory, saglayici, pencere_fn=_duz, simdi=datetime(2026, 10, 10, 18, 10, tzinfo=ist), kural=acik)
    assert a["uyari_bildirimi"] == 1 and await say("don_gece") == 1
    await isler.don_isi(factory, saglayici, pencere_fn=_duz, simdi=datetime(2026, 10, 10, 18, 40, tzinfo=ist), kural=acik)
    assert await say("don_gece") == 1  # aynı gece ikinci bildirim yok (dedupe)
    bos = await isler.don_isi(factory, saglayici, pencere_fn=_duz, simdi=datetime(2026, 10, 10, 12, 0, tzinfo=ist), kural=acik)
    assert bos["uyari_bildirimi"] == 0 and bos["soru"] == 0
    sab = await isler.don_isi(factory, saglayici, pencere_fn=_duz, simdi=datetime(2026, 10, 11, 8, 5, tzinfo=ist), kural=acik)
    assert sab["soru"] == 1 and await say("don_soru") == 1
    async with factory() as s:
        await servis.geri_bildirim_yaz(s, gid, gun, "oldu", None)
        await s.commit()
    await isler.don_isi(factory, saglayici, pencere_fn=_duz, simdi=datetime(2026, 10, 11, 8, 30, tzinfo=ist), kural=acik)
    assert await say("don_soru") == 1  # yanıt verilmiş gece için yeniden sorulmaz


# ------------------------------------------------------------------ olay yeniden değerlendirmesi
async def _olay(s, gid, anahtar, bas, bit, en_dusuk):  # noqa: ANN001
    await s.execute(text("INSERT INTO events (id, garden_id, anahtar, tur, turler, baslangic, bitis, guven, siddet, tahmin, ayrinti, formul_surumu) VALUES (:i, :g, :a, 'don', CAST('[\"don\"]' AS jsonb), :b, :e, 'orta', 'normal', false, CAST(:y AS jsonb), 'olay-v2')"),
                    {"i": uuid.uuid4(), "g": gid, "a": anahtar, "b": bas, "e": bit, "y": json.dumps({"don.en_dusuk_c": en_dusuk})})


def test_siniflandir_kurali():
    d = load_catalog().dis_kanit.don_destek_c
    assert olay_yd.siniflandir(-3.7, -0.5, KURAL, d) == "istasyon_destekliyor"
    assert olay_yd.siniflandir(-3.7, 0.7, KURAL, d) == "model_sapmasi_olasi"  # istasyon > 0 ve model ≥ σ (2,4 K) soğuk
    assert olay_yd.siniflandir(-1.0, 0.7, KURAL, d) == "belirsiz"
    assert olay_yd.siniflandir(-1.0, None, KURAL, d) == "kanit_yok"
    assert olay_yd.siniflandir(-3.7, 0.7, KURAL, d, dis_kayit_destek=True) == "dis_kayit_destekliyor"  # kamu kaydı destekliyorsa olay korunur
    assert olay_yd.siniflandir(-3.7, -0.5, KURAL, d, dis_kayit_destek=True) == "istasyon_destekliyor"  # istasyon da destekliyorsa öncelik istasyonda


async def test_olay_yeniden_degerlendirme_siler_degistirmez_kullanici_dogrulamaliya_dokunmaz(user_client, factory):
    gid = await seed(user_client, factory)
    async with factory() as s:
        lat, lng = (await s.execute(text("SELECT ST_Y(ST_Centroid(geom)), ST_X(ST_Centroid(geom)) FROM gardens WHERE id = :g"), {"g": gid})).one()
        sid = f"T{uuid.uuid4().hex[:8]}"
        await s.execute(text("DELETE FROM station_daily"))  # paylaşılan test veritabanında önceki testlerin kalıntı istasyonları en yakın 3'ü doldurmasın
        await s.execute(text("DELETE FROM stations"))
        await s.execute(text("INSERT INTO stations (id, saglayici, ad, lat, lng, yukseklik, gozlem_baslangic, gozlem_bitis) VALUES (:i, 'meteostat', 'Test istasyonu', :la, :lo, 3, '2020-01-01', '2026-01-01')"), {"i": sid, "la": lat + 0.05, "lo": lng})
        for gun, tmin in ((date(2023, 12, 5), 2.2), (date(2023, 12, 6), 0.7), (date(2025, 2, 22), 2.2), (date(2025, 2, 23), 0.7), (date(2024, 1, 10), -0.5), (date(2024, 1, 11), -0.2)):
            await s.execute(text("INSERT INTO station_daily (istasyon_id, tarih, tmin, prcp) VALUES (:i, :t, :m, 0)"), {"i": sid, "t": gun, "m": tmin})
        await _olay(s, gid, "don:2023-12-05", date(2023, 12, 5), date(2023, 12, 6), -3.7)  # istasyon min 0,7, kamu kaydı yok → model sapması olası
        await _olay(s, gid, "don:2025-02-22", date(2025, 2, 22), date(2025, 2, 23), -3.7)  # aynı istasyon değeri ama Şubat 2025 il düzeyi kamu kaydı → olay KORUNUR
        await _olay(s, gid, "don:2024-01-10", date(2024, 1, 10), date(2024, 1, 11), -2.0)  # istasyon −0,5 → destekliyor
        await _olay(s, gid, "don:2022-03-13", date(2022, 3, 13), date(2022, 3, 14), -1.0)  # istasyon verisi yok → kanıt yok
        await _olay(s, gid, "don:2019-01-05", date(2019, 1, 5), date(2019, 1, 6), -4.0)  # kullanıcı doğruladı → dokunulmaz
        await s.execute(text("INSERT INTO event_verifications (id, garden_id, hedef_tur, hedef_anahtar, baslik, tur_grubu, turler, baslangic, bitis, durum_anlik, sonuc) VALUES (:i, :g, 'olay', 'don:2019-01-05', 'Don', 'don', CAST('[]' AS jsonb), '2019-01-05', '2019-01-06', 'olay', 'gerceklesti')"), {"i": uuid.uuid4(), "g": gid})
        sonuc = await olay_yd.yeniden_degerlendir(s, gid, KURAL)
        await s.commit()
    yeni = {x["anahtar"]: x["yeni"] for x in sonuc["satirlar"]}
    assert yeni["don:2023-12-05"] == "model_sapmasi_olasi" and yeni["don:2024-01-10"] == "istasyon_destekliyor" and yeni["don:2022-03-13"] == "kanit_yok"
    assert yeni["don:2025-02-22"] in ("dis_kayit_destekliyor", "model_sapmasi_olasi")  # kamu kaydı bahçenin ilinde geçerliyse korunur (test bahçesinin ili katalogla eşleşir)
    assert sonuc["atlanan_kullanici_dogrulamali"] == 1 and all(x["sapma_duzeltmesi"] == "uygulanmadı" for x in sonuc["satirlar"])
    async with factory() as s:
        n = (await s.execute(text("SELECT count(*) FROM events WHERE garden_id = :g AND tur = 'don'"), {"g": gid})).scalar()
        assert n == 5  # olay silinmedi
        assert (await s.execute(text("SELECT count(*) FROM olay_yeniden_degerlendirme WHERE garden_id = :g AND anahtar = 'don:2019-01-05'"), {"g": gid})).scalar() == 0
    r = (await user_client.get(f"/gardens/{gid}/olaylar")).json()
    don = {o["tur_adi"] + o["baslangic"]: o for o in r["olaylar"] if o["tur"] == "don"}
    isaretli = [o for o in don.values() if o["yeniden_degerlendirme"] is not None]
    assert len(isaretli) == 4 and all(o["yeniden_degerlendirme"]["yeniden_degerlendirildi"] for o in isaretli)
    assert GEOMETRY is not None
