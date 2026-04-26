import base64

from app.services import document_multimodal


def test_build_chat_image_thumbnail_returns_metadata_even_without_pillow(monkeypatch):
    """El helper NUNCA debe romper el chat: si Pillow no está, degrada con metadata mínima."""
    monkeypatch.setattr(document_multimodal, "_safe_import_pillow", lambda: None)

    # data URL válido; el contenido no se usará porque Pillow está desactivado.
    fake_bytes = b"\x89PNG\r\n\x1a\nfake"
    data_url = "data:image/png;base64," + base64.b64encode(fake_bytes).decode("ascii")

    result = document_multimodal.build_chat_image_thumbnail(data_url, "image/png")

    assert result["thumbnail_data_url"] is None
    assert result["mime_type"] == "image/png"
    assert result["width"] == 0
    assert result["height"] == 0


def test_build_chat_image_thumbnail_handles_invalid_data_url():
    """Ante data URL corrupto debe degradar sin lanzar excepción."""
    result = document_multimodal.build_chat_image_thumbnail("no-es-data-url", "image/png")

    assert result["thumbnail_data_url"] is None
    assert result["mime_type"] == "image/png"


def test_select_relevant_visual_candidates_ignores_small_decorative_assets():
    candidates = [
        {
            "asset_id": "small-logo",
            "width_px": 80,
            "height_px": 80,
            "nearby_text": "Logo institucional en cabecera",
            "probable_type": "foto",
            "is_low_text_page": False,
        },
        {
            "asset_id": "main-graph",
            "width_px": 1200,
            "height_px": 900,
            "nearby_text": "Figura 1. Gráfico de oferta y demanda con explicación del estudiante.",
            "probable_type": "grafica",
            "is_low_text_page": False,
        },
    ]

    selected = document_multimodal.select_relevant_visual_candidates(candidates)

    assert [item["asset_id"] for item in selected] == ["main-graph"]
    assert selected[0]["probable_relevance"] == "high"


def test_cache_document_processing_returns_safe_copy():
    payload = {
        "text_source": "native",
        "visual_context_enabled": True,
        "visual_context": [{"type": "grafica", "summary": "curva de demanda", "probable_relevance": "high"}],
    }

    document_multimodal.cache_document_processing(9991, payload)
    cached = document_multimodal.get_cached_document_processing(9991)
    cached["visual_context"][0]["summary"] = "mutado"

    again = document_multimodal.get_cached_document_processing(9991)

    assert again["visual_context"][0]["summary"] == "curva de demanda"


def test_extract_document_payload_keeps_native_text_flow(monkeypatch):
    monkeypatch.setattr(
        document_multimodal,
        "_extract_txt_payload",
        lambda _: (
            [
                "Este es un documento con suficiente texto nativo para mantenerse en el flujo actual.",
                "Incluye varios párrafos y no necesita OCR adicional.",
            ],
            [],
        ),
    )

    extracted = document_multimodal.extract_document_payload("alumno.txt", b"contenido")

    assert extracted["paragraphs"][0].startswith("Este es un documento")
    assert extracted["processing"]["text_source"] == "native_text"
    assert extracted["processing"]["document_source_type"] == "native_text"
    assert extracted["processing"]["transcribed_paragraphs"] == []


def test_extract_document_payload_uses_transcription_for_scanned_handwritten(monkeypatch):
    candidates = [
        {
            "asset_id": "pdf-1-1",
            "page_number": 1,
            "width_px": 1200,
            "height_px": 1600,
            "nearby_text": "",
            "source_label": "Página 1",
            "probable_type": "foto",
            "image_bytes": b"fake-image",
            "mime_type": "image/png",
            "is_low_text_page": True,
        }
    ]
    monkeypatch.setattr(document_multimodal, "_extract_pdf_payload", lambda _: (["1 2"], candidates))
    monkeypatch.setattr(document_multimodal, "_vision_request_for_candidates", lambda _: [])
    monkeypatch.setattr(
        document_multimodal,
        "transcribe_visual_candidates",
        lambda _: {
            "source_type": "scanned_handwritten",
            "transcribed_paragraphs": ["Mi nombre es Ana.", "Resuelvo el problema con suma repetida."],
            "transcription_confidence": "medium",
            "transcription_confidence_score": 0.6,
            "low_confidence_spans": [{"asset_id": "pdf-1-1", "page_number": 1, "text": "repetida"}],
            "page_map": [
                {
                    "asset_id": "pdf-1-1",
                    "page_number": 1,
                    "paragraph_indexes": [0, 1],
                    "confidence": "medium",
                    "source_type": "scanned_handwritten",
                }
            ],
        },
    )

    extracted = document_multimodal.extract_document_payload("alumno.pdf", b"fake-pdf")

    assert extracted["paragraphs"] == ["Mi nombre es Ana.", "Resuelvo el problema con suma repetida."]
    assert extracted["processing"]["text_source"] == "ocr_transcription"
    assert extracted["processing"]["document_source_type"] == "scanned_handwritten"
    assert extracted["processing"]["transcription_confidence"] == "medium"
    assert extracted["processing"]["page_map"][0]["page_number"] == 1


def test_extract_document_payload_marks_mixed_when_native_and_transcribed_coexist(monkeypatch):
    native_paragraphs = [
        " ".join(["texto"] * 120),
        " ".join(["evidencia"] * 80),
    ]
    candidates = [
        {
            "asset_id": "pdf-2-1",
            "page_number": 2,
            "width_px": 1200,
            "height_px": 1600,
            "nearby_text": "",
            "source_label": "Página 2",
            "probable_type": "foto",
            "image_bytes": b"fake-image",
            "mime_type": "image/png",
            "is_low_text_page": True,
        }
    ]
    monkeypatch.setattr(document_multimodal, "_extract_pdf_payload", lambda _: (native_paragraphs, candidates))
    monkeypatch.setattr(document_multimodal, "_vision_request_for_candidates", lambda _: [])
    monkeypatch.setattr(
        document_multimodal,
        "transcribe_visual_candidates",
        lambda _: {
            "source_type": "scanned_printed",
            "transcribed_paragraphs": ["Anexo escaneado con observaciones del estudiante."],
            "transcription_confidence": "high",
            "transcription_confidence_score": 0.85,
            "low_confidence_spans": [],
            "page_map": [
                {
                    "asset_id": "pdf-2-1",
                    "page_number": 2,
                    "paragraph_indexes": [0],
                    "confidence": "high",
                    "source_type": "scanned_printed",
                }
            ],
        },
    )

    extracted = document_multimodal.extract_document_payload("mixto.pdf", b"fake-pdf")

    assert extracted["paragraphs"] == native_paragraphs
    assert extracted["processing"]["text_source"] == "mixed"
    assert extracted["processing"]["document_source_type"] == "mixed"
    assert extracted["processing"]["transcribed_paragraphs"] == ["Anexo escaneado con observaciones del estudiante."]
