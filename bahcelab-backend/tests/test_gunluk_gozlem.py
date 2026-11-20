# ruff: noqa: F811
"""ADIM 11 · Dilim 1 (ADR 0034): etiketli gözlem (sözlük, doğrulama, süzgeç, güncelleme), sistem yanıtlarının etiket eşlemesi, saha turuna 10B «belirsiz» noktası."""

import uuid
from datetime import date

from sqlalchemy import text

from bahcelab_backend.domain.don import servis

from .test_don import KURAL, _sahte
from .test_events_service import factory, seed, user_client  # noqa: F401
from .test_fieldbook_api import point
from .test_sebep import D0, _tohumla

GOZLEM = {"kategori": "zararli", "etiket": "kirmizi_orumcek", "siddet": "orta", "yayginlik": "birkac_agac"}


def govde(**ek):  # noqa: ANN003, ANN201
    return {"tur": "gozlem", "tarih": date.today().isoformat(), "konum": point(), "aciklama": "Yaprak altında ağ", "gozlem": GOZLEM, **ek}


async def test_sozluk_katalogdan_gelir(user_client):
    r = await user_client.get("/gunluk/sozluk")
    assert r.status_code == 200
    j = r.json()
    kat = {k["kod"]: k for k in j["kategoriler"]}
    assert list(kat) == ["zararli", "hastalik", "fenoloji", "cevre", "sulama_altyapi", "bakim", "genel"]
    assert "su_stresi" in [e["kod"] for e in kat["cevre"]["etiketler"]] and [e["kod"] for e in kat["bakim"]["etiketler"]][:2] == ["budama", "hasat"]
    assert kat["zararli"]["siddet_zorunlu"] is True and kat["fenoloji"]["siddet_zorunlu"] is False
    assert j["foto_uzun_kenar_px"] == 2048 and j["foto_hedef_bayt"] == 1_000_000
    assert j["durum"] == "dogrulanmadi" and [x["kod"] for x in j["siddet"]] == ["az", "orta", "cok"]


async def test_etiketli_gozlem_olusur_listelenir_suzulur_guncellenir(user_client, factory):
    gid = await seed(user_client, factory)
    r = await user_client.post(f"/gardens/{gid}/saha-kayitlari", json=govde(gozlem={**GOZLEM, "konum_dogruluk_m": 8.5}))
    assert r.status_code == 201, r.text
    g = r.json()["gozlem"]
    assert g["kategori_ad"] == "Zararlı" and g["etiket_ad"] == "Kırmızı örümcek" and g["siddet_ad"] == "Orta" and g["yayginlik_ad"] == "Birkaç ağaç"
    assert g["kaynak"] == "kullanici" and g["konum_dogruluk_m"] == 8.5
    await user_client.post(f"/gardens/{gid}/saha-kayitlari", json={"tur": "gozlem", "tarih": date.today().isoformat(), "gozlem": {"kategori": "fenoloji", "etiket": "cicek"}})  # fenolojide şiddet isteğe bağlı
    await user_client.post(f"/gardens/{gid}/saha-kayitlari", json={"tur": "gozlem", "tarih": date.today().isoformat(), "aciklama": "etiketsiz eski tür gözlem"})
    tum = (await user_client.get(f"/gardens/{gid}/saha-kayitlari")).json()["kayitlar"]
    assert len(tum) == 3
    assert [k["gozlem"]["etiket"] if k["gozlem"] else None for k in tum].count(None) == 1
    zararli = (await user_client.get(f"/gardens/{gid}/saha-kayitlari?kategori=zararli")).json()["kayitlar"]
    assert len(zararli) == 1 and zararli[0]["gozlem"]["etiket"] == "kirmizi_orumcek"
    assert len((await user_client.get(f"/gardens/{gid}/saha-kayitlari?kategori=fenoloji&etiket=cicek")).json()["kayitlar"]) == 1
    assert (await user_client.get(f"/gardens/{gid}/saha-kayitlari?etiket=yok_boyle")).json()["kayitlar"] == []
    kid = zararli[0]["id"]
    p = await user_client.patch(f"/gardens/{gid}/saha-kayitlari/{kid}", json={"gozlem": {**GOZLEM, "etiket": "unlu_bit", "siddet": "cok", "yayginlik": "bahce_geneli"}})
    assert p.status_code == 200 and p.json()["gozlem"]["etiket"] == "unlu_bit" and p.json()["gozlem"]["siddet"] == "cok"
    sil = await user_client.patch(f"/gardens/{gid}/saha-kayitlari/{kid}", json={"gozlem": None})
    assert sil.status_code == 200 and sil.json()["gozlem"] is None


