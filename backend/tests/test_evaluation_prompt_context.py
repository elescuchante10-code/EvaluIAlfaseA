from app.services import evaluation_context_bundle as ecb
from app.services.evaluation_prompt_context import (
    MAX_FORMAL_SNIPPETS,
    build_formal_evaluation_prompt_context,
)


def test_formal_prompt_empty_for_non_bundle():
    assert build_formal_evaluation_prompt_context({}) == ""
    assert build_formal_evaluation_prompt_context({"bundle_kind": "other"}) == ""


def test_formal_prompt_empty_when_no_useful_fields():
    bundle = {
        "bundle_kind": ecb.BUNDLE_KIND,
        "subject": "",
        "document_role": None,
        "document_intelligence_profile": None,
        "teacher_context_snippets": [],
        "retrieval_used": False,
    }
    assert build_formal_evaluation_prompt_context(bundle) == ""


def test_formal_prompt_includes_policy_and_caps_snippets():
    bundle = {
        "bundle_kind": ecb.BUNDLE_KIND,
        "subject": "Física",
        "document_role": "student_submission",
        "document_intelligence_profile": {
            "content_mode": "mixed",
            "has_formulas": True,
            "has_tables": True,
        },
        "retrieval_used": True,
        "teacher_context_snippets": [
            {
                "filename": "g.md",
                "categoria_documental": "guide",
                "snippet": "x" * 500,
            },
            {"filename": "b.md", "categoria_documental": "guide", "snippet": "dos"},
            {"filename": "c.md", "categoria_documental": "guide", "snippet": "tres"},
            {"filename": "d.md", "categoria_documental": "guide", "snippet": "cuatro"},
        ],
    }
    text = build_formal_evaluation_prompt_context(bundle)
    assert "POLÍTICA DE USO" in text
    assert "La rúbrica provista" in text
    assert "FORMAL / MENOR / RELEVANTE / CRÍTICO" in text
    assert "Asignatura de trabajo: Física" in text
    assert "Rol documental: student_submission" in text
    assert "Perfil del documento" in text
    assert text.count("Fragmentos de referencia") == 1
    assert text.count(". (") == MAX_FORMAL_SNIPPETS
    assert "cuatro" not in text
