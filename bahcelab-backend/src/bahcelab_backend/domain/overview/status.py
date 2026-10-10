"""Bahçe durum etiketi: uyarı kurallarından türetilir. TEK fonksiyon (Adım 8'de bahçe durumu skoruna bağlanacak)."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Literal

Durum = Literal["iyi", "izle", "dikkat", "veri_yok"]
Seviye = Literal["sari", "kirmizi"]


def derive_status(*, has_data: bool, severities: Sequence[Seviye]) -> Durum:
    """Kural: görüntü yoksa «veri yok»; kırmızı uyarı varsa «dikkat»; sarı uyarı varsa «izle»; yoksa «iyi».

    `severities`: uydu uyarıları (öncelik yüksek → kırmızı) ve hava uyarılarının (don/sıcak) seviyeleri.
    """
    if "kirmizi" in severities:
        return "dikkat"
    if not has_data:
        return "veri_yok"
    return "izle" if severities else "iyi"
