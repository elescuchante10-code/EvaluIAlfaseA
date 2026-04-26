"""Tablas de pagos pendientes y eventos Wompi.

Revision ID: 20260420_0002
Revises: 20260420_0001
Create Date: 2026-04-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.sql import func

revision: str = "20260420_0002"
down_revision: Union[str, None] = "20260420_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)

    if not insp.has_table("pending_payments"):
        op.create_table(
            "pending_payments",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("plan_code", sa.String(length=32), nullable=False, server_default="free"),
            sa.Column("reference", sa.String(length=80), nullable=False),
            sa.Column("provider", sa.String(length=32), nullable=False, server_default="wompi"),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="created"),
            sa.Column("amount_in_cents", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("currency", sa.String(length=8), nullable=False, server_default="COP"),
            sa.Column("checkout_url", sa.String(length=500), nullable=True),
            sa.Column("wompi_payment_link_id", sa.String(length=80), nullable=True),
            sa.Column("wompi_transaction_id", sa.String(length=120), nullable=True),
            sa.Column("redirect_url", sa.String(length=500), nullable=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=func.now(), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("reference"),
            sa.UniqueConstraint("wompi_payment_link_id"),
        )
        op.create_index("idx_pending_payments_user_status", "pending_payments", ["user_id", "status"], unique=False)
        op.create_index("ix_pending_payments_reference", "pending_payments", ["reference"], unique=True)
        op.create_index("ix_pending_payments_wompi_payment_link_id", "pending_payments", ["wompi_payment_link_id"], unique=True)

    if not insp.has_table("billing_events"):
        op.create_table(
            "billing_events",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("event_key", sa.String(length=255), nullable=False),
            sa.Column("event_type", sa.String(length=80), nullable=False),
            sa.Column("provider", sa.String(length=32), nullable=False, server_default="wompi"),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("pending_payment_id", sa.Integer(), nullable=True),
            sa.Column("reference", sa.String(length=80), nullable=True),
            sa.Column("transaction_id", sa.String(length=120), nullable=True),
            sa.Column("status", sa.String(length=32), nullable=True),
            sa.Column("checksum", sa.String(length=255), nullable=True),
            sa.Column("payload_json", sa.Text(), nullable=False),
            sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=func.now(), nullable=True),
            sa.ForeignKeyConstraint(["pending_payment_id"], ["pending_payments.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("event_key"),
        )
        op.create_index("ix_billing_events_event_key", "billing_events", ["event_key"], unique=True)
        op.create_index("ix_billing_events_event_type", "billing_events", ["event_type"], unique=False)
        op.create_index("ix_billing_events_reference", "billing_events", ["reference"], unique=False)
        op.create_index("ix_billing_events_transaction_id", "billing_events", ["transaction_id"], unique=False)
        op.create_index("ix_billing_events_user_id", "billing_events", ["user_id"], unique=False)
        op.create_index("ix_billing_events_pending_payment_id", "billing_events", ["pending_payment_id"], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)

    if insp.has_table("billing_events"):
        for index_name in (
            "ix_billing_events_pending_payment_id",
            "ix_billing_events_user_id",
            "ix_billing_events_transaction_id",
            "ix_billing_events_reference",
            "ix_billing_events_event_type",
            "ix_billing_events_event_key",
        ):
            try:
                op.drop_index(index_name, table_name="billing_events")
            except Exception:
                pass
        op.drop_table("billing_events")

    insp = inspect(conn)
    if insp.has_table("pending_payments"):
        for index_name in (
            "ix_pending_payments_wompi_payment_link_id",
            "ix_pending_payments_reference",
            "idx_pending_payments_user_status",
        ):
            try:
                op.drop_index(index_name, table_name="pending_payments")
            except Exception:
                pass
        op.drop_table("pending_payments")
