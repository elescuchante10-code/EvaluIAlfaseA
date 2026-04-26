import json

from app.routers import evaluate


def _methodology_config():
    return {
        "methodology": "general_document",
        "methodology_label": "General del documento",
        "custom_instruction": "",
    }


def _evaluation_matrix():
    return {
        "criteria": [
            {
                "criterion": "Análisis conceptual",
                "weight": "50%",
                "score": 8,
                "max_score": 10,
                "level": "Bueno",
                "key_examples": ["[1] Ejemplo breve"],
            }
        ],
        "total_score": 80,
        "overall_level": "Bueno",
        "general_summary": "La respuesta cumple el criterio principal, pero aún puede afinar la justificación.",
    }


def test_short_document_prompt_and_json_contract(monkeypatch):
    captured_messages = []

    def fake_call_groq(messages, max_tokens=4000, temperature=0.0):
        captured_messages.append(messages)
        return json.dumps(
            {
                "footnotes": [
                    {
                        "paragraph_index": 0,
                        "snippet": "autonomía corporal",
                        "anchor_type": "phrase",
                        "note_type": "improvement",
                        "severity": "RELEVANTE",
                        "note_text": (
                            "No desarrolla la relación entre autonomía corporal y dependencia técnica. "
                            "Esto debilita el análisis conceptual del criterio. "
                            "Añade cómo la mediación tecnológica modifica la libertad moral. "
                            "Esta cuarta frase debe ser recortada."
                        ),
                    },
                    {
                        "paragraph_index": 1,
                        "snippet": "autoridad epistemológica",
                        "anchor_type": "phrase",
                        "note_type": "improvement",
                        "note_text": (
                            "No desarrolla la relación entre autoridad epistemológica y evidencia empírica. "
                            "El argumento queda afirmado, no demostrado. "
                            "Incorpora una cita o dato que sostenga la inferencia."
                        ),
                    },
                ],
                "evaluation_matrix": _evaluation_matrix(),
            },
            ensure_ascii=False,
        )

    monkeypatch.setattr(evaluate, "call_groq", fake_call_groq)

    result = evaluate.evaluate_short_document(
        paragraphs=[
            "La autonomía corporal se menciona sin conectar su dependencia de la tecnología.",
            "Se alude a la autoridad epistemológica sin respaldo empírico.",
        ],
        rubric_markdown="# Rúbrica\n- Criterio: Análisis conceptual",
        methodology_config=_methodology_config(),
    )

    assert set(result.keys()) == {"paragraphs", "footnotes", "evaluation_matrix", "metrics"}
    assert set(result["footnotes"][0].keys()) == {
        "number",
        "paragraph_index",
        "snippet",
        "anchor_type",
        "note_type",
        "severity",
        "note_text",
        "comment",
        "type",
    }
    assert result["metrics"]["total"] == len(result["footnotes"])
    assert sum("no desarrolla" in footnote["note_text"].lower() for footnote in result["footnotes"]) <= 1
    assert len(evaluate._split_sentences(result["footnotes"][0]["note_text"])) == 3
    assert result["footnotes"][0]["severity"] in evaluate.SEVERITY_LEVELS
    assert "strengths" in result["evaluation_matrix"]
    assert "main_weaknesses" in result["evaluation_matrix"]
    assert "improvement_plan" in result["evaluation_matrix"]

    sent_messages = captured_messages[0]
    assert "CALIDAD PEDAGÓGICA OBLIGATORIA" in sent_messages[0]["content"]
    assert "CONTRATO DE CALIDAD DEL FEEDBACK" in sent_messages[1]["content"]
    assert "PERFIL DISCIPLINAR" in sent_messages[1]["content"]
    assert "PRESUPUESTO DE FEEDBACK" in sent_messages[1]["content"]


def test_short_document_includes_visual_context_when_available(monkeypatch):
    captured_messages = []

    def fake_call_groq(messages, max_tokens=4000, temperature=0.0):
        captured_messages.append(messages)
        return json.dumps(
            {
                "footnotes": [],
                "evaluation_matrix": _evaluation_matrix(),
            },
            ensure_ascii=False,
        )

    monkeypatch.setattr(evaluate, "call_groq", fake_call_groq)

    evaluate.evaluate_short_document(
        paragraphs=["El gráfico se menciona, pero no se explica completamente."],
        rubric_markdown="# Rúbrica\n- Criterio: Uso de evidencia",
        methodology_config=_methodology_config(),
        document_context={
            "text_source": "native",
            "visual_context_enabled": True,
            "visual_context": [
                {
                    "type": "grafica",
                    "summary": "gráfico de oferta y demanda con curva descendente",
                    "probable_relevance": "high",
                    "page_number": 1,
                }
            ],
        },
    )

    sent_messages = captured_messages[0]
    assert "CONTEXTO VISUAL" in sent_messages[1]["content"]
    assert "texto nativo del documento sigue siendo la fuente principal" in sent_messages[1]["content"].lower()
    assert "gráfico de oferta y demanda" in sent_messages[1]["content"].lower()