async def test_gozlem_dogrulamasi(user_client, factory):
    gid = await seed(user_client, factory)
    url = f"/gardens/{gid}/saha-kayitlari"
    assert (await user_client.post(url, json=govde(gozlem={**GOZLEM, "etiket": "uydurma"}))).status_code == 422
    assert (await user_client.post(url, json=govde(gozlem={**GOZLEM, "kategori": "uydurma"}))).status_code == 422
    assert (await user_client.post(url, json=govde(gozlem={**GOZLEM, "siddet": "yok"}))).status_code == 422
    assert (await user_client.post(url, json=govde(gozlem={"kategori": "zararli", "etiket": "thrips"}))).status_code == 422  # zararlıda şiddet + yaygınlık zorunlu
    assert (await user_client.post(url, json=govde(tur="hasat"))).status_code == 422  # etiket yalnız gözlemde
    assert (await user_client.post(url, json=govde(gozlem={**GOZLEM, "sector_id": str(uuid.uuid4())}))).status_code == 422  # vana bu bahçeye ait değil
    assert (await user_client.get(f"/gardens/{gid}/saha-kayitlari")).json()["kayitlar"] == []


async def test_vana_baglanir(user_client, factory):
    gid = await seed(user_client, factory)
    async with factory() as s:
        sid = uuid.uuid4()
        await s.execute(text("INSERT INTO irrigation_sectors (id, garden_id, ad, sira, geom, alan_m2) SELECT :i, :g, 'V1', 1, geom, 1000 FROM gardens WHERE id = :g"), {"i": sid, "g": gid})
        await s.commit()
    r = await user_client.post(f"/gardens/{gid}/saha-kayitlari", json=govde(gozlem={**GOZLEM, "sector_id": str(sid)}))
    assert r.status_code == 201 and r.json()["gozlem"]["sector_id"] == str(sid)


async def _kayitlar(user_client, gid):  # noqa: ANN001, ANN202
    return (await user_client.get(f"/gardens/{gid}/saha-kayitlari?tur=gozlem")).json()["kayitlar"]


async def test_don_yaniti_etiket_eslemesi(user_client, factory):
    gid = await seed(user_client, factory)
    bugun = date(2026, 10, 10)
    async with factory() as s:
        await servis.hesapla_ve_yaz(s, gid, _sahte(bugun, [(-1.5, -0.5, 0.5), (2.0, 3.0, 4.0), (3.0, 4.0, 5.0)]), KURAL, bugun)
        await s.commit()
    assert (await user_client.post(f"/gardens/{gid}/don/geri-bildirim", json={"gece": bugun.isoformat(), "yanit": "oldu"})).status_code == 204
    k = [x for x in await _kayitlar(user_client, gid) if (x["ayrinti"] or {}).get("konu") == "don_uyarisi"]
    assert len(k) == 1 and k[0]["gozlem"]["kategori"] == "cevre" and k[0]["gozlem"]["etiket"] == "don" and k[0]["gozlem"]["kaynak"] == "sistem"
    assert (await user_client.post(f"/gardens/{gid}/don/geri-bildirim", json={"gece": bugun.isoformat(), "yanit": "olmadi"})).status_code == 204  # yanıt değişir: «olmadı» EŞLENMEZ
    k = [x for x in await _kayitlar(user_client, gid) if (x["ayrinti"] or {}).get("konu") == "don_uyarisi"]
    assert len(k) == 1 and k[0]["gozlem"] is None  # kayıt kalır, etiket yok (don_geri_bildirim'de durur)
    async with factory() as s:
        assert (await s.execute(text("SELECT yanit FROM don_geri_bildirim WHERE garden_id = :g"), {"g": gid})).scalar() == "olmadi"


