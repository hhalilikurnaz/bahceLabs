"""Olay ve kademe → bildirim adayları (SAF, ADR 0018). Şablonla ve veriden; serbest metin yok."""

from __future__ import annotations

import uuid
from datetime import date

from bahcelab_backend.domain.agro.catalog import BildirimKurali
from bahcelab_backend.domain.events.service import EventView
from bahcelab_backend.domain.notifications import decision, templates
from bahcelab_backend.domain.notifications.types import Candidate, Oncelik

WEATHER_KINDS = ("don", "asiri_yagis", "ruzgar")


def event_importance(e: EventView, rule: BildirimKurali) -> Oncelik | None:
    """kritik: don, şiddetli olay (siddet=siddetli ya da çok kaynaklı yüksek güven); önemli: diğer olaylar; düşük güvenli olay bildirilmez (geçmiş kaydında kalır)."""
    if e.tur == "don" or e.siddet == "siddetli" or e.guven == rule.kritik_olay_guven:
        return "kritik"
    return None if e.guven == "dusuk" else "onemli"


def event_candidate(garden_id: uuid.UUID, garden: str, e: EventView, today: date, rule: BildirimKurali, anahtar: str) -> Candidate | None:
    """Taze, bildirilmeye değer olay için aday. Tahmin DON'u hava uyarısı yolundan gelir (çift bildirim olmasın)."""
    if e.durum not in ("olay", "bekliyor") or not decision.is_fresh_event(e.bitis, today, rule):
        return None
    if e.tahmin and e.tur == "don":
        return None
    importance: Oncelik | None = "onemli" if e.durum == "bekliyor" else event_importance(e, rule)  # doğrulama bekleyen düşüş: önemli düzeyde (özette), kritik olmaz
    if importance is None:
        return None
    d = e.ayrinti or {}
    data = {
        "en_dusuk_c": d.get("don.en_dusuk_c"), "yagis_mm": d.get("asiri_yagis.en_yuksek_24s_mm"), "hamle_kmh": d.get("ruzgar.en_yuksek_hamle_kmh"), "alan_da": e.alan_da,
    }
    title, body = templates.event_text(garden, e.tur, e.baslangic, e.bitis, data, forecast=e.tahmin, severe=e.siddet == "siddetli", pending=e.durum == "bekliyor", damage="s2_dusus" in e.turler and e.tur == "don")
    return Candidate(garden_id, "olay", importance, title, body, "hava" if e.tur in WEATHER_KINDS else "durum", decision.event_dedupe_key(garden_id, anahtar))


def tier_candidate(garden_id: uuid.UUID, garden: str, old: str | None, new: str, sentences: list[str], today: date) -> Candidate | None:
    if not decision.tier_dropped(old, new) or old is None:
        return None
    title, body = templates.tier_text(garden, old, new, sentences)
    return Candidate(garden_id, "kademe_dususu", "onemli", title, body, "durum", decision.tier_dedupe_key(garden_id, old, new, today))