def test_format_image_chat_response_preserves_single_footnote_contract():
    response = evaluate.format_image_chat_response(
        {
            "transcribed_paragraphs": ["La fotosíntesis transforma energía lumínica en química."],
            "transcription_confidence": "medium",
        },
        (
            "Retroalimentación: La idea central es correcta, pero falta precisar el rol de la clorofila.\n"
            "NOTA AL PIE: Precisa que la clorofila capta la energía lumínica al inicio del proceso."
        ),
    )

    assert "Texto detectado: La fotosíntesis transforma energía lumínica en química." in response
    assert "Confianza estimada: media" in response
    assert response.count("NOTA AL PIE:") == 1


def test_format_image_chat_response_handles_unreadable_image_without_breaking_shape():
    response = evaluate.format_image_chat_response(
        {
            "transcribed_paragraphs": [],
            "transcription_confidence": "low",
        },
        "",
    )

    assert "Texto detectado: No fue posible leer texto suficiente en la imagen." in response
    assert "Confianza estimada: baja" in response
    assert "Retroalimentación:" in response


def test_semantic_duplicate_comments_are_removed():
    result = evaluate.normalize_evaluation_result(
        paragraphs=[
            "La autonomía corporal se menciona sin mayor desarrollo.",
            "La idea vuelve a repetirse con otra formulación.",
        ],
        raw_result={
            "footnotes": [
                {
                    "paragraph_index": 0,
                    "snippet": "autonomía corporal",
                    "anchor_type": "phrase",
                    "note_type": "improvement",
                    "note_text": (
                        "No desarrolla la relación entre autonomía y dependencia técnica. "
                        "Esto debilita el análisis conceptual. "
                        "Añade una conexión explícita entre técnica y libertad moral."
                    ),
                },
                {
                    "paragraph_index": 1,
                    "snippet": "dependencia técnica",
                    "anchor_type": "phrase",
                    "note_type": "improvement",
                    "note_text": (
                        "No desarrolla la relación entre autonomía y dependencia técnica. "
                        "Esto debilita el análisis conceptual. "
                        "Añade una conexión explícita entre técnica y libertad moral."
                    ),
                },
            ],
            "evaluation_matrix": _evaluation_matrix(),
        },
    )

    assert len(result["footnotes"]) == 1
    assert result["metrics"]["total"] == 1
    assert result["footnotes"][0]["severity"] in evaluate.SEVERITY_LEVELS


def test_calibrate_critical_severity_downgrades_generic_critical_label():
    assert (
        evaluate.calibrate_critical_severity(
            "CRÍTICO",
            "El párrafo podría articular mejor la idea respecto al criterio.",
            "fragmento del texto",
        )
        == "RELEVANTE"
    )
    assert (
        evaluate.calibrate_critical_severity(
            "CRÍTICO",
            "La inferencia inválida entre premisa y conclusión invalida el argumento central respecto al criterio.",
            "por lo tanto",
        )
        == "CRÍTICO"
    )


def test_detect_discipline_uses_subject_and_keywords():
    rubric_markdown = """---
asignatura: Filosofía
---
# Rúbrica de ensayo
- Evalúa tesis, premisas, inferencias y contraargumentos.
"""

    profile = evaluate.detect_discipline(rubric_markdown)

    assert profile["label"] == "Filosofía"


def test_budget_and_humanized_feedback_are_applied():
    paragraphs = [
        " ".join(["texto"] * 300),
        " ".join(["texto"] * 300),
        " ".join(["texto"] * 300),
        " ".join(["texto"] * 300),
    ]
    issue_topics = [
        "tesis",
        "evidencia",
        "cohesión",
        "cronología",
        "causalidad",
        "contexto",
        "fuente",
        "estructura",
        "transición",
        "conclusión",
    ]
    raw_result = {
        "footnotes": [
            {
                "paragraph_index": index % len(paragraphs),
                "snippet": topic,
                "anchor_type": "phrase",
                "note_type": "improvement" if index % 2 else "error",
                "note_text": (
                    f"Conviene ampliar la {topic}. "
                    f"Resulta pertinente explicar mejor la {topic} dentro del criterio. "
                    f"Añade una justificación concreta sobre la {topic}."
                ),
            }
            for index, topic in enumerate(issue_topics)
        ],
        "evaluation_matrix": _evaluation_matrix(),
    }

    result = evaluate.normalize_evaluation_result(
        paragraphs=paragraphs,
        raw_result=raw_result,
        discipline_profile=evaluate.detect_discipline("Historia causalidad fuente contexto"),
        total_words=evaluate.count_words_in_paragraphs(paragraphs),
    )

    assert len(result["footnotes"]) <= evaluate.compute_feedback_budget(1200)
    assert all(footnote["severity"] in evaluate.SEVERITY_LEVELS for footnote in result["footnotes"])
    assert all("conviene ampliar" not in footnote["note_text"].lower() for footnote in result["footnotes"])
    assert all("resulta pertinente" not in footnote["note_text"].lower() for footnote in result["footnotes"])
    assert "improvement_plan" in result["evaluation_matrix"]


