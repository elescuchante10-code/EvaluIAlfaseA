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
        "retrieval_confidence": "heuristic_keyword_match",
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
    assert "CONTEXTO DE REFERENCIA ACADÉMICA" in text
    assert "MARCO MULTI-ASIGNATURA" in text
    assert "no se asume un programa fijo" in text
    assert "Marco disciplinar y de programa" in text
    assert "AUTORIDAD DE CONTENIDO" in text
    assert "evaluation_matrix" in text
    assert "FORMAL / MENOR / RELEVANTE / CRÍTICO" in text
    assert "Asignatura: Física" in text
    assert "Rol del documento evaluado: student_submission" in text
    assert "Perfil del documento entregado" in text
    assert "FRAGMENTOS DE REFERENCIA" in text
    assert text.count("[1]") == 1
    assert text.count("[4]") == 1
    assert "cuatro" in text
    assert len(text) < 50000


def test_formal_prompt_includes_rubric_encadre_when_only_rubric_summary():
    """C3.1: el encuadre mínimo de rúbrica basta para emitir el bloque formal (sin duplicar la rúbrica entera)."""
    bundle = {
        "bundle_kind": ecb.BUNDLE_KIND,
        "rubric_active_summary": {
            "title": "Rúbrica ensayo NM",
            "preview": "Criterios de argumentación y uso de fuentes.",
        },
        "subject": "",
        "document_role": None,
        "document_intelligence_profile": None,
        "teacher_context_snippets": [],
    }
    text = build_formal_evaluation_prompt_context(bundle)
    assert text
    assert "Encuadre de rúbrica" in text
    assert "Rúbrica ensayo NM" in text
    assert "argumentación" in text


def test_max_formal_snippets_constant_matches_reference():
    assert MAX_FORMAL_SNIPPETS == 12
