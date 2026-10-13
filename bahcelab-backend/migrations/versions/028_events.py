"""Olay motoru (ADR 0018): `events` + `event_sources`. Olay, kaynak kayıtlarını KOPYALAMAZ; `event_sources` onlara kimlikle referans verir."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "028_events"
down_revision: Union[str, None] = "027_chirps_disabled"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("anahtar", sa.String(80), nullable=False),  # tur:baslangic — yeniden hesapta kimlik sabit kalır (bildirim dedupe'u buna bağlanır)
        sa.Column("tur", sa.String(20), nullable=False),  # don | asiri_yagis | ruzgar | s2_dusus | radar_degisim (birleşik olayda baskın tür)
        sa.Column("turler", JSONB, nullable=False),  # olayı oluşturan sinyal türleri
        sa.Column("baslangic", sa.Date(), nullable=False, index=True),
        sa.Column("bitis", sa.Date(), nullable=False),
        sa.Column("alan_da", sa.Float(), nullable=True),  # YALNIZ olay motorunun kendi ölçtüğü alan (S2); radar alanı kaynaktan okunur
        sa.Column("guven", sa.String(10), nullable=False),  # dusuk | orta | yuksek
        sa.Column("siddet", sa.String(10), nullable=True),  # normal | siddetli (don)
        sa.Column("katman", sa.String(20), nullable=True),  # ilgili harita katmanı (yoksa Hava sekmesi)
        sa.Column("tahmin", sa.Boolean(), nullable=False, server_default=sa.false()),  # bitiş bugünden sonra: tahmine dayalı uyarı
        sa.Column("ayrinti", JSONB, nullable=True),  # eşik değerleri ve ölçümler (kaynak kayıtlarında olmayanlar)
        sa.Column("formul_surumu", sa.String(40), nullable=False),
        sa.Column("hesaplama", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("garden_id", "anahtar", name="uq_event_key"),
    )
    op.create_table(
        "event_sources",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("event_id", UUID(as_uuid=True), sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("kaynak_tablosu", sa.String(30), nullable=False),  # change_events | acquisitions | era5_daily
        sa.Column("kaynak_kimligi", sa.String(80), nullable=False),  # uuid ya da «hücre:tarih» (era5_daily bileşik anahtarı)
        sa.Column("rol", sa.String(20), nullable=False),  # sinyal türü: s2_dusus | radar_degisim | don | asiri_yagis | ruzgar
        sa.Column("tarih", sa.Date(), nullable=False),
        sa.UniqueConstraint("event_id", "kaynak_tablosu", "kaynak_kimligi", "rol", name="uq_event_source"),
    )


def downgrade() -> None:
    op.drop_table("event_sources")
    op.drop_table("events")
