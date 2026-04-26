from app.services.document_intelligence import build_document_intelligence_profile


def _base_processing(**kwargs):
    base = {
        "document_router": {"type": "generic", "confidence": 0.5, "signals": []},
        "document_source_type": "native_text",
        "native_text_sufficient": True,
        "native_text_word_count": 400,
        "visual_context_enabled": False,
        "visual_context": [],
        "visual_analysis": {
            "candidate_count": 0,
            "analyzed_count": 0,
            "relevant_count": 0,
            "vision_failed": False,
        },
        "transcribed_paragraphs": [],
        "page_map": [],
    }
    base.update(kwargs)
    return base


def test_profile_rubric_role():
    proc = _base_processing(
        document_router={"type": "rubric", "confidence": 0.9, "signals": ["text:rubrica"]},
    )
    p = build_document_intelligence_profile("criterios.docx", "criterio y descriptor", proc)
    assert p["document_role"] == "rubric"
    assert p["content_mode"] == "text_only"
    assert p["source_type"] == "native_text"


def test_profile_lab_from_report_coarse():
    proc = _base_processing(
        document_router={"type": "report", "confidence": 0.8, "signals": []},
    )
    text = "Metodología experimental y resultados del laboratorio con hipótesis clara."
    p = build_document_intelligence_profile("informe.pdf", text, proc)
    assert p["document_role"] == "lab_response"


def test_profile_handwriting_mixed():
    proc = _base_processing(
        document_source_type="mixed",
        page_map=[{"source_type": "scanned_handwritten", "asset_id": "a1"}],
    )
    p = build_document_intelligence_profile("scan.pdf", "algo de texto", proc)
    assert p["has_handwriting"] is True


def test_profile_visual_chart_flags():
    proc = _base_processing(
        visual_context_enabled=True,
        visual_context=[
            {"type": "grafica", "probable_relevance": "high", "summary": "curva"},
        ],
        visual_analysis={"candidate_count": 2, "analyzed_count": 1, "relevant_count": 1, "vision_failed": False},
    )
    p = build_document_intelligence_profile("fig.pdf", "texto corto", proc)
    assert p["has_images"] is True
    assert p["has_charts"] is True
    assert p["visual_evidence_relevant"] is True


def test_profile_student_submission_exam():
    proc = _base_processing(document_router={"type": "exam", "confidence": 0.9, "signals": []})
    text = "Nombre y apellido: Ana López. Curso 3B. Responda todas las preguntas."
    p = build_document_intelligence_profile("entrega.pdf", text, proc)
    assert p["document_role"] == "student_submission"


def test_empty_processing_safe_defaults():
    p = build_document_intelligence_profile("x.txt", "hello world", None)
    assert p["document_role"] == "generic"
    assert p["source_type"] == "native_text"
    assert p["has_images"] is False
