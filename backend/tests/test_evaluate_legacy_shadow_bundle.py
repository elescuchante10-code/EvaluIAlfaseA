"""POST /api/evaluate/ devuelve evaluation_context_bundle auditable y puede inyectar contexto mínimo al prompt."""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.main import app
from app.routers import evaluate
from app.services.auth import get_current_active_user


@pytest.fixture
def client(monkeypatch):
    async def fake_user():
        u = MagicMock()
        u.id = 1
        u.is_active = True
        u.role = "user"
        u.credits_balance = 999
        u.subscription = SimpleNamespace(status="active", plan_code="free")
        return u

    def fake_db():
        yield MagicMock()

    def fake_strategy(*args, **kwargs):
        return {
            "paragraphs": [{"index": 0, "text": "Párrafo de prueba para el bundle.", "footnote_numbers": [1]}],
            "footnotes": [
                {
                    "number": 1,
                    "paragraph_index": 0,
                    "snippet": "prueba",
                    "anchor_type": "phrase",
                    "note_type": "observation",
                    "severity": "MENOR",
                    "note_text": "Comentario de prueba.",
                }
            ],
            "evaluation_matrix": {
                "criteria": [],
                "total_score": 7,
                "overall_level": "Bueno",
                "general_summary": "Resumen de prueba.",
                "strengths": ["S1"],
                "main_weaknesses": ["W1"],
                "improvement_plan": "Plan de prueba.",
            },
            "metrics": {"total": 1, "error": 0, "improvement": 0, "observation": 1},
        }

    app.dependency_overrides[get_current_active_user] = fake_user
    app.dependency_overrides[get_db] = fake_db
    monkeypatch.setattr(evaluate, "evaluate_document_with_strategy", fake_strategy)
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_legacy_evaluate_includes_shadow_bundle(client):
    res = client.post(
        "/api/evaluate/",
        json={
            "document_id": 42,
            "paragraphs": ["Párrafo de prueba para el bundle."],
            "rubric_markdown": "---\nasignatura: Prueba\n---\n# R\nCriterio uno.",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    html_out = data["evaluation"]
    assert "Resumen de prueba." in html_out
    assert "Comentario de prueba." in html_out
    assert "evaluai-formal-report" in html_out
    bundle = data["evaluation_context_bundle"]
    assert bundle["bundle_kind"] == "evaluation_context_bundle"
    assert bundle["bundle_mode"] == "shadow"
    assert "shadow" in bundle["note"].lower()
    assert data["document_id"] == 42
    assert "formal_prompt_context_injected" in bundle
    cp = bundle.get("coverage_policy")
    assert isinstance(cp, dict)
    assert cp.get("target_observation_count", 0) >= 1
    assert cp.get("coverage_mode")


def test_legacy_evaluate_empty_document_still_returns_shadow_bundle(client):
    res = client.post(
        "/api/evaluate/",
        json={
            "document_id": 7,
            "paragraphs": ["", "  "],
            "rubric_markdown": "# R",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["evaluation"] == ""
    bundle = data["evaluation_context_bundle"]
    assert bundle["bundle_kind"] == "evaluation_context_bundle"
    assert bundle["bundle_mode"] == "shadow"
    assert bundle.get("formal_prompt_context_injected") is False
    cp = bundle.get("coverage_policy")
    assert isinstance(cp, dict)
    assert "target_observation_count" in cp


def test_render_legacy_evaluation_html_escapes_markup():
    raw = evaluate.render_legacy_evaluation_html(
        paragraphs=["x"],
        footnotes=[
            {
                "number": 1,
                "paragraph_index": 0,
                "snippet": "<b>xss</b>",
                "anchor_type": "phrase",
                "note_type": "observation",
                "severity": "MENOR",
                "note_text": "<script>bad</script>",
            }
        ],
        evaluation_matrix={"general_summary": "<em>no</em>"},
        coverage_policy={"coverage_mode": "x", "target_observation_count": 3, "coverage_rationale": "r"},
    )
    assert "&lt;script&gt;bad&lt;/script&gt;" in raw
    assert "&lt;b&gt;xss&lt;/b&gt;" in raw
    assert "&lt;em&gt;no&lt;/em&gt;" in raw
