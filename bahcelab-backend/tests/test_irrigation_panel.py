# ruff: noqa: F811
"""Sulama paneli (9H-S4 dilim 1): vana sektörleri, panel, vardiya, onay/işle, simülasyon, güven; Bugün/Su/KPI aynı kovadan."""

import uuid
from datetime import timedelta

import pytest
from sqlalchemy import text

from bahcelab_backend.domain.irrigation.service import IrrigationService

from .test_irrigation_api import PROFIL, add_ndvi, add_ndvi_series  # noqa: F401
from .test_water_api import GEOMETRY, TODAY, factory, seed, user_client  # noqa: F401

RING = GEOMETRY["coordinates"][0]
XS = [min(p[0] for p in RING), max(p[0] for p in RING)]
YS = [min(p[1] for p in RING), max(p[1] for p in RING)]
XM = (XS[0] + XS[1]) / 2


def kutu(x0: float, x1: float, y0: float = YS[0], y1: float = YS[1]) -> dict:
    return {"type": "Polygon", "coordinates": [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]}


async def kur(client, factory, *, agac: int | None = 800, profil: dict | None = None) -> uuid.UUID:
    gid = await seed(client, factory)
    await add_ndvi(factory, gid)
    if agac:
        async with factory() as s:
            await s.execute(text("UPDATE gardens SET agac_sayisi = :n WHERE id = :g"), {"n": agac, "g": gid})
            await s.commit()
    assert (await client.put(f"/gardens/{gid}/sulama-profili", json=profil or PROFIL)).status_code == 200
    return gid


IKI = {"sektorler": [{"ad": "V1", "geometry": kutu(XS[0], XM), "vana_debi_m3h": 30}, {"ad": "V2", "geometry": kutu(XM, XS[1]), "vana_debi_m3h": 30}]}


async def test_sektorler_dogrulama_ve_tek_sektor_varsayilani(user_client, factory):
    gid = await kur(user_client, factory)
    bos = (await user_client.get(f"/gardens/{gid}/sulama-sektorleri")).json()
    assert bos["tanimli"] is False and [s["ad"] for s in bos["sektorler"]] == ["Bahçe"] and bos["sektorler"][0]["agac_kaynak"] == "beyan" and bos["sektorler"][0]["id"] is None
    ok = await user_client.put(f"/gardens/{gid}/sulama-sektorleri", json=IKI)
    assert ok.status_code == 200 and ok.json()["tanimli"] is True
    seks = ok.json()["sektorler"]
    assert [s["ad"] for s in seks] == ["V1", "V2"] and all(s["agac_kaynak"] == "orantili" for s in seks) and abs(sum(s["agac_sayisi"] for s in seks) - 800) <= 2
    assert abs(seks[0]["alan_m2"] - seks[1]["alan_m2"]) < 0.02 * seks[0]["alan_m2"]
    # binen sektörler, dışarı taşan sektör, tekrar eden ad reddedilir
    assert (await user_client.put(f"/gardens/{gid}/sulama-sektorleri", json={"sektorler": [{"ad": "A", "geometry": kutu(XS[0], XM + 0.0005)}, {"ad": "B", "geometry": kutu(XM, XS[1])}]})).status_code == 422
    assert (await user_client.put(f"/gardens/{gid}/sulama-sektorleri", json={"sektorler": [{"ad": "A", "geometry": kutu(XS[0], XS[1] + 0.01)}]})).status_code == 422
    assert (await user_client.put(f"/gardens/{gid}/sulama-sektorleri", json={"sektorler": [{"ad": "A", "geometry": kutu(XS[0], XM)}, {"ad": "A", "geometry": kutu(XM, XS[1])}]})).status_code == 422
    assert (await user_client.get(f"/gardens/{gid}/sulama-sektorleri")).json()["tanimli"] is True  # hatalı istek eskisini bozmaz
    sil = await user_client.put(f"/gardens/{gid}/sulama-sektorleri", json={"sektorler": []})
    assert sil.json()["tanimli"] is False


