"""Credits balance + ledger.

Revision ID: 20260423_0003
Revises: 20260420_0002
Create Date: 2026-04-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.sql import func

revision: str = "20260423_0003"
down_revision: Union[str, None] = "20260420_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)

    # --- users columns (add if missing) ---
    cols = {c["name"] for c in insp.get_columns("users")} if insp.has_table("users") else set()

    if "credits_balance" not in cols:
        op.add_column("users", sa.Column("credits_balance", sa.Integer(), nullable=False, server_default="0"))
    if "account_type" not in cols:
        op.add_column("users", sa.Column("account_type", sa.String(length=32), nullable=False, server_default="individual"))
    if "institution_name" not in cols:
        op.add_column("users", sa.Column("institution_name", sa.String(length=255), nullable=True))

    # --- ledger table ---
    if not insp.has_table("credit_ledger_events"):
        op.create_table(
            "credit_ledger_events",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("action", sa.String(length=64), nullable=False),
            sa.Column("surface", sa.String(length=64), nullable=False),
            sa.Column("credits_delta", sa.Integer(), nullable=False),
            sa.Column("credits_before", sa.Integer(), nullable=False),
            sa.Column("credits_after", sa.Integer(), nullable=False),
            sa.Column("doc_id", sa.Integer(), nullable=True),
            sa.Column("request_id", sa.String(length=80), nullable=False),
            sa.Column("tokens_used", sa.Integer(), nullable=True),
            sa.Column("provider_cost_usd", sa.Float(), nullable=True),
            sa.Column("meta_json", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=func.now(), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("request_id"),
        )
        op.create_index("ix_credit_ledger_events_user_id", "credit_ledger_events", ["user_id"], unique=False)
        op.create_index("ix_credit_ledger_events_action", "credit_ledger_events", ["action"], unique=False)
        op.create_index("ix_credit_ledger_events_surface", "credit_ledger_events", ["surface"], unique=False)
        op.create_index("ix_credit_ledger_events_doc_id", "credit_ledger_events", ["doc_id"], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)

    if insp.has_table("credit_ledger_events"):
        for index_name in (
            "ix_credit_ledger_events_doc_id",
            "ix_credit_ledger_events_surface",
            "ix_credit_ledger_events_action",
            "ix_credit_ledger_events_user_id",
        ):
            try:
                op.drop_index(index_name, table_name="credit_ledger_events")
            except Exception:
                pass
        op.drop_table("credit_ledger_events")

    if insp.has_table("users"):
        cols = {c["name"] for c in insp.get_columns("users")}
        for name in ("institution_name", "account_type", "credits_balance"):
            if name in cols:
                try:
                    op.drop_column("users", name)
                except Exception:
                    pass

