from types import SimpleNamespace
from unittest.mock import MagicMock

from app.services import teacher_context_pipeline as tcp
from app.services import teacher_context_retrieval as tcr

_DB = MagicMock()
_OWNER = 1


def _patch_fs(monkeypatch, root):
    monkeypatch.setattr(tcp, "TEACHER_CONTEXT_ROOT", root)


def _patch_owned_always(monkeypatch):
    monkeypatch.setattr(
        tcr,
        "_owned_document_row",
        lambda db, did, uid: SimpleNamespace(
            id=int(did), user_id=int(uid), context_markdown_relpath=None
        ),
    )


def _pack(docs):
    return {"pack_kind": "teacher_context_pack", "documents": docs}


def test_retrieval_keyword_in_paragraph(monkeypatch, tmp_path):
    _patch_owned_always(monkeypatch)
    root = tmp_path / "teacher_context"
    (root / "md").mkdir(parents=True)
    (root / "md" / "7.md").write_text(
        "---\ndocument_id: 7\n---\n\n"
        "Intro breve.\n\n"
        "La unidad aborda el problema del conocimiento científico y sus límites.\n",
        encoding="utf-8",
    )
    _patch_fs(monkeypatch, root)

    ctx = {
        "teacher_context_pack": _pack(
            [
                {
                    "document_id": "7",
                    "filename": "guia_epistemologia.pdf",
                    "markdown_status": "ready",
                    "categoria_documental": "guide",
                }
            ]
        )
    }
    bundle = tcr.build_teacher_context_snippets_bundle(
        "¿Qué temas cubre la unidad?", ctx, db=_DB, owner_user_id=_OWNER
    )
    assert bundle["retrieval_mode"] in ("markdown_selective", "markdown_selective_tfidf")
    assert bundle["documents_considered"] == 1
    assert len(bundle["snippets"]) >= 1
    assert "conocimiento" in bundle["snippets"][0]["snippet"].lower()

    prompt = tcr.format_teacher_context_snippets_for_prompt(bundle)
    assert "Fragmentos recuperados" in prompt
    assert "doc_id=7" in prompt


def test_retrieval_empty_without_ready_markdown(monkeypatch, tmp_path):
    _patch_owned_always(monkeypatch)
    root = tmp_path / "teacher_context"
    (root / "md").mkdir(parents=True)
    _patch_fs(monkeypatch, root)

    ctx = {
        "teacher_context_pack": _pack(
            [
                {
                    "document_id": "99",
                    "filename": "x.pdf",
                    "markdown_status": "pending",
                    "categoria_documental": "guide",
                }
            ]
        )
    }
    bundle = tcr.build_teacher_context_snippets_bundle(
        "contenido unidad conocimiento", ctx, db=_DB, owner_user_id=_OWNER
    )
    assert bundle["snippets"] == []
    assert bundle.get("note")


def test_retrieval_intro_intent_uses_first_paragraph_without_body_keywords(monkeypatch, tmp_path):
    """Preguntas con introducción/estímulo anclan al 1.º bloque aunque no haya match en el cuerpo."""
    _patch_owned_always(monkeypatch)
    root = tmp_path / "teacher_context"
    (root / "md").mkdir(parents=True)
    (root / "md" / "5.md").write_text(
        "---\ndocument_id: 5\n---\n\n"
        "PRIMERA_LINEA_SIN_COINCIDENTS_CLAROS_XYZ.\n\n"
        "Segundo bloque con términos no relacionados a la pregunta abcqwerty.\n",
        encoding="utf-8",
    )
    _patch_fs(monkeypatch, root)

    ctx = {
        "teacher_context_pack": _pack(
            [
                {
                    "document_id": "5",
                    "filename": "doc_nombre_generico_sin_match.pdf",
                    "markdown_status": "ready",
                    "categoria_documental": "assessment",
                }
            ]
        )
    }
    bundle = tcr.build_teacher_context_snippets_bundle(
        "¿Qué dice la introducción a esta tarea?", ctx, db=_DB, owner_user_id=_OWNER
    )
    assert len(bundle["snippets"]) >= 1
    assert bundle["snippets"][0]["document_id"] == 5
    sn = bundle["snippets"][0]["snippet"].lower()
    assert "primera" in sn or "linea" in sn or "xyz" in sn


def test_retrieval_filename_intro_when_keyword_only_in_name(monkeypatch, tmp_path):
    _patch_owned_always(monkeypatch)
    root = tmp_path / "teacher_context"
    (root / "md").mkdir(parents=True)
    (root / "md" / "3.md").write_text(
        "---\ndocument_id: 3\n---\n\n"
        "Este es el primer párrafo visible de la guía publicada.\n\n"
        "Segundo bloque sin palabras de la consulta.\n",
        encoding="utf-8",
    )
    _patch_fs(monkeypatch, root)

    ctx = {
        "teacher_context_pack": _pack(
            [
                {
                    "document_id": "3",
                    "filename": "guia_filosofia_2024.pdf",
                    "markdown_status": "ready",
                    "categoria_documental": "guide",
                }
            ]
        )
    }
    bundle = tcr.build_teacher_context_snippets_bundle(
        "¿De qué habla mi guía de filosofía?", ctx, db=_DB, owner_user_id=_OWNER
    )
    assert len(bundle["snippets"]) >= 1
    assert bundle["snippets"][0]["document_id"] == 3


