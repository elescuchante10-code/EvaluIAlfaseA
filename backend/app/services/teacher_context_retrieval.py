"""
Retrieval selectivo y auditable sobre Markdown de Mi Espacio IB (estilo Karpathy).

Sin embeddings ni vector DB: manifiesto/índice cliente + lectura de .md en disco
y coincidencia simple por tokens (keywords) en nombre, categoría y cuerpo.
"""
from __future__ import annotations

import logging
import re
import unicodedata
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy.orm import Session

from app.services.teacher_context_pipeline import TEACHER_CONTEXT_ROOT
from app.services.teacher_context_response_policy import (
    build_teacher_context_snippets_prompt_footer,
    resolve_chat_superficie,
)

logger = logging.getLogger(__name__)

MAX_SNIPPETS = 4
MAX_SNIPPET_CHARS = 520
MAX_DOCS_TO_RANK = 14
MAX_DOCS_TO_READ = 10
MIN_TOKEN_LEN = 2
MIN_DOC_BONUS_FOR_INTRO_SNIPPET = 4

# Consultas muy cortas o solo puntuación: no forzar lectura de disco.
MIN_QUERY_CHARS_FOR_RETRIEVAL = 3

_STOPWORDS_ES = frozenset(
    {
        "el",
        "la",
        "los",
        "las",
        "un",
        "una",
        "unos",
        "unas",
        "de",
        "del",
        "al",
        "y",
        "o",
        "pero",
        "si",
        "no",
        "en",
        "por",
        "para",
        "con",
        "sin",
        "sobre",
        "entre",
        "que",
        "cual",
        "como",
        "cuando",
        "donde",
        "hay",
        "este",
        "esta",
        "esto",
        "ese",
        "esa",
        "eso",
        "mi",
        "tu",
        "su",
        "mis",
        "tus",
        "sus",
        "me",
        "te",
        "se",
        "nos",
        "les",
        "lo",
        "le",
        "da",
        "doy",
        "das",
        "son",
        "es",
        "soy",
        "eres",
        "somos",
        "ya",
        "muy",
        "mas",
        "menos",
        "todo",
        "toda",
        "todos",
        "todas",
        "algo",
        "alguien",
        "nada",
        "nadie",
        "quien",
        "cual",
        "cuales",
        "sea",
        "ser",
        "ver",
        "vez",
        "aqui",
        "ahi",
        "alli",
    }
)


def _fold(text: str) -> str:
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFD", str(text).lower())
    return "".join(c for c in nfkd if unicodedata.category(c) != "Mn")


def tokenize_query(message: str) -> List[str]:
    if not message or not str(message).strip():
        return []
    folded = _fold(message)
    raw = re.findall(r"[a-z0-9]{2,}", folded)
    out: List[str] = []
    seen: Set[str] = set()
    for t in raw:
        if len(t) < MIN_TOKEN_LEN or t in _STOPWORDS_ES:
            continue
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out[:24]


def _strip_yaml_frontmatter(md: str) -> str:
    text = md or ""
    if not text.startswith("---"):
        return text
    parts = text.split("---", 2)
    if len(parts) >= 3:
        return parts[2].lstrip("\n")
    return text


def _document_owned(db: Session, document_id: int, owner_user_id: int) -> bool:
    from app.models.models import Document

    row = (
        db.query(Document.id)
        .filter(Document.id == int(document_id), Document.user_id == int(owner_user_id))
        .first()
    )
    return row is not None


def _read_markdown_body(
    document_id: int,
    *,
    db: Optional[Session],
    owner_user_id: Optional[int],
) -> Optional[str]:
    """Lee Markdown en disco solo si el documento pertenece a owner_user_id (lookup en BD)."""
    if db is None or owner_user_id is None:
        return None
    if not _document_owned(db, int(document_id), int(owner_user_id)):
        return None
    path = TEACHER_CONTEXT_ROOT / "md" / f"{document_id}.md"
    try:
        if not path.is_file():
            return None
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        logger.warning("teacher_context retrieval: cannot read md doc=%s: %s", document_id, exc)
        return None


def _split_paragraphs(body: str) -> List[str]:
    raw = _strip_yaml_frontmatter(body)
    chunks = re.split(r"\n\s*\n+", raw.strip())
    return [c.strip() for c in chunks if c and c.strip()]


