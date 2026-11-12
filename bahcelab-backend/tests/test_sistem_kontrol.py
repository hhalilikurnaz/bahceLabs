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


def _kova(seri: list[sk.Gozlem], ok: bool = True) -> dict[date, bool]:
    return {g.tarih: ok for g in seri}


def test_taban_yetersiz_sezon_isaret_uretmez_ve_nedenini_yazar():
    seri = _gecmis(sezonlar=(2024,)) + _guncel([0.1, 0.1])  # tek önceki sezon
    k = sk.degerlendir("V2", seri, {}, date(2026, 7, 6), K, _kova(seri))
    assert k.durum == "yok" and "taban yok" in k.neden and "en az 2" in k.neden


def test_iki_bulutsuz_sahnede_z_dusuk_ve_kova_yeterli_isaret_uretir_tek_vana_orta_guven():
    seri = _gecmis() + _guncel([0.12, 0.10])  # taban ≈ 0,30 ± ~0,016 → z ≪ −1,5
    k = sk.degerlendir("V2", seri, {}, date(2026, 7, 6), K, _kova(seri))
    assert k.durum == "isaret" and k.guven == "orta" and "V2'de sulama sistemini kontrol edin" in k.neden
    assert len(k.sahneler) == 2 and all(s.z <= -1.5 for s in k.sahneler) and k.taban is not None and k.taban.sezon_sayisi == 3


def test_tek_sahne_dusuk_yetmez_ardisiklik_sart():
    seri = _gecmis() + _guncel([0.30, 0.10])  # ilk sahne normal
    k = sk.degerlendir("V2", seri, {}, date(2026, 7, 6), K, _kova(seri))
    assert k.durum == "yok" and "normal aralıkta" in k.neden


def test_kova_zaten_esik_altindaysa_isaret_degil_normal_stres():
    seri = _gecmis() + _guncel([0.12, 0.10])
    k = sk.degerlendir("V2", seri, {}, date(2026, 7, 6), K, _kova(seri, ok=False))
    assert k.durum == "yok" and "normal stres" in k.neden


def test_yalniz_bir_vana_dusuyorsa_guven_yuksek():
    v2 = _gecmis() + _guncel([0.12, 0.10])
    v1 = _gecmis() + _guncel([0.30, 0.31])
    k = sk.degerlendir("V2", v2, {"V1": v1}, date(2026, 7, 6), K, _kova(v2))
    assert k.durum == "isaret" and k.guven == "yuksek" and "yalnız bu vana" in (k.karsilastirma or "")


def test_hepsi_dusuyorsa_hava_fenoloji_isaret_uretilmez():
    v2 = _gecmis() + _guncel([0.12, 0.10])
    v1 = _gecmis() + _guncel([0.11, 0.12])
    v3 = _gecmis() + _guncel([0.13, 0.12])
    k = sk.degerlendir("V2", v2, {"V1": v1, "V3": v3}, date(2026, 7, 6), K, _kova(v2))
    assert k.durum == "yok" and "birlikte düşüyor" in k.neden


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
