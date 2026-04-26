"""
Pipeline contextual Karpathy-style (sin embeddings): Markdown mínimo + manifiesto JSON.

- Escribe una vista Markdown derivada de los párrafos ya extraídos en upload.
- Regenera un manifiesto legible en disco para auditoría y fases futuras de retrieval selectivo.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
TEACHER_CONTEXT_ROOT = BACKEND_ROOT / "data" / "teacher_context"
MD_DIR = TEACHER_CONTEXT_ROOT / "md"
MANIFEST_FILENAME = "teacher_context_manifest.json"

MANIFEST_SCHEMA_VERSION = "1"
MANIFEST_KIND = "teacher_context_manifest"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def paragraphs_to_markdown_body(paragraphs: List[str]) -> str:
    chunks = []
    for p in paragraphs or []:
        t = (p or "").strip()
        if t:
            chunks.append(t)
    return "\n\n".join(chunks)


def md_relative_path(document_id: int) -> str:
    return f"md/{document_id}.md"


def write_teacher_markdown_file(
    document_id: int,
    filename: str,
    paragraphs: List[str],
) -> Tuple[str, Optional[str]]:
    """
    Escribe `data/teacher_context/md/{id}.md`. Devuelve (status, relpath bajo teacher_context o None).
    status ∈ pending | ready | error  (pending no se usa aquí; reservado API)
    """
    try:
        MD_DIR.mkdir(parents=True, exist_ok=True)
        rel = md_relative_path(document_id)
        path = TEACHER_CONTEXT_ROOT.joinpath(*rel.split("/"))
        body = paragraphs_to_markdown_body(paragraphs)
        header_lines = [
            "---",
            f"document_id: {document_id}",
            f'source_filename: {json.dumps(filename, ensure_ascii=False)}',
            f"generated_at: {_utc_now_iso()}",
            "kind: teacher_context_markdown_v1",
            "---",
            "",
        ]
        path.write_text("".join(header_lines) + body, encoding="utf-8")
        return "ready", rel
    except OSError as exc:
        logger.warning("teacher_context markdown write failed doc=%s: %s", document_id, exc)
        return "error", None
    except Exception as exc:  # noqa: BLE001
        logger.exception("unexpected error writing teacher markdown doc=%s: %s", document_id, exc)
        return "error", None


def build_manifest_payload(document_models) -> Dict[str, Any]:
    """Construye el dict del manifiesto a partir de filas Document (ORM)."""
    entries: List[Dict[str, Any]] = []
    for doc in document_models:
        did = getattr(doc, "id", None)
        if did is None:
            continue
        fn = getattr(doc, "filename", "") or ""
        st = getattr(doc, "context_markdown_status", None) or "pending"
        rel = getattr(doc, "context_markdown_relpath", None)
        entries.append(
            {
                "document_id": did,
                "filename": fn,
                "markdown_status": st,
                "markdown_relpath": rel,
                "api_markdown_url": f"/api/documents/{did}/teacher-markdown",
            }
        )
    entries.sort(key=lambda x: x["document_id"])
    return {
        "manifest_kind": MANIFEST_KIND,
        "schema_version": MANIFEST_SCHEMA_VERSION,
        "generated_at": _utc_now_iso(),
        "retrieval_mode": "manifest_only",
        "note": "Sin embeddings ni vector DB. Markdown derivado de extracción nativa; asignatura vive en el índice cliente (Mi Espacio IB).",
        "documents": entries,
        "subject_index": {
            "_note": "Claves por asignatura se completan en el cliente (teacher_context_index); el servidor registra documentos y rutas Markdown.",
        },
    }


def write_manifest_to_disk(document_models) -> Path:
    TEACHER_CONTEXT_ROOT.mkdir(parents=True, exist_ok=True)
    payload = build_manifest_payload(document_models)
    path = TEACHER_CONTEXT_ROOT / MANIFEST_FILENAME
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def regenerate_teacher_context_artifacts(db) -> None:
    """Regenera el manifiesto en disco a partir del estado actual de la tabla documents."""
    from app.models.models import Document  # import local evita ciclos

    docs = db.query(Document).order_by(Document.id.asc()).all()
    write_manifest_to_disk(docs)
