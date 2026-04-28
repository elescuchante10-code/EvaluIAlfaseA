"""
Retrieval selectivo y auditable sobre Markdown de Mi Espacio IB (estilo Karpathy).

Sin embeddings ni vector DB: manifiesto/índice cliente + lectura de .md en disco,
coincidencia por tokens (keywords) y, con 2+ candidatos, re-ranking TF‑IDF
(scikit-learn + fusión numérica numpy) frente al mensaje de consulta.
"""
from __future__ import annotations

import logging
import re
import unicodedata
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy.orm import Session

from app.services.teacher_context_pipeline import resolve_teacher_markdown_abs_path
from app.services.teacher_context_tfidf import rerank_scored_snippets
from app.services.teacher_context_response_policy import (
    build_teacher_context_snippets_prompt_footer,
    resolve_chat_superficie,
)

logger = logging.getLogger(__name__)

MAX_SNIPPETS = 4
MAX_SNIPPET_CHARS = 520
# Evaluación formal: más material de referencia por documento (sin vector DB).
FORMAL_EVAL_MAX_SNIPPETS = 12
FORMAL_EVAL_MAX_SNIPPET_CHARS = 2000
FORMAL_EVAL_PARAGRAPHS_PER_DOC = 4
MAX_DOCS_TO_RANK = 14
MAX_DOCS_TO_READ = 10
MIN_TOKEN_LEN = 2
# Párrafo inicial (cuando no hay match léxico) solo si el nombre/categoría refuerza la consulta, o
# bajo 2+ puntos, o la pregunta sugiere explícitamente “intro/estímulo/apertura” (Fase A).
MIN_DOC_BONUS_FOR_INTRO_SNIPPET = 2

# Palabras o raíces en el mensaje del usuario (después de _fold) que activan anclar al inicio del doc.
_INTRO_INTENT_TOKENS = frozenset(
    {
        "introduccion",
        "intro",
        "estimulo",
        "comienzo",
        "apertura",
        "inicial",
        "inicio",
        "primera",
    }
)

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


def _message_prefers_intro_paragraph(message: str) -> bool:
    """True si el usuario pide apertura/introducción/estímulo, etc. (sin depender de embeddings)."""
    if not (message and str(message).strip()):
        return False
    folded = _fold(message)
    for raw in re.findall(r"[a-z0-9]{2,}", folded):
        if raw in _INTRO_INTENT_TOKENS:
            return True
    return False


def _expand_scoring_tokens(tokens: Set[str]) -> Set[str]:
    """Añade pistas léxicas relacionadas (solo puntuación/scoring, no se listan como query_tokens)."""
    out: Set[str] = set(tokens)
    for t in tokens:
        if t == "estimulo":
            out.update({"introduccion", "apertura", "contexto"})
        elif t == "tema":
            out.update({"unidad", "contenido"})
        elif t == "guia":
            out.update({"unidad", "plan"})
    # Guías IB: la pregunta pide "criterios" pero el documento expresa "objetivo(s) de evaluación" / descriptores.
    if tokens & {
        "criterio",
        "criterios",
        "rubrica",
        "calificar",
        "nota",
        "pondera",
        "prueba",
        "investigacion",
        "investigaciones",
        "interna",
        "internas",
        "evaluacion",
        "evaluaciones",
    }:
        out.update(
            {
                "objetivo",
                "objetivos",
                "comprension",
                "sintesis",
                "aplicacion",
                "conocimiento",
                "indagacion",
                "descriptores",
                "descriptor",
            }
        )
    return out


def _ib_objectives_rubric_weight(paragraph: str) -> int:
    """
    Peso hacia secciones que listan criterios IB reales: «Objetivo de evaluación 1/2/…»,
    frente a tablas solo con duración/porcentaje.
    """
    if not paragraph or not str(paragraph).strip():
        return 0
    f = _fold(str(paragraph))
    w = 0
    w += 12 * len(re.findall(r"objetivo de evaluacion[:\s]+[0-4]\b", f, flags=re.IGNORECASE))
    if w == 0 and re.search(
        r"objetivo de evaluacion.{0,3}[0-4]|\bobjetiv.{0,15}de evaluacion", f, flags=re.IGNORECASE
    ):
        w = 8
    if re.search(
        r"conocimiento y comprension|sintesis y evaluacion|aplicacion y analisis|uso y aplicacion",
        f,
        flags=re.IGNORECASE,
    ):
        w += 8
    if re.search(
        r"puntuacion|descriptor|banda[sd]? de|esquemas? de calificacion",
        f,
        flags=re.IGNORECASE,
    ) and w < 4:
        w = max(w, 4)
    return w


def _seeks_criteria_rubric_intent(user_message: str) -> bool:
    """Más ancho de snippet cuando el docente pide criterios/rúbrica/ponderación (tablas en guía)."""
    if not user_message or not str(user_message).strip():
        return False
    t = set(re.findall(r"[a-z0-9]{2,}", _fold(str(user_message))))
    return bool(
        t
        & {
            "criterio",
            "criterios",
            "rubrica",
            "rubricas",
            "calificar",
            "evaluarlo",
            "evaluar",
            "evaluacion",
            "evaluaciones",
            "pondera",
            "ponderacion",
        }
    )


def _strip_yaml_frontmatter(md: str) -> str:
    text = md or ""
    if not text.startswith("---"):
        return text
    parts = text.split("---", 2)
    if len(parts) >= 3:
        return parts[2].lstrip("\n")
    return text


