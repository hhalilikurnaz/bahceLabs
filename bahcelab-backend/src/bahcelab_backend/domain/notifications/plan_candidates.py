"""Sulama planı bildirimleri (ADR 0023): YALNIZ iki tür — «sulama günü yaklaştı» ve «plandan ciddi sapma». Eşikler katalogda (`sulama_plani`)."""

from __future__ import annotations

import uuid
from datetime import date

from bahcelab_backend.domain.agro.catalog import SulamaPlaniKurali
from bahcelab_backend.domain.irrigation.schemas import PlanYaniti
from bahcelab_backend.domain.notifications.types import Candidate

GUN = ("Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar")


def _sure(dk: int) -> str:
    h, m = divmod(dk, 60)
    return f"{h} sa {m} dk" if h and m else f"{h} sa" if h else f"{m} dk"


def plan_candidates(garden_id: uuid.UUID, name: str, plan: PlanYaniti, rule: SulamaPlaniKurali, today: date) -> list[Candidate]:
    if plan.durum != "hazir":
        return []
    out: list[Candidate] = []
    nxt = plan.sonraki
    if nxt is not None and 0 <= (nxt.tarih - today).days <= rule.yaklasma_gun:
        detail = f", {_sure(nxt.emitor_dakika)}" if nxt.emitor_dakika else f", ≈ {nxt.m3_bahce:.0f} m³"
        out.append(
            Candidate(garden_id, "sulama_plani", "bilgi", f"{name}: sulama günü yaklaştı", f"Sulama: {GUN[nxt.tarih.weekday()]}{detail}.", "su/sulama", f"sulamaplani:{garden_id}:{nxt.tarih}")
        )
    if plan.sapma_ciddi and plan.sapma_mm is not None:
        iso = today.isocalendar()
        way = "fazla" if plan.sapma_mm > 0 else "az"
        out.append(
            Candidate(
                garden_id, "sulama_sapma", "onemli", f"{name}: sulama plandan ciddi sapıyor",
                f"Son 14 günde uyguladığınız sulama plandan ≈ {abs(plan.sapma_mm):.0f} mm {way}.", "su/sulama", f"sulamasapma:{garden_id}:{iso.year}-W{iso.week:02d}",
            )
        )
    return out
