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
    gecmis = [y for y in s["yillar"] if not y["guncel"]]
    assert len(gecmis) >= 10 and all(y["tip"] for y in gecmis) and sum(1 for y in s["yillar"] if y["guncel"]) == 1  # 2015–2025 hepsi tipli (tercil) + bu yıl
    assert max(y["yagis_mm"] for y in gecmis if y["tip"] == "kuru") <= min(y["yagis_mm"] for y in gecmis if y["tip"] == "islak")
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
    k = ks["kisinti"]  # kısıntı: su farkı DAİMA stres günü farkı ve verim riskiyle birlikte
    assert k["fark_m3"] < 0 and k["verim_riski"] in ("dusuk", "orta", "yuksek") and k["tam"]["m3"] == pytest.approx(s["sayac"]["m3"]) and k["kisintili"]["m3"] == pytest.approx(ks["sayac"]["m3"])
    assert k["fark_stres_gun"] == k["kisintili"]["stres_gun"] - k["tam"]["stres_gun"]
    assert "stres günü" in k["cumle"] and "verim riski: " in k["cumle"] and "az su" in k["cumle"]
    from bahcelab_backend.domain.agro.catalog import load_catalog
    from bahcelab_backend.domain.irrigation.engine import escalate_risk

    assert k["verim_riski"] == escalate_risk("dusuk", k["fark_stres_gun"], load_catalog().sulama_plani)  # olgunlaşma dönemi riski «düşük»; stres artışı yükseltir
    assert s["kisinti"] is None  # kısıntı kapalıyken karşılaştırma yok
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


# ---------------------------------------------------------------- ADR 0026: geçici günler, bahçe yağış ölçeri, kesinleşen veriyle plan değişikliği
def test_yagis_yanlilik_aylik_oneri_otomatik_uygulanmaz():
    from datetime import date

    from bahcelab_backend.domain.agro.catalog import load_catalog
    from bahcelab_backend.domain.water.rain_series import yanlilik_hesapla

    rule = load_catalog().sulama_plani
    gunler = [date(2026, 10, d) for d in range(1, 8)]
    seri = {d: 5.0 for d in gunler}  # Σ 35 mm
    # ölçüm seriden belirgin fazla: 7 gün × 8 = 56 → oran 1,6 → öneri 1,6
    a = yanlilik_hesapla({d: 8.0 for d in gunler}, seri, rule)[0]
    assert a.ay == "2026-10" and a.gun == 7 and a.oran == pytest.approx(1.6) and a.oneri == pytest.approx(1.6)
    # kırpma: oran 3 → üst sınır 2
    assert yanlilik_hesapla({d: 15.0 for d in gunler}, seri, rule)[0].oneri == rule.yagis_olcer_oran_ust
    # az gün (4 < 5), küçük sapma (%10), küçük seri (Σ 7 mm < 10): öneri YOK ama farkı gösterir
    assert yanlilik_hesapla({d: 8.0 for d in gunler[:4]}, seri, rule)[0].oneri is None
    assert yanlilik_hesapla({d: 5.5 for d in gunler}, seri, rule)[0].oneri is None
    assert yanlilik_hesapla({d: 2.0 for d in gunler}, {d: 1.0 for d in gunler}, rule)[0].oneri is None
    assert yanlilik_hesapla({date(2026, 10, 9): 5.0}, seri, rule) == ()  # seride günü olmayan ölçüm eşleşmez


async def test_yagis_olcumu_kaydi_dogrulanir(user_client, factory):
    gid = await seed(user_client, factory)
    ok = await user_client.post(f"/gardens/{gid}/saha-kayitlari", json={"tur": "yagis", "tarih": str(TODAY), "ayrinti": {"mm": 12.5}})
    assert ok.status_code == 201 and ok.json()["ayrinti"]["mm"] == 12.5
    for kotu in ({}, {"mm": -1}, {"mm": 900}, {"mm": "çok"}, {"mm": True}):
        assert (await user_client.post(f"/gardens/{gid}/saha-kayitlari", json={"tur": "yagis", "tarih": str(TODAY), "ayrinti": kotu})).status_code == 422
    rid = ok.json()["id"]
    assert (await user_client.patch(f"/gardens/{gid}/saha-kayitlari/{rid}", json={"ayrinti": {"mm": 9999}})).status_code == 422


