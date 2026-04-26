"""Pruebas de billing Wompi."""
from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app
from app.models.models import BillingEvent, CreditLedgerEvent, PendingPayment, Subscription, SubscriptionPlan, SubscriptionStatus, User
from app.services import wompi_service
from app.services.auth import get_current_active_user


@pytest.fixture()
def db_session(tmp_path):
    db_path = tmp_path / "wompi.sqlite"
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    SessionTesting = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionTesting()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session, monkeypatch):
    settings = SimpleNamespace(
        WOMPI_SKIP_SIGNATURE_VALIDATION=False,
        WOMPI_EVENT_SECRET="unit-test-secret",
        WOMPI_PRIVATE_KEY="unit-test-private-key",
        WOMPI_ENVIRONMENT="sandbox",
        WOMPI_API_BASE_URL="https://sandbox.wompi.co/v1",
        WOMPI_CHECKOUT_BASE_URL="https://checkout.wompi.co/l",
        FRONTEND_URL="http://localhost:3000",
        WOMPI_PAYMENT_SUCCESS_PATH="/payment-success",
        WOMPI_INDIVIDUAL_AMOUNT_CENTS=3500000,
        WOMPI_INSTITUTIONAL_AMOUNT_CENTS=200000000,
        WOMPI_TIMEOUT_SECONDS=5,
    )

    def override_db():
        yield db_session

    def override_user():
        user = db_session.query(User).filter(User.email == "teacher@evaluai.test").first()
        if user is None:
            user = User(
                email="teacher@evaluai.test",
                hashed_password="hashed",
                full_name="Teacher Test",
                is_active=1,
                role="user",
            )
            db_session.add(user)
            db_session.flush()
            db_session.add(
                Subscription(
                    user_id=user.id,
                    plan_code=SubscriptionPlan.FREE.value,
                    status=SubscriptionStatus.ACTIVE.value,
                )
            )
            db_session.commit()
        return db_session.query(User).filter(User.email == "teacher@evaluai.test").first()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_active_user] = override_user

    monkeypatch.setattr(
        wompi_service,
        "_http_json",
        lambda *args, **kwargs: {"data": {"id": "plink_123456"}},
    )
    monkeypatch.setattr(wompi_service, "get_settings", lambda: settings)
    yield TestClient(app)
    app.dependency_overrides.clear()


def _ensure_teacher_user(db_session):
    user = db_session.query(User).filter(User.email == "teacher@evaluai.test").first()
    if user is None:
        user = User(
            email="teacher@evaluai.test",
            hashed_password="hashed",
            full_name="Teacher Test",
            is_active=1,
            role="user",
        )
        db_session.add(user)
        db_session.flush()
        db_session.add(
            Subscription(
                user_id=user.id,
                plan_code=SubscriptionPlan.FREE.value,
                status=SubscriptionStatus.ACTIVE.value,
            )
        )
        db_session.commit()
    return db_session.query(User).filter(User.email == "teacher@evaluai.test").first()


