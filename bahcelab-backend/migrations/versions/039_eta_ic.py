"""9I Dilim 1A: uydudan ETa altyapısı (iç kalite): sahne ölçümleri, WaPOR L1 bağlamı, ECOSTRESS doğrulaması, kalibrasyon, kapı durumu."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "039_eta_ic"
down_revision: Union[str, None] = "038_sulama_agi"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    gid = lambda: sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), nullable=False)  # noqa: E731
    op.create_table(
        "eta_sahneler",
        gid(),
        sa.Column("tarih", sa.Date(), nullable=False),
        sa.Column("kaynak", sa.String(32), nullable=False),
        sa.Column("sahne_id", sa.String(80), nullable=False),
        sa.Column("platform", sa.String(16), nullable=True),
        sa.Column("termal_m", sa.Float(), nullable=True),  # fiziksel termal çözünürlük (m)
        sa.Column("bahce_piksel", sa.Integer(), nullable=False),
        sa.Column("gecerli_piksel", sa.Integer(), nullable=False),
        sa.Column("ic_piksel", sa.Integer(), nullable=False),
        sa.Column("gecerli_oran", sa.Float(), nullable=False),
        sa.Column("karisik_pay", sa.Float(), nullable=False),  # 1 − iç/tüm (kenar/karışık piksel payı)
        sa.Column("lst_k", sa.Float(), nullable=True),
        sa.Column("lst_ic_k", sa.Float(), nullable=True),
        sa.Column("sigma_lst_k", sa.Float(), nullable=True),  # ST_QA
        sa.Column("ndvi", sa.Float(), nullable=True),
        sa.Column("tc_soguk_k", sa.Float(), nullable=True),  # sahne soğuk referansı (tanı)
        sa.Column("n_soguk", sa.Integer(), nullable=True),
        sa.Column("dem_m", sa.Float(), nullable=True),
        sa.Column("ta_ham_k", sa.Float(), nullable=True),  # ERA5 Tmax
        sa.Column("ta_duz_k", sa.Float(), nullable=True),  # sapma + rakım düzeltmeli
        sa.Column("dt_k", sa.Float(), nullable=True),
        sa.Column("c_sahne", sa.Float(), nullable=True),
        sa.Column("c_uzun", sa.Float(), nullable=True),
        sa.Column("c_yayilim", sa.Float(), nullable=True),
        sa.Column("tc_k", sa.Float(), nullable=True),
        sa.Column("etf", sa.Float(), nullable=True),
        sa.Column("etf_ic", sa.Float(), nullable=True),
        sa.Column("etf_sigma", sa.Float(), nullable=True),
        sa.Column("et0_mm", sa.Float(), nullable=True),
        sa.Column("eta_mm", sa.Float(), nullable=True),
        sa.Column("durum", sa.String(16), nullable=False, server_default="ham"),  # ham | hesaplandi | elendi
        sa.Column("neden", sa.Text(), nullable=True),
        sa.Column("guncelleme", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("garden_id", "tarih", "kaynak", "sahne_id"),
    )
    op.create_table(
        "eta_meteo",
        gid(),
        sa.Column("tarih", sa.Date(), nullable=False),
        sa.Column("rs_mj", sa.Float(), nullable=True),
        sa.Column("tmax_c", sa.Float(), nullable=True),
        sa.Column("tmin_c", sa.Float(), nullable=True),
        sa.Column("tmean_c", sa.Float(), nullable=True),
        sa.Column("cig_c", sa.Float(), nullable=True),
        sa.Column("et0_mm", sa.Float(), nullable=True),
        sa.Column("yagis_mm", sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint("garden_id", "tarih"),
    )
    op.create_table(
        "eta_baglam",
        gid(),
        sa.Column("kaynak", sa.String(32), nullable=False),
        sa.Column("bas", sa.Date(), nullable=False),
        sa.Column("bit", sa.Date(), nullable=False),
        sa.Column("et_mm_gun", sa.Float(), nullable=True),
        sa.Column("piksel_dokunan", sa.Integer(), nullable=False),
        sa.Column("piksel_gecerli", sa.Integer(), nullable=False),
        sa.Column("piksel_m", sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint("garden_id", "kaynak", "bas"),
    )
    op.create_table(
        "eta_dogrulama",
        gid(),
        sa.Column("kaynak", sa.String(32), nullable=False),
        sa.Column("sahne_id", sa.String(96), nullable=False),
        sa.Column("tarih", sa.Date(), nullable=False),
        sa.Column("et_mm_gun", sa.Float(), nullable=True),
        sa.Column("piksel_gecerli", sa.Integer(), nullable=False),
        sa.Column("piksel_dokunan", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("garden_id", "kaynak", "sahne_id"),
    )
    op.create_table(
        "eta_kalibrasyon",
        gid(),
        sa.Column("tur", sa.String(16), nullable=False),  # ta_sapma | c_faktoru
        sa.Column("anahtar", sa.String(8), nullable=False),  # ay (01–12)
        sa.Column("deger", sa.Float(), nullable=True),
        sa.Column("yayilim", sa.Float(), nullable=True),
        sa.Column("n", sa.Integer(), nullable=False),
        sa.Column("guncelleme", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("garden_id", "tur", "anahtar"),
    )
    op.create_table(
        "eta_durum",
        sa.Column("garden_id", UUID(as_uuid=True), sa.ForeignKey("gardens.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tutarlilik_p90", sa.Float(), nullable=True),
        sa.Column("tutarlilik_medyan", sa.Float(), nullable=True),
        sa.Column("cift_sayisi", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("esik", sa.Float(), nullable=False),
        sa.Column("kapi", sa.String(8), nullable=False),  # kapali | acik
        sa.Column("neden", sa.Text(), nullable=False),
        sa.Column("alan_dekar", sa.Float(), nullable=True),
        sa.Column("sahne_sayisi", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("guncelleme", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    for t in ("eta_durum", "eta_kalibrasyon", "eta_dogrulama", "eta_baglam", "eta_meteo", "eta_sahneler"):
        op.drop_table(t)
