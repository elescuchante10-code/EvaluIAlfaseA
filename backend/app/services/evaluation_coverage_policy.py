"""
Motor de política de cobertura evaluativa (heurístico, sin LLM).

Orienta techo y distribución de observaciones en evaluación formal según modo de
contenido, rol documental, extensión textual y señales multimodales. La rúbrica
sigue siendo la autoridad principal; esto solo modula densidad y foco.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Tuple

from app.services.document_intelligence import build_document_intelligence_profile

# Aproximadamente 15 observaciones por 2000 palabras en modo predominantemente textual.
_TEXT_OBS_PER_1K_WORDS = 7.5
_MIN_TARGET = 4
_MAX_TARGET = 45

_STEP_LINE_RE = re.compile(r"^\s*(?:\(?\d+[\).\s]|[a-z]\)\s|paso\s+\d+)", re.IGNORECASE | re.MULTILINE)


def _word_target(total_words: int) -> int:
    raw = round(_TEXT_OBS_PER_1K_WORDS * max(0, int(total_words)) / 1000.0)
    return max(_MIN_TARGET, min(_MAX_TARGET, max(raw, _MIN_TARGET)))


def _visual_context_rich_count(processing: Dict[str, Any]) -> int:
    vc = processing.get("visual_context") or []
    if not isinstance(vc, list):
        return 0
    n = 0
    for item in vc:
        if not isinstance(item, dict):
            continue
        t = str(item.get("type") or "").strip().lower()
        if t in {"grafica", "tabla", "diagrama", "formula", "objeto", "obra"}:
            n += 1
    return min(n, 12)


def _resolution_like_paragraphs_count(paragraphs: List[str]) -> int:
    n = 0
    for p in paragraphs or []:
        s = str(p or "")
        if len(s) < 14:
            continue
        if _STEP_LINE_RE.search(s):
            n += 1
            continue
        if s.count("=") >= 2 and len(s) <= 900:
            n += 1
            continue
        if re.search(r"\\frac|\\sum|\\int|\$\$", s):
            n += 1
    return min(n, 12)


def _evidence_score(
    profile: Dict[str, Any],
    processing: Dict[str, Any],
    paragraphs: List[str],
) -> float:
    score = 0.0
    if profile.get("has_formulas"):
        score += 3.0
    if profile.get("has_tables"):
        score += 3.0
    if profile.get("has_charts"):
        score += 2.5
    if profile.get("has_diagrams"):
        score += 2.0
    if profile.get("has_images"):
        score += 1.0
    if profile.get("visual_evidence_relevant"):
        score += 1.5

    score += 0.55 * float(_visual_context_rich_count(processing))
    score += 0.9 * float(_resolution_like_paragraphs_count(paragraphs))

    va = processing.get("visual_analysis") or {}
    if isinstance(va, dict):
        analyzed = int(va.get("analyzed_count") or 0)
        candidates = int(va.get("candidate_count") or 0)
        score += 0.35 * float(min(8, max(analyzed, candidates)))

    return score


def _evidence_target(score: float) -> int:
    # Base 6 + ~2 observaciones por unidad de evidencia compuesta.
    raw = round(6.0 + 1.85 * score)
    return max(_MIN_TARGET, min(_MAX_TARGET, raw))


def _blend(a: float, b: float, w_a: float) -> int:
    return int(round(w_a * a + (1.0 - w_a) * b))


def _role_adjustment(role: str, content_mode: str, text_t: int, ev_t: int) -> Tuple[int, int, str]:
    note = ""
    r = (role or "").strip()
    if r == "essay" and content_mode in {"text_only", "mixed"}:
        text_t = min(_MAX_TARGET, max(text_t, int(round(text_t * 1.08))))
        note = " Ajuste por rol ensayo: más margen para desarrollo argumentativo."
    elif r in {"lab_response", "formula_sheet"} and content_mode in {"formula_heavy", "mixed", "visual_heavy"}:
        ev_t = min(_MAX_TARGET, ev_t + 2)
        note = " Ajuste por rol laboratorio/formulario: más foco en evidencia técnica."
    elif r == "report" and content_mode == "text_only":
        text_t = min(_MAX_TARGET, int(round(text_t * 1.05)))
        note = " Ajuste por rol informe: ligeramente más cobertura textual."
    return text_t, ev_t, note


def _distribution_hints(content_mode: str) -> Dict[str, Any]:
    if content_mode == "text_only":
        return {
            "spread_across_document": True,
            "prefer_paragraph_fragments": True,
            "balance_text_and_visual_evidence": False,
            "prioritize_formula_table_chart_blocks": False,
        }
    if content_mode == "formula_heavy":
        return {
            "spread_across_document": True,
            "prefer_paragraph_fragments": False,
            "balance_text_and_visual_evidence": True,
            "prioritize_formula_table_chart_blocks": True,
        }
    if content_mode == "visual_heavy":
        return {
            "spread_across_document": True,
            "prefer_paragraph_fragments": False,
            "balance_text_and_visual_evidence": True,
            "prioritize_formula_table_chart_blocks": True,
        }
    # mixed
    return {
        "spread_across_document": True,
        "prefer_paragraph_fragments": True,
        "balance_text_and_visual_evidence": True,
        "prioritize_formula_table_chart_blocks": True,
    }


def _coverage_mode_label(content_mode: str) -> str:
    return {
        "text_only": "textual_proportional",
        "formula_heavy": "evidence_structured",
        "visual_heavy": "visual_first",
        "mixed": "hybrid_text_evidence",
    }.get(content_mode, "hybrid_text_evidence")


def build_evaluation_coverage_policy(
    document_context: Dict[str, Any],
    paragraphs: List[str],
    total_words: int,
) -> Dict[str, Any]:
    """
    Devuelve política serializable (API / bundle) con techo orientativo de observaciones.

    No sustituye la rúbrica ni fuerza “relleno”: el techo es máximo, no mínimo.
    """
    ctx = document_context if isinstance(document_context, dict) else {}
    prof_in = ctx.get("document_intelligence_profile")
    text_joined = "\n\n".join(paragraphs or [])
    if not isinstance(prof_in, dict):
        profile = build_document_intelligence_profile(
            str(ctx.get("original_filename") or ctx.get("filename") or ""),
            text_joined,
            ctx,
        )
    else:
        profile = prof_in

    content_mode = str(profile.get("content_mode") or "mixed").strip()
    if content_mode not in {"text_only", "mixed", "visual_heavy", "formula_heavy"}:
        content_mode = "mixed"

    role = str(profile.get("document_role") or "").strip()
    text_t = _word_target(total_words)
    ev_score = _evidence_score(profile, ctx, paragraphs or [])
    ev_t = _evidence_target(ev_score)

    text_t, ev_t, role_note = _role_adjustment(role, content_mode, text_t, ev_t)

    if content_mode == "text_only":
        target = text_t
        rationale = (
            f"Documento predominantemente textual (~{total_words} palabras); "
            f"proporción orientativa ~{_TEXT_OBS_PER_1K_WORDS:.1f} observaciones por 1000 palabras."
        )
    elif content_mode == "formula_heavy":
        floor_words = max(_MIN_TARGET, min(text_t // 3, 10))
        target = max(ev_t, floor_words)
        rationale = (
            "Trabajo cuantitativo / con fórmulas: la cobertura privilegia bloques de evidencia "
            f"(fórmulas, tablas, gráficas, pasos de resolución; score evidencia ≈ {ev_score:.1f}), "
            "no solo el volumen de palabras."
        )
    elif content_mode == "visual_heavy":
        floor_words = max(_MIN_TARGET, min(text_t // 2, 12))
        target = max(ev_t, floor_words)
        rationale = (
            "Documento visualmente denso: la cobertura debe repartirse entre texto y elementos "
            f"visuales relevantes (score evidencia ≈ {ev_score:.1f})."
        )
    else:
        target = _blend(float(text_t), float(ev_t), 0.52)
        target = max(_MIN_TARGET, min(_MAX_TARGET, target))
        rationale = (
            f"Documento mixto: combina proporción textual (~{text_t}) con evidencia técnica/visual (~{ev_t})."
        )

    if role_note:
        rationale += role_note

    distribution = _distribution_hints(content_mode)

    return {
        "coverage_mode": _coverage_mode_label(content_mode),
        "content_mode": content_mode,
        "document_role": role or None,
        "target_observation_count": int(target),
        "distribution_hints": distribution,
        "coverage_rationale": rationale.strip(),
    }


def extend_feedback_prompt_lines(
    lines: List[str],
    coverage_policy: Dict[str, Any],
) -> None:
    """Añade instrucciones de cobertura y calidad a las líneas del presupuesto de feedback."""
    mode = str(coverage_policy.get("coverage_mode") or "")
    rationale = str(coverage_policy.get("coverage_rationale") or "").strip()
    hints = coverage_policy.get("distribution_hints") or {}
    lines.append(
        f"Política de cobertura ({mode}): {rationale}" if rationale else f"Política de cobertura ({mode})."
    )
    if isinstance(hints, dict):
        if hints.get("spread_across_document"):
            lines.append(
                "Distribuye las observaciones a lo largo del documento: cubre inicio, desarrollo y cierre "
                "según corresponda; evita concentrar la mayoría de notas en la introducción o en un solo tramo."
            )
        if hints.get("prefer_paragraph_fragments"):
            lines.append(
                "Prioriza anchor_type='paragraph' o fragmentos de párrafo (varias frases coherentes); usa "
                "'phrase' solo si el error es local y puntual. Evita snippets demasiado breves (menos de ~12 palabras) "
                "salvo citas cortas inevitables; evita bloques enormes que diluyan el problema."
            )
        if hints.get("prioritize_formula_table_chart_blocks"):
            lines.append(
                "Asegura observaciones sobre bloques matemáticos, tablas, gráficas o diagramas cuando sean parte del trabajo."
            )
        if hints.get("balance_text_and_visual_evidence"):
            lines.append("Equilibra comentarios sobre argumentación escrita y sobre evidencia visual o técnica relevante.")
    target_n = int(coverage_policy.get("target_observation_count") or 0)
    mode_cm = str(coverage_policy.get("content_mode") or "")
    if target_n >= 12 and mode_cm in {"text_only", "mixed"}:
        lines.append(
            "Si el documento ofrece suficientes problemas distintos y bien fundados en la rúbrica, "
            "aproxímate al techo máximo con notas útiles (no repeticiones): la meta operativa es alta densidad "
            "pedagógica cuando el texto lo permite."
        )
    lines.append(
        "El número máximo indicado es un techo orientativo, no una cuota mínima: no inventes observaciones vacías "
        "ni microcomentarios solo para 'llenar'; menos notas de alto valor es preferible a ruido o duplicados."
    )
    lines.append(
        "Síntesis final (evaluation_matrix): `general_summary`, `strengths`, `main_weaknesses`, `improvement_plan` y `key_examples` deben ser "
        "específicos, defendibles con la rúbrica y con el texto evaluado; evita debilidades o fortalezas genéricas de relleno no respaldadas en las notas al pie."
    )
