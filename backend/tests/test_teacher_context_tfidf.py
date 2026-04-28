import numpy as np

from app.services.teacher_context_tfidf import (
    blend_lexical_and_tfidf,
    rerank_scored_snippets,
    rerank_teacher_snippets_text_only,
    tfidf_cosine_similarities,
)


def test_tfidf_cosine_similarities_orders_by_relevance():
    q = "fotosíntesis clorofila luz absorbencia"
    docs = [
        "El renacimiento italiano y la perspectiva en pintura.",
        "La fotosíntesis utiliza clorofila para captar energía lumínica.",
    ]
    sims = tfidf_cosine_similarities(q, docs)
    assert sims is not None
    assert sims.shape == (2,)
    assert float(sims[1]) > float(sims[0])


def test_blend_lexical_and_tfidf_numpy_weights():
    lex = np.array([100.0, 50.0], dtype=np.float64)
    sims = np.array([0.0, 1.0], dtype=np.float64)
    out = blend_lexical_and_tfidf(lex, sims, alpha=0.5)
    assert out.shape == (2,)
    assert float(out[1]) > float(out[0])


def test_rerank_scored_snippets_prefers_tfidf_when_lexical_ties():
    scored = [
        {"_sort": 40, "snippet": "Arte gótico y arbotantes en catedrales.", "document_id": 1},
        {"_sort": 40, "snippet": "Mitocondria ATP respiración celular aerobia.", "document_id": 2},
    ]
    out, applied = rerank_scored_snippets("mitocondria ATP respiración", scored)
    assert applied is True
    assert out[0]["document_id"] == 2


def test_rerank_teacher_snippets_text_only():
    snippets = [
        {"snippet": "Contenido sobre geología sedimentaria."},
        {"snippet": "La homeostasis y retroalimentación en sistemas biológicos."},
    ]
    out = rerank_teacher_snippets_text_only("homeostasis retroalimentación", snippets)
    assert "homeostasis" in out[0]["snippet"].lower()