def test_long_document_strategy_preserves_json_shape(monkeypatch):
    responses = iter(
        [
            json.dumps(
                {
                    "footnotes": [
                        {
                            "paragraph_index": 0,
                            "snippet": "autonomía corporal",
                            "anchor_type": "phrase",
                            "note_type": "improvement",
                            "severity": "RELEVANTE",
                            "note_text": (
                                "No desarrolla la relación entre autonomía corporal y tecnología externa. "
                                "Esto reduce la precisión conceptual del criterio. "
                                "Añade una conexión explícita entre mediación técnica y libertad moral."
                            ),
                        }
                    ],
                    "chunk_summary": {"issues": ["Autonomía mencionada sin articulación conceptual"]},
                },
                ensure_ascii=False,
            ),
            json.dumps(
                {
                    "footnotes": [
                        {
                            "paragraph_index": 1,
                            "snippet": "evidencia empírica",
                            "anchor_type": "phrase",
                            "note_type": "improvement",
                            "severity": "RELEVANTE",
                            "note_text": (
                                "No desarrolla la relación entre tesis y evidencia empírica. "
                                "El argumento queda afirmado, no demostrado. "
                                "Incorpora un dato o una cita que sostenga la inferencia."
                            ),
                        }
                    ],
                    "chunk_summary": {"issues": ["Tesis sin respaldo verificable"]},
                },
                ensure_ascii=False,
            ),
            json.dumps(
                {
                    "global_footnotes": [
                        {
                            "paragraph_index": 1,
                            "snippet": "estructura global",
                            "anchor_type": "paragraph",
                            "note_type": "observation",
                            "severity": "RELEVANTE",
                            "note_text": (
                                "La transición entre los dos apartados deja el hilo argumental fragmentado. "
                                "Eso afecta la coherencia global del trabajo. "
                                "Añade una frase puente que explique cómo el segundo apartado desarrolla la tesis inicial."
                            ),
                        }
                    ],
                    "evaluation_matrix": _evaluation_matrix(),
                },
                ensure_ascii=False,
            ),
        ]
    )

    def fake_call_groq(messages, max_tokens=4000, temperature=0.0):
        return next(responses)

    def fake_chunk_paragraphs(paragraphs, target_words=0, max_words=0):
        return [
            {
                "start_index": 0,
                "end_index": 0,
                "word_count": 120,
                "paragraphs": [{"index": 0, "text": paragraphs[0]}],
            },
            {
                "start_index": 1,
                "end_index": 1,
                "word_count": 120,
                "paragraphs": [{"index": 1, "text": paragraphs[1]}],
            },
        ]

    monkeypatch.setattr(evaluate, "call_groq", fake_call_groq)
    monkeypatch.setattr(evaluate, "chunk_paragraphs", fake_chunk_paragraphs)

    result = evaluate.evaluate_long_document(
        paragraphs=[
            "La autonomía corporal aparece mencionada, pero no se explica su dependencia respecto de la tecnología.",
            "La tesis general se formula con claridad, aunque no incorpora evidencia empírica suficiente ni una transición sólida.",
        ],
        rubric_markdown="# Rúbrica\n- Criterio: Análisis conceptual\n- Criterio: Uso de evidencia",
        methodology_config=_methodology_config(),
    )

    assert set(result.keys()) == {"paragraphs", "footnotes", "evaluation_matrix", "metrics"}
    assert [footnote["number"] for footnote in result["footnotes"]] == list(range(1, len(result["footnotes"]) + 1))
    assert result["metrics"]["total"] == len(result["footnotes"])
    assert sum("no desarrolla" in footnote["note_text"].lower() for footnote in result["footnotes"]) <= 1
    assert isinstance(result["evaluation_matrix"], dict)
    assert "strengths" in result["evaluation_matrix"]
    assert "main_weaknesses" in result["evaluation_matrix"]
    assert "improvement_plan" in result["evaluation_matrix"]
