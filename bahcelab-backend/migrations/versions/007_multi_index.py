"""Çoklu indeks: ndvi_observations → scene_observations + index_observations (mevcut NDVI verisi taşınır)."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "007_multi_index"
down_revision: Union[str, None] = "006_ndvi"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NOW = sa.text("now()")


def upgrade() -> None:
    op.create_table(
        "scene_observations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "garden_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("gardens.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tarih", sa.Date, nullable=False),
        sa.Column("scene_id", sa.String(120), nullable=False),
        sa.Column("durum", sa.String(10), nullable=False, server_default="tamam"),
        sa.Column("bulut_orani", sa.Float, nullable=True),
        sa.Column("gecerli_piksel_orani", sa.Float, nullable=False),
        sa.Column("satir", sa.Integer, nullable=True),
        sa.Column("sutun", sa.Integer, nullable=True),
        sa.Column("goruntu_koordinatlari", postgresql.JSONB, nullable=True),
        sa.Column("gercek_renk_png_yolu", sa.Text, nullable=True),
        sa.Column("kaynak", sa.String(20), nullable=False, server_default="sentinel-2"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.UniqueConstraint("garden_id", "tarih", name="uq_scene_garden_tarih"),
        sa.CheckConstraint("durum IN ('tamam', 'bulutlu')", name="ck_scene_durum"),
    )
    op.create_index("ix_scene_observations_garden_id", "scene_observations", ["garden_id"])

    op.create_table(
        "index_observations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "garden_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("gardens.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tarih", sa.Date, nullable=False),
        sa.Column("indeks", sa.String(20), nullable=False),
        sa.Column("ortalama", sa.Float, nullable=False),
        sa.Column("medyan", sa.Float, nullable=False),
        sa.Column("p10", sa.Float, nullable=False),
        sa.Column("p90", sa.Float, nullable=False),
        sa.Column("min", sa.Float, nullable=False),
        sa.Column("max", sa.Float, nullable=False),
        sa.Column("png_yolu", sa.Text, nullable=True),
        sa.Column("veri_yolu", sa.Text, nullable=True),
        sa.Column("sorunlu_bolge_geojson", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.UniqueConstraint("garden_id", "tarih", "indeks", name="uq_index_garden_tarih_indeks"),
        sa.ForeignKeyConstraint(
            ["garden_id", "tarih"],
            ["scene_observations.garden_id", "scene_observations.tarih"],
            ondelete="CASCADE",
        ),
    )
    op.create_index("ix_index_observations_garden_id", "index_observations", ["garden_id"])

    # Mevcut NDVI verisi taşınır; sahneler yeniden indirilmez. Eski PNG'ler olduğu gibi kullanılır,
    # eksik ham ızgara/diğer indeksler bir sonraki işte yalnızca gereken bantlar okunarak tamamlanır.
    op.execute(
        """
        INSERT INTO scene_observations
            (id, garden_id, tarih, scene_id, durum, bulut_orani, gecerli_piksel_orani,
             goruntu_koordinatlari, kaynak, created_at)
        SELECT id, garden_id, tarih, scene_id, durum, bulut_orani, gecerli_piksel_orani,
               goruntu_koordinatlari, kaynak, created_at
        FROM ndvi_observations
        """
    )
    op.execute(
        """
        INSERT INTO index_observations
            (id, garden_id, tarih, indeks, ortalama, medyan, p10, p90, min, max,
             png_yolu, sorunlu_bolge_geojson, created_at)
        SELECT gen_random_uuid(), garden_id, tarih, 'ndvi', ortalama, medyan, p10, p90, min, max,
               png_yolu, sorunlu_bolge_geojson, created_at
        FROM ndvi_observations
        WHERE durum = 'tamam' AND ortalama IS NOT NULL
        """
    )
    # Eski sorunlu bölge özelliği `ortalama_ndvi` idi; genel adı `ortalama`
    op.execute(
        """
        UPDATE index_observations
        SET sorunlu_bolge_geojson = jsonb_set(
            sorunlu_bolge_geojson, '{features}',
            COALESCE((
                SELECT jsonb_agg(
                    jsonb_set(f, '{properties}',
                        (f->'properties') - 'ortalama_ndvi'
                        || jsonb_build_object('ortalama', f->'properties'->'ortalama_ndvi'))
                )
                FROM jsonb_array_elements(sorunlu_bolge_geojson->'features') AS f
            ), '[]'::jsonb)
        )
        WHERE sorunlu_bolge_geojson IS NOT NULL
        """
    )

    op.drop_index("ix_ndvi_observations_garden_id", table_name="ndvi_observations")
    op.drop_table("ndvi_observations")


def downgrade() -> None:
    op.create_table(
        "ndvi_observations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "garden_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("gardens.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tarih", sa.Date, nullable=False),
        sa.Column("scene_id", sa.String(120), nullable=False),
        sa.Column("durum", sa.String(10), nullable=False, server_default="tamam"),
        sa.Column("bulut_orani", sa.Float, nullable=True),
        sa.Column("gecerli_piksel_orani", sa.Float, nullable=False),
        sa.Column("ortalama", sa.Float, nullable=True),
        sa.Column("medyan", sa.Float, nullable=True),
        sa.Column("p10", sa.Float, nullable=True),
        sa.Column("p90", sa.Float, nullable=True),
        sa.Column("min", sa.Float, nullable=True),
        sa.Column("max", sa.Float, nullable=True),
        sa.Column("png_yolu", sa.Text, nullable=True),
        sa.Column("sorunlu_bolge_geojson", postgresql.JSONB, nullable=True),
        sa.Column("goruntu_koordinatlari", postgresql.JSONB, nullable=True),
        sa.Column("kaynak", sa.String(20), nullable=False, server_default="sentinel-2"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.UniqueConstraint("garden_id", "tarih", name="uq_ndvi_garden_tarih"),
        sa.CheckConstraint("durum IN ('tamam', 'bulutlu')", name="ck_ndvi_durum"),
    )
    op.create_index("ix_ndvi_observations_garden_id", "ndvi_observations", ["garden_id"])
    op.execute(
        """
        INSERT INTO ndvi_observations
            (id, garden_id, tarih, scene_id, durum, bulut_orani, gecerli_piksel_orani, ortalama,
             medyan, p10, p90, min, max, png_yolu, sorunlu_bolge_geojson, goruntu_koordinatlari,
             kaynak, created_at)
        SELECT s.id, s.garden_id, s.tarih, s.scene_id, s.durum, s.bulut_orani, s.gecerli_piksel_orani,
               i.ortalama, i.medyan, i.p10, i.p90, i.min, i.max, i.png_yolu, i.sorunlu_bolge_geojson,
               s.goruntu_koordinatlari, s.kaynak, s.created_at
        FROM scene_observations s
        LEFT JOIN index_observations i
               ON i.garden_id = s.garden_id AND i.tarih = s.tarih AND i.indeks = 'ndvi'
        """
    )
    op.drop_index("ix_index_observations_garden_id", table_name="index_observations")
    op.drop_table("index_observations")
    op.drop_index("ix_scene_observations_garden_id", table_name="scene_observations")
    op.drop_table("scene_observations")
