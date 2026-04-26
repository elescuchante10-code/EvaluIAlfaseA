from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app
from app.models.models import CreditLedgerEvent, Subscription, SubscriptionPlan, SubscriptionStatus, User
from app.services.auth import get_current_active_user


@pytest.fixture()
def db_session(tmp_path):
    db_path = tmp_path / "admin.sqlite"
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
def client(db_session):
    def override_db():
        yield db_session

    def override_admin_user():
        admin = db_session.query(User).filter(User.email == "admin@evaluai.test").first()
        if admin is None:
            admin = User(
                email="admin@evaluai.test",
                hashed_password="hashed",
                full_name="Admin",
                is_active=1,
                role="admin",
                credits_balance=0,
                account_type="individual",
            )
            db_session.add(admin)
            db_session.flush()
            db_session.add(
                Subscription(
                    user_id=admin.id,
                    plan_code=SubscriptionPlan.ENTERPRISE.value,
                    status=SubscriptionStatus.ACTIVE.value,
                )
            )
            db_session.commit()
        return db_session.query(User).filter(User.email == "admin@evaluai.test").first()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_active_user] = override_admin_user
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_admin_can_create_user_and_topup_and_export_csv(client, db_session):
    res = client.post(
        "/api/admin/users",
        json={
            "email": "teacher1@evaluai.test",
            "password": "password123",
            "full_name": "Teacher One",
            "credits_initial": 100,
            "account_type": "colegio",
            "institution_name": "Colegio Demo",
        },
        headers={"X-Request-Id": "admin-create-1"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["success"] is True
    assert data["user"]["email"] == "teacher1@evaluai.test"
    assert data["user"]["credits_balance"] == 100
    user_id = data["user"]["id"]

    top = client.post(
        f"/api/admin/users/{user_id}/topup",
        json={"credits_delta": 50, "reason": "Recarga Nequi"},
        headers={"X-Request-Id": "admin-topup-1"},
    )
    assert top.status_code == 200
    top_data = top.json()
    assert top_data["user"]["credits_balance"] == 150

    # ledger exists
    assert db_session.query(CreditLedgerEvent).filter(CreditLedgerEvent.user_id == user_id).count() >= 2

    csv_res = client.get(f"/api/admin/ledger/export.csv?user_id={user_id}")
    assert csv_res.status_code == 200
    assert "created_at,user_id,email,action,surface" in csv_res.text.splitlines()[0]


def test_non_admin_gets_403(db_session):
    def override_db():
        yield db_session

    def override_non_admin():
        u = db_session.query(User).filter(User.email == "user@evaluai.test").first()
        if u is None:
            u = User(
                email="user@evaluai.test",
                hashed_password="hashed",
                full_name="User",
                is_active=1,
                role="user",
                credits_balance=0,
                account_type="individual",
            )
            db_session.add(u)
            db_session.flush()
            db_session.add(
                Subscription(
                    user_id=u.id,
                    plan_code=SubscriptionPlan.FREE.value,
                    status=SubscriptionStatus.ACTIVE.value,
                )
            )
            db_session.commit()
        return db_session.query(User).filter(User.email == "user@evaluai.test").first()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_active_user] = override_non_admin
    client = TestClient(app)
    res = client.get("/api/admin/users")
    assert res.status_code == 403
    app.dependency_overrides.clear()

