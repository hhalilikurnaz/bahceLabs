"""Saha Defteri (ADR 0019): saha kayıtları, fotoğraflar, olay/uyarı doğrulamaları ve saha turu ziyaretleri."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geometry
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "032_field_book"
down_revision: Union[str, None] = "031_hls_observations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "field_records",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tur", sa.String(12), nullable=False),
        sa.Column("tarih", sa.Date(), nullable=False),
        sa.Column("konum_tur", sa.String(6), nullable=True),
        sa.Column("konum", Geometry(geometry_type="GEOMETRY", srid=4326, spatial_index=False), nullable=True),
        sa.Column("aciklama", sa.Text(), nullable=True),
        sa.Column("ayrinti", JSONB, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("tur IN ('gozlem','ilaclama','gubreleme','sulama','hasat','tuzak')", name="ck_field_record_tur"),
        sa.CheckConstraint("konum_tur IS NULL OR konum_tur IN ('nokta','alan')", name="ck_field_record_konum_tur"),
    )
    op.create_index("ix_field_records_garden_id", "field_records", ["garden_id"])
    op.create_index("ix_field_records_tarih", "field_records", ["tarih"])
    op.create_table(
        "event_verifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False),
        sa.Column("hedef_tur", sa.String(6), nullable=False),
        sa.Column("hedef_anahtar", sa.String(200), nullable=False),
        sa.Column("baslik", sa.String(200), nullable=False),
        sa.Column("tur_grubu", sa.String(12), nullable=False),
        sa.Column("turler", JSONB, nullable=False, server_default="[]"),
        sa.Column("baslangic", sa.Date(), nullable=False),
        sa.Column("bitis", sa.Date(), nullable=False),
        sa.Column("guven", sa.String(10), nullable=True),
        sa.Column("durum_anlik", sa.String(10), nullable=False),
        sa.Column("sonuc", sa.String(16), nullable=False),
        sa.Column("aciklama", sa.Text(), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("garden_id", "hedef_tur", "hedef_anahtar", name="uq_verification_target"),
        sa.CheckConstraint("hedef_tur IN ('olay','uyari')", name="ck_verification_hedef_tur"),
        sa.CheckConstraint("sonuc IN ('gerceklesti','gerceklesmedi','bilinmiyor')", name="ck_verification_sonuc"),
    )
    op.create_index("ix_event_verifications_garden_id", "event_verifications", ["garden_id"])
    op.create_table(
        "field_photos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False),
        sa.Column("record_id", UUID(as_uuid=True), sa.ForeignKey("field_records.id", ondelete="CASCADE"), nullable=True),
        sa.Column("verification_id", UUID(as_uuid=True), sa.ForeignKey("event_verifications.id", ondelete="CASCADE"), nullable=True),
        sa.Column("dosya_yolu", sa.String(200), nullable=False),
        sa.Column("icerik_turu", sa.String(20), nullable=False),
        sa.Column("boyut_bayt", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("(record_id IS NOT NULL) <> (verification_id IS NOT NULL)", name="ck_photo_one_owner"),
    )
    op.create_index("ix_field_photos_garden_id", "field_photos", ["garden_id"])
    op.create_index("ix_field_photos_record_id", "field_photos", ["record_id"])
    op.create_index("ix_field_photos_verification_id", "field_photos", ["verification_id"])
    op.create_table(
        "tour_visits",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nokta_anahtar", sa.String(160), nullable=False),
        sa.Column("ziyaret_zamani", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("record_id", UUID(as_uuid=True), sa.ForeignKey("field_records.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.UniqueConstraint("garden_id", "nokta_anahtar", name="uq_tour_visit"),
    )
    op.create_index("ix_tour_visits_garden_id", "tour_visits", ["garden_id"])


def downgrade() -> None:
    op.drop_table("tour_visits")
    op.drop_table("field_photos")
    op.drop_table("event_verifications")
    op.drop_table("field_records")
