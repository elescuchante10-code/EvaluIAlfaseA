"""
Perfil de inteligencia documental auditable (heurístico, sin LLM propio).

Combina:
- Clasificación gruesa existente (`document_router` / detect_document_type)
- Metadatos del pipeline multimodal (`document_multimodal.extract_document_payload`)
- Patrones de texto y nombre de archivo conservadores
"""
from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, List, Optional, Set

# Roles finos expuestos en API (valores estables para clientes).
DOCUMENT_ROLES = (
    "student_submission",
    "official_exam",
    "teacher_worksheet",
    "rubric",
    "guide",
    "essay",
    "report",
    "lab_response",
    "formula_sheet",
    "generic",
)

CONTENT_MODES = ("text_only", "mixed", "visual_heavy", "formula_heavy")

SOURCE_TYPES = ("native_text", "scanned_printed", "scanned_handwritten", "mixed")

TEXT_SAMPLE_LIMIT = 6000

# Pesos ligeros: solo desempatan; si no hay señal clara → generic / defaults seguros.
_STUDENT_FILENAME = {
    "entrega": 4,
    "submission": 4,
    "tarea": 3,
    "homework": 3,
    "alumno": 3,
    "estudiante": 3,
    "student": 3,
}

_STUDENT_TEXT = {
    "nombre del estudiante": 4,
    "nombre y apellido": 4,
    "apellido": 2,
    "curso": 2,
    "grupo": 2,
    "legajo": 3,
    "numero de lista": 3,
    "fecha de entrega": 3,
}

_TEACHER_SHEET_FILENAME = {
    "worksheet": 5,
    "practica": 4,
    "práctica": 4,
    "ejercicios": 4,
    "actividad": 4,
    "guia de trabajo": 5,
    "clase": 2,
}

_TEACHER_SHEET_TEXT = {
    "complete los espacios": 4,
    "completa la tabla": 4,
    "ejercicio 1": 2,
    "ejercicios": 2,
    "practica": 2,
    "práctica": 2,
    "pair work": 3,
    "fill in": 3,
}

_OFFICIAL_EXAM_FILENAME = {
    "past paper": 5,
    "mock exam": 5,
    "official": 3,
    "ib exam": 5,
    "cambridge": 3,
    "ministerio": 3,
}

_OFFICIAL_EXAM_TEXT = {
    "tiempo total": 4,
    "duracion": 3,
    "duración": 3,
    "no escriba en esta hoja": 4,
    "instrucciones del examen": 4,
    "examen oficial": 5,
    "paper 1": 3,
    "paper 2": 3,
}

_LAB_FILENAME = {
    "lab": 3,
    "laboratorio": 4,
    "practica de lab": 4,
    "informe de laboratorio": 5,
}

_LAB_TEXT = {
    "hipotesis": 3,
    "hipótesis": 3,
    "metodologia experimental": 4,
    "metodología experimental": 4,
    "material y metodologia": 4,
    "resultados experimentales": 4,
    "discusion": 2,
    "discusión": 2,
    "objetivo del laboratorio": 5,
}

_FORMULA_FILENAME = {
    "formula": 4,
    "formulario": 3,
    "cheat sheet": 5,
    "equation": 3,
}

_LATEX_RE = re.compile(
    r"(\\frac|\\sum|\\int|\\sqrt|\\begin\{equation\}|\$\$|\$[^\$]+\$|\\\[|\\\]|\\text\{)"
)


