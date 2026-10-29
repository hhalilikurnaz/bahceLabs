"""Bildirim adaylarını üretir (SAF): hava uyarıları, uydu uyarıları, sulama ihtiyacı. (Zararlı riski bildirimi seviyeyi izler: `NotificationService.reconcile_risks`.)
Her aday tekrar önleme anahtarı (`dedupe_key`) taşır: aynı olay iş tekrarında tek bildirim üretir."""

from __future__ import annotations

import uuid
from datetime import date

from bahcelab_backend.domain.agro.irrigation import IrrigationResult
from bahcelab_backend.domain.ndvi.schemas import Uyari
from bahcelab_backend.domain.notifications.types import Candidate
from bahcelab_backend.domain.weather.schemas import HavaUyarisi

# Gösterge → harita katmanı kimliği (ön yüzdeki `KatmanId`): düşüş bildirimi o göstergenin katmanında, düşüşü gören görüntüde açılır
INDEX_LAYER = {"ndvi": "canlilik", "ndre": "klorofil", "ndmi": "yaprakSuyu", "lai": "yaprakAlani", "msavi": "tacToprak"}


def build_candidates(
    garden_id: uuid.UUID,
    garden_name: str,
    *,
    weather_alerts: list[HavaUyarisi],
    satellite_alerts: list[Uyari],
    irrigation: IrrigationResult | None,
    today: date,
) -> list[Candidate]:
    out: list[Candidate] = []
    for alert in weather_alerts:
        kind = "hava_don" if alert.tur == "don" else "hava_sicak"
        out.append(
            Candidate(garden_id, kind, "kritik" if alert.seviye == "kirmizi" else "onemli", f"{garden_name}: {alert.baslik}", alert.mesaj, "hava",
                      f"hava:{garden_id}:{alert.tur}:{alert.baslangic}:{alert.seviye}")
        )
    for sat in satellite_alerts:
        out.append(
            Candidate(garden_id, "indeks_dususu", "onemli" if sat.oncelik == "yuksek" else "bilgi", f"{garden_name}: {sat.baslik}", sat.mesaj, "durum",
                      f"uydu:{garden_id}:{sat.son_tarih}:{','.join(sorted(sat.indeksler))}",
                      harita=f"katman={INDEX_LAYER.get(sorted(sat.indeksler)[0], 'canlilik')}&tarih={sat.son_tarih}")
        )
    if irrigation is not None and irrigation.gerekli:
        iso = today.isocalendar()
        out.append(Candidate(garden_id, "sulama", "bilgi", f"{garden_name}: sulama ihtiyacı görünüyor", irrigation.cumle, "hava", f"sulama:{garden_id}:{iso.year}-W{iso.week:02d}"))
    return out