def test_create_payment_link_persists_pending_payment(client, db_session):
    response = client.post(
        "/api/billing/wompi/payment-links",
        json={"plan_code": "pro"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["provider"] == "wompi"
    assert data["plan_code"] == "pro"
    assert data["payment_link_id"] == "plink_123456"
    assert data["checkout_url"].endswith("/plink_123456")
    assert data["reference"].startswith("EVAI-PRO-U")
    pending = db_session.query(PendingPayment).filter(PendingPayment.reference == data["reference"]).first()
    assert pending is not None
    assert pending.status == "created"
    assert pending.wompi_payment_link_id == "plink_123456"
    assert pending.checkout_url == data["checkout_url"]


def test_payment_status_endpoint_returns_current_payment(client, db_session):
    user = _ensure_teacher_user(db_session)
    pending = PendingPayment(
        user_id=user.id,
        plan_code=SubscriptionPlan.PRO.value,
        reference="EVAI-PRO-U1-TEST",
        provider="wompi",
        status="created",
        amount_in_cents=3500000,
        currency="COP",
        checkout_url="https://checkout.wompi.co/l/plink_abc",
        wompi_payment_link_id="plink_abc",
        redirect_url="http://localhost:3000/payment-success?reference=EVAI-PRO-U1-TEST",
        expires_at=datetime.now(timezone.utc),
    )
    db_session.add(pending)
    db_session.commit()

    response = client.get("/api/billing/wompi/payments/EVAI-PRO-U1-TEST")
    assert response.status_code == 200
    data = response.json()
    assert data["reference"] == "EVAI-PRO-U1-TEST"
    assert data["status"] == "created"
    assert data["payment_link_id"] == "plink_abc"


def test_webhook_approves_payment_and_activates_subscription(client, db_session, monkeypatch):
    user = _ensure_teacher_user(db_session)
    user.credits_balance = 10
    db_session.commit()
    pending = PendingPayment(
        user_id=user.id,
        plan_code=SubscriptionPlan.PRO.value,
        reference="EVAI-PRO-U1-APPROVED",
        provider="wompi",
        status="created",
        amount_in_cents=3500000,
        currency="COP",
        checkout_url="https://checkout.wompi.co/l/plink_approved",
        wompi_payment_link_id="plink_approved",
        redirect_url="http://localhost:3000/payment-success?reference=EVAI-PRO-U1-APPROVED",
        expires_at=datetime.now(timezone.utc),
    )
    db_session.add(pending)
    db_session.commit()

    monkeypatch.setattr(wompi_service, "validate_wompi_event_signature", lambda payload, headers=None: True)
    payload = {
        "event": "transaction.updated",
        "timestamp": "2026-04-20T12:00:00Z",
        "signature": {"checksum": "checksum-1", "properties": ["data.transaction.id", "data.transaction.status"]},
        "data": {
            "transaction": {
                "id": "tx_approved_1",
                "status": "APPROVED",
                "reference": "EVAI-PRO-U1-APPROVED",
                "payment_link_id": "plink_approved",
            }
        },
    }

    response = client.post("/api/billing/wompi/webhook", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["processed"] is True
    assert data["status"] == "approved"

    refreshed = db_session.query(PendingPayment).filter(PendingPayment.reference == "EVAI-PRO-U1-APPROVED").first()
    assert refreshed is not None
    assert refreshed.status == "approved"
    assert refreshed.wompi_transaction_id == "tx_approved_1"

    subscription = db_session.query(Subscription).filter(Subscription.user_id == user.id).first()
    assert subscription is not None
    assert subscription.plan_code == SubscriptionPlan.PRO.value
    assert subscription.status == SubscriptionStatus.ACTIVE.value
    assert subscription.current_period_end is not None

    refreshed_user = db_session.query(User).filter(User.id == user.id).first()
    assert refreshed_user is not None
    assert refreshed_user.credits_balance == 510

    ledger = db_session.query(CreditLedgerEvent).filter(CreditLedgerEvent.user_id == user.id).all()
    assert any(e.action == "Wompi_CreditPurchase" and e.surface == "wompi" and e.credits_delta == 500 for e in ledger)

    event = db_session.query(BillingEvent).filter(BillingEvent.reference == "EVAI-PRO-U1-APPROVED").first()
    assert event is not None
    assert event.processed_at is not None

    # Duplicate webhook (same event_key) must not double credit
    response2 = client.post("/api/billing/wompi/webhook", json=payload)
    assert response2.status_code == 200
    refreshed_user2 = db_session.query(User).filter(User.id == user.id).first()
    assert refreshed_user2 is not None
    assert refreshed_user2.credits_balance == 510


def test_webhook_invalid_signature_does_not_credit(client, db_session):
    user = _ensure_teacher_user(db_session)
    user.credits_balance = 20
    db_session.commit()
    pending = PendingPayment(
        user_id=user.id,
        plan_code=SubscriptionPlan.PRO.value,
        reference="EVAI-PRO-U1-BADSIG",
        provider="wompi",
        status="created",
        amount_in_cents=3500000,
        currency="COP",
        checkout_url="https://checkout.wompi.co/l/plink_bad",
        wompi_payment_link_id="plink_bad",
        redirect_url="http://localhost:3000/payment-success?reference=EVAI-PRO-U1-BADSIG",
        expires_at=datetime.now(timezone.utc),
    )
    db_session.add(pending)
    db_session.commit()

    payload = {
        "event": "transaction.updated",
        "timestamp": "2026-04-20T12:00:00Z",
        "signature": {"checksum": "definitely-wrong", "properties": ["data.transaction.id", "data.transaction.status"]},
        "data": {
            "transaction": {
                "id": "tx_bad_sig_1",
                "status": "APPROVED",
                "reference": "EVAI-PRO-U1-BADSIG",
                "payment_link_id": "plink_bad",
            }
        },
    }

    response = client.post("/api/billing/wompi/webhook", json=payload)
    assert response.status_code == 400

    refreshed_user = db_session.query(User).filter(User.id == user.id).first()
    assert refreshed_user is not None
    assert refreshed_user.credits_balance == 20
    assert db_session.query(CreditLedgerEvent).filter(CreditLedgerEvent.user_id == user.id).count() == 0


def test_compute_and_validate_wompi_checksum(monkeypatch):
    settings = SimpleNamespace(
        WOMPI_SKIP_SIGNATURE_VALIDATION=False,
        WOMPI_EVENT_SECRET="shared-secret",
    )
    monkeypatch.setattr(wompi_service, "get_settings", lambda: settings)

    payload = {
        "event": "transaction.updated",
        "timestamp": "2026-04-20T12:00:00Z",
        "signature": {
            "properties": ["data.transaction.id", "data.transaction.status"],
        },
        "data": {
            "transaction": {
                "id": "tx-123",
                "status": "APPROVED",
            }
        },
    }
    checksum = wompi_service.compute_event_checksum(payload, "shared-secret")
    payload["signature"]["checksum"] = checksum
    assert wompi_service.validate_wompi_event_signature(payload, headers={"X-Event-Checksum": checksum}) is True
