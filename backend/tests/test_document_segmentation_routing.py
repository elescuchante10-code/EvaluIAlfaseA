"""Segmentación PDF y routing short vs long (sin LLM)."""
from app.routers.evaluate import (
    should_trigger_coverage_backfill,
    should_use_long_evaluation,
    SHORT_DOCUMENT_WORD_LIMIT,
)
from app.services.document_multimodal import segment_text_blocks


def test_segment_text_blocks_splits_oversized_pdf_blob():
    words = ["w"] * 400
    blob = " ".join(words)
    out = segment_text_blocks(blob, source="pdf", max_words=120, max_chars=800)
    assert len(out) >= 2
    assert all(w.strip() for w in out)


def test_segment_text_blocks_respects_blank_lines():
    blob = "Primera unidad corta.\n\nSegunda unidad también corta."
    out = segment_text_blocks(blob, source="pdf")
    assert len(out) >= 2


def test_should_use_long_for_few_giant_paragraphs():
    # ~2400 palabras en 2 bloques enormes
    a = " ".join(["palabra"] * 1200)
    b = " ".join(["otra"] * 1200)
    paras = [a, b]
    total = 2400
    assert total <= SHORT_DOCUMENT_WORD_LIMIT
    assert should_use_long_evaluation(paras, total) is True


def test_should_stay_short_for_many_small_paragraphs():
    paras = [" ".join(["x"] * 80) for _ in range(20)]
    total = sum(len(p.split()) for p in paras)
    assert total < SHORT_DOCUMENT_WORD_LIMIT
    assert should_use_long_evaluation(paras, total) is False


def test_coverage_backfill_trigger_reasonable():
    pol = {"target_observation_count": 18}
    assert should_trigger_coverage_backfill(5, pol, 1200, 8) is True
    # ≥78 % del techo (~14/18): no segunda pasada
    assert should_trigger_coverage_backfill(15, pol, 1200, 8) is False
    assert should_trigger_coverage_backfill(5, pol, 400, 8) is False
    assert should_trigger_coverage_backfill(5, {"target_observation_count": 8}, 1200, 8) is False