def _word_set(text: str) -> Set[str]:
    return set(re.findall(r"[a-z0-9]{2,}", _fold(text)))


def _paragraph_score(paragraph: str, tokens: Set[str]) -> int:
    if not tokens:
        return 0
    words = _word_set(paragraph)
    return len(tokens & words)


def _doc_metadata_bonus(filename: str, category: str, tokens: Set[str]) -> int:
    bonus = 0
    fn = _fold(filename)
    cat = _fold(category)
    for t in tokens:
        if t in fn:
            bonus += 2
        if t in cat:
            bonus += 3
    bonus += _category_alignment_bonus(cat, tokens)
    return bonus


def _category_alignment_bonus(category_folded: str, tokens: Set[str]) -> int:
    """Refuerzo léxico simple (p. ej. pregunta por «guía» y categoría guide)."""
    if not category_folded or not tokens:
        return 0
    pairs = [
        ({"guia", "guide", "unidad", "unit"}, ("guide", "guia", "unidad", "unit")),
        ({"rubrica", "rubric"}, ("rubric", "rubrica")),
        ({"plan", "planificacion"}, ("plan", "syllabus")),
        ({"tarea", "actividad"}, ("assignment", "activity", "tarea", "actividad")),
    ]
    best = 0
    for keys, cat_keys in pairs:
        if not (tokens & keys):
            continue
        for ck in cat_keys:
            if ck in category_folded:
                best = max(best, 5)
    return best


def _trim_snippet(text: str, max_chars: int) -> str:
    t = " ".join((text or "").split())
    if len(t) <= max_chars:
        return t
    return t[: max_chars - 1].rstrip() + "…"


def _best_window(paragraph: str, tokens: Set[str], max_chars: int) -> str:
    """Si el párrafo es largo, recorta alrededor de la primera coincidencia de token."""
    if not paragraph:
        return ""
    if len(paragraph) <= max_chars:
        return _trim_snippet(paragraph, max_chars)
    folded = _fold(paragraph)
    pos = -1
    for t in sorted(tokens, key=len, reverse=True):
        idx = folded.find(t)
        if idx != -1:
            pos = idx
            break
    if pos == -1:
        return _trim_snippet(paragraph, max_chars)
    half = max_chars // 2
    start = max(0, pos - half)
    end = min(len(paragraph), start + max_chars)
    start = max(0, end - max_chars)
    snippet = paragraph[start:end].strip()
    return _trim_snippet(snippet, max_chars)


def _documents_from_pack(pack: Dict[str, Any]) -> List[Dict[str, Any]]:
    docs = pack.get("documents")
    if not isinstance(docs, list):
        return []
    return [d for d in docs if isinstance(d, dict)]


def _parse_document_id(raw: Any) -> Optional[int]:
    if raw is None:
        return None
    try:
        return int(str(raw).strip())
    except (TypeError, ValueError):
        return None


