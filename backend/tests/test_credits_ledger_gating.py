from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app
from app.models.models import CreditLedgerEvent, Subscription, SubscriptionPlan, SubscriptionStatus, User
from app.routers import evaluate
from app.services.auth import get_current_active_user


@pytest.fixture()
def db_session(tmp_path):
    db_path = tmp_path / "credits.sqlite"
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
                credits_balance=0,
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

    def fake_strategy(*args, **kwargs):
        return {
            "footnotes": [],
            "evaluation_matrix": {
                "criteria": [],
                "total_score": 7,
                "overall_level": "Bueno",
                "general_summary": "Resumen de prueba.",
                "strengths": ["S1"],
                "main_weaknesses": ["W1"],
                "improvement_plan": "Plan de prueba.",
            },
            "metrics": {"total": 0, "error": 0, "improvement": 0, "observation": 0},
        }

    monkeypatch.setattr(evaluate, "evaluate_document_with_strategy", fake_strategy)
    yield TestClient(app)
    app.dependency_overrides.clear()


def _set_credits(db_session, amount: int):
    user = db_session.query(User).filter(User.email == "teacher@evaluai.test").first()
    if user is None:
        user = User(
            email="teacher@evaluai.test",
            hashed_password="hashed",
            full_name="Teacher Test",
            is_active=1,
            role="user",
            credits_balance=0,
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
        user = db_session.query(User).filter(User.email == "teacher@evaluai.test").first()
    user.credits_balance = amount
    db_session.commit()


def test_gating_returns_403_insufficient_credits(client, db_session):
    _set_credits(db_session, 0)
    res = client.post(
        "/api/evaluate/",
        json={
            "document_id": 42,
            "paragraphs": ["Párrafo de prueba."],
            "rubric_markdown": "# R",
        },
        headers={"X-Request-Id": "req-gating-1"},
    )
    assert res.status_code == 403
    detail = res.json().get("detail") or {}
    assert detail.get("code") == "insufficient_credits"


def test_deducts_only_after_success_and_writes_ledger(client, db_session):
    _set_credits(db_session, 10)
    res = client.post(
        "/api/evaluate/",
        json={
            "document_id": 42,
            "paragraphs": ["Párrafo de prueba."],
            "rubric_markdown": "# R",
        },
        headers={"X-Request-Id": "req-eval-1"},
    )
    assert res.status_code == 200
    user = db_session.query(User).filter(User.email == "teacher@evaluai.test").first()
    assert user.credits_balance == 5
    events = db_session.query(CreditLedgerEvent).filter(CreditLedgerEvent.request_id == "req-eval-1").all()
    assert len(events) == 1
    assert events[0].credits_delta == -5
    assert events[0].credits_before == 10
    assert events[0].credits_after == 5


def test_idempotency_same_request_id_does_not_double_charge(client, db_session):
    _set_credits(db_session, 10)
    payload = {
        "document_id": 42,
        "paragraphs": ["Párrafo de prueba."],
        "rubric_markdown": "# R",
    }
    headers = {"X-Request-Id": "req-eval-idem-1"}
    res1 = client.post("/api/evaluate/", json=payload, headers=headers)
    res2 = client.post("/api/evaluate/", json=payload, headers=headers)
    assert res1.status_code == 200
    assert res2.status_code == 200
    user = db_session.query(User).filter(User.email == "teacher@evaluai.test").first()
    assert user.credits_balance == 5
    assert db_session.query(CreditLedgerEvent).filter(CreditLedgerEvent.request_id == "req-eval-idem-1").count() == 1


def test_no_deduction_if_ai_fails(client, db_session, monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("provider timeout")

    monkeypatch.setattr(evaluate, "evaluate_document_with_strategy", boom)
    _set_credits(db_session, 10)

    res = client.post(
        "/api/evaluate/",
        json={
            "document_id": 42,
            "paragraphs": ["Párrafo de prueba."],
            "rubric_markdown": "# R",
        },
        headers={"X-Request-Id": "req-fail-1"},
    )
    assert res.status_code == 500
    user = db_session.query(User).filter(User.email == "teacher@evaluai.test").first()
    assert user.credits_balance == 10
    assert db_session.query(CreditLedgerEvent).filter(CreditLedgerEvent.request_id == "req-fail-1").count() == 0


def test_chat_deducts_1_credit_text_contextual(client, db_session, monkeypatch):
    monkeypatch.setattr(evaluate, "call_groq", lambda *args, **kwargs: "ok")
    _set_credits(db_session, 3)

    res = client.post(
        "/api/evaluate/chat",
        json={
            "mensaje": "Hola",
            "contexto": {"superficie": "chat_contextual"},
            "historial": [],
        },
        headers={"X-Request-Id": "req-chat-1"},
    )
    assert res.status_code == 200
    user = db_session.query(User).filter(User.email == "teacher@evaluai.test").first()
    assert user.credits_balance == 2
    assert db_session.query(CreditLedgerEvent).filter(CreditLedgerEvent.request_id == "req-chat-1").count() == 1

