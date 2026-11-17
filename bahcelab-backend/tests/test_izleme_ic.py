"""9J Dilim 2 iç izleme uç noktaları (/ic/izleme/*): yalnız iç ekip; seriler gerçek anlık görüntülerden; güven etiketi kullanıcı ekranlarıyla AYNI servisten."""

from datetime import date, timedelta

from sqlalchemy import text

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.izleme import guven, isler

from .test_irrigation_panel import kur
from .test_water_api import TODAY, factory, user_client  # noqa: F401

YOLLAR = ["/ic/izleme/akislar", "/ic/izleme/uyum", "/ic/izleme/kurallar", "/ic/izleme/bahceler", "/ic/izleme/don-uyari"]


async def test_yalniz_ic_ekip(user_client, monkeypatch):  # noqa: F811
    me = (await user_client.get("/auth/me")).json()
    monkeypatch.setattr(get_settings(), "internal_emails", "")
    for y in YOLLAR:
        assert (await user_client.get(y)).status_code == 403
    monkeypatch.setattr(get_settings(), "internal_emails", me["email"])
    for y in YOLLAR:
        assert (await user_client.get(y)).status_code == 200


async def test_akis_uyum_kural_ve_bahce_guveni(user_client, factory, monkeypatch):  # noqa: F811
    gid = await kur(user_client, factory)
    me = (await user_client.get("/auth/me")).json()
    monkeypatch.setattr(get_settings(), "internal_emails", me["email"])
    await isler.gunluk(factory, TODAY)
    await isler.haftalik(factory, TODAY, agdan=False)

    a = (await user_client.get("/ic/izleme/akislar")).json()
    assert len(a["guncel"]) == 11 and {x["durum"] for x in a["guncel"]} <= {"taze", "gecikmeli", "kopuk", "bos"}
    assert {z["akis"] for z in a["zaman"]} == {x["akis"] for x in a["guncel"]} and all(z["tarih"] == TODAY.isoformat() for z in a["zaman"])

    u = (await user_client.get("/ic/izleme/uyum")).json()
    k = {s["kontrol"]: s for s in u["seriler"] if s["garden_id"] == str(gid)}
    assert k["era5_imerg_aylik"]["son_durum"] == "yetersiz" and k["olcer_era5"]["noktalar"][0]["deger"] is None  # veri yok: uydurulmaz

    r = (await user_client.get("/ic/izleme/kurallar")).json()
    assert {o["kural"] for o in r["ozet"]} >= {"sistem_kontrol", "don"} and all(o["durum"] in ("olculuyor", "olculemiyor") for o in r["ozet"])

    b = (await user_client.get("/ic/izleme/bahceler")).json()
    assert b["toplam_bahce"] == 1 and sum(b["dagilim"].values()) == 1
    # tek güven servisi: iç ekran etiketi, doğrudan guven.topla çıktısıyla birebir aynı (ayrı eşik/hesap yok)
    async with factory() as s:
        g = await guven.topla(s, gid, b["bugun"] and date.fromisoformat(b["bugun"]), "durum", agac_beyan=True)
    assert b["en_dusuk"][0]["etiket"] == g.etiket and b["en_dusuk"][0]["nedeni"] == g.nedeni
    async with factory() as s:
        assert (await s.execute(text("SELECT count(*) FROM izleme_akis WHERE tarih = :t"), {"t": TODAY})).scalar() == 11


def test_wilson_aralik_kucuk_orneklem_ve_bos():
    from bahcelab_backend.domain.izleme.don_uyari import wilson

    assert wilson(0, 0)["oran"] is None
    w = wilson(7, 11)  # 7/11 ≈ 0,64
    assert w["oran"] == 0.636 and 0.35 < w["alt"] < 0.40 and 0.84 < w["ust"] < 0.90
    assert wilson(0, 5)["alt"] == 0.0 and wilson(5, 5)["ust"] == 1.0  # uçlarda aralık sınır içinde


