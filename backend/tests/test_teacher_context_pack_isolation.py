"""
C4.3 — El pack / manifiesto de contexto docente no cruza user_id.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app
from app.models.models import (
    Document,
    DocumentStatus,
    Subscription,
    SubscriptionPlan,
    SubscriptionStatus,
    User,
)
from app.services.auth import get_current_active_user


@pytest.fixture()
def db_session(tmp_path):
    db_path = tmp_path / "iso.sqlite"
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    SessionTesting = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionTesting()
    try:
        u1 = User(
            email="a_pack_iso@evaluai.test",
            hashed_password="h",
            full_name="A",
            is_active=1,
            role="user",
            credits_balance=10,
        )
        u2 = User(
            email="b_pack_iso@evaluai.test",
            hashed_password="h",
            full_name="B",
            is_active=1,
            role="user",
            credits_balance=10,
        )
        session.add_all([u1, u2])
        session.flush()
        for u in (u1, u2):
            session.add(
                Subscription(
                    user_id=u.id,
                    plan_code=SubscriptionPlan.FREE.value,
                    status=SubscriptionStatus.ACTIVE.value,
                )
            )
        session.add_all(
            [
                Document(
                    user_id=u1.id,
                    filename="solo_a.pdf",
                    context_markdown_status="ready",
                    context_markdown_relpath="users/1/onlya.md",
                    file_size_bytes=1,
                    status=DocumentStatus.PENDING,
                ),
                Document(
                    user_id=u2.id,
                    filename="solo_b.pdf",
                    context_markdown_status="ready",
                    context_markdown_relpath="users/2/onlyb.md",
                    file_size_bytes=1,
                    status=DocumentStatus.PENDING,
                ),
            ]
        )
        session.commit()
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def test_teacher_context_pack_does_not_leak_across_users(db_session):
    """GET /api/documents/teacher-context/pack listado disjunto por usuario (C4.3)."""
    u_a = db_session.query(User).filter(User.email == "a_pack_iso@evaluai.test").first()
    u_b = db_session.query(User).filter(User.email == "b_pack_iso@evaluai.test").first()
    assert u_a and u_b

    def run_as(user: User) -> set[int]:
        def override_db():
            yield db_session

        def override_user():
            return user

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_active_user] = override_user
        try:
            c = TestClient(app)
            r = c.get("/api/documents/teacher-context/pack")
            assert r.status_code == 200, r.text
            data = r.json()
            out = set()
            for d in data.get("documents") or []:
                did = d.get("document_id")
                if did is not None:
                    out.add(int(did))
            return out
        finally:
            app.dependency_overrides.clear()

    ids_a = run_as(u_a)
    ids_b = run_as(u_b)
    assert ids_a and ids_b
    assert ids_a.isdisjoint(ids_b)


def test_teacher_context_manifest_does_not_leak_across_users(db_session):
    u_a = db_session.query(User).filter(User.email == "a_pack_iso@evaluai.test").first()
    u_b = db_session.query(User).filter(User.email == "b_pack_iso@evaluai.test").first()

    def run_as(user: User) -> set[int]:
        def override_db():
            yield db_session

        def override_user():
            return user

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_active_user] = override_user
        try:
            c = TestClient(app)
            r = c.get("/api/documents/teacher-context/manifest")
            assert r.status_code == 200, r.text
            data = r.json()
            out = set()
            for d in (data.get("documents") or data.get("items") or []) or []:
                if not isinstance(d, dict):
                    continue
                did = d.get("document_id") or d.get("id")
                if did is not None:
                    out.add(int(did))
            return out
        finally:
            app.dependency_overrides.clear()

    m_a = run_as(u_a)
    m_b = run_as(u_b)
    assert m_a and m_b
    assert m_a.isdisjoint(m_b)
