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
    assert bundle["retrieval_mode"] == "markdown_selective"
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
