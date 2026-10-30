"""Sulama planı motoru (ADR 0023): saf fonksiyonlar, ağsız, veritabanısız. Katsayılar katalogdan okunur."""

from datetime import date, timedelta

import pytest

from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.irrigation import engine as e

RULE = load_catalog().sulama_plani


def days(start: date, n: int, rain=0.0, et0=5.0):
    return [e.DayIn(start + timedelta(days=i), rain, et0) for i in range(n)]


def test_kc_tablosu_siniflarda_FAO56_Tablo12_ile_ayni():
    assert e.kc_monthly(1, 70, RULE) == pytest.approx(0.70)  # başlangıç
    assert e.kc_monthly(7, 70, RULE) == pytest.approx(0.65)  # orta
    assert e.kc_monthly(12, 50, RULE) == pytest.approx(0.65)  # son
    assert e.kc_monthly(7, 20, RULE) == pytest.approx(0.45)


def test_kc_orten_siniflari_arasinda_dogrusal_ve_disinda_kirpilir():
    assert e.kc_monthly(7, 35, RULE) == pytest.approx(0.525)  # 0,45 ile 0,60 arası
    assert e.kc_monthly(7, 5, RULE) == pytest.approx(0.45)  # sınıf dışı: uç sınıf (uydurma genişletme yok)
    assert e.kc_monthly(7, 95, RULE) == pytest.approx(0.65)


def test_kc_gelisme_ayinda_evre_agirligi():
    # Nisan: 0,5 başlangıç + 0,5 orta; %50 örtü: 0,5·0,65 + 0,5·0,60
    assert e.kc_monthly(4, 50, RULE) == pytest.approx(0.625)


def test_orten_ndvi_den_ve_eksik_ndvi():
    assert e.canopy_cover_from_ndvi(0.30, RULE) == 0.0
    assert e.canopy_cover_from_ndvi(0.85, RULE) == 100.0
    assert e.canopy_cover_from_ndvi(0.575, RULE) == pytest.approx(50.0)
    assert e.canopy_cover_from_ndvi(None, RULE) is None


def test_taw_raw_FAO56_denk_82_83():
    taw, raw = e.taw_raw_mm(0.25, 0.12, 80, 0.5)  # 1000 (0,25 − 0,12) 0,8 = 104
    assert taw == pytest.approx(104.0) and raw == pytest.approx(52.0)


def test_etkili_yagis_esik_ve_oran():
    assert e.effective_rain_mm(1.5, RULE) == 0.0
    assert e.effective_rain_mm(10, RULE) == pytest.approx(10 * RULE.etkili_yagis_oran)


def test_kova_ETc_biriktirir_yagis_azaltir_sinirlar():
    kw = dict(taw=100.0, raw=50.0, cover_pct=50, rule=RULE, efficiency=0.9)
    dry = e.run_bucket(days(date(2025, 7, 1), 3), initial_dr=0.0, **kw)
    assert dry[0].etc_mm == pytest.approx(5 * 0.60) and dry[2].tukenme_mm == pytest.approx(9.0)
    sat = e.run_bucket(days(date(2025, 7, 1), 1, rain=60.0), initial_dr=10.0, **kw)
    assert sat[0].tukenme_mm == 0.0  # taşan su derin sızıntı: Dr < 0 olmaz
    wp = e.run_bucket(days(date(2025, 7, 1), 40, et0=9.0), initial_dr=0.0, **kw)
    assert wp[-1].tukenme_mm == 100.0 and wp[-1].stres  # TAW'ı aşmaz


def test_kova_eksik_veri_uydurmaz():
    d = [e.DayIn(date(2025, 7, 1), None, 5.0), e.DayIn(date(2025, 7, 2), 0.0, None)]
    r = e.run_bucket(d, taw=100.0, raw=50.0, cover_pct=50, rule=RULE, efficiency=0.9, initial_dr=20.0)
    assert all(x.veri_eksik for x in r) and r[-1].tukenme_mm == 20.0


def test_uygulanan_sulama_kovadan_net_dusulur():
    d = days(date(2025, 7, 1), 2)
    r = e.run_bucket(d, taw=100.0, raw=50.0, cover_pct=50, rule=RULE, efficiency=0.9, initial_dr=30.0, applied_net_mm={date(2025, 7, 1): 20.0})
    assert r[0].tukenme_mm == pytest.approx(30 - 20 + 3.0) and r[0].uygulanan_net_mm == 20.0


