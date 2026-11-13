"""9J-5 tek güven servisi: saf etiketleme + gerçek veriyle koşullar; Durum ve Sulama panelleri AYNI «nasıl hesaplandı» metnini verir."""

from sqlalchemy import text

from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.izleme import guven as gv

from .test_irrigation_panel import kur
from .test_water_api import TODAY, factory, user_client  # noqa: F401

K = load_catalog().izleme


def test_etiket_oran_ve_olculemeyen_kosul_paydada_yok():
    ok, hayir, bilinmez = gv.Kosul("a", True), gv.Kosul("b", False), gv.Kosul("c", None)
    assert gv.olustur([ok] * 7 + [hayir], K).etiket == "yuksek"  # 7/8 = %87,5 ≥ %85
    assert gv.olustur([ok] * 4 + [hayir] * 3, K).etiket == "orta"  # 4/7 = %57
    assert gv.olustur([ok] + [hayir] * 3, K).etiket == "dusuk"
    r = gv.olustur([ok, ok, hayir, bilinmez, bilinmez], K)
    assert (r.puan, r.toplam) == (2, 3) and "2/3" in r.nedeni and "uydurulmaz" in r.nasil and "eksik: b" in r.nedeni  # ölçülemeyenler paydada yok
    assert gv.olustur([], K).etiket == "dusuk"


def test_olculen_kosul_alt_siniri_guveni_en_cok_orta_yapar_ve_nedenini_yazar():
    ok, bilinmez = gv.Kosul("a", True), gv.Kosul("b", None)
    az = gv.olustur([ok, ok, ok, bilinmez, bilinmez, bilinmez], K)  # 3 ölçülen < 4: 3/3 = %100 olsa da «yüksek» DEĞİL
    assert K.guven_min_olculen == 4 and az.etiket == "orta" and (az.puan, az.toplam) == (3, 3)
    assert "3 koşul ölçülemedi" in az.nedeni and "3 koşul ölçülemedi" in az.nasil and "en çok «orta»" in az.nasil
    yeter = gv.olustur([ok] * 4 + [bilinmez], K)  # 4 ölçülen: alt sınır sağlandı → yüksek mümkün
    assert yeter.etiket == "yuksek" and "ölçülemedi" not in yeter.nasil  # genel metin sabit (ekranlar arası aynı)
    dusuk = gv.olustur([gv.Kosul("a", False), gv.Kosul("b", False), bilinmez], K)  # alt sınır etiketi YÜKSELTMEZ
    assert dusuk.etiket == "dusuk"


async def test_kosullar_gercek_veriden_ve_iki_panel_ayni_metin(user_client, factory):  # noqa: F811
    gid = await kur(user_client, factory)
    sul = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()["guven"]
    durum = (await user_client.get(f"/gardens/{gid}/durum")).json()
    assert sul["nasil"] == durum["guven_nasil"] and sul["nasil"] not in durum["nasil"]  # «Güven nasıl hesaplandı?» iki ekranda AYNI metin; Durum cümle listesine karışmaz
    assert "ölçülebilen koşul" in sul["nasil"]
    # şüpheli (sert) ölçüm bayrağı güveni düşürür ve nedeni yazar
    async with factory() as s:
        from bahcelab_backend.domain.water.era5_sync import garden_cell

        cell, _, _ = await garden_cell(s, gid)
        await s.execute(text("INSERT INTO veri_bayrak (kaynak, anahtar, tarih, degisken, deger, kural, siddet, ayrinti) VALUES ('era5', :c, :t, 'yagis_mm', 400, 'aralik', 'sert', 'x') ON CONFLICT DO NOTHING"), {"c": str(cell), "t": TODAY})
        await s.commit()
    g2 = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()["guven"]
    bayrak = next(k for k in g2["kosullar"] if k["ad"] == "Şüpheli (imkânsız) ölçüm yok")
    assert bayrak["ok"] is False and "imkânsız değer" in bayrak["not"] and g2["puan"] == sul["puan"] - 1
    # kaynak drift'i uyumsuzluk olarak girer
    async with factory() as s:
        await s.execute(text("INSERT INTO izleme_uyum (tarih, kontrol, garden_id, esik, n, durum) VALUES (:t, 'era5_imerg_aylik', :g, 0.35, 9, 'drift')"), {"t": TODAY, "g": gid})
        await s.commit()
    g3 = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()["guven"]
    uyum = next(k for k in g3["kosullar"] if k["ad"] == "Kaynaklar birbiriyle uyumlu")
    assert uyum["ok"] is False and "era5_imerg_aylik" in uyum["not"]
    assert g3["etiket"] in ("yuksek", "orta") and g3["puan"] < g2["puan"] + 1


def test_veri_durumu_yalniz_bozuksa_ve_tek_satir():
    k = load_catalog().izleme
    iyi = gv.olustur([gv.Kosul("Uydu görüntüsü taze", True), gv.Kosul("Hava verisi güncel", True), gv.Kosul("Veri akışları kopuk değil", True), gv.Kosul("Ağaç sayısı beyan edilmiş", False)], k)
    assert gv.veri_durumu(iyi) is None  # beyan eksikliği veri sorunu değil: satır yok
    bozuk = gv.olustur([gv.Kosul("Uydu görüntüsü taze", False, "son net görüntü 26.10.2026 (18 gün önce)"), gv.Kosul("Hava verisi güncel", False, "son gün 08.10.2026"), gv.Kosul("Veri akışları kopuk değil", True)], k)
    assert gv.veri_durumu(bozuk) == "Uydu görüntüsü eski — son net görüntü 26.10.2026 (18 gün önce)"  # en ağır tek satır
    assert gv.veri_durumu(gv.olustur([gv.Kosul("Uydu görüntüsü taze", None)], k)) is None  # ölçülemeyen koşul «bozuk» sayılmaz
