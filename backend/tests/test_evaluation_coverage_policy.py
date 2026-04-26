from app.routers import evaluate
from app.services.evaluation_coverage_policy import build_evaluation_coverage_policy


def _words(n: int) -> str:
    return " ".join(["palabra"] * n)


def test_text_only_proportional_to_words():
    ctx = {
        "document_intelligence_profile": {
            "content_mode": "text_only",
            "document_role": "student_submission",
            "has_formulas": False,
            "has_tables": False,
            "has_charts": False,
            "has_diagrams": False,
            "has_images": False,
            "visual_evidence_relevant": False,
            "source_type": "native_text",
        }
    }
    p2000 = build_evaluation_coverage_policy(ctx, [_words(2000)], 2000)
    p4000 = build_evaluation_coverage_policy(ctx, [_words(4000)], 4000)
    assert p2000["coverage_mode"] == "textual_proportional"
    assert p2000["target_observation_count"] == 15
    assert p4000["target_observation_count"] == 30


def test_formula_heavy_prioritizes_evidence_not_word_count():
    low_words = 80
    paragraphs = ["Sea x el valor buscado.", "Entonces x = 2 y sustituyendo en la ecuación."]
    ctx = {
        "document_intelligence_profile": {
            "content_mode": "formula_heavy",
            "document_role": "student_submission",
            "has_formulas": True,
            "has_tables": True,
            "has_charts": True,
            "has_diagrams": True,
            "has_images": True,
            "visual_evidence_relevant": True,
            "source_type": "native_text",
        },
        "visual_context": [
            {"type": "formula"},
            {"type": "tabla"},
            {"type": "grafica"},
        ],
        "visual_analysis": {"analyzed_count": 4, "candidate_count": 4},
    }
    policy = build_evaluation_coverage_policy(ctx, paragraphs, low_words)
    assert policy["coverage_mode"] == "evidence_structured"
    word_only = evaluate.compute_feedback_budget(low_words)
    assert policy["target_observation_count"] > word_only


def test_mixed_combines_signals():
    ctx = {
        "document_intelligence_profile": {
            "content_mode": "mixed",
            "document_role": "report",
            "has_formulas": True,
            "has_tables": True,
            "has_charts": False,
            "has_diagrams": False,
            "has_images": True,
            "visual_evidence_relevant": True,
            "source_type": "native_text",
        },
        "visual_context": [{"type": "tabla"}],
    }
    policy = build_evaluation_coverage_policy(ctx, [_words(2000)], 2000)
    assert policy["coverage_mode"] == "hybrid_text_evidence"
    assert 12 <= policy["target_observation_count"] <= 40


def test_visual_heavy_mode_label_and_hints():
    ctx = {
        "document_intelligence_profile": {
            "content_mode": "visual_heavy",
            "document_role": "student_submission",
            "has_formulas": False,
            "has_tables": True,
            "has_charts": True,
            "has_diagrams": True,
            "has_images": True,
            "visual_evidence_relevant": True,
            "source_type": "native_text",
        },
        "visual_context": [{"type": "diagrama"}, {"type": "grafica"}],
    }
    policy = build_evaluation_coverage_policy(ctx, [_words(120)], 120)
    assert policy["coverage_mode"] == "visual_first"
    assert policy["distribution_hints"]["balance_text_and_visual_evidence"] is True


def test_feedback_budget_prompt_includes_coverage_lines():
    pol = build_evaluation_coverage_policy(
        {
            "document_intelligence_profile": {
                "content_mode": "text_only",
                "document_role": "essay",
                "has_formulas": False,
                "has_tables": False,
                "has_charts": False,
                "has_diagrams": False,
                "has_images": False,
                "visual_evidence_relevant": False,
                "source_type": "native_text",
            }
        },
        [_words(500)],
        500,
    )
    text = evaluate.build_feedback_budget_prompt(500, max_notes=pol["target_observation_count"], coverage_policy=pol)
    assert "Política de cobertura" in text
    assert "techo orientativo" in text.lower() or "cuota mínima" in text.lower()