async def test_panel_tek_sektor_kpi_hafta_guven(user_client, factory):
    gid = await kur(user_client, factory)
    p = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()
    assert p["durum"] == "hazir" and p["sektor_tanimli"] is False and len(p["sektorler"]) == 1 and p["sektorler"][0]["ad"] == "Bahçe"
    s = p["sektorler"][0]
    assert len(s["gunler"]) == 14 + 1 + 7 and s["etiket"] in ("stres", "yakin", "yeterli", "dolu") and 0 <= s["doluluk_pct"] <= 100
    assert len(p["hafta"]) == 7 and p["hafta"][0]["tarih"] == str(TODAY) and p["tetik_pct"] == pytest.approx(60.0, abs=0.01)  # damla tetiği: %60 kullanılabilir su
    assert p["kpi"]["ihtiyac_renk"] in ("yesil", "sari", "kirmizi") and 0 <= p["kpi"]["ihtiyac_karsilandi_pct"] <= 100
    assert p["en_dusuk"]["ad"] == "Bahçe"
    # güven: uydu taze, hava taze, ağaç beyanlı, damlatıcı tam, pompa tam → yüksek
    assert p["guven"]["etiket"] == "yuksek" and p["guven"]["puan"] == 5


async def test_guven_eksik_beyanla_duser(user_client, factory):
    gid = await kur(user_client, factory, agac=None, profil={**PROFIL, "pompa_kw": None, "pompa_debi_m3h": None})
    g = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()["guven"]
    assert g["puan"] == 3 and g["etiket"] == "orta" and [k["ad"] for k in g["kosullar"] if not k["ok"]] == ["Ağaç sayısı beyan edilmiş", "Pompa bilgisi tam"]


async def test_bugun_su_karti_kpi_vardiya_ayni_kovadan_ve_ayni_gun(user_client, factory):
    """Panel (KPI, vardiya, vana etiketi), plan (Su kartı) ve Su kararı AYNI sonraki sulama gününü söyler; farklı «bugün»lerde ve tanımlı vanalarla."""
    from bahcelab_backend.domain.water.service import WaterService

    gid = await seed(user_client, factory)
    await add_ndvi_series(factory, gid, [TODAY - timedelta(days=k) for k in range(0, 400, 20)])
    await user_client.put(f"/gardens/{gid}/sulama-profili", json=PROFIL)
    await user_client.put(f"/gardens/{gid}/sulama-sektorleri", json=IKI)
    async with factory() as session:
        ws = (await session.execute(text("SELECT workspace_id FROM gardens WHERE id = :g"), {"g": gid})).scalar_one()
        var = 0
        for k in range(0, 300, 11):
            d = TODAY - timedelta(days=k)
            svc = IrrigationService(session, ws, d)
            panel = await svc.panel(gid)
            plan = await svc.plan(gid, hafif=True)
            su = await WaterService(session, ws).su(gid, d)
            assert panel.durum == "hazir"
            sonraki = panel.kpi.sonraki
            assert (sonraki.tarih if sonraki else None) == (plan.sonraki.tarih if plan.sonraki else None), (d,)
            if sonraki:
                var += 1
                assert panel.vardiya.tarih == sonraki.tarih  # çizelgedeki gün = «sonraki sulama»
                assert sorted(sonraki.vanalar) == sorted(k_.sektor for k_ in panel.vardiya.kalemler)
                assert min(s.sonraki_sulama for s in panel.sektorler if s.sonraki_sulama) == sonraki.tarih
            assert (su.karar_detay.durum == "sulama") == (sonraki is not None and (sonraki.tarih - d).days <= 7), (d,)
            for s in panel.sektorler:  # harita etiketi / KPI: bugünkü % tüm yerlerde aynı kovanın sayısı
                bugun = next(x for x in s.gunler if x.tarih == d)
                assert bugun.doluluk_pct == pytest.approx(s.doluluk_pct)
        assert var >= 3


