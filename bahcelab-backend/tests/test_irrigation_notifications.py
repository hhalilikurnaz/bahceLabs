"""Sulama planı bildirimleri: yalnız iki tür, eşikler katalogdan; plan yoksa bildirim yok."""

import uuid
from datetime import date, timedelta

from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.irrigation.schemas import PlanYaniti, Sulama
from bahcelab_backend.domain.notifications.plan_candidates import plan_candidates
from bahcelab_backend.domain.notifications.types import TYPES

RULE = load_catalog().sulama_plani
G = uuid.uuid4()
TODAY = date(2026, 7, 14)  # Salı


def sul(days: int, dk: int | None = 145) -> Sulama:
    return Sulama(tarih=TODAY + timedelta(days=days), net_mm=20, brut_mm=22, m3_bahce=100, m3_dekar=1.1, litre_agac=None, emitor_dakika=dk)


def plan(**kw) -> PlanYaniti:
    return PlanYaniti(durum="hazir", neden=None, bugun=TODAY, **kw)


def test_yaklasan_sulama_gunu_ve_dedupe():
    c = plan_candidates(G, "Jlnnlk", plan(sonraki=sul(1)), RULE, TODAY)
    assert [x.tur for x in c] == ["sulama_plani"] and c[0].metin == "Sulama: Çarşamba, 2 sa 25 dk." and c[0].sekme == "sulama-plani"
    assert c[0].dedupe_key == plan_candidates(G, "Jlnnlk", plan(sonraki=sul(1)), RULE, TODAY)[0].dedupe_key


def test_uzak_sulama_gunu_bildirim_uretmez_sure_yoksa_m3():
    assert plan_candidates(G, "J", plan(sonraki=sul(5)), RULE, TODAY) == []
    assert "≈ 100 m³" in plan_candidates(G, "J", plan(sonraki=sul(0, None)), RULE, TODAY)[0].metin


def test_ciddi_sapma_yalniz_esik_asilinca():
    assert plan_candidates(G, "J", plan(sapma_mm=-5, sapma_ciddi=False), RULE, TODAY) == []
    c = plan_candidates(G, "J", plan(sapma_mm=-35, sapma_ciddi=True), RULE, TODAY)
    assert [x.tur for x in c] == ["sulama_sapma"] and "35 mm az" in c[0].metin and c[0].oncelik == "onemli"


def test_plan_hazir_degilse_bildirim_yok():
    assert plan_candidates(G, "J", PlanYaniti(durum="veri_yok", neden="x", bugun=TODAY), RULE, TODAY) == []


def test_turler_tercihlerde_tanimli():
    assert {"sulama_plani", "sulama_sapma"} <= set(TYPES)
