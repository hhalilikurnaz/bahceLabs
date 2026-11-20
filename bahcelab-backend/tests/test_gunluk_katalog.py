"""ADIM 11 · Dilim 0 (ADR 0034): Günlük sözlüğü katalogda — onaylı etiket kümesi, hasat sözlüğü, sistem yanıtı eşlemesi ve doğrulayıcılar."""

import pytest

from bahcelab_backend.domain.agro.catalog import GunlukKurali, load_catalog

G = load_catalog().gunluk


def _etiketler(kategori: str) -> list[str]:
    return [e.ad for k in G.gozlem_kategorileri if k.kod == kategori for e in k.etiketler]


def test_durum_dogrulanmadi_ve_kaynak_etiketli():
    assert G.durum == "dogrulanmadi" and "mühendis onayı bekliyor" in G.kaynak and "FFV-14" in G.kaynak


def test_gozlem_etiket_kumesi_onaylanan_listeyle_birebir():
    assert [k.kod for k in G.gozlem_kategorileri] == ["zararli", "hastalik", "fenoloji", "cevre", "sulama_altyapi", "bakim", "genel"]
    assert _etiketler("zararli") == ["Akdeniz meyve sineği", "Kırmızı örümcek", "Unlu bit", "Kabuklu bit", "Beyaz sinek", "Yaprak galeri güvesi", "Thrips", "Yaprak biti", "Diğer"]
    assert _etiketler("hastalik") == ["Uçkurutan", "Kahverengi çürüklük / Phytophthora", "Kök boğazı çürüklüğü", "Antraknoz", "Diğer"]
    assert _etiketler("fenoloji") == ["Sürgün", "Çiçek", "Meyve tutumu", "Meyve büyümesi", "Renk dönümü", "Hasat olgunluğu"]
    assert _etiketler("cevre") == ["Don", "Dolu", "Rüzgâr", "Güneş yanığı", "Yaprak sararması (besin belirtisi olabilir)", "Su stresi (solgunluk)"]
    assert _etiketler("sulama_altyapi") == ["Tıkalı damlatıcı", "Sızıntı", "Pompa / vana arızası"]
    assert _etiketler("bakim") == ["Budama", "Hasat", "Budama / hasat (ayrıştırılmamış)"]
    assert [x.kod for x in G.siddet] == ["az", "orta", "cok"]
    assert [x.kod for x in G.yayginlik] == ["tek_agac", "birkac_agac", "bolge", "bahce_geneli"]


def test_hasat_sozlugu():
    h = G.hasat
    assert h.kasa_kg_varsayilan == 20 and h.kasa_kg_min <= 20 <= h.kasa_kg_max
    assert [x.kod for x in h.miktar_kaynaklari] == ["kantar", "kasa_tahmini"]
    assert [x.kod for x in h.kalite] == ["ihracatlik", "birinci_sinif", "ikinci_sinif", "sanayilik_iskarta"]
    assert [x.kod for x in h.satis_sekilleri] == ["dalinda_goturu", "tuccara_kg", "hale", "kendi_depoya", "ihracatciya"]
    unece = {x.kod: x.unece for x in h.kalite}
    assert unece["birinci_sinif"] == "Class I" and unece["ikinci_sinif"] == "Class II"
    assert "UNECE sınıfı değil" in unece["ihracatlik"] and "Karşılığı yok" in unece["sanayilik_iskarta"]  # birebir eşleşme İDDİA EDİLMEZ
    assert G.foto.uzun_kenar_px == 2048 and G.foto.roller == ["genel", "kantar_fisi"]


def test_sistem_yaniti_eslemesi_etiket_kumesine_baglanir():
    kodlar = {f"{k.kod}.{e.kod}" for k in G.gozlem_kategorileri for e in k.etiketler}
    for eslesme in G.sistem_eslesme.values():
        for hedef in eslesme.values():
            assert hedef is None or hedef in kodlar
    assert G.sistem_eslesme["sebep_yaniti"]["don"] == "cevre.don"
    assert G.sistem_eslesme["sebep_yaniti"]["besin"] == "cevre.yaprak_sararmasi"
    assert G.sistem_eslesme["sebep_yaniti"]["su"] == "cevre.su_stresi"
    assert G.sistem_eslesme["sebep_yaniti"]["budama_hasat"] == "bakim.budama_hasat"
    assert G.sistem_eslesme["sebep_yaniti"]["bilmiyorum"] is None
    assert G.sistem_eslesme["don_yaniti"]["oldu"] == "cevre.don" and G.sistem_eslesme["don_yaniti"]["olmadi"] is None


def test_dogrulayicilar_bozuk_katalogu_reddeder():
    ham = G.model_dump()
    ham["sistem_eslesme"]["sebep_yaniti"]["don"] = "cevre.yok_boyle_etiket"
    with pytest.raises(ValueError, match="etiket kümesinde yok"):
        GunlukKurali.model_validate(ham)
    ham = G.model_dump()
    ham["hasat"]["kasa_kg_varsayilan"] = 99
    with pytest.raises(ValueError, match="min–max"):
        GunlukKurali.model_validate(ham)
    ham = G.model_dump()
    ham["gozlem_kategorileri"][0]["etiketler"].append(dict(ham["gozlem_kategorileri"][0]["etiketler"][0]))
    with pytest.raises(ValueError, match="tekil"):
        GunlukKurali.model_validate(ham)