async def test_vardiya_pompa_debisinden_saat_ve_sira(user_client, factory):
    gid = await kur(user_client, factory)
    await user_client.put(f"/gardens/{gid}/sulama-sektorleri", json=IKI)
    p = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()
    v = p["vardiya"]
    assert v is not None and v["baslangic"] == "05:00" and len(v["kalemler"]) == 2
    k1, k2 = v["kalemler"]
    assert k1["baslangic"] == "05:00" and k1["sure_dk"] == round(k1["m3"] / 30 * 60)  # vana debisi (30) pompadan (40) küçük → o geçerli
    assert k2["baslangic"] == k1["bitis"]  # vanalar art arda
    assert k1["litre_agac"] is not None and k1["emitor_dakika"] > 0
    # debi yoksa saat uydurulmaz
    gid2 = await kur(user_client, factory, profil={**PROFIL, "pompa_kw": None, "pompa_debi_m3h": None})
    v2 = (await user_client.get(f"/gardens/{gid2}/sulama-panel")).json()["vardiya"]
    assert v2["kalemler"][0]["baslangic"] is None and v2["kalemler"][0]["sure_dk"] is None and "hesaplanamıyor" in v2["zaman_notu"]


async def test_onayla_ve_isle_sahaya_yazar_ve_kovaya_girer(user_client, factory):
    gid = await kur(user_client, factory)
    p = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()
    gun = p["vardiya"]["tarih"]
    assert p["onayli_tarih"] is None
    onay = (await user_client.post(f"/gardens/{gid}/sulama-onay", json={"tarih": gun})).json()
    assert onay["onayli_tarih"] == gun and onay["vardiya"]["onayli"] is True
    assert (await user_client.post(f"/gardens/{gid}/sulama-onay", json={"tarih": str(TODAY - timedelta(days=40))})).status_code == 409
    assert (await user_client.post(f"/gardens/{gid}/sulama-isle", json={"tarih": gun})).json() == {"yazilan": 1}
    # işlenen sulama kovaya girdi: o günün programı artık «yapıldı», ikinci işleme kayıt eklemez
    assert (await user_client.post(f"/gardens/{gid}/sulama-isle", json={"tarih": gun})).status_code == 409
    kayitlar = (await user_client.get(f"/gardens/{gid}/saha-kayitlari")).json()["kayitlar"]
    sul = [k for k in kayitlar if k["tur"] == "sulama"]
    assert len(sul) == 1 and sul[0]["ayrinti"]["sektor"] == "Bahçe" and sul[0]["ayrinti"]["m3"] > 0 and sul[0]["ayrinti"]["kaynak"] == "plan"


async def test_vana_kaydi_yalniz_o_vanayi_etkiler(user_client, factory):
    gid = await kur(user_client, factory)
    await user_client.put(f"/gardens/{gid}/sulama-sektorleri", json=IKI)
    gun = str(TODAY - timedelta(days=2))
    assert (await user_client.post(f"/gardens/{gid}/saha-kayitlari", json={"tur": "sulama", "tarih": gun, "ayrinti": {"m3": 60, "sektor": "V1"}})).status_code == 201
    p = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()
    v1, v2 = p["sektorler"]
    g1 = next(x for x in v1["gunler"] if x["tarih"] == gun)
    g2 = next(x for x in v2["gunler"] if x["tarih"] == gun)
    assert g1["uygulandi"] is True and g2["uygulandi"] is False and g1["net_mm"] > 0 and g2["net_mm"] == 0


