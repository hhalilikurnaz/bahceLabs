"""Seed citrus product catalog."""

import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002_seed_products"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

LIMON_ID = uuid.UUID("a1000000-0000-4000-8000-000000000001")
MEYER_ID = uuid.UUID("a2000000-0000-4000-8000-000000000001")
CARRIZO_ID = uuid.UUID("a3000000-0000-4000-8000-000000000001")
VOLKAMERIANA_ID = uuid.UUID("a3000000-0000-4000-8000-000000000002")

PORTAKAL_ID = uuid.UUID("b1000000-0000-4000-8000-000000000001")
VALENCIA_ID = uuid.UUID("b2000000-0000-4000-8000-000000000001")
C35_ID = uuid.UUID("b3000000-0000-4000-8000-000000000001")


def upgrade() -> None:
    products = sa.table(
        "products",
        sa.column("id", sa.Uuid),
        sa.column("name", sa.String),
        sa.column("slug", sa.String),
        sa.column("description", sa.Text),
        sa.column("is_active", sa.Boolean),
    )
    varieties = sa.table(
        "varieties",
        sa.column("id", sa.Uuid),
        sa.column("product_id", sa.Uuid),
        sa.column("name", sa.String),
        sa.column("slug", sa.String),
        sa.column("recommended_planting_period", sa.String),
        sa.column("yield_start_period", sa.String),
        sa.column("is_active", sa.Boolean),
    )
    rootstocks = sa.table(
        "rootstocks",
        sa.column("id", sa.Uuid),
        sa.column("variety_id", sa.Uuid),
        sa.column("name", sa.String),
        sa.column("slug", sa.String),
        sa.column("is_active", sa.Boolean),
    )

    op.bulk_insert(
        products,
        [
            {
                "id": LIMON_ID,
                "name": "Limon",
                "slug": "limon",
                "description": "Citrus limon — Türkiye'de yaygın limon çeşitleri",
                "is_active": True,
            },
            {
                "id": PORTAKAL_ID,
                "name": "Portakal",
                "slug": "portakal",
                "description": "Citrus sinensis — Sofralık portakal çeşitleri",
                "is_active": True,
            },
        ],
    )

    op.bulk_insert(
        varieties,
        [
            {
                "id": MEYER_ID,
                "product_id": LIMON_ID,
                "name": "Meyer",
                "slug": "meyer",
                "recommended_planting_period": "Mart - Nisan",
                "yield_start_period": "3. yıl",
                "is_active": True,
            },
            {
                "id": VALENCIA_ID,
                "product_id": PORTAKAL_ID,
                "name": "Valencia",
                "slug": "valencia",
                "recommended_planting_period": "Mart - Mayıs",
                "yield_start_period": "4. yıl",
                "is_active": True,
            },
        ],
    )

    op.bulk_insert(
        rootstocks,
        [
            {
                "id": CARRIZO_ID,
                "variety_id": MEYER_ID,
                "name": "Carrizo",
                "slug": "carrizo",
                "is_active": True,
            },
            {
                "id": VOLKAMERIANA_ID,
                "variety_id": MEYER_ID,
                "name": "Volkameriana",
                "slug": "volkameriana",
                "is_active": True,
            },
            {
                "id": C35_ID,
                "variety_id": VALENCIA_ID,
                "name": "C-35",
                "slug": "c-35",
                "is_active": True,
            },
        ],
    )


def downgrade() -> None:
    op.execute("DELETE FROM rootstocks")
    op.execute("DELETE FROM varieties")
    op.execute("DELETE FROM products")
