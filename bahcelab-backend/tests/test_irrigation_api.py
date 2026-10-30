# ruff: noqa: F811
"""Sulama planı API'si (ADR 0023): profil, plan, sezon, senaryolar. Gerçek tablolar, ağsız; ERA5/toprak tohumlanır."""

import uuid
from datetime import timedelta

import pytest
from sqlalchemy import text

from .test_water_api import TODAY, factory, seed, user_client  # noqa: F401, F811

PROFIL = {"sistem": "damla", "damlatici_sayisi": 4, "damlatici_debi_lh": 4.0, "sira_aralik_m": 6.0, "agac_aralik_m": 4.0, "pompa_kw": 7.5, "pompa_debi_m3h": 40.0, "enerji": "sebeke"}


async def add_ndvi(factory, gid: uuid.UUID, ndvi: float = 0.7) -> None:
    async with factory() as session:
        aid = uuid.uuid4()
        await session.execute(
            text("INSERT INTO acquisitions (id, garden_id, source_id, scene_id, tarih, durum) VALUES (:i, :g, 'sentinel2-l2a', :s, :d, 'net')"),
            {"i": aid, "g": gid, "s": f"S2_{aid}", "d": TODAY - timedelta(days=5)},
        )
        await session.execute(
            text("INSERT INTO acquisition_stats (acquisition_id, indeks, ortalama, medyan, p10, p25, p75, p90, minimum, maksimum, gecerli_piksel) VALUES (:i, 'ndvi', :v, :v, :v, :v, :v, :v, :v, :v, 100)"),
            {"i": aid, "v": ndvi},
        )
        await session.commit()


async def test_plan_without_profile_says_so(user_client, factory):
    gid = await seed(user_client, factory)
    body = (await user_client.get(f"/gardens/{gid}/sulama-plani")).json()
    assert body["durum"] == "profil_yok" and body["gunler"] == [] and body["neden"]
    prof = (await user_client.get(f"/gardens/{gid}/sulama-profili")).json()
    assert prof["profil"] is None and prof["tarife"]["guncel"] is False and "faturanızdaki" in prof["tarife"]["mesaj"] and prof["fiyat_kaynagi"] == "yok"


async def test_profile_roundtrip_and_validation(user_client, factory):
    gid = await seed(user_client, factory)
    r = await user_client.put(f"/gardens/{gid}/sulama-profili", json=PROFIL)
    assert r.status_code == 200 and r.json()["profil"]["damlatici_debi_lh"] == 4.0
    assert (await user_client.put(f"/gardens/{gid}/sulama-profili", json={**PROFIL, "sistem": "bilinmeyen"})).status_code == 422
    assert (await user_client.put(f"/gardens/{gid}/sulama-profili", json={**PROFIL, "damlatici_debi_lh": -1})).status_code == 422
    assert (await user_client.put(f"/gardens/{uuid.uuid4()}/sulama-profili", json=PROFIL)).status_code == 404


async def test_plan_without_satellite_cover_is_veri_yok_not_a_guess(user_client, factory):
    gid = await seed(user_client, factory)
    await user_client.put(f"/gardens/{gid}/sulama-profili", json=PROFIL)
    body = (await user_client.get(f"/gardens/{gid}/sulama-plani")).json()
    assert body["durum"] == "veri_yok" and "Sentinel-2" in body["neden"]


async def test_plan_has_bucket_irrigation_tree_liters_and_untariffed_cost(user_client, factory):
    gid = await seed(user_client, factory)
    await add_ndvi(factory, gid)
    await user_client.put(f"/gardens/{gid}/sulama-profili", json=PROFIL)
    body = (await user_client.get(f"/gardens/{gid}/sulama-plani")).json()
    assert body["durum"] == "hazir" and body["on_deger"] is True and body["katalog_surum"] >= 2
    assert body["taw_mm"] == pytest.approx((0.32 - 0.17) * 800) and body["raw_mm"] == pytest.approx(0.5 * body["taw_mm"]) and 0 < body["orten_yuzde"] <= 100
    assert body["sistem_verimi"] == 0.9
    assert len(body["gunler"]) == 30 + 10 and body["gunler"][-1]["tarih"] == str(TODAY + timedelta(days=10)) or body["gunler"][-1]["tahmin"]
    for s in body["sulamalar"]:
        assert s["brut_mm"] == pytest.approx(s["net_mm"] / 0.9)
        # ağaç sayısı beyan edilmediği için ağaç başına değerler YOK
        assert s["litre_agac"] is None and s["emitor_dakika"] is None
    assert any(u["kod"] == "agac_sayisi_yok" for u in body["uyarilar"])
    # tarife doğrulanmadığı için TL uydurulmaz
    m = body["hafta_maliyet"]
    assert m["toplam_tl"] is None and m["fiyat_kaynagi"] == "yok" and m["kwh"] is not None
    pj = body["projeksiyon"]
    assert pj["yil_sayisi"] >= 10 and pj["m3"]["alt"] <= pj["m3"]["orta"] <= pj["m3"]["ust"] and pj["tl"] is None
    assert any("FAO-56" in k["ad"] for k in body["kaynaklar"])


async def test_user_price_gives_tl_labelled_as_user_price(user_client, factory):
    gid = await seed(user_client, factory)
    await add_ndvi(factory, gid)
    await user_client.put(f"/gardens/{gid}/sulama-profili", json={**PROFIL, "kwh_fiyat_tl": 2.5, "su_ucreti_m3_tl": 0.4})
    body = (await user_client.get(f"/gardens/{gid}/sulama-plani")).json()
    assert body["hafta_maliyet"]["fiyat_kaynagi"] == "kullanici"
    assert body["projeksiyon"]["tl"]["alt"] <= body["projeksiyon"]["tl"]["ust"]