async def test_simulasyon_yillar_mod_sistem_kisinti(user_client, factory):
    gid = await kur(user_client, factory)
    s = (await user_client.get(f"/gardens/{gid}/sulama-simulasyon")).json()
    assert s["durum"] == "hazir" and {y["tip"] for y in s["yillar"] if y["tip"]} == {"kuru", "normal", "islak"}
    kuru = next(y["yil"] for y in s["yillar"] if y["tip"] == "kuru")
    islak = next(y["yil"] for y in s["yillar"] if y["tip"] == "islak")
    assert next(y for y in s["yillar"] if y["yil"] == kuru)["yagis_mm"] <= next(y for y in s["yillar"] if y["yil"] == islak)["yagis_mm"]
    assert s["sayac"]["m3"] > 0 and s["sayac"]["kwh"] > 0 and s["sayac"]["tl"] is None and s["sayac"]["fiyat_kaynagi"] == "yok" and len(s["gunler"]) > 150
    assert len(s["sektorler"][0]["doluluk_pct"]) == len(s["gunler"])
    # kWh fiyatı verilince TL
    t = (await user_client.get(f"/gardens/{gid}/sulama-simulasyon", params={"kwh_fiyat": 2.0})).json()["sayac"]
    assert t["tl"] == pytest.approx(t["kwh"] * 2.0) and t["fiyat_kaynagi"] == "kullanici"
    # damla → salma: daha çok su; kısıntı: daha az
    salma = (await user_client.get(f"/gardens/{gid}/sulama-simulasyon", params={"sistem": "salma"})).json()
    assert salma["sayac"]["m3"] > s["sayac"]["m3"] and salma["sistem"] == "salma"
    ks = (await user_client.get(f"/gardens/{gid}/sulama-simulasyon", params={"kisinti": "true"})).json()
    assert ks["sayac"]["m3"] < s["sayac"]["m3"] and ks["kisinti_uygulandi"] is True and {d["kod"] for d in ks["kilitli_donemler"]} == {"ciceklenme_tutum", "hizli_meyve_buyumesi"}
    assert (await user_client.get(f"/gardens/{gid}/sulama-simulasyon", params={"sistem": "bilinmiyor"})).status_code == 422
    assert s["vardiyalar"] and all(v["kalemler"] for v in s["vardiyalar"])


async def test_aliskanlik_kayittan_ogrenilir_yoksa_neden_soylenir(user_client, factory):
    gid = await kur(user_client, factory)
    bos = (await user_client.get(f"/gardens/{gid}/sulama-simulasyon", params={"mod": "aliskanlik"})).json()
    assert bos["aliskanlik"] is None and "en az 4 sulama günü" in bos["aliskanlik_neden"] and bos["karsilastirma"] is None and bos["mod"] == "plan"
    elle = (await user_client.get(f"/gardens/{gid}/sulama-simulasyon", params={"mod": "aliskanlik", "gunler": "0,3", "saat": 4})).json()
    assert elle["aliskanlik"]["kaynak"] == "elle" and elle["karsilastirma_cumle"].startswith(f"{elle['yil']} havasında alışkanlığınız plana göre")
    for k in range(5):  # 5 sulama günü kaydı → alışkanlık Saha Defteri'nden
        await user_client.post(f"/gardens/{gid}/saha-kayitlari", json={"tur": "sulama", "tarih": str(TODAY - timedelta(days=7 * (k + 1))), "ayrinti": {"sure_dk": 240}})
    kay = (await user_client.get(f"/gardens/{gid}/sulama-simulasyon", params={"mod": "aliskanlik"})).json()
    assert kay["aliskanlik"]["kaynak"] == "kayit" and kay["aliskanlik"]["kayit_sayisi"] == 5 and kay["mod"] == "aliskanlik"
    assert set(kay["karsilastirma"]) == {"plan", "aliskanlik"} and "stres günü" in kay["karsilastirma_cumle"] and "boşa giden" in kay["karsilastirma_cumle"]


async def test_panel_profilsiz_ve_verisiz(user_client, factory):
    gid = await seed(user_client, factory)
    assert (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()["durum"] == "profil_yok"
    await user_client.put(f"/gardens/{gid}/sulama-profili", json=PROFIL)
    assert (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()["durum"] == "veri_yok"  # NDVI yok
    assert (await user_client.get(f"/gardens/{gid}/sulama-simulasyon")).json()["durum"] == "veri_yok"


async def test_vardiya_24_saati_asarsa_uyarir(user_client, factory):
    """Düşük pompa debisi: vardiya toplamı 24 saati aşar; çizelge çizilir ama neden açıkça yazılır."""
    gid = await kur(user_client, factory, profil={**PROFIL, "pompa_debi_m3h": 3.0})
    await user_client.put(f"/gardens/{gid}/sulama-sektorleri", json=IKI)
    v = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()["vardiya"]
    assert v is not None and "24 saati aşıyor" in (v["zaman_notu"] or "")