def _normalize(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[^\w\s|]", " ", text)
    return " ".join(text.split())


def _text_sample(text: Any) -> str:
    raw = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    return raw[:TEXT_SAMPLE_LIMIT]


def _score_terms(haystack: str, terms: Dict[str, int]) -> int:
    score = 0
    for term, weight in terms.items():
        if " " in term:
            if re.search(rf"(?i)\b{re.escape(term)}\b", haystack):
                score += weight
        else:
            hits = len(re.findall(rf"(?i)\b{re.escape(term)}\b", haystack))
            if hits:
                score += min(hits, 4) * weight
    return score


def _visual_types(processing: Dict[str, Any]) -> Set[str]:
    out: Set[str] = set()
    for item in processing.get("visual_context") or []:
        if not isinstance(item, dict):
            continue
        t = str(item.get("type") or "").strip().lower()
        if t:
            out.add(t)
    return out


def _normalize_source_type(value: Any) -> str:
    s = str(value or "").strip().lower()
    if s in SOURCE_TYPES:
        return s
    return "native_text"


def _has_handwriting(processing: Dict[str, Any]) -> bool:
    st = _normalize_source_type(processing.get("document_source_type") or processing.get("source_type"))
    if st == "scanned_handwritten":
        return True
    if st != "mixed":
        return False
    for entry in processing.get("page_map") or []:
        if not isinstance(entry, dict):
            continue
        if str(entry.get("source_type") or "").strip().lower() == "scanned_handwritten":
            return True
    return False


def _text_suggests_table(sample_norm: str) -> bool:
    if re.search(r"\|[^\n]+\|[^\n]+\|", sample_norm):
        return True
    if re.search(r"\btabla\s+\d+\b", sample_norm) and sample_norm.count("tabla") >= 1:
        return True
    return False


def _formula_density(sample_raw: str) -> float:
    if not sample_raw or len(sample_raw) < 40:
        return 0.0
    latex_hits = len(_LATEX_RE.findall(sample_raw))
    # Símbolos matemáticos sueltos (conservador: muchos en poco texto).
    sym_hits = len(re.findall(r"[∫∑√≤≥≠±×÷^_=]{2,}", sample_raw))
    wordish = max(1, len(re.findall(r"\w+", sample_raw)))
    return (latex_hits * 2.5 + sym_hits) / wordish


def _infer_document_role(
    filename: str,
    text: str,
    router: Optional[Dict[str, Any]],
) -> str:
    coarse = str((router or {}).get("type") or "generic").strip().lower()
    fn = _normalize(filename)
    sample = _normalize(_text_sample(text))

    if coarse == "rubric":
        return "rubric"
    if coarse == "guide":
        return "guide"
    if coarse == "essay":
        return "essay"
    if coarse == "report":
        lab_score = _score_terms(fn, _LAB_FILENAME) + _score_terms(sample, _LAB_TEXT)
        if lab_score >= 6:
            return "lab_response"
        return "report"

    fs_score = _score_terms(fn, _FORMULA_FILENAME) + int(_formula_density(text) >= 0.08)
    if coarse == "generic" and (fs_score >= 4 or _formula_density(text) >= 0.12):
        return "formula_sheet"

    if coarse == "exam":
        stu = _score_terms(fn, _STUDENT_FILENAME) + _score_terms(sample, _STUDENT_TEXT)
        tch = _score_terms(fn, _TEACHER_SHEET_FILENAME) + _score_terms(sample, _TEACHER_SHEET_TEXT)
        off = _score_terms(fn, _OFFICIAL_EXAM_FILENAME) + _score_terms(sample, _OFFICIAL_EXAM_TEXT)
        ranked = sorted(
            [
                ("student_submission", stu),
                ("teacher_worksheet", tch),
                ("official_exam", off),
            ],
            key=lambda x: x[1],
            reverse=True,
        )
        best_role, best_score = ranked[0]
        second = ranked[1][1] if len(ranked) > 1 else 0
        if best_score >= 5 and (best_score - second) >= 2:
            return str(best_role)
        # Examen genérico sin señales fuertes: conservador hacia material de aula.
        return "official_exam"

    if coarse == "generic":
        lab_score = _score_terms(fn, _LAB_FILENAME) + _score_terms(sample, _LAB_TEXT)
        if lab_score >= 6:
            return "lab_response"
        stu = _score_terms(fn, _STUDENT_FILENAME) + _score_terms(sample, _STUDENT_TEXT)
        if stu >= 5:
            return "student_submission"
        tch = _score_terms(fn, _TEACHER_SHEET_FILENAME) + _score_terms(sample, _TEACHER_SHEET_TEXT)
        if tch >= 5:
            return "teacher_worksheet"

    return "generic"


def _infer_content_mode(
    processing: Dict[str, Any],
    text: str,
    vtypes: Set[str],
    has_formula_signal: bool,
) -> str:
    va = processing.get("visual_analysis") or {}
    candidates = int(va.get("candidate_count") or 0)
    analyzed = int(va.get("analyzed_count") or 0)
    vision_failed = bool(va.get("vision_failed"))

    native_sufficient = bool(processing.get("native_text_sufficient"))
    word_count = int(processing.get("native_text_word_count") or 0)
    transcribed = processing.get("transcribed_paragraphs") or []
    transcribed_n = len(transcribed) if isinstance(transcribed, list) else 0

    if has_formula_signal and _formula_density(text) >= 0.06:
        return "formula_heavy"

    visual_rich_types = vtypes & {"grafica", "tabla", "diagrama", "formula", "objeto", "obra", "foto"}
    if candidates >= 2 and not native_sufficient and not vision_failed:
        return "visual_heavy"
    if analyzed >= 2 and len(visual_rich_types) >= 2 and word_count < 180:
        return "visual_heavy"
    if candidates >= 1 and transcribed_n > 0:
        return "mixed"
    if native_sufficient and candidates >= 1:
        return "mixed"
    return "text_only"


def _visual_evidence_relevant(processing: Dict[str, Any]) -> bool:
    if not processing.get("visual_context_enabled"):
        return False
    va = processing.get("visual_analysis") or {}
    if bool(va.get("vision_failed")):
        return False
    vc = processing.get("visual_context") or []
    if not isinstance(vc, list) or not vc:
        return False
    for item in vc:
        if not isinstance(item, dict):
            continue
        rel = str(item.get("probable_relevance") or "").strip().lower()
        if rel in {"high", "medium"}:
            return True
    return False


def build_document_intelligence_profile(
    filename: str,
    text: str,
    processing: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Construye el perfil expuesto en API. Sin side effects.
    """
    proc = processing if isinstance(processing, dict) else {}
    router = proc.get("document_router") if isinstance(proc.get("document_router"), dict) else None

    source_type = _normalize_source_type(proc.get("document_source_type") or proc.get("source_type"))

    vtypes = _visual_types(proc)
    sample_raw = _text_sample(text)
    sample_norm = _normalize(sample_raw)

    has_charts = "grafica" in vtypes
    has_tables = "tabla" in vtypes or _text_suggests_table(sample_norm)
    has_formulas = "formula" in vtypes or _formula_density(sample_raw) >= 0.04
    has_diagrams = "diagrama" in vtypes

    va = proc.get("visual_analysis") or {}
    candidate_count = int(va.get("candidate_count") or 0)
    has_images = candidate_count > 0

    has_handwriting = _has_handwriting(proc)

    formula_signal = has_formulas or _formula_density(sample_raw) >= 0.06
    content_mode = _infer_content_mode(proc, sample_raw, vtypes, formula_signal)
    role = _infer_document_role(filename, text, router)
    if role == "generic" and formula_signal and _score_terms(_normalize(filename), _FORMULA_FILENAME) >= 3:
        role = "formula_sheet"

    visual_evidence_relevant = _visual_evidence_relevant(proc)

    profile = {
        "document_role": role if role in DOCUMENT_ROLES else "generic",
        "content_mode": content_mode if content_mode in CONTENT_MODES else "mixed",
        "source_type": source_type,
        "has_images": bool(has_images),
        "has_charts": bool(has_charts),
        "has_tables": bool(has_tables),
        "has_formulas": bool(has_formulas),
        "has_diagrams": bool(has_diagrams),
        "has_handwriting": bool(has_handwriting),
        "visual_evidence_relevant": bool(visual_evidence_relevant),
    }
    return profile


def format_profile_for_prompt(profile: Dict[str, Any]) -> str:
    """Una línea breve para contexto de chat (auditable, sin JSON enorme)."""
    if not isinstance(profile, dict):
        return ""
    parts = [
        f"rol={profile.get('document_role')}",
        f"modo={profile.get('content_mode')}",
        f"fuente={profile.get('source_type')}",
        f"img={profile.get('has_images')}",
        f"graf={profile.get('has_charts')}",
        f"tab={profile.get('has_tables')}",
        f"form={profile.get('has_formulas')}",
        f"diag={profile.get('has_diagrams')}",
        f"manuscrito={profile.get('has_handwriting')}",
        f"evid_visual={profile.get('visual_evidence_relevant')}",
    ]
    return "Perfil documental (heurístico): " + "; ".join(str(p) for p in parts)