async def test_tree_count_declared_gives_per_tree_liters_and_consistency_warning(user_client, factory):
    gid = await seed(user_client, factory)
    await add_ndvi(factory, gid)
    async with factory() as s:
        await s.execute(text("UPDATE gardens SET agac_sayisi = 5000 WHERE id = :g"), {"g": gid})  # alan ≈ 90 dönüm; 6×4 m aralıkta ≈ 3700 ağaç
        await s.commit()
    await user_client.put(f"/gardens/{gid}/sulama-profili", json=PROFIL)
    body = (await user_client.get(f"/gardens/{gid}/sulama-plani")).json()
    assert any(u["kod"] == "agac_sayisi" for u in body["uyarilar"])
    prof = (await user_client.get(f"/gardens/{gid}/sulama-profili")).json()
    assert prof["agac_kontrol"]["tutarli"] is False and prof["agac_kontrol"]["beklenen"] > 0
    if body["sulamalar"]:
        s0 = body["sulamalar"][0]
        assert s0["litre_agac"] == pytest.approx(s0["brut_mm"] * prof["alan_m2"] / 5000) and s0["emitor_dakika"] > 0


async def test_field_book_irrigation_enters_the_bucket(user_client, factory):
    gid = await seed(user_client, factory)
    await add_ndvi(factory, gid)
    await user_client.put(f"/gardens/{gid}/sulama-profili", json=PROFIL)
    r = await user_client.post(f"/gardens/{gid}/saha-kayitlari", json={"tur": "sulama", "tarih": str(TODAY - timedelta(days=2)), "ayrinti": {"m3": 150}})
    assert r.status_code in (200, 201), r.text
    await user_client.post(f"/gardens/{gid}/saha-kayitlari", json={"tur": "sulama", "tarih": str(TODAY - timedelta(days=1))})  # miktarsız: sayılmaz, söylenir
    body = (await user_client.get(f"/gardens/{gid}/sulama-plani")).json()
    assert body["uygulanan_kayit_sayisi"] == 2 and body["uygulanan_sezon_m3"] == pytest.approx(150.0)
    assert any(u["kod"] == "miktarsiz_kayit" for u in body["uyarilar"])
    day = next(g for g in body["gunler"] if g["tarih"] == str(TODAY - timedelta(days=2)))
    assert day["uygulanan_net_mm"] > 0


async def test_season_replays_a_past_year_with_its_own_weather(user_client, factory):
    gid = await seed(user_client, factory)
    await add_ndvi(factory, gid)
    await user_client.put(f"/gardens/{gid}/sulama-profili", json=PROFIL)
    y = TODAY.year - 2
    body = (await user_client.get(f"/gardens/{gid}/sulama-sezon", params={"yil": y})).json()
    assert body["yil"] == y and body["gunler"][0]["tarih"] == f"{y}-04-01" and body["gunler"][-1]["tarih"] == f"{y}-10-31"
    assert body["toplam_m3"] == pytest.approx(body["gunler"][-1]["kumulatif_m3"]) and body["tahmin_dahil"] is False
    cum = [g["kumulatif_m3"] for g in body["gunler"]]
    assert cum == sorted(cum)


async def test_scenarios_all_four_with_real_weather_and_locked_periods(user_client, factory):
    gid = await seed(user_client, factory)
    await add_ndvi(factory, gid)
    async with factory() as s:
        await s.execute(text("UPDATE gardens SET agac_sayisi = 3700 WHERE id = :g"), {"g": gid})
        await s.commit()
    await user_client.put(f"/gardens/{gid}/sulama-profili", json={**PROFIL, "kwh_fiyat_tl": 2.0})
    y = TODAY.year - 1
    body = (await user_client.get(f"/gardens/{gid}/sulama-senaryolar", params={"yil": y, "gunler": "0,3", "saat": 4, "hedef": "salma", "yatirim_tl": 100000})).json()
    assert body["durum"] == "hazir"
    a = body["aliskanlik"]
    assert a["yil"] == y and a["fark_m3"] == pytest.approx(a["aliskanlik"]["m3"] - a["plan"]["m3"])
    k = body["kuru_islak"]
    assert len(k["yillar"]) >= 9 and k["secili"]["yil"] == y and k["fark_m3"] is not None
    d = body["kisinti"]
    assert d["varsayilan_plan"] is False and d["uygulanabilir"] is True and d["tasarruf_m3"] >= 0 and d["verim_riski"] == "dusuk"
    assert {x["kod"] for x in d["kilitli_donemler"]} == {"ciceklenme_tutum", "hizli_meyve_buyumesi"} and all(x["mesaj"] == "Bu dönemde önerilmez." for x in d["kilitli_donemler"])
    s = body["sistem"]
    assert s["hedef"] == "salma" and s["fark_m3"] > 0  # damla → salma daha fazla su (verim 0,55 < 0,90)
    assert s["fark_tl"] > 0 and s["geri_odeme_sezon"] is None  # kötüleşme: geri ödeme yok


async def test_scenarios_habit_needs_drip_info_and_tree_count(user_client, factory):
    gid = await seed(user_client, factory)
    await add_ndvi(factory, gid)
    await user_client.put(f"/gardens/{gid}/sulama-profili", json=PROFIL)  # ağaç sayısı yok
    body = (await user_client.get(f"/gardens/{gid}/sulama-senaryolar", params={"gunler": "0,3", "saat": 4})).json()
    assert body["durum"] == "hazir" and body["aliskanlik"] is None  # ağaç sayısı yok: süre → mm çevrilemez, uydurulmaz


async def test_scenarios_without_profile(user_client, factory):
    gid = await seed(user_client, factory)
    assert (await user_client.get(f"/gardens/{gid}/sulama-senaryolar")).json()["durum"] == "profil_yok"
