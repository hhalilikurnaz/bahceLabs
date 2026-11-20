"""Sistem yanıtlarının (10B «Sebep buydu», ADIM 10 «Don oldu mu?») gözlem etiketiyle yazılması (ADR 0034 §5): eşleme katalogda (`gunluk.sistem_eslesme`), eşleşmeyen yanıt etiketsiz kalır."""

from __future__ import annotations

import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.agro.catalog import load_catalog


def hedef_etiket(grup: str, yanit: str) -> tuple[str, str] | None:
    """Sistem yanıtı → (kategori, etiket); karşılığı yoksa None. `grup`: sebep_yaniti | don_yaniti."""
    hedef = load_catalog().gunluk.sistem_eslesme.get(grup, {}).get(yanit)
    if hedef is None:
        return None
    kategori, etiket = hedef.split(".", 1)
    return kategori, etiket


async def etiket_yaz(session: AsyncSession, record_id: uuid.UUID, grup: str, yanit: str, iliski_anahtar: str | None) -> bool:
    """Eşleşme varsa `gozlem_detay` (kaynak = sistem) yazar; yazdıysa True."""
    h = hedef_etiket(grup, yanit)
    if h is None:
        return False
    await session.execute(
        text("INSERT INTO gozlem_detay (record_id, kategori, etiket, kaynak, iliski_anahtar) VALUES (:r, :k, :e, 'sistem', :a)"),
        {"r": record_id, "k": h[0], "e": h[1], "a": iliski_anahtar},
    )
    return True
