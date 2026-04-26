"""
Heurísticas ligeras para clasificar documentos académicos.

Objetivo:
- Detectar un tipo documental útil sin depender de IA pesada.
- Favorecer decisiones conservadoras: si hay duda, devolver "generic".
"""
from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, List


DOCUMENT_TYPES = ("exam", "essay", "report", "rubric", "guide", "generic")
TEXT_SAMPLE_LIMIT = 5000
PARAGRAPH_SAMPLE_LIMIT = 8

TYPE_RULES = {
    "exam": {
        "filename": {
            "exam": 5,
            "examen": 5,
            "quiz": 4,
            "test": 4,
            "paper": 3,
            "parcial": 4,
            "final": 3,
            "markscheme": 5,
            "preguntas": 3,
        },
        "text": {
            "exam": 4,
            "examen": 4,
            "question": 3,
            "questions": 3,
            "paper": 2,
            "section": 2,
            "markscheme": 5,
            "instructions": 2,
            "answer all questions": 5,
            "multiple choice": 5,
            "true or false": 4,
            "puntaje": 2,
            "pregunta": 3,
            "preguntas": 3,
            "seccion": 2,
        },
    },
    "essay": {
        "filename": {
            "essay": 5,
            "ensayo": 5,
            "paper": 3,
            "monografia": 4,
            "monograph": 4,
        },
        "text": {
            "essay": 4,
            "ensayo": 4,
            "introduction": 2,
            "conclusion": 2,
            "bibliography": 3,
            "references": 3,
            "thesis": 2,
            "argument": 2,
            "introduccion": 2,
            "conclusiones": 2,
            "conclusion general": 2,
            "bibliografia": 3,
            "referencias": 3,
        },
    },
    "report": {
        "filename": {
            "report": 5,
            "informe": 5,
            "lab": 3,
            "research": 3,
        },
        "text": {
            "report": 4,
            "informe": 4,
            "findings": 4,
            "methodology": 4,
            "results": 3,
            "discussion": 3,
            "executive summary": 4,
            "metodologia": 4,
            "metodo": 2,
            "hallazgos": 4,
            "resultados": 3,
            "discusion": 3,
        },
    },
    "rubric": {
        "filename": {
            "rubric": 6,
            "rubrica": 6,
            "criteria": 4,
            "criterios": 4,
            "descriptor": 4,
            "descriptors": 4,
        },
        "text": {
            "rubric": 5,
            "rubrica": 5,
            "criterion": 4,
            "criteria": 4,
            "criterio": 4,
            "criterios": 4,
            "descriptor": 4,
            "descriptors": 4,
            "desempeno": 3,
            "performance level": 4,
            "achievement level": 4,
            "nivel de desempeno": 4,
            "excelente": 2,
            "bueno": 2,
            "regular": 2,
            "deficiente": 2,
        },
    },
    "guide": {
        "filename": {
            "guide": 6,
            "guia": 6,
            "syllabus": 6,
            "handbook": 6,
            "manual": 4,
        },
        "text": {
            "guide": 5,
            "guia": 5,
            "syllabus": 5,
            "handbook": 5,
            "course outline": 4,
            "learning outcomes": 4,
            "student handbook": 5,
            "objetivos de aprendizaje": 4,
            "programa del curso": 4,
            "cronograma": 3,
            "unidad": 2,
        },
    },
}


def _normalize_text(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    text = re.sub(r"[^\w\s]", " ", text)
    return " ".join(text.split())


def _build_text_sample(text: Any) -> str:
    raw_text = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    paragraphs = [segment.strip() for segment in raw_text.split("\n\n") if segment.strip()]
    if paragraphs:
        return "\n\n".join(paragraphs[:PARAGRAPH_SAMPLE_LIMIT])[:TEXT_SAMPLE_LIMIT]
    return raw_text[:TEXT_SAMPLE_LIMIT]


def _count_term_occurrences(text: str, term: str) -> int:
    escaped = re.escape(term)
    if " " in term:
        return 1 if re.search(rf"\b{escaped}\b", text) else 0
    return len(re.findall(rf"\b{escaped}\b", text))


def _score_bucket(source_text: str, rules: Dict[str, int], label: str) -> tuple[int, List[str]]:
    score = 0
    signals: List[str] = []
    for term, weight in rules.items():
        hits = _count_term_occurrences(source_text, term)
        if hits <= 0:
            continue
        contribution = min(hits, 3) * weight
        score += contribution
        signals.append(f"{label}:{term} x{hits}")
    return score, signals


def detect_document_type(filename: str, text: str) -> Dict[str, Any]:
    normalized_filename = _normalize_text(filename)
    sample_text = _normalize_text(_build_text_sample(text))
    scores = {doc_type: 0 for doc_type in DOCUMENT_TYPES if doc_type != "generic"}
    signals: Dict[str, List[str]] = {doc_type: [] for doc_type in scores}

    for doc_type, rule_group in TYPE_RULES.items():
        filename_score, filename_signals = _score_bucket(
            normalized_filename,
            rule_group["filename"],
            "filename",
        )
        text_score, text_signals = _score_bucket(
            sample_text,
            rule_group["text"],
            "text",
        )
        scores[doc_type] += filename_score + text_score
        signals[doc_type].extend(filename_signals + text_signals)

    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    best_type, best_score = ranked[0] if ranked else ("generic", 0)
    second_score = ranked[1][1] if len(ranked) > 1 else 0
    margin = best_score - second_score

    if best_score < 5 or margin < 2:
        return {
            "type": "generic",
            "confidence": 0.32 if best_score > 0 else 0.1,
            "signals": signals.get(best_type, [])[:8],
        }

    confidence = min(0.95, round(0.45 + (best_score * 0.03) + (margin * 0.04), 2))
    return {
        "type": best_type,
        "confidence": confidence,
        "signals": signals.get(best_type, [])[:8],
    }