async def test_sebep_yaniti_etiket_eslemesi(user_client, factory):
    gid = await seed(user_client, factory)
    eid = await _tohumla(factory, gid, bulut=60.0, sonraki=True)
    beklenen = {"su": ("cevre", "su_stresi"), "besin": ("cevre", "yaprak_sararmasi"), "hastalik_zararli": ("hastalik", "diger"), "budama_hasat": ("bakim", "budama_hasat"), "don": ("cevre", "don")}
    for yanit, (kat, etiket) in beklenen.items():
        assert (await user_client.post(f"/gardens/{gid}/olaylar/{eid}/sebep-yaniti", json={"sebep": yanit})).status_code == 204
        k = [x for x in await _kayitlar(user_client, gid) if (x["ayrinti"] or {}).get("konu") == "sebep_yaniti"]
        assert len(k) == 1 and (k[0]["gozlem"]["kategori"], k[0]["gozlem"]["etiket"]) == (kat, etiket) and k[0]["gozlem"]["kaynak"] == "sistem", yanit
    assert (await user_client.post(f"/gardens/{gid}/olaylar/{eid}/sebep-yaniti", json={"sebep": "bilmiyorum"})).status_code == 204
    k = [x for x in await _kayitlar(user_client, gid) if (x["ayrinti"] or {}).get("konu") == "sebep_yaniti"]
    assert len(k) == 1 and k[0]["gozlem"] is None  # «bilmiyorum» eşlenmez


async def test_saha_turune_belirsiz_sebep_ve_kontrol_listesi_girer(user_client, factory, monkeypatch):
    from bahcelab_backend.domain.agro.catalog import load_catalog

    monkeypatch.setattr(load_catalog().saha, "tur_sebep_gun", 400)  # tohum olayı D0 (sabit test tarihi); «son 45 gün» penceresi testin dondurulmuş saatinden uzak
    gid = await seed(user_client, factory)
    eid = await _tohumla(factory, gid, bulut=2.0, sonraki=False)  # bulutsuz, kısmen düşüş: sebep «belirsiz»; olay «bekliyor»
    async with factory() as s:
        await s.execute(text("UPDATE events SET bitis = :b WHERE id = :i"), {"b": D0, "i": eid})
        await s.commit()
    j = (await user_client.get(f"/gardens/{gid}/saha-turu")).json()
    nokta = [n for n in j["noktalar"] if n["tur"] == "sebep_belirsiz"]
    assert len(nokta) == 1 and nokta[0]["olay_id"] == str(eid) and nokta[0]["olay_anahtar"] == "s2_dusus:test"
    gruplar = {g["sebep"]: g for g in nokta[0]["kontrol"]}
    assert {"don", "su", "besin", "hastalik", "mekanik"} <= set(gruplar) and all(g["maddeler"] for g in gruplar.values())
    assert any(m["url"] and m["kaynak"] for m in gruplar["don"]["maddeler"]) and any(m["kaynak"] is None for m in gruplar["su"]["maddeler"])  # kaynaksız madde açıkça kaynaksız
    assert not [n for n in j["noktalar"] if n["tur"] == "bekliyor" and n["olay_anahtar"] == "s2_dusus:test"]  # aynı olay iki nokta olmaz
    # «Sebep buydu» yanıtı verilince nokta turdan çıkar
    assert (await user_client.post(f"/gardens/{gid}/olaylar/{eid}/sebep-yaniti", json={"sebep": "su"})).status_code == 204
    j2 = (await user_client.get(f"/gardens/{gid}/saha-turu")).json()
    assert not [n for n in j2["noktalar"] if n["tur"] == "sebep_belirsiz"]