def test_plan_RAW_asilinca_sulama_onerir_brut_net_bolu_verim():
    pol = e.Policy(from_date=date(2025, 7, 1), min_net_mm=10.0)
    r = e.run_bucket(days(date(2025, 7, 1), 30), taw=100.0, raw=30.0, cover_pct=50, rule=RULE, efficiency=0.8, initial_dr=0.0, policy=pol)
    first = next(x for x in r if x.planli_net_mm > 0)
    assert first.planli_brut_mm == pytest.approx(first.planli_net_mm / 0.8)
    assert first.tukenme_mm == pytest.approx(0.0, abs=1e-9)  # tarla kapasitesine doldurur
    assert not any(x.stres for x in r)  # plan stresi önler


def test_plan_gecmiste_oneri_uretmez():
    pol = e.Policy(from_date=date(2025, 7, 20))
    r = e.run_bucket(days(date(2025, 7, 1), 15, et0=9.0), taw=100.0, raw=30.0, cover_pct=50, rule=RULE, efficiency=0.8, initial_dr=0.0, policy=pol)
    assert all(x.planli_net_mm == 0 for x in r)


def test_agac_basi_litre_ve_damlatici_suresi():
    t = e.per_tree(10.0, 10_000.0, 400, 4, 4.0)  # 10 mm = 10 L/m² → ağaç başı 250 L; 16 L/sa
    assert t is not None and t.litre_agac == pytest.approx(250.0) and t.emitor_dakika == round(250 / 16 * 60)


def test_agac_sayisi_yoksa_agac_basi_deger_gizlenir():
    assert e.per_tree(10.0, 10_000.0, None, 4, 4.0) is None
    assert e.per_tree(10.0, 10_000.0, 400, None, 4.0) is None


def test_agac_sayisi_tutarlilik():
    assert e.tree_count_check(400, 10_000, 5, 5, 0.15) == (400, True)
    assert e.tree_count_check(300, 10_000, 5, 5, 0.15) == (400, False)  # %25 fark
    assert e.tree_count_check(None, 10_000, 5, 5, 0.15) == (400, None)
    assert e.tree_count_check(400, 10_000, None, 5, 0.15) == (None, None)


def test_kova_gozlem_farki_uyarisi():
    assert e.soil_check(40, 10, 15) is True and e.soil_check(40, 30, 15) is False and e.soil_check(40, None, 15) is None


def test_maliyet_tarife_yoksa_sayi_uydurulmaz():
    c = e.cost(1000, e.CostInput(11, 50, "sebeke", None, None, None, None))
    assert c.kwh == pytest.approx(220.0) and c.toplam_tl is None and c.fiyat_kaynagi == "yok" and "faturanızdaki" in (c.eksik or "")


def test_maliyet_kullanici_fiyati_katalogu_ezer():
    c = e.cost(1000, e.CostInput(11, 50, "sebeke", 2.0, 3.0, None, 1.0))
    assert c.fiyat_kaynagi == "kullanici" and c.enerji_tl == pytest.approx(440.0) and c.toplam_tl == pytest.approx(440.0 + 1000.0)


def test_maliyet_pompa_bilinmiyorsa_gizli_ama_su_ucreti_ayri():
    c = e.cost(500, e.CostInput(None, None, "sebeke", 2.0, None, None, 0.5))
    assert c.kwh is None and c.toplam_tl is None and c.su_ucreti_tl == pytest.approx(250.0)


def test_maliyet_dizel_kullanici_m3_maliyeti():
    c = e.cost(100, e.CostInput(None, None, "dizel", None, None, 4.0, None))
    assert c.toplam_tl == pytest.approx(400.0)
    assert e.cost(100, e.CostInput(None, None, "dizel", None, None, None, None)).toplam_tl is None


def test_kisinti_yalniz_onayli_donemde_kilitli_donem_tam_plan():
    f = e.deficit_ratio_fn(RULE)
    assert f(date(2025, 4, 20)) == 1.0 and f(date(2025, 7, 10)) == 1.0  # çiçeklenme/tutum ve hızlı büyüme KİLİTLİ
    assert f(date(2025, 10, 5)) == RULE.kisitli_donemler[-1].oran
    assert e.period_of(date(2025, 7, 10), RULE.kisitli_donemler).durum == "kilitli"


def test_kisinti_riski_yalniz_uygulanan_donemden():
    assert e.deficit_risk(RULE, [date(2025, 7, 10)]) is None  # kilitli dönemde kısıntı yok, risk de yok
    assert e.deficit_risk(RULE, [date(2025, 10, 5)]) == "dusuk"


def test_kisintili_plan_daha_az_su_verir():
    kw = dict(taw=100.0, raw=30.0, cover_pct=50, rule=RULE, efficiency=0.8, initial_dr=0.0)
    d = days(date(2025, 9, 16), 45, et0=5.0)
    full = e.season_total(e.run_bucket(d, policy=e.Policy(date(2025, 9, 16)), **kw), RULE)
    deficit = e.season_total(e.run_bucket(d, policy=e.Policy(date(2025, 9, 16), oran=e.deficit_ratio_fn(RULE)), **kw), RULE)
    assert deficit.brut_mm < full.brut_mm