def build_teacher_context_snippets_bundle(
    user_message: str,
    context: Optional[Dict[str, Any]],
    *,
    db: Optional[Session] = None,
    owner_user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Devuelve un bundle auditable. Si no hay coincidencias útiles, `snippets` va vacío.
    """
    base: Dict[str, Any] = {
        "retrieval_kind": "teacher_context_snippets",
        "retrieval_mode": "markdown_selective",
        "query_tokens": [],
        "documents_considered": 0,
        "documents_read": 0,
        "snippets": [],
        "note": None,
    }

    ctx = context if isinstance(context, dict) else {}
    raw_pack = ctx.get("teacher_context_pack")
    pack = raw_pack if isinstance(raw_pack, dict) else None
    if not pack:
        base["note"] = "Sin teacher_context_pack en el contexto; no se aplica retrieval."
        return base

    if db is None or owner_user_id is None:
        base["note"] = (
            "Retrieval sin sesión de usuario autenticado; no se leen Markdown de Mi Espacio IB desde disco."
        )
        return base

    msg = (user_message or "").strip()
    if len(msg) < MIN_QUERY_CHARS_FOR_RETRIEVAL:
        base["note"] = "Consulta demasiado corta; retrieval omitido."
        return base

    tokens_list = tokenize_query(msg)
    if not tokens_list:
        base["note"] = "Sin tokens de consulta útiles tras filtrar stopwords; retrieval omitido."
        return base
    tokens_set = set(tokens_list)
    base["query_tokens"] = tokens_list[:16]

    docs = _documents_from_pack(pack)
    candidates: List[Tuple[int, Dict[str, Any], int]] = []
    for d in docs:
        did = _parse_document_id(d.get("document_id"))
        if did is None:
            continue
        st = str(d.get("markdown_status") or "").strip().lower()
        if st != "ready":
            continue
        fn = str(d.get("filename") or "")
        cat = str(d.get("categoria_documental") or "")
        bonus = _doc_metadata_bonus(fn, cat, tokens_set)
        candidates.append((bonus, d, did))

    candidates.sort(key=lambda x: (-x[0], x[2]))
    candidates = candidates[:MAX_DOCS_TO_RANK]
    base["documents_considered"] = len(candidates)

    scored: List[Dict[str, Any]] = []
    read_count = 0
    for doc_bonus, d, did in candidates[:MAX_DOCS_TO_READ]:
        raw_md = _read_markdown_body(did, db=db, owner_user_id=owner_user_id)
        read_count += 1
        if not raw_md:
            continue
        paragraphs = _split_paragraphs(raw_md)
        if not paragraphs:
            continue

        best_para = ""
        best_ps = 0
        for p in paragraphs:
            ps = _paragraph_score(p, tokens_set)
            if ps > best_ps or (ps == best_ps and len(p) > len(best_para)):
                best_ps = ps
                best_para = p

        use_intro = best_ps == 0 and doc_bonus >= MIN_DOC_BONUS_FOR_INTRO_SNIPPET
        if best_ps == 0 and not use_intro:
            continue

        body = best_para if best_ps > 0 else paragraphs[0]
        snippet_text = _best_window(body, tokens_set, MAX_SNIPPET_CHARS)
        if not snippet_text:
            continue

        total = doc_bonus + best_ps * 10
        scored.append(
            {
                "document_id": did,
                "filename": str(d.get("filename") or ""),
                "categoria_documental": str(d.get("categoria_documental") or ""),
                "snippet": snippet_text,
                "_sort": total,
            }
        )

    base["documents_read"] = read_count
    scored.sort(key=lambda x: -x["_sort"])
    for item in scored[:MAX_SNIPPETS]:
        item.pop("_sort", None)
        base["snippets"].append(item)

    if not base["snippets"]:
        base["note"] = (
            "No se encontraron fragmentos con coincidencia simple suficiente en los Markdown "
            "disponibles (o los documentos no están en estado markdown ready)."
        )
    return base


def format_teacher_context_snippets_for_prompt(
    bundle: Dict[str, Any],
    superficie: str = "default",
) -> str:
    """Texto breve para inyectar en el system prompt del chat."""
    if not isinstance(bundle, dict):
        return ""
    snippets = bundle.get("snippets")
    if not isinstance(snippets, list) or not snippets:
        return ""

    lines = [
        "--- Fragmentos recuperados · Mi Espacio IB (markdown_selective, sin embeddings) ---",
        (
            f"Documentos considerados en el índice activo: {bundle.get('documents_considered', 0)}; "
            f"Markdown leídos: {bundle.get('documents_read', 0)}."
        ),
    ]
    for i, s in enumerate(snippets, start=1):
        if not isinstance(s, dict):
            continue
        sid = s.get("document_id", "")
        fn = s.get("filename", "")
        cat = s.get("categoria_documental", "")
        sn = s.get("snippet", "")
        lines.append(f"[{i}] doc_id={sid} · {fn} · categoría={cat} · «{sn}»")
    lines.append(build_teacher_context_snippets_prompt_footer(superficie))
    return "\n".join(lines)


def merge_chat_context_with_teacher_snippets(
    base_context_block: str,
    user_message: str,
    context: Optional[Dict[str, Any]],
    *,
    db: Optional[Session] = None,
    owner_user_id: Optional[int] = None,
) -> Tuple[str, Dict[str, Any]]:
    bundle = build_teacher_context_snippets_bundle(
        user_message, context, db=db, owner_user_id=owner_user_id
    )
    sf = resolve_chat_superficie(context)
    extra = format_teacher_context_snippets_for_prompt(bundle, superficie=sf)
    if not extra:
        return (base_context_block.strip(), bundle)
    merged = f"{base_context_block.rstrip()}\n\n{extra}".strip()
    return (merged, bundle)