def _owned_document_row(db: Session, document_id: int, owner_user_id: int):
    from app.models.models import Document

    return (
        db.query(Document)
        .filter(Document.id == int(document_id), Document.user_id == int(owner_user_id))
        .first()
    )


def _document_owned(db: Session, document_id: int, owner_user_id: int) -> bool:
    return _owned_document_row(db, document_id, owner_user_id) is not None


def _read_markdown_body(
    document_id: int,
    *,
    db: Optional[Session],
    owner_user_id: Optional[int],
) -> Optional[str]:
    """Lee Markdown en disco solo si el documento pertenece a owner_user_id (lookup en BD + rutas P2/legacy)."""
    if db is None or owner_user_id is None:
        return None
    doc = _owned_document_row(db, int(document_id), int(owner_user_id))
    if not doc:
        return None
    path = resolve_teacher_markdown_abs_path(doc)
    if path is None or not path.is_file():
        return None
    try:
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
    for_formal_evaluation: bool = False,
) -> Dict[str, Any]:
    """
    Devuelve un bundle auditable. Si no hay coincidencias útiles, `snippets` va vacío.

    for_formal_evaluation: hasta varios párrafos por documento y más caracteres por
    fragmento, para alimentar el bloque de contexto de evaluación formal (coincidencia
    léxica sobre Markdown en disco + re-ranking TF‑IDF local cuando hay 2+ candidatos).
    """
    base: Dict[str, Any] = {
        "retrieval_kind": "teacher_context_snippets",
        "retrieval_mode": "markdown_selective",
        "query_tokens": [],
        "documents_considered": 0,
        "documents_read": 0,
        "snippets": [],
        "note": None,
        "tfidf_rerank_applied": False,
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
    tokens_scoring = _expand_scoring_tokens(tokens_set)
    base["query_tokens"] = tokens_list[:16]
    prefer_intro = _message_prefers_intro_paragraph(msg)
    criteria_rubric_intent = _seeks_criteria_rubric_intent(msg)
    if for_formal_evaluation:
        snippet_max_chars = FORMAL_EVAL_MAX_SNIPPET_CHARS
        max_snippets_out = FORMAL_EVAL_MAX_SNIPPETS
    else:
        snippet_max_chars = 900 if criteria_rubric_intent else MAX_SNIPPET_CHARS
        max_snippets_out = MAX_SNIPPETS

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
        bonus = _doc_metadata_bonus(fn, cat, tokens_scoring)
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

        if for_formal_evaluation:
            para_rows: List[Tuple[int, str]] = []
            for p in paragraphs:
                ps = _paragraph_score(p, tokens_scoring)
                if criteria_rubric_intent:
                    ps = ps + _ib_objectives_rubric_weight(p)
                para_rows.append((ps, p))
            para_rows.sort(key=lambda x: (-x[0], -len(x[1])))
            picks: List[Tuple[int, str]] = []
            seen_prefix: Set[str] = set()
            for ps, p in para_rows:
                if len(picks) >= FORMAL_EVAL_PARAGRAPHS_PER_DOC:
                    break
                if ps <= 0:
                    continue
                fp = _fold(p)[:120]
                if fp in seen_prefix:
                    continue
                seen_prefix.add(fp)
                picks.append((ps, p))
            if not picks:
                use_intro = doc_bonus >= MIN_DOC_BONUS_FOR_INTRO_SNIPPET or prefer_intro
                if (use_intro or doc_bonus >= MIN_DOC_BONUS_FOR_INTRO_SNIPPET) and paragraphs:
                    picks = [(0, paragraphs[0])]
                else:
                    continue
            for ps, body in picks:
                snippet_text = _best_window(body, tokens_scoring, snippet_max_chars)
                if not snippet_text:
                    continue
                total = doc_bonus + ps * 10
                scored.append(
                    {
                        "document_id": did,
                        "filename": str(d.get("filename") or ""),
                        "categoria_documental": str(d.get("categoria_documental") or ""),
                        "snippet": snippet_text,
                        "_sort": total,
                    }
                )
        else:
            best_para = ""
            best_ps = 0
            for p in paragraphs:
                ps = _paragraph_score(p, tokens_scoring)
                if criteria_rubric_intent:
                    ps = ps + _ib_objectives_rubric_weight(p)
                if ps > best_ps or (ps == best_ps and len(p) > len(best_para)):
                    best_ps = ps
                    best_para = p

            use_intro = best_ps == 0 and (
                doc_bonus >= MIN_DOC_BONUS_FOR_INTRO_SNIPPET or prefer_intro
            )
            if best_ps == 0 and not use_intro:
                continue

            body = best_para if best_ps > 0 else paragraphs[0]
            snippet_text = _best_window(body, tokens_scoring, snippet_max_chars)
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
    scored, tfidf_applied = rerank_scored_snippets(msg, scored)
    base["tfidf_rerank_applied"] = bool(tfidf_applied)
    if tfidf_applied:
        base["retrieval_mode"] = "markdown_selective_tfidf"
    else:
        scored.sort(key=lambda x: -x["_sort"])
    for item in scored[:max_snippets_out]:
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
        "--- Fragmentos recuperados · Mi Espacio IB (léxico + TF‑IDF local entre 2+ candidatos; "
        "si la pregunta pide apertura/introducción, anclaje al primer bloque) · sin vector DB ---",
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
