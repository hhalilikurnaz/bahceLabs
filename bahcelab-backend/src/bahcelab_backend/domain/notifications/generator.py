"""Bildirim adaylarını üretir (SAF): hava uyarıları, uydu uyarıları, yüksek zararlı riski, sulama ihtiyacı.
Her aday tekrar önleme anahtarı (`dedupe_key`) taşır: aynı olay iş tekrarında tek bildirim üretir."""

from __future__ import annotations

import uuid
from datetime import date

from bahcelab_backend.domain.agro.irrigation import IrrigationResult
from bahcelab_backend.domain.agro.risks import RiskSonucu
from bahcelab_backend.domain.ndvi.schemas import Uyari
from bahcelab_backend.domain.notifications.types import Candidate
from bahcelab_backend.domain.weather.schemas import HavaUyarisi


def build_candidates(
    garden_id: uuid.UUID,
    garden_name: str,
    *,
    weather_alerts: list[HavaUyarisi],
    satellite_alerts: list[Uyari],
    risks: list[RiskSonucu],
    irrigation: IrrigationResult | None,
    today: date,
) -> list[Candidate]:
    out: list[Candidate] = []
    for alert in weather_alerts:
        kind = "hava_don" if alert.tur == "don" else "hava_sicak"
        out.append(
            Candidate(garden_id, kind, "kritik" if alert.seviye == "kirmizi" else "uyari", f"{garden_name}: {alert.baslik}", alert.mesaj, "hava",
                      f"hava:{garden_id}:{alert.tur}:{alert.baslangic}:{alert.seviye}")
        )
    for sat in satellite_alerts:
        out.append(
            Candidate(garden_id, "indeks_dususu", "kritik" if sat.oncelik == "yuksek" else "uyari", f"{garden_name}: {sat.baslik}", sat.mesaj, "durum",
                      f"uydu:{garden_id}:{sat.son_tarih}:{','.join(sorted(sat.indeksler))}")
        )
    for risk in risks:
        if risk.seviye == "yuksek" and risk.veri_yeterli:
            out.append(
                Candidate(garden_id, "zararli_riski", "uyari", f"{garden_name}: {risk.ad} – yüksek risk", f"{risk.gerekce} (Risk tahminidir, teşhis değildir.)", "hava",
                          f"risk:{garden_id}:{risk.kod}:{risk.gecerlilik_baslangic}")
            )
    if irrigation is not None and irrigation.gerekli:
        iso = today.isocalendar()
        out.append(Candidate(garden_id, "sulama", "bilgi", f"{garden_name}: sulama ihtiyacı görünüyor", irrigation.cumle, "hava", f"sulama:{garden_id}:{iso.year}-W{iso.week:02d}"))
    return out
