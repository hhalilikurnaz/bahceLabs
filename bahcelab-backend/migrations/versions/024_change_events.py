"""Radar değişim olay adayları (ADR 0016): `change_events` — 9F olay motoru bunları tüketir."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "024_change_events"
down_revision: Union[str, None] = "023_radar_source"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "change_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("source_id", sa.String(40), sa.ForeignKey("data_sources.id"), nullable=False),
        sa.Column("scene_id", sa.String(120), nullable=False),
        sa.Column("tarih", sa.Date(), nullable=False, index=True),
        sa.Column("yorunge", sa.Integer(), nullable=False),
        sa.Column("gecis_yonu", sa.String(10), nullable=False),
        sa.Column("durum", sa.String(10), nullable=False),  # aday | gurultu
        sa.Column("isaret", sa.String(10), nullable=False),  # azalis | artis
        sa.Column("alan_orani", sa.Float(), nullable=False),
        sa.Column("alan_m2", sa.Float(), nullable=False),
        sa.Column("buyukluk_db", sa.Float(), nullable=False),
        sa.Column("bahce_delta_db", sa.Float(), nullable=True),
        sa.Column("kalici_sapma", sa.String(10), nullable=False),  # alt | ust | bant_ici | bant_yok
        sa.Column("art_arda", sa.Boolean(), nullable=False),
        sa.Column("islaklik_olabilir", sa.Boolean(), nullable=True),  # null: yağış verisi yok (bilinmiyor)
        sa.Column("yagis_mm", sa.Float(), nullable=True),
        sa.Column("formul_surumu", sa.String(40), nullable=False),
        sa.Column("hesaplama", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("garden_id", "source_id", "scene_id", name="uq_change_event_scene"),
    )


def downgrade() -> None:
    op.drop_table("change_events")