def test_aliskanlik_brut_mm_ve_kovaya_net():
    ds = [date(2025, 7, 1) + timedelta(days=i) for i in range(14)]
    a = e.habit_applied(ds, [0, 3], 4.0, 400, 4, 4.0, 10_000.0, 0.9)  # pzt+prş, 4 sa: 4·4·4·400/10000 = 2,56 mm brüt
    assert len(a) == 4 and next(iter(a.values())) == pytest.approx(2.56 * 0.9)


def test_sezon_gunleri_ve_toplam_veri_eksikse_sayilmaz():
    sd = e.season_days(2025, RULE)
    assert sd[0] == date(2025, 4, 1) and sd[-1] == date(2025, 10, 31)


def test_aralik_ornek_yetersizse_none_degilse_p10_p90():
    assert e.percentile_range([1, 2], 10, 90) is None
    lo, mid, hi = e.percentile_range(list(map(float, range(1, 12))), 10, 90)
    assert lo < mid < hi


def test_geri_odeme_sezonu():
    assert e.payback(10_000, 2_500).sezon == 4.0
    assert e.payback(10_000, -5).sezon is None and e.payback(None, 100).sezon is None


def test_mm_m3():
    assert e.mm_to_m3(10, 10_000) == 100.0


def test_kisinti_tuketimin_yalniz_oranini_geri_verir_ve_stresi_gosterir():
    ds = [date(2025, 9, 16) + timedelta(days=i) for i in range(46)]
    inp = [e.DayIn(d, 0.0, 6.0) for d in ds]
    kw = dict(taw=120.0, raw=40.0, cover_pct=50, rule=RULE, efficiency=1.0, initial_dr=0.0)
    full = e.run_bucket(inp, policy=e.Policy(ds[0]), **kw)
    deficit = e.run_bucket(inp, policy=e.Policy(ds[0], oran=e.deficit_ratio_fn(RULE)), **kw)
    f, d = sum(x.planli_brut_mm for x in full), sum(x.planli_brut_mm for x in deficit)
    assert 0.6 < d / f < 0.9  # tüketimin ≈ `oran`ı geri verilir (olaylar ayrık olduğundan tam oran değil)
    assert sum(1 for x in deficit if x.stres) > sum(1 for x in full if x.stres)  # kısıntının bedeli: stres günü


def test_damla_sik_az_salma_seyrek_cok():
    """Aynı hava, aynı toprak: damla küçük ve sık, salma büyük ve seyrek sulanır; toplam net su yakın (tüketimi karşılar)."""
    ds = [date(2025, 7, 1) + timedelta(days=i) for i in range(60)]
    inp = [e.DayIn(d, 0.0, 6.0) for d in ds]
    out = {}
    for sistem in ("damla", "salma"):
        prog = RULE.sistem_programi[sistem]
        pol = e.Policy(ds[0], min_net_mm=prog.en_az_net_mm, tetik_mm=prog.tetik_orani * 60.0, azami_net_mm=prog.azami_net_mm)
        rows = e.run_bucket(inp, taw=120.0, raw=60.0, cover_pct=60, rule=RULE, efficiency=RULE.sistem_verimi[sistem], initial_dr=0.0, policy=pol)
        out[sistem] = [x for x in rows if x.planli_net_mm > 0]
    assert max(x.planli_net_mm for x in out["damla"]) <= RULE.sistem_programi["damla"].azami_net_mm + 1e-9
    assert len(out["damla"]) > 3 * len(out["salma"])  # sık-az ↔ seyrek-çok
    assert max(x.planli_net_mm for x in out["salma"]) > 3 * max(x.planli_net_mm for x in out["damla"])
    net = {k: sum(x.planli_net_mm for x in v) for k, v in out.items()}
    assert abs(net["damla"] - net["salma"]) < 0.25 * net["salma"]


def test_damlada_esik_alti_stres_olmaz():
    ds = [date(2025, 7, 1) + timedelta(days=i) for i in range(90)]
    inp = [e.DayIn(d, 0.0, 7.0) for d in ds]
    prog = RULE.sistem_programi["damla"]
    pol = e.Policy(ds[0], min_net_mm=prog.en_az_net_mm, tetik_mm=prog.tetik_orani * 60.0, azami_net_mm=prog.azami_net_mm)
    rows = e.run_bucket(inp, taw=120.0, raw=60.0, cover_pct=60, rule=RULE, efficiency=0.9, initial_dr=0.0, policy=pol)
    assert not any(x.stres for x in rows)


def test_katalog_sistem_programi_ve_verim_ayni_sistemler():
    assert set(RULE.sistem_programi) == set(RULE.sistem_verimi) == {"damla", "mini_yagmurlama", "salma"}
