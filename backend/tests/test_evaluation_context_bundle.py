from types import SimpleNamespace
from unittest.mock import MagicMock

from app.services import evaluation_context_bundle as ecb
from app.services import teacher_context_pipeline as tcp
from app.services import teacher_context_retrieval as tcr


def _discipline():
    return {"label": "Filosofía"}


def test_shadow_bundle_minimal_without_teacher_pack():
    bundle = ecb.build_evaluation_context_bundle(
        document_id=1,
        paragraphs=["Breve texto de prueba."],
        rubric_markdown="# Rúbrica\nCriterio: análisis",
        document_context={"document_intelligence_profile": {"document_role": "student_submission"}},
        discipline_profile=_discipline(),
        db=None,
    )
    assert bundle["bundle_kind"] == "evaluation_context_bundle"
    assert bundle["bundle_mode"] == "shadow"
    assert bundle["retrieval_used"] is False
    assert "shadow" in bundle["note"].lower()
    assert bundle["document_role"] == "student_submission"
    assert bundle["teacher_context_snippets"] == []


def test_shadow_bundle_respects_subject_frontmatter():
    md = "---\nasignatura: Historia\n---\n# Título\nCriterios."
    bundle = ecb.build_evaluation_context_bundle(
        document_id=2,
        paragraphs=["Contenido."],
        rubric_markdown=md,
        document_context={},
        discipline_profile={"label": "General académico"},
        db=None,
    )
    assert bundle["subject"] == "Historia"


def test_shadow_bundle_excludes_evaluated_doc_from_client_pack(monkeypatch, tmp_path):
    root = tmp_path / "teacher_context"
    (root / "md").mkdir(parents=True)
    (root / "md" / "10.md").write_text(
        "---\n---\n\nLa ética del cuidado y la autonomía del paciente.\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(tcp, "TEACHER_CONTEXT_ROOT", root)

    ctx = {
        "teacher_context_pack": {
            "pack_kind": "teacher_context_pack",
            "documents": [
                {
                    "document_id": 10,
                    "filename": "guia.pdf",
                    "markdown_status": "ready",
                    "categoria_documental": "guide",
                }
            ],
        },
        "document_intelligence_profile": {"document_role": "essay"},
    }
    bundle = ecb.build_evaluation_context_bundle(
        document_id=10,
        paragraphs=["autonomía paciente ética"],
        rubric_markdown="---\nasignatura: Filosofía\n---\n# Rúbrica",
        document_context=ctx,
        discipline_profile=_discipline(),
        db=None,
    )
    assert bundle["retrieval_used"] is False
    assert bundle["teacher_context_retrieval_debug"]["pack_source"] == "client"
    assert "excluir" in bundle["scope_note"].lower() or "omitido" in bundle["scope_note"].lower()


def test_shadow_bundle_retrieval_from_other_docs(monkeypatch, tmp_path):
    def _row(db, did, uid):
        if int(did) == 20 and int(uid) == 1:
            return SimpleNamespace(id=20, user_id=1, context_markdown_relpath=None)
        return None

    monkeypatch.setattr(tcr, "_owned_document_row", _row)
    root = tmp_path / "teacher_context"
    (root / "md").mkdir(parents=True)
    (root / "md" / "20.md").write_text(
        "---\n---\n\nEl conocimiento científico y sus límites epistemológicos.\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(tcp, "TEACHER_CONTEXT_ROOT", root)

    ctx = {
        "teacher_context_pack": {
            "pack_kind": "teacher_context_pack",
            "documents": [
                {
                    "document_id": 20,
                    "filename": "guia_epistemologia.pdf",
                    "markdown_status": "ready",
                    "categoria_documental": "guide",
                }
            ],
        }
    }
    bundle = ecb.build_evaluation_context_bundle(
        document_id=99,
        paragraphs=["Reflexión sobre conocimiento científico."],
        rubric_markdown=(
            "---\nasignatura: Filosofía\n---\n"
            "conocimiento científico límites epistemológicos"
        ),
        document_context=ctx,
        discipline_profile=_discipline(),
        db=MagicMock(),
        db_user_id=1,
    )
    assert bundle["retrieval_used"] is True
    assert bundle["teacher_context_snippets"]
    assert bundle["related_document_categories"] == ["guide"]
    assert bundle["teacher_context_retrieval_debug"]["pack_source"] == "client"


def test_shadow_bundle_no_disk_read_for_foreign_doc_in_pack(monkeypatch, tmp_path):
    """Pack con doc_id ajeno: sin snippets si la BD niega ownership (no lectura de disco)."""
    root = tmp_path / "teacher_context"
    (root / "md").mkdir(parents=True)
    (root / "md" / "20.md").write_text(
        "---\n---\n\nContenido secreto de otro usuario.\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(tcp, "TEACHER_CONTEXT_ROOT", root)
    monkeypatch.setattr(tcr, "_owned_document_row", lambda db, did, uid: None)

    ctx = {
        "teacher_context_pack": {
            "pack_kind": "teacher_context_pack",
            "documents": [
                {
                    "document_id": 20,
                    "filename": "x.pdf",
                    "markdown_status": "ready",
                    "categoria_documental": "guide",
                }
            ],
        }
    }
    bundle = ecb.build_evaluation_context_bundle(
        document_id=99,
        paragraphs=["Reflexión sobre conocimiento científico."],
        rubric_markdown="---\nasignatura: Filosofía\n---\nconocimiento científico",
        document_context=ctx,
        discipline_profile=_discipline(),
        db=MagicMock(),
        db_user_id=1,
    )
    assert bundle["retrieval_used"] is False
    assert bundle["teacher_context_snippets"] == []
