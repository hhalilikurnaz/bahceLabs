"""Sulama sistemi kontrol kuralı (ADR 0029): sentetik NDMI serileriyle saf kural testi."""

from datetime import date, timedelta

import pytest

from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.irrigation import sistem_kontrol as sk

K = load_catalog().sistem_kontrol
EVRE = "buyume"
HEDEF_SEZON = 2025


def _gecmis(taban: float = 0.30, sapma: float = 0.02, sezonlar: tuple[int, ...] = (2022, 2023, 2024), n: int = 4) -> list[sk.Gozlem]:
    out = []
    for yil in sezonlar:
        for i in range(n):
            out.append(sk.Gozlem(date(yil + 1, 7, 1) + timedelta(days=10 * i), taban + sapma * ((i % 3) - 1), yil, EVRE, 1.0, 20))
    return out


def _guncel(ndmi: list[float], bas: date = date(2026, 7, 1), aralik: int = 5, sezon: int = HEDEF_SEZON) -> list[sk.Gozlem]:
    return [sk.Gozlem(bas + timedelta(days=aralik * i), v, sezon, EVRE, 1.0, 20) for i, v in enumerate(ndmi)]


def _halka(son: list[float], taban: float = 0.40, piksel: int = 80, bas: date = date(2026, 7, 1), aralik: int = 5) -> list[sk.HalkaSatir]:
    """Komşu halka: önceki 3 sezonda aynı evrede ≈ taban; güncel sezonda `son` değerleri (None = geçerli ağaçlık piksel eşiğin altında)."""
    out = [sk.HalkaSatir(g.tarih, g.ndmi + (taban - 0.30), 80, g.sezon, g.evre) for g in _gecmis()]
    out += [sk.HalkaSatir(bas + timedelta(days=aralik * i), v, piksel if v is not None else 12, HEDEF_SEZON, EVRE) for i, v in enumerate(son)]
    return out


def _kova(seri: list[sk.Gozlem], ok: bool = True) -> dict[date, bool]:
    return {g.tarih: ok for g in seri}


def test_taban_yetersiz_sezon_isaret_uretmez_ve_nedenini_yazar():
    seri = _gecmis(sezonlar=(2024,)) + _guncel([0.1, 0.1])  # tek önceki sezon
    k = sk.degerlendir("V2", seri, {}, date(2026, 7, 6), K, _kova(seri))
    assert k.durum == "yok" and "taban yok" in k.neden and "en az 2" in k.neden


def test_tek_sektor_halka_normalse_isaret_orta_yuksek_guvenle():
    seri = _gecmis() + _guncel([0.12, 0.10])  # taban ≈ 0,30 ± ~0,016 → z ≪ −1,5
    k = sk.degerlendir("V2", seri, {}, date(2026, 7, 6), K, _kova(seri), _halka([0.40, 0.41]))
    assert k.durum == "isaret" and k.guven == "orta_yuksek" and "V2'de sulama sistemini kontrol edin" in k.neden and k.halka is not None and k.halka.durum == "normal"
    assert "komşu halka" in (k.karsilastirma or "") and "tek sektör" in (k.karsilastirma or "")
    assert len(k.sahneler) == 2 and all(s.z <= -1.5 for s in k.sahneler) and k.taban is not None and k.taban.sezon_sayisi == 3


def test_tek_sektor_halka_da_dusuyorsa_isaret_yok():
    seri = _gecmis() + _guncel([0.12, 0.10])
    k = sk.degerlendir("V2", seri, {}, date(2026, 7, 6), K, _kova(seri), _halka([0.20, 0.18]))  # halka da düşüyor (hava/fenoloji)
    assert k.durum == "yok" and "halka da düşüyor" in k.neden and k.halka is not None and k.halka.durum == "dusuk"


def test_tek_sektor_halka_referansi_yoksa_isaret_yok_ve_nedeni_yazilir():
    seri = _gecmis() + _guncel([0.12, 0.10])
    yok = sk.degerlendir("V2", seri, {}, date(2026, 7, 6), K, _kova(seri))  # halka hiç hesaplanmamış
    assert yok.durum == "yok" and "halka referansı yok" in yok.neden
    az = sk.degerlendir("V2", seri, {}, date(2026, 7, 6), K, _kova(seri), _halka([0.40, None]))  # son sahnede 12 ağaçlık piksel < 30
    assert az.durum == "yok" and "12 geçerli ağaçlık piksel" in az.neden and "en az 30" in az.neden
    tabansiz = sk.degerlendir("V2", seri, {}, date(2026, 7, 6), K, _kova(seri), [sk.HalkaSatir(date(2026, 7, 1), 0.4, 80, HEDEF_SEZON, EVRE), sk.HalkaSatir(date(2026, 7, 6), 0.4, 80, HEDEF_SEZON, EVRE)])
    assert tabansiz.durum == "yok" and "taban yok" in tabansiz.neden


def test_tek_sahne_dusuk_yetmez_ardisiklik_sart():
    seri = _gecmis() + _guncel([0.30, 0.10])  # ilk sahne normal
    k = sk.degerlendir("V2", seri, {}, date(2026, 7, 6), K, _kova(seri))
    assert k.durum == "yok" and "normal aralıkta" in k.neden


