"""
Re-ranking léxico → TF‑IDF (scikit-learn) con fusión numérica (numpy).

Se aplica sobre candidatos ya extraídos en `teacher_context_retrieval` para
refinar el orden sin embeddings ni servicios externos.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

# Peso del coseno TF‑IDF frente a la puntuación léxica normalizada (1 − alpha léxico).
TFIDF_BLEND_ALPHA = 0.42


def tfidf_cosine_similarities(query: str, documents: List[str]) -> Optional[np.ndarray]:
    """Similitud coseno entre la consulta y cada documento; None si no aplica."""
    if not query or not str(query).strip():
        return None
    if not documents or len(documents) < 1:
        return None
    q = str(query).strip()
    if len(q) < 2:
        return None
    docs_clean: List[str] = []
    for d in documents:
        s = d if isinstance(d, str) else ""
        docs_clean.append(s if s.strip() else " ")
    if not any(d.strip() for d in docs_clean):
        return None
    try:
        vectorizer = TfidfVectorizer(
            max_df=0.98,
            min_df=1,
            ngram_range=(1, 2),
            sublinear_tf=True,
            strip_accents="unicode",
        )
        X = vectorizer.fit_transform([q] + docs_clean)
        sims = cosine_similarity(X[0:1], X[1:]).astype(np.float64, copy=False).flatten()
        if sims.shape[0] != len(documents):
            return None
        return sims
    except ValueError as exc:
        logger.debug("tfidf cosine skipped: %s", exc)
        return None
    except Exception as exc:
        logger.warning("tfidf cosine failed: %s", exc)
        return None


def blend_lexical_and_tfidf(lexical: np.ndarray, sims: np.ndarray, alpha: float) -> np.ndarray:
    """Fusiona puntuación léxica normalizada [0,1] y similitud TF‑IDF [0,1] con numpy."""
    lex = np.asarray(lexical, dtype=np.float64).reshape(-1)
    sim = np.asarray(sims, dtype=np.float64).reshape(-1)
    if lex.size == 0:
        return sim
    mx = float(np.max(lex)) if lex.size else 0.0
    if mx > 1e-9:
        lex_n = lex / mx
    else:
        lex_n = np.zeros_like(lex)
    a = float(alpha)
    a = min(1.0, max(0.0, a))
    return (1.0 - a) * lex_n + a * sim


def rerank_scored_snippets(
    user_message: str,
    scored: List[Dict[str, Any]],
    *,
    alpha: float = TFIDF_BLEND_ALPHA,
) -> Tuple[List[Dict[str, Any]], bool]:
    """
    Reordena `scored` por fusión léxico + TF‑IDF. Cada ítem debe incluir `_sort` y `snippet`.

    Returns:
        (lista_reordenada, True si se aplicó TF‑IDF a 2+ candidatos con éxito).
    """
    if len(scored) < 2:
        return scored, False
    texts = [str(x.get("snippet") or "") for x in scored]
    sims = tfidf_cosine_similarities(user_message, texts)
    if sims is None:
        return scored, False
    lex = np.array([float(x.get("_sort") or 0) for x in scored], dtype=np.float64)
    combined = blend_lexical_and_tfidf(lex, sims, alpha)
    tie = np.arange(len(combined), dtype=np.int64)
    order = np.lexsort((tie, -combined))
    return [scored[int(i)] for i in order], True


def rerank_teacher_snippets_text_only(query: str, snippets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Ordena solo por similitud TF‑IDF con la consulta (p. ej. consulta distinta al retrieval original)."""
    if len(snippets) < 2 or not (query and str(query).strip()):
        return snippets
    texts = [str(s.get("snippet") or "") for s in snippets]
    sims = tfidf_cosine_similarities(str(query).strip(), texts)
    if sims is None:
        return snippets
    tie = np.arange(len(sims), dtype=np.int64)
    order = np.lexsort((tie, -sims))
    return [snippets[int(i)] for i in order]
