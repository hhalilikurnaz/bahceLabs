"""Saha Defteri: «Yağış ölçümü (mm)» kayıt türü (`yagis`)."""

from typing import Sequence, Union

from alembic import op

revision: str = "037_yagis_olcumu"
down_revision: Union[str, None] = "036_irrigation_sectors"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_field_record_tur", "field_records", type_="check")
    op.create_check_constraint("ck_field_record_tur", "field_records", "tur IN ('gozlem','ilaclama','gubreleme','sulama','hasat','tuzak','yagis')")


def downgrade() -> None:
    op.execute("DELETE FROM field_records WHERE tur = 'yagis'")
    op.drop_constraint("ck_field_record_tur", "field_records", type_="check")
    op.create_check_constraint("ck_field_record_tur", "field_records", "tur IN ('gozlem','ilaclama','gubreleme','sulama','hasat','tuzak')")