async def test_don_uyari_ayrinti_gece_gece_birikimli_far_pod_ve_adr_referansi(user_client, factory, monkeypatch):  # noqa: F811
    gid = await kur(user_client, factory)
    me = (await user_client.get("/auth/me")).json()
    monkeypatch.setattr(get_settings(), "internal_emails", me["email"])
    d0 = date(2026, 10, 1)
    async with factory() as s:
        lat, lng = (await s.execute(text("SELECT ST_Y(ST_Centroid(geom)), ST_X(ST_Centroid(geom)) FROM gardens WHERE id = :g"), {"g": gid})).one()
        await s.execute(text("DELETE FROM station_daily"))
        await s.execute(text("DELETE FROM stations"))
        await s.execute(text("INSERT INTO stations (id, saglayici, ad, lat, lng, yukseklik, gozlem_baslangic, gozlem_bitis) VALUES ('TST1', 'meteostat', 'Test istasyonu', :la, :lo, 3, '2020-01-01', '2099-01-01')"), {"la": lat + 0.05, "lo": lng})
        # 5 uyarı gecesi: yanıtlar oldu, olmadı ×3, bilmiyorum; istasyon: 1. gece don (−0,5), 2. gece 2,0 (yanlış alarm); 6. gece izle (istasyon don = kaçırılmış değil: uyarı yoktu)
        for i, (sev, yanit, tmin) in enumerate([("uyari", "oldu", -0.5), ("uyari", "olmadi", 2.0), ("uyari", "olmadi", None), ("uyari", "olmadi", None), ("uyari", "bilmiyorum", None), ("izle", None, -1.0)]):
            gece = d0 + timedelta(days=i)
            await s.execute(text("INSERT INTO don_risk (garden_id, gece, kritik_c, evre, organlar, en_soguk_c, tmin_model, uzlasi, saat_kritik_alti, seviye, olasilik, neden, kural_surum) VALUES (:g, :n, -0.8, 'olgunlasma', CAST('[\"olgun_meyve\"]' AS jsonb), -1.0, CAST('{}' AS jsonb), 2, 0, :s, 0.5, 'x', 'don-1')"), {"g": gid, "n": gece, "s": sev})
            if yanit:
                await s.execute(text("INSERT INTO don_geri_bildirim (garden_id, gece, yanit) VALUES (:g, :n, :y)"), {"g": gid, "n": gece, "y": yanit})
            if tmin is not None:
                await s.execute(text("INSERT INTO station_daily (istasyon_id, tarih, tmin, prcp) VALUES ('TST1', :t, :m, 0)"), {"t": gece + timedelta(days=1), "m": tmin})
        await s.commit()
    j = (await user_client.get("/ic/izleme/don-uyari")).json()
    assert j["referans"]["far"] == 0.64 and j["referans"]["pod"] == 0.846 and "ADR 0031" in j["referans"]["kaynak"]
    ku = j["kullanici"]
    assert ku["uyari_gece"] == 5 and ku["oldu"] == 1 and ku["olmadi"] == 3 and ku["bilmiyorum"] == 1 and ku["far"]["k"] == 3 and ku["far"]["n"] == 4 and ku["far"]["oran"] == 0.75
    assert ku["far"]["alt"] < 0.75 < ku["far"]["ust"] and ku["far"]["yeterli"] is False  # n=4 < min yanıt (5): «yetersiz» (uydurma yok)
    ist = j["istasyon"]
    assert ist["gozlemli_gece"] == 3 and ist["don_gecesi"] == 2 and ist["uyari_gozlemli"] == 2
    assert ist["far"]["k"] == 1 and ist["far"]["n"] == 2  # uyarılı iki gözlemli geceden biri don değildi
    assert ist["pod"]["k"] == 1 and ist["pod"]["n"] == 2  # 2 don gecesinden yalnız 1'inde uyarı vardı (6. gece yalnız «izle»)
    assert [g["kademe"] for g in j["geceler"]][:2] == ["izle", "uyarı"]  # yeniden eskiye
    g1 = next(g for g in j["geceler"] if g["gece"] == (d0).isoformat())
    assert g1["istasyon"] == {"ad": "Test istasyonu", "mesafe_km": g1["istasyon"]["mesafe_km"], "tmin_c": -0.5} and g1["yanit"] == "oldu" and g1["kritik_c"] == -0.8 and g1["en_soguk_c"] == -1.0
    assert next(g for g in j["geceler"] if g["gece"] == (d0 + timedelta(days=2)).isoformat())["istasyon"] is None  # gözlem yoksa istasyon alanı boş
