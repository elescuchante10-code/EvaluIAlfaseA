"""Anclajes de bajo valor y fragmentos sustantivos (sin LLM)."""
from app.services.footnote_anchor_quality import (
    is_low_value_anchor_candidate,
    substantive_snippet_for_paragraph_fragment,
)


def test_flags_bibliography_heading():
    low, _ = is_low_value_anchor_candidate("Referencias", 3, 20)
    assert low is True


def test_flags_word_count_line():
    low, _ = is_low_value_anchor_candidate("Número de palabras: 2150", 1, 10)
    assert low is True


def test_keeps_argument_paragraph():
    low, _ = is_low_value_anchor_candidate(
        "La tesis se sostiene porque el autor articula dos premisas incompatibles con la evidencia citada en la sección anterior.",
        4,
        12,
    )
    assert low is False


def test_paragraph_fragment_snippet_prefers_note_keywords():
    para = " ".join(["palabra"] * 120) + " nucleo_argumental central " + " ".join(["otra"] * 120)
    sn = substantive_snippet_for_paragraph_fragment(
        para,
        "El nucleo argumental no está vinculado al criterio de evidencia.",
        "palabra palabra",
        max_chars=400,
    )
    assert "nucleo" in sn.lower() or "nucleo_argumental" in sn.replace(" ", "_").lower()