def test_retrieval_prefers_ib_objectives_over_timetable_when_asking_criteria(monkeypatch, tmp_path):
    """Criterio vs «objetivo de evaluación» en guías IB: evitar anclar solo a tablas con horas."""
    _patch_owned_always(monkeypatch)
    root = tmp_path / "teacher_context"
    (root / "md").mkdir(parents=True)
    (root / "md" / "2.md").write_text(
        "---\ndocument_id: 2\n---\n\n"
        "En clase reserve tiempo para explicar la evaluación interna, consultas con estudiantes y control de avances. "
        "Use horas y planificación; esto no sustituye los criterios oficiales de la asignatura.\n\n"
        "Al finalizar el curso de Filosofía, se espera: Objetivo de evaluación 1: Conocimiento y comprensión—demostrar "
        "conocimientos. Objetivo de evaluación 2: Aplicación y análisis. Objetivo de evaluación 3: Síntesis y evaluación. "
        "Objetivo de evaluación 4: Uso y aplicación de habilidades.\n",
        encoding="utf-8",
    )
    _patch_fs(monkeypatch, root)
    ctx = {
        "teacher_context_pack": _pack(
            [
                {
                    "document_id": "2",
                    "filename": "guiafilosofia.pdf",
                    "markdown_status": "ready",
                    "categoria_documental": "guide",
                }
            ]
        )
    }
    bundle = tcr.build_teacher_context_snippets_bundle(
        "¿Qué criterios de evaluación aplican a la evaluación interna y a la prueba de Filosofía?",
        ctx,
        db=_DB,
        owner_user_id=_OWNER,
    )
    assert len(bundle["snippets"]) >= 1
    sn = bundle["snippets"][0]["snippet"]
    assert "objetivo de evaluación" in sn.lower() or "objetivo" in sn.lower()
    assert "conocimiento" in sn.lower()


def test_formal_evaluation_returns_multiple_paragraphs_per_doc(monkeypatch, tmp_path):
    _patch_owned_always(monkeypatch)
    root = tmp_path / "teacher_context"
    (root / "md").mkdir(parents=True)
    body = (
        "Introduccion breve sin palabras de la consulta zzzunused.\n\n"
        "La unidad exige conocimiento cientifico y metodo empirico detallado.\n\n"
        "Segundo bloque con conocimiento cientifico y evidencia experimental.\n\n"
        "Tercer bloque sobre conocimiento y analisis critico.\n"
    )
    (root / "md" / "8.md").write_text("---\ndocument_id: 8\n---\n\n" + body, encoding="utf-8")
    _patch_fs(monkeypatch, root)
    ctx = {
        "teacher_context_pack": _pack(
            [
                {
                    "document_id": "8",
                    "filename": "guia.pdf",
                    "markdown_status": "ready",
                    "categoria_documental": "guide",
                }
            ]
        )
    }
    bundle_chat = tcr.build_teacher_context_snippets_bundle(
        "conocimiento cientifico metodo empirico", ctx, db=_DB, owner_user_id=_OWNER
    )
    bundle_formal = tcr.build_teacher_context_snippets_bundle(
        "conocimiento cientifico metodo empirico",
        ctx,
        db=_DB,
        owner_user_id=_OWNER,
        for_formal_evaluation=True,
    )
    assert len(bundle_chat["snippets"]) == 1
    assert len(bundle_formal["snippets"]) >= 2
    assert bundle_formal.get("tfidf_rerank_applied") is True
    assert bundle_formal["retrieval_mode"] == "markdown_selective_tfidf"


def test_merge_returns_bundle(monkeypatch, tmp_path):
    _patch_owned_always(monkeypatch)
    root = tmp_path / "teacher_context"
    (root / "md").mkdir(parents=True)
    (root / "md" / "1.md").write_text(
        "---\n---\n\nContenido sobre autonomía y ética del cuidado.\n",
        encoding="utf-8",
    )
    _patch_fs(monkeypatch, root)

    ctx = {
        "teacher_context_pack": _pack(
            [
                {
                    "document_id": "1",
                    "filename": "doc.pdf",
                    "markdown_status": "ready",
                    "categoria_documental": "guide",
                }
            ]
        )
    }
    block, bundle = tcr.merge_chat_context_with_teacher_snippets(
        "- Asignatura: X.", "autonomía", ctx, db=_DB, owner_user_id=_OWNER
    )
    assert "Fragmentos recuperados" in block
    assert bundle["snippets"]

    block_as, _ = tcr.merge_chat_context_with_teacher_snippets(
        "- Asignatura: X.",
        "autonomía",
        {**ctx, "superficie": "asistente_ia"},
        db=_DB,
        owner_user_id=_OWNER,
    )
    assert "Asistente IA" in block_as or "asistente IA" in block_as.lower()