async def test_panel_gecici_gunler_ve_bahce_olcumu_seriden_once_kullanilir(user_client, factory):
    gid = await kur(user_client, factory)
    p0 = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()
    # tohum: son 6 gün (bugün dahil) «model» satırı → geçici
    assert p0["gecici_gun"] == 6 and p0["gecici_ilk"] == str(TODAY - timedelta(days=5)) and p0["olculen_gun"] == 0
    gunler = {g["tarih"]: g for g in p0["sektorler"][0]["gunler"]}
    assert all(gunler[str(TODAY - timedelta(days=k))]["gecici"] for k in range(0, 6)) and not gunler[str(TODAY - timedelta(days=6))]["gecici"]
    assert "geçici" in " ".join(k["ad"] for k in p0["kaynaklar"]) and "bahçede ölçüldü" not in " ".join(k["ad"] for k in p0["kaynaklar"])
    # bahçede 30 mm ölçüldü (3 gün önce): kova bunu seriden ÖNCE kullanır (etkili = %80)
    gun = TODAY - timedelta(days=3)
    assert (await user_client.post(f"/gardens/{gid}/saha-kayitlari", json={"tur": "yagis", "tarih": str(gun), "ayrinti": {"mm": 30}})).status_code == 201
    p1 = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()
    g1 = next(g for g in p1["sektorler"][0]["gunler"] if g["tarih"] == str(gun))
    assert p1["olculen_gun"] == 1 and g1["yagis_olculdu"] is True and g1["yagis_mm"] == 30 and g1["etkili_yagis_mm"] == pytest.approx(24.0)
    assert "1 gün bahçede ölçüldü" in " ".join(k["ad"] for k in p1["kaynaklar"])
    assert len(p1["yagis_yanlilik"]) == 1 and p1["yagis_yanlilik"][0]["gun"] == 1 and p1["yagis_yanlilik"][0]["oneri"] is None  # tek gün: öneri yok
    # aynı gün ikinci kayıt: EN SON girilen sayılır (çift sayım yok)
    await user_client.post(f"/gardens/{gid}/saha-kayitlari", json={"tur": "yagis", "tarih": str(gun), "ayrinti": {"mm": 10}})
    g2 = next(g for g in (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()["sektorler"][0]["gunler"] if g["tarih"] == str(gun))
    assert g2["yagis_mm"] == 10


async def test_kesinlesen_veri_plani_degistirirse_bildirim(user_client, factory):
    from bahcelab_backend.domain.irrigation.revize import once_al, sonra_bildir
    from bahcelab_backend.domain.water.era5_sync import garden_cell

    gid = await kur(user_client, factory)
    async with factory() as s:
        cell, _, _ = await garden_cell(s, gid)
    once = await once_al(factory, cell)
    assert gid in once.imzalar and len(once.gecici) == 6 and once.imzalar[gid][2].gunler  # kurak tohum: sulama önerisi var
    assert await sonra_bildir(factory, cell, once) == 0  # hiçbir gün kesinleşmedi → bildirim yok
    # son 5 gün KESİNLEŞTİ ve çok yağışlı geldi (ERA5 finali): plan değişir
    async with factory() as s:
        await s.execute(text("UPDATE era5_daily SET hava_kaynak = 'era5_land', yagis_mm = 60 WHERE cell_id = :c AND tarih BETWEEN :a AND :b"), {"c": cell, "a": TODAY - timedelta(days=5), "b": TODAY - timedelta(days=1)})
        await s.commit()
    assert await sonra_bildir(factory, cell, once) == 1
    async with factory() as s:
        n = (await s.execute(text("SELECT baslik, metin FROM notifications WHERE garden_id = :g AND tur = 'sulama_revize'"), {"g": gid})).all()
    assert len(n) == 1 and "kesinleşen veriyle değişti" in n[0][0] and "5 günün" in n[0][1] and "→" in n[0][1]
    assert await sonra_bildir(factory, cell, once) == 0  # tekrar çalışınca aynı bildirim ikinci kez çıkmaz (tekil anahtar)


# ---------------------------------------------------------------- Dilim 2: ağ (pompa/boru/sıra yönü), vana Kc, göstergeler, bu yıl serisi, vana eylemleri
def _nokta(dx: float = 0.0, dy: float = 0.0) -> dict:
    return {"type": "Point", "coordinates": [XS[0] + dx, YS[0] + dy]}


def _cizgi() -> dict:
    return {"type": "LineString", "coordinates": [[XS[0], YS[0]], [XS[0], YS[1]]]}


async def test_ag_pompa_boru_sira_yonu_kaydedilir_ve_dogrulanir(user_client, factory):
    gid = await kur(user_client, factory)
    bos = (await user_client.get(f"/gardens/{gid}/sulama-sektorleri")).json()
    assert bos["pompa"] is None and bos["ana_boru"] is None and bos["sira_yonu_derece"] is None  # çizilmedi: haritada gösterilmez
    ok = await user_client.put(f"/gardens/{gid}/sulama-sektorleri", json={**IKI, "pompa": _nokta(), "ana_boru": _cizgi(), "sira_yonu_derece": 12.5})
    assert ok.status_code == 200
    j = ok.json()
    assert j["pompa"]["type"] == "Point" and j["ana_boru"]["type"] == "LineString" and j["sira_yonu_derece"] == 12.5
    assert j["varsayilan_sira_aralik_m"] == PROFIL["sira_aralik_m"] and j["varsayilan_agac_aralik_m"] == PROFIL["agac_aralik_m"]
    panel = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()
    assert panel["ag"]["pompa"] is not None and panel["ag"]["sira_yonu_derece"] == 12.5 and panel["parsel"]["type"] in ("Polygon", "MultiPolygon")
    # geçersiz: bahçeden uzak pompa, nokta yerine çizgi
    assert (await user_client.put(f"/gardens/{gid}/sulama-sektorleri", json={**IKI, "pompa": {"type": "Point", "coordinates": [XS[1] + 0.05, YS[1] + 0.05]}})).status_code == 422
    assert (await user_client.put(f"/gardens/{gid}/sulama-sektorleri", json={**IKI, "pompa": _cizgi()})).status_code == 422
    assert (await user_client.put(f"/gardens/{gid}/sulama-sektorleri", json={**IKI, "sira_yonu_derece": 400})).status_code == 422
    # hepsi boşsa ağ silinir
    son = (await user_client.put(f"/gardens/{gid}/sulama-sektorleri", json=IKI)).json()
    assert son["pompa"] is None and son["ana_boru"] is None and son["sira_yonu_derece"] is None


async def _sentinel_ndvi(factory, gid: uuid.UUID, sol: float, sag: float, gun_once: int = 3, nan_sag: bool = False) -> None:
    """Gerçek depolama + gerçek işleme: bahçe kanonik ızgarasında NDVI (sol yarı `sol`, sağ yarı `sag`); `nan_sag`: sağ yarı bulutlu (NaN)."""
    import numpy as np

    from bahcelab_backend.domain.acquisitions.models import AcquisitionModel
    from bahcelab_backend.domain.acquisitions.repository import AcquisitionRepository
    from bahcelab_backend.domain.acquisitions.store import encode_grids, pixel_stats
    from bahcelab_backend.domain.multiyear.grid import canonical_grid, garden_mask
    from bahcelab_backend.shared.storage import get_storage

    async with factory() as session:
        repo = AcquisitionRepository(session)
        geometry = await repo.geometry_geojson(gid)
        grid = canonical_grid(geometry)
        mask = garden_mask(grid, geometry)
        yarim = grid.shape[1] // 2
        ndvi = np.full(grid.shape, sol, dtype=np.float32)
        ndvi[:, yarim:] = np.nan if nan_sag else sag
        tarih = TODAY - timedelta(days=gun_once)
        key = f"acq/{gid}/S2_{tarih}_d2.npz"
        get_storage().save(key, encode_grids({"ndvi": ndvi}))
        row = AcquisitionModel(garden_id=gid, source_id="sentinel2-l2a", scene_id=f"S2_{tarih}_d2", tarih=tarih, bulut_orani=5.0, durum="net", gecerli_oran=1.0, formul_surumu="test", izgara_yolu=key)
        st = pixel_stats(ndvi, mask)
        await repo.upsert_acquisition(row, {"ndvi": st} if st else {})
        await session.commit()


async def test_vana_basina_sentinel2_orten_kc_piksel_ve_maske(user_client, factory):
    gid = await seed(user_client, factory)
    await _sentinel_ndvi(factory, gid, 0.80, 0.50)
    await user_client.put(f"/gardens/{gid}/sulama-profili", json=PROFIL)
    await user_client.put(f"/gardens/{gid}/sulama-sektorleri", json=IKI)
    p = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()
    v1, v2 = p["sektorler"]
    assert v1["kc"]["kaynak"] == "vana" and v2["kc"]["kaynak"] == "vana"
    assert v1["kc"]["ndvi"] == pytest.approx(0.80, abs=0.02) and v2["kc"]["ndvi"] == pytest.approx(0.50, abs=0.02)  # her vana KENDİ pikselleri
    assert v1["kc"]["orten_yuzde"] > v2["kc"]["orten_yuzde"] and v1["kc"]["kc_bugun"] >= v2["kc"]["kc_bugun"]
    assert v1["kc"]["piksel"] >= 20 and v1["kc"]["piksel"] == v1["kc"]["toplam_piksel"] and v1["kc"]["maske_orani"] == pytest.approx(0.0) and v1["kc"]["tarih"] == str(TODAY - timedelta(days=3))
    # Kc farkı kovayı ayrıştırır: yüksek örtülü vana daha çok tüketir (daha kuru)
    assert v1["doluluk_pct"] < v2["doluluk_pct"]
    # çizilmemiş: bahçe değeri
    await user_client.put(f"/gardens/{gid}/sulama-sektorleri", json={"sektorler": []})
    tek = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()["sektorler"][0]
    assert tek["kc"]["kaynak"] == "bahce" and tek["kc"]["piksel"] is None


async def test_vana_kc_bulutlu_yarim_icin_bahce_degerine_duser_ve_nedenini_yazar(user_client, factory):
    gid = await seed(user_client, factory)
    await _sentinel_ndvi(factory, gid, 0.80, 0.50, nan_sag=True)  # sağ vana tamamen bulutlu
    await user_client.put(f"/gardens/{gid}/sulama-profili", json=PROFIL)
    await user_client.put(f"/gardens/{gid}/sulama-sektorleri", json=IKI)
    v1, v2 = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()["sektorler"]
    assert v1["kc"]["kaynak"] == "vana" and v2["kc"]["kaynak"] == "bahce"
    assert "temiz piksel yetersiz" in v2["kc"]["neden"] and "bahçe değeri kullanıldı" in v2["kc"]["neden"]


async def test_gostergeler_stres_7g_ve_fazla_su_7g(user_client, factory):
    gid = await kur(user_client, factory)
    p0 = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()["sektorler"][0]
    assert 0 <= p0["stres_7g"] <= 7 and p0["fazla_su_7g_mm"] >= 0
    # son günlerde 120 m³ sulama kaydı: sistem kaybı (brüt − net) «fazla su»ya girer
    await user_client.post(f"/gardens/{gid}/saha-kayitlari", json={"tur": "sulama", "tarih": str(TODAY - timedelta(days=1)), "ayrinti": {"m3": 120}})
    p1 = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()["sektorler"][0]
    assert p1["fazla_su_7g_mm"] > p0["fazla_su_7g_mm"]


async def test_bu_yil_serisi_panelle_ayni_bugun_degeri_ve_gecici_bayragi(user_client, factory):
    gid = await kur(user_client, factory)
    await user_client.put(f"/gardens/{gid}/sulama-sektorleri", json=IKI)
    p = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()
    s = (await user_client.get(f"/gardens/{gid}/sulama-simulasyon", params={"yil": TODAY.year})).json()
    assert s["durum"] == "hazir" and s["yil"] == TODAY.year and s["bugun_idx"] is not None and next(y for y in s["yillar"] if y["guncel"])["yil"] == TODAY.year
    i = s["bugun_idx"]
    assert s["gunler"][i]["tarih"] == str(TODAY) and s["gunler"][i]["gecici"] is True  # tohum: son günler model
    for sim_v, pan_v in zip(s["sektorler"], p["sektorler"], strict=True):
        assert sim_v["ad"] == pan_v["ad"] and sim_v["doluluk_pct"][i] == pytest.approx(pan_v["doluluk_pct"])  # harita şeridi ↔ panel ↔ Su kartı AYNI
        n = len(sim_v["doluluk_pct"])
        assert n == len(sim_v["ks"]) == len(sim_v["bosa_mm"]) == len(s["gunler"]) and n > 150
    assert s["gunler"][0]["tarih"] == f"{TODAY.year}-03-01"  # Mart başından
    assert s["tetik_pct"] == pytest.approx(60.0, abs=0.01) and s["taw_mm"] > s["raw_mm"] > 0


async def test_vana_eylemleri_kayit_isle_ve_programa_ekle(user_client, factory):
    gid = await kur(user_client, factory)
    await user_client.put(f"/gardens/{gid}/sulama-sektorleri", json=IKI)
    p = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()
    gun = p["vardiya"]["tarih"]
    # yalnız bir vanaya kayıt işle
    assert (await user_client.post(f"/gardens/{gid}/sulama-isle", json={"tarih": gun, "sektor": "V2"})).json() == {"yazilan": 1}
    kay = [k for k in (await user_client.get(f"/gardens/{gid}/saha-kayitlari")).json()["kayitlar"] if k["tur"] == "sulama"]
    assert len(kay) == 1 and kay[0]["ayrinti"]["sektor"] == "V2"
    assert (await user_client.post(f"/gardens/{gid}/sulama-isle", json={"tarih": gun, "sektor": "V9"})).status_code == 409
    # planın önermediği vanayı programa ekle: gelecek bir güne
    yarin = str(TODAY + timedelta(days=2))
    r = await user_client.post(f"/gardens/{gid}/sulama-program-ekle", json={"sektor": "V1", "tarih": yarin})
    assert r.status_code == 200
    v1 = next(s for s in r.json()["sektorler"] if s["ad"] == "V1")
    assert v1["sonraki_sulama"] is not None and v1["sonraki_sulama"] <= yarin
    assert (await user_client.post(f"/gardens/{gid}/sulama-program-ekle", json={"sektor": "V7"})).status_code == 404
    assert (await user_client.post(f"/gardens/{gid}/sulama-program-ekle", json={"sektor": "V1", "tarih": str(TODAY + timedelta(days=60))})).status_code == 422


async def test_panel_harita_gosterim_degerleri_katalogdan_gelir(user_client, factory):
    gid = await kur(user_client, factory)
    g = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()["gosterim"]
    assert g == {"fazla_su_az_mm": 2.0, "fazla_su_cok_mm": 8.0, "serit_genislik_m": 1.0, "tac_cap_m": 3.0}  # katalog (ön değer · mühendis onayı bekliyor); hesaba girmez


def test_katalog_fazla_su_esikleri_artan_olmali():
    import pytest as _pt
    from pydantic import ValidationError

    from bahcelab_backend.domain.agro.catalog import SulamaPlaniKurali, load_catalog

    kural = load_catalog().sulama_plani
    with _pt.raises(ValidationError, match="artan"):
        SulamaPlaniKurali.model_validate({**kural.model_dump(), "fazla_su_az_mm": 9.0, "fazla_su_cok_mm": 8.0})
