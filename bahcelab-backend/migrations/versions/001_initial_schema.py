"""Initial schema: simulation_plans + product catalog."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "simulation_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("garden_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("current_step", sa.String(20), nullable=False, server_default="land"),
        sa.Column(
            "draft_land",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text(
                """'{"geometry": null, "area_m2": null, "perimeter_m": null, """
                """"location_label": null, "validation_status": "not_set", """
                """"validation_message": null}'::jsonb"""
            ),
        ),
        sa.Column(
            "product_selection",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text(
                """'{"product_id": null, "product_name": null, "variety_id": null, """
                """"variety_name": null, "rootstock_id": null, "rootstock_name": null, """
                """"image_url": null, "recommended_planting_period": null, """
                """"yield_start_period": null}'::jsonb"""
            ),
        ),
        sa.Column("planting_plan", postgresql.JSONB, nullable=True),
        sa.Column("maintenance_plan", postgresql.JSONB, nullable=True),
        sa.Column("growth_simulation", postgresql.JSONB, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_simulation_plans_workspace_id", "simulation_plans", ["workspace_id"])

    op.create_table(
        "products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.create_table(
        "varieties",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("recommended_planting_period", sa.String(100), nullable=True),
        sa.Column("yield_start_period", sa.String(100), nullable=True),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
    )
    op.create_index("ix_varieties_product_id", "varieties", ["product_id"])

    op.create_table(
        "rootstocks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("variety_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
    )
    op.create_index("ix_rootstocks_variety_id", "rootstocks", ["variety_id"])


def downgrade() -> None:
    op.drop_table("rootstocks")
    op.drop_table("varieties")
    op.drop_table("products")
    op.drop_index("ix_simulation_plans_workspace_id", table_name="simulation_plans")
    op.drop_table("simulation_plans")