def test_kova_zaten_esik_altindaysa_isaret_degil_normal_stres():
    seri = _gecmis() + _guncel([0.12, 0.10])
    k = sk.degerlendir("V2", seri, {}, date(2026, 7, 6), K, _kova(seri, ok=False))
    assert k.durum == "yok" and "normal stres" in k.neden


def test_yalniz_bir_vana_dusuyorsa_guven_yuksek_halka_gerekmez():
    v2 = _gecmis() + _guncel([0.12, 0.10])
    v1 = _gecmis() + _guncel([0.30, 0.31])
    k = sk.degerlendir("V2", v2, {"V1": v1}, date(2026, 7, 6), K, _kova(v2))  # halka yok: vana-arası kural aynen
    assert k.durum == "isaret" and k.guven == "yuksek" and "yalnız bu vana" in (k.karsilastirma or "")
    k2 = sk.degerlendir("V2", v2, {"V1": v1}, date(2026, 7, 6), K, _kova(v2), _halka([0.40, 0.41]))
    assert k2.guven == "yuksek" and "komşu halka normal" in (k2.karsilastirma or "")


def test_yalniz_bu_vana_dusuyor_halka_da_dusukse_isaret_kalir_guven_orta():
    v2 = _gecmis() + _guncel([0.12, 0.10])
    v1 = _gecmis() + _guncel([0.30, 0.31])
    k = sk.degerlendir("V2", v2, {"V1": v1}, date(2026, 7, 6), K, _kova(v2), _halka([0.20, 0.18]))  # halka da düşük
    assert k.durum == "isaret" and k.guven == "orta" and "komşu halka da düşük" in (k.karsilastirma or "") and "yalnız bu vana" in (k.karsilastirma or "")


def test_cok_vanali_orta_guven_halka_normalse_orta_yuksek():
    v2 = _gecmis() + _guncel([0.12, 0.10])
    v1 = _gecmis() + _guncel([0.20, 0.18])  # biri de belirgin düşük ama çoğunluk değil (2 vana: %50 → hepsi_dusuyor değil z eşiği üstünde değil)
    v3 = _gecmis() + _guncel([0.30, 0.31])
    v4 = _gecmis() + _guncel([0.30, 0.30])
    k = sk.degerlendir("V2", v2, {"V1": v1, "V3": v3, "V4": v4}, date(2026, 7, 6), K, _kova(v2), _halka([0.40, 0.41]))
    assert k.durum == "isaret" and k.guven == "orta_yuksek"


def test_hepsi_dusuyor_halka_da_dusuyorsa_isaret_yok_halka_normalse_isaret():
    v2 = _gecmis() + _guncel([0.12, 0.10])
    v1 = _gecmis() + _guncel([0.11, 0.12])
    v3 = _gecmis() + _guncel([0.13, 0.12])
    sade = sk.degerlendir("V2", v2, {"V1": v1, "V3": v3}, date(2026, 7, 6), K, _kova(v2))  # halka yok → ek kontrol yapılamaz
    assert sade.durum == "yok" and "birlikte düşüyor" in sade.neden and "halka referansı yok" in sade.neden
    dusuk = sk.degerlendir("V2", v2, {"V1": v1, "V3": v3}, date(2026, 7, 6), K, _kova(v2), _halka([0.20, 0.18]))
    assert dusuk.durum == "yok" and "komşu halka da düşüyor" in dusuk.neden  # hava/fenoloji
    normal = sk.degerlendir("V2", v2, {"V1": v1, "V3": v3}, date(2026, 7, 6), K, _kova(v2), _halka([0.40, 0.41]))
    assert normal.durum == "isaret" and normal.guven == "orta_yuksek" and "birlikte düşüyor" in (normal.karsilastirma or "")


def test_bulutlu_sahneler_sayilmaz_ve_cok_seyrek_sahne_reddedilir():
    seri = _gecmis() + [sk.Gozlem(date(2026, 7, 1), 0.10, HEDEF_SEZON, EVRE, 0.3, 2), sk.Gozlem(date(2026, 7, 6), 0.10, HEDEF_SEZON, EVRE, 1.0, 20)]  # biri bulutlu (oran 0,3)
    k = sk.degerlendir("V2", seri, {}, date(2026, 7, 6), K, _kova(seri))
    assert k.durum == "yok" and "gün arayla" in k.neden  # bulutlu sahne sayılmaz: son temiz sahne bir önceki yıldan kalır
    seyrek = _gecmis() + _guncel([0.10, 0.10], aralik=60)
    assert "gün arayla" in sk.degerlendir("V2", seyrek, {}, date(2026, 9, 1), K, _kova(seyrek)).neden


def test_gelecek_ve_ayni_sezon_taban_degildir():
    # taban yalnız ÖNCEKİ sezonlardan: mevcut sezonun düşük değerleri tabanı bozmaz
    seri = _gecmis(sezonlar=(2023, 2024)) + _guncel([0.10, 0.10, 0.10, 0.10, 0.10, 0.10])
    t, neden = sk.taban_hesapla(seri, seri[-1], K)
    assert t is not None and t.ort == pytest.approx(0.30, abs=0.03) and neden is None


def test_evre_bilinmiyorsa_taban_yok():
    g = sk.Gozlem(date(2026, 7, 1), 0.1, HEDEF_SEZON, None, 1.0, 20)
    t, neden = sk.taban_hesapla(_gecmis(), g, K)
    assert t is None and "evre bilinmiyor" in (neden or "")
