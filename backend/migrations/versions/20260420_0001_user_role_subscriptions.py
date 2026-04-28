"""Rol de usuario, tabla subscriptions y datos iniciales.

Revision ID: 20260420_0001
Revises:
Create Date: 2026-04-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text
from sqlalchemy.sql import func

revision: str = "20260420_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)

    if insp.has_table("users"):
        cols = {c["name"] for c in insp.get_columns("users")}
        if "role" not in cols:
            op.add_column(
                "users",
                sa.Column(
                    "role",
                    sa.String(length=20),
                    nullable=False,
                    server_default="user",
                ),
            )

    if not insp.has_table("subscriptions"):
        op.create_table(
            "subscriptions",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("plan_code", sa.String(length=32), nullable=False, server_default="free"),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
            sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
            sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=func.now(), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id"),
        )
        op.create_index("idx_subscriptions_status", "subscriptions", ["status"], unique=False)

    conn.execute(
        text(
            """
            INSERT INTO subscriptions (user_id, plan_code, status)
            SELECT u.id, 'free', 'active'
            FROM users u
            WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id)
            """
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    if insp.has_table("subscriptions"):
        for ix in insp.get_indexes("subscriptions"):
            if ix.get("name") == "idx_subscriptions_status":
                op.drop_index("idx_subscriptions_status", table_name="subscriptions")
                break
        op.drop_table("subscriptions")
    insp = inspect(conn)
    if insp.has_table("users"):
        cols = {c["name"] for c in insp.get_columns("users")}
        if "role" in cols:
            op.drop_column("users", "role")
