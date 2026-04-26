"""
Bundle auditable `evaluation_context_bundle`.

Construye contexto enriquecido para inspección; un extracto mínimo se deriva vía
`app.services.evaluation_prompt_context` para la evaluación formal (nunca el JSON completo).
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.services.teacher_context_retrieval import build_teacher_context_snippets_bundle

BUNDLE_KIND = "evaluation_context_bundle"
SHADOW_NOTE = (
    "Modo shadow (auditable): el bundle completo no se envía al modelo; solo un extracto mínimo filtrado "
    "puede derivarse para orientar la evaluación formal, siempre subordinado a la rúbrica y al texto del documento."
)

MAX_RUBRIC_PREVIEW_CHARS = 420
MAX_QUERY_CHARS = 1200


def _extract_frontmatter(markdown: str) -> Dict[str, str]:
    if not markdown:
        return {}
    match = re.match(r"^---\s*\n([\s\S]*?)\n---\s*\n?", markdown)
    if not match:
        return {}
    frontmatter: Dict[str, str] = {}
    for line in match.group(1).splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        frontmatter[key.strip()] = value.strip().strip("\"'")
    return frontmatter


def _strip_frontmatter_body(markdown: str) -> str:
    if not markdown:
        return ""
    if markdown.startswith("---"):
        parts = markdown.split("---", 2)
        if len(parts) >= 3:
            return parts[2].lstrip("\n")
    return markdown


def _rubric_active_summary(rubric_markdown: str) -> Dict[str, Any]:
    fm = _extract_frontmatter(rubric_markdown)
    body = _strip_frontmatter_body(rubric_markdown or "").strip()
    preview = body[:MAX_RUBRIC_PREVIEW_CHARS].strip()
    if len(body) > MAX_RUBRIC_PREVIEW_CHARS:
        preview = preview[: MAX_RUBRIC_PREVIEW_CHARS - 1].rstrip() + "…"
    title = (fm.get("titulo") or fm.get("title") or "").strip()
    first_line = ""
    for ln in body.splitlines():
        t = ln.strip()
        if t and not t.startswith("#"):
            first_line = t[:180]
            break
        if t.startswith("#"):
            first_line = t.lstrip("#").strip()[:180]
            break
    return {
        "title": title or first_line or None,
        "preview": preview or None,
        "asignatura_frontmatter": (fm.get("asignatura") or "").strip() or None,
    }


def _retrieval_query(paragraphs: List[str], rubric_markdown: str) -> str:
    fm = _extract_frontmatter(rubric_markdown)
    bits: List[str] = []
    subj = (fm.get("asignatura") or "").strip()
    if subj:
        bits.append(subj)
    # Primera porción del cuerpo de rúbrica (sin volcar todo el pack)
    body = _strip_frontmatter_body(rubric_markdown or "")
    for ln in body.splitlines():
        s = ln.strip()
        if s and not s.startswith("---"):
            bits.append(s[:200])
            break
    excerpt = " ".join(p.strip() for p in (paragraphs or [])[:4] if p and str(p).strip())
    excerpt = excerpt[:MAX_QUERY_CHARS]
    if excerpt:
        bits.append(excerpt)
    return " ".join(bits).strip()


def _filter_pack_exclude_self(pack: Dict[str, Any], document_id: int) -> Dict[str, Any]:
    out = dict(pack)
    docs = pack.get("documents")
    if not isinstance(docs, list):
        return out
    filtered = [d for d in docs if isinstance(d, dict) and int(d.get("document_id") or -1) != int(document_id)]
    out["documents"] = filtered
    return out


def _build_server_teacher_pack(
    db: Session,
    exclude_document_id: int,
    owner_user_id: int,
) -> Optional[Dict[str, Any]]:
    from app.models.models import Document

    docs = (
        db.query(Document)
        .filter(Document.user_id == int(owner_user_id))
        .order_by(Document.id.asc())
        .all()
    )
    entries: List[Dict[str, Any]] = []
    for d in docs:
        if int(d.id) == int(exclude_document_id):
            continue
        st = getattr(d, "context_markdown_status", None) or "pending"
        if str(st).strip().lower() != "ready":
            continue
        entries.append(
            {
                "document_id": int(d.id),
                "filename": str(d.filename or ""),
                "markdown_status": "ready",
                "categoria_documental": "",
            }
        )
    if not entries:
        return None
    return {
        "pack_kind": "teacher_context_pack",
        "asignatura_activa": "",
        "documents": entries,
    }


def _merge_retrieval_context(
    document_context: Dict[str, Any],
    document_id: int,
    db: Optional[Session],
    owner_user_id: Optional[int],
) -> Tuple[Dict[str, Any], str, Optional[str]]:
    """
    Devuelve (contexto_para_retrieval, fuente_pack, nota_si_falta).
    fuente_pack: client | server_manifest | none
    """
    ctx = dict(document_context) if isinstance(document_context, dict) else {}
    raw_pack = ctx.get("teacher_context_pack")
    if isinstance(raw_pack, dict):
        docs = raw_pack.get("documents")
        if isinstance(docs, list) and docs:
            merged = _filter_pack_exclude_self(raw_pack, document_id)
            ctx["teacher_context_pack"] = merged
            n = len(merged.get("documents") or [])
            if n == 0:
                return ctx, "client", (
                    "teacher_context_pack presente pero sin otros documentos indexados tras excluir "
                    "el documento evaluado; retrieval omitido."
                )
            return ctx, "client", None

    if db is not None and owner_user_id is not None:
        server_pack = _build_server_teacher_pack(
            db, exclude_document_id=document_id, owner_user_id=int(owner_user_id)
        )
        if server_pack and server_pack.get("documents"):
            ctx["teacher_context_pack"] = server_pack
            return ctx, "server_manifest", None

    if db is not None and owner_user_id is None:
        return (
            ctx,
            "none",
            "Hay sesión de base de datos pero no user_id del evaluador; pack servidor omitido por política de aislamiento.",
        )

    return ctx, "none", "Sin pack de Mi Espacio IB en la petición ni documentos Markdown listos en servidor para otros ids."


def _related_categories_from_context(document_context: Dict[str, Any]) -> List[str]:
    ctx = document_context if isinstance(document_context, dict) else {}
    out: List[str] = []
    seen = set()
    raw_pack = ctx.get("teacher_context_pack")
    if isinstance(raw_pack, dict):
        for d in raw_pack.get("documents") or []:
            if not isinstance(d, dict):
                continue
            cat = str(d.get("categoria_documental") or "").strip()
            if cat and cat.lower() not in seen:
                seen.add(cat.lower())
                out.append(cat)
            if len(out) >= 16:
                break
    summary = ctx.get("teacher_context_summary")
    if isinstance(summary, dict):
        raw_cats = summary.get("categoria_documental_list") or summary.get("categories")
        if isinstance(raw_cats, list):
            for c in raw_cats:
                cat = str(c or "").strip()
                if cat and cat.lower() not in seen:
                    seen.add(cat.lower())
                    out.append(cat)
                if len(out) >= 16:
                    break
    return out


def _trim_profile_for_bundle(profile: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(profile, dict):
        return None
    keys = (
        "document_role",
        "content_mode",
        "source_type",
        "has_images",
        "has_charts",
        "has_tables",
        "has_formulas",
        "has_diagrams",
        "has_handwriting",
        "visual_evidence_relevant",
    )
    return {k: profile[k] for k in keys if k in profile}


def build_evaluation_context_bundle(
    *,
    document_id: int,
    paragraphs: List[str],
    rubric_markdown: str,
    document_context: Dict[str, Any],
    discipline_profile: Dict[str, Any],
    db: Optional[Session] = None,
    db_user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Capa auditable; la evaluación formal consume solo un extracto vía `evaluation_prompt_context`.
    """
    ctx_in = document_context if isinstance(document_context, dict) else {}
    profile_trim = _trim_profile_for_bundle(ctx_in.get("document_intelligence_profile"))
    doc_role = None
    if isinstance(profile_trim, dict):
        doc_role = profile_trim.get("document_role")

    fm_subj = (_extract_frontmatter(rubric_markdown).get("asignatura") or "").strip()
    subject = fm_subj or str((discipline_profile or {}).get("label") or "").strip()

    rubric_sum = _rubric_active_summary(rubric_markdown)

    ret_ctx, pack_source, pack_note = _merge_retrieval_context(
        ctx_in, document_id, db, owner_user_id=db_user_id
    )
    query = _retrieval_query(paragraphs, rubric_markdown)
    retrieval_bundle = build_teacher_context_snippets_bundle(
        query, ret_ctx, db=db, owner_user_id=db_user_id
    )

    snippets = retrieval_bundle.get("snippets") if isinstance(retrieval_bundle, dict) else []
    has_snippets = isinstance(snippets, list) and len(snippets) > 0
    retrieval_used = bool(has_snippets)

    related_cats = _related_categories_from_context(ret_ctx)

    scope_parts = [
        f"Pack retrieval: {pack_source}.",
        f"Documentos considerados (índice): {retrieval_bundle.get('documents_considered', 0)}; "
        f"Markdown leídos: {retrieval_bundle.get('documents_read', 0)}.",
    ]
    if retrieval_bundle.get("note"):
        scope_parts.append(str(retrieval_bundle["note"]))
    if pack_note:
        scope_parts.append(pack_note)
    scope_note = " ".join(scope_parts)

    confidence = "none"
    if retrieval_used:
        confidence = "heuristic_keyword_match"
    elif pack_source != "none":
        confidence = "low_no_match"

    out: Dict[str, Any] = {
        "bundle_kind": BUNDLE_KIND,
        "bundle_mode": "shadow",
        "subject": subject or None,
        "document_role": doc_role,
        "document_intelligence_profile": profile_trim,
        "rubric_active_summary": rubric_sum,
        "retrieval_used": retrieval_used,
        "retrieval_query_excerpt": query[:320] + ("…" if len(query) > 320 else ""),
        "teacher_context_snippets": snippets if has_snippets else [],
        "related_document_categories": related_cats,
        "teacher_context_retrieval_debug": {
            "pack_source": pack_source,
            "query_tokens": retrieval_bundle.get("query_tokens") or [],
            "internal_note": retrieval_bundle.get("note"),
        },
        "scope_note": scope_note,
        "retrieval_confidence": confidence,
        "note": SHADOW_NOTE,
    }
    return out
