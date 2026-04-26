"""
Pipeline contextual Karpathy-style (sin embeddings): Markdown mínimo + manifiesto JSON.

- Escribe Markdown bajo `data/teacher_context/users/{user_id}/md/{document_id}.md` (P2).
- Mantiene lectura compatible con rutas legacy `md/{document_id}.md` en la raíz teacher_context.
- Manifiesto por usuario: `data/teacher_context/users/{user_id}/teacher_context_manifest.json`.
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


def md_relative_path_legacy(document_id: int) -> str:
    """Ruta relativa histórica bajo TEACHER_CONTEXT_ROOT (sin tenant)."""
    return f"md/{document_id}.md"


def md_relative_path_namespaced(owner_user_id: int, document_id: int) -> str:
    """Ruta relativa namespaced (P2): `users/{user_id}/md/{document_id}.md`."""
    return f"users/{int(owner_user_id)}/md/{int(document_id)}.md"


def user_teacher_context_dir(owner_user_id: int) -> Path:
    return TEACHER_CONTEXT_ROOT / "users" / str(int(owner_user_id))


def resolve_teacher_markdown_abs_path(doc: Any) -> Optional[Path]:
    """
    Resuelve la ruta absoluta del Markdown contextual para un ORM `Document`.

    Orden: `context_markdown_relpath` si el archivo existe → legacy `md/{id}.md` →
    `users/{user_id}/md/{id}.md`. No borra legacy; solo lee el primer archivo existente.
    """
    did = int(getattr(doc, "id", 0) or 0)
    uid = int(getattr(doc, "user_id", 0) or 0)
    rel = getattr(doc, "context_markdown_relpath", None)
    if rel and str(rel).strip():
        p = TEACHER_CONTEXT_ROOT.joinpath(*str(rel).strip().split("/"))
        if p.is_file():
            return p
    legacy = TEACHER_CONTEXT_ROOT / "md" / f"{did}.md"
    if legacy.is_file():
        return legacy
    namespaced = user_teacher_context_dir(uid) / "md" / f"{did}.md"
    if namespaced.is_file():
        return namespaced
    return None


def write_teacher_markdown_file(
    document_id: int,
    filename: str,
    paragraphs: List[str],
    *,
    owner_user_id: int,
) -> Tuple[str, Optional[str]]:
    """
    Escribe Markdown namespaced bajo `users/{owner_user_id}/md/{id}.md`.
    Devuelve (status, relpath bajo TEACHER_CONTEXT_ROOT o None).
    """
    try:
        rel = md_relative_path_namespaced(owner_user_id, document_id)
        path = TEACHER_CONTEXT_ROOT.joinpath(*rel.split("/"))
        path.parent.mkdir(parents=True, exist_ok=True)
        body = paragraphs_to_markdown_body(paragraphs)
        header_lines = [
            "---",
            f"document_id: {document_id}",
            f"owner_user_id: {int(owner_user_id)}",
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


def build_teacher_context_pack_from_documents(document_models) -> Dict[str, Any]:
    """JSON `teacher_context_pack` para un conjunto de filas Document (mismo usuario en el caller)."""
    entries: List[Dict[str, Any]] = []
    for doc in document_models:
        did = getattr(doc, "id", None)
        if did is None:
            continue
        st = str(getattr(doc, "context_markdown_status", None) or "pending").strip().lower()
        if st != "ready":
            continue
        rel = getattr(doc, "context_markdown_relpath", None)
        entries.append(
            {
                "document_id": int(did),
                "filename": str(getattr(doc, "filename", "") or ""),
                "markdown_status": "ready",
                "markdown_relpath": rel,
                "categoria_documental": "",
            }
        )
    entries.sort(key=lambda x: x["document_id"])
    return {
        "pack_kind": "teacher_context_pack",
        "asignatura_activa": "",
        "documents": entries,
    }


def write_manifest_to_disk(document_models) -> Path:
    """
    Escribe el manifiesto global histórico en la raíz teacher_context (legacy).

    Ya no se usa en `regenerate_teacher_context_artifacts` (manifiestos por usuario, P2);
    se conserva por compatibilidad si algún script externo lo importaba.
    """
    TEACHER_CONTEXT_ROOT.mkdir(parents=True, exist_ok=True)
    payload = build_manifest_payload(document_models)
    path = TEACHER_CONTEXT_ROOT / MANIFEST_FILENAME
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def write_user_manifest_to_disk(owner_user_id: int, document_models) -> Path:
    """Escribe `users/{owner_user_id}/teacher_context_manifest.json`."""
    udir = user_teacher_context_dir(owner_user_id)
    udir.mkdir(parents=True, exist_ok=True)
    payload = build_manifest_payload(document_models)
    path = udir / MANIFEST_FILENAME
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def regenerate_teacher_context_artifacts(db, triggering_user_id: Optional[int] = None) -> None:
    """
    Regenera manifiestos JSON **por usuario** bajo `users/{user_id}/`.

    No borra Markdown legacy (`md/*.md`); no elimina el manifiesto global antiguo en disco
    (puede quedar obsoleto). Si `triggering_user_id` es None, actualiza todos los `user_id`
    distintos presentes en `documents`.
    """
    from app.models.models import Document  # import local evita ciclos

    if triggering_user_id is not None:
        user_ids = [int(triggering_user_id)]
    else:
        rows = db.query(Document.user_id).distinct().order_by(Document.user_id.asc()).all()
        user_ids = [int(r[0]) for r in rows if r[0] is not None]

    for uid in user_ids:
        docs = (
            db.query(Document)
            .filter(Document.user_id == uid)
            .order_by(Document.id.asc())
            .all()
        )
        write_user_manifest_to_disk(uid, docs)
