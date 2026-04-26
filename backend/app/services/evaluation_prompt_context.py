"""
Reduce `evaluation_context_bundle` a un bloque breve y seguro para la evaluación formal.

No sustituye la rúbrica ni el texto del documento; solo orienta de forma subordinada.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from app.services.evaluation_context_bundle import BUNDLE_KIND

MAX_FORMAL_SNIPPETS = 3
MAX_SNIPPET_CHARS = 400
MAX_PROFILE_SUMMARY_CHARS = 320

_FORMAL_CONTEXT_POLICY = """POLÍTICA DE USO (solo evaluación formal):
- La rúbrica provista en este mensaje es la autoridad principal para criterios y ponderación.
- La evidencia real del documento del estudiante manda: cada juicio debe anclarse en ese texto.
- Este bloque es orientación complementaria (asignatura, tipo de tarea, lectura de tablas, gráficos, fórmulas o diagramas cuando aplique).
- Si el contexto —incluidos los fragmentos de referencia— y el documento o la rúbrica divergen, prioriza siempre el documento y la rúbrica.
- No atribuyas aciertos ni errores al estudiante solo porque un fragmento de guía diga algo distinto.
- No cites ni desarrolles extensamente los fragmentos salvo cuando ayuden directamente a interpretar el trabajo entregado.
- Las etiquetas de severidad FORMAL / MENOR / RELEVANTE / CRÍTICO aplican únicamente en esta evaluación formal, no en chats u otros modos."""


def _clean_one_line(text: str, max_len: int) -> str:
    s = re.sub(r"\s+", " ", (text or "").strip())
    if len(s) <= max_len:
        return s
    return s[: max_len - 1].rstrip() + "…"


def _summarize_profile(profile: Any) -> str:
    if not isinstance(profile, dict):
        return ""
    mode = str(profile.get("content_mode") or "").strip()
    src = str(profile.get("source_type") or "").strip()
    flags: List[str] = []
    if profile.get("has_tables"):
        flags.append("tablas")
    if profile.get("has_charts"):
        flags.append("gráficos")
    if profile.get("has_formulas"):
        flags.append("fórmulas")
    if profile.get("has_diagrams"):
        flags.append("diagramas")
    if profile.get("has_handwriting"):
        flags.append("manuscrito")
    if profile.get("has_images"):
        flags.append("imágenes")
    vis = profile.get("visual_evidence_relevant")
    vis_s = "evidencia visual relevante" if vis is True else ""

    parts: List[str] = []
    if mode:
        parts.append(f"modo: {mode}")
    if src:
        parts.append(f"origen: {src}")
    if flags:
        parts.append("presenta: " + ", ".join(flags))
    if vis_s:
        parts.append(vis_s)
    raw = "; ".join(parts)
    return _clean_one_line(raw, MAX_PROFILE_SUMMARY_CHARS)


def _orientation_note(bundle: Dict[str, Any]) -> str:
    if bundle.get("retrieval_used"):
        return (
            "Los fragmentos provienen de materiales indexados en Mi Espacio IB; "
            "úsalos solo si clarifican la tarea o la lectura del trabajo, sin imponer exigencias extra a la rúbrica."
        )
    subj = str(bundle.get("subject") or "").strip()
    if subj:
        return f"Contexto mínimo alineado a la asignatura indicada ({subj}); prioriza siempre el texto entregado y la rúbrica."
    return "Contexto mínimo de apoyo; prioriza siempre el texto entregado y la rúbrica."


def _trim_snippet_text(text: str) -> str:
    return _clean_one_line(text, MAX_SNIPPET_CHARS)


def build_formal_evaluation_prompt_context(bundle: Dict[str, Any]) -> str:
    """
    Devuelve texto para insertar en el user prompt de evaluación formal, o cadena vacía si no aporta nada útil.
    """
    if not isinstance(bundle, dict) or bundle.get("bundle_kind") != BUNDLE_KIND:
        return ""

    subject = str(bundle.get("subject") or "").strip()
    role = str(bundle.get("document_role") or "").strip()
    raw_profile = bundle.get("document_intelligence_profile")
    profile_for_summary: Any = raw_profile
    if isinstance(raw_profile, dict):
        profile_for_summary = {k: v for k, v in raw_profile.items() if k != "document_role"}
    profile_line = _summarize_profile(profile_for_summary)

    snippets_raw = bundle.get("teacher_context_snippets") or []
    snippet_lines: List[str] = []
    if isinstance(snippets_raw, list):
        for i, item in enumerate(snippets_raw[:MAX_FORMAL_SNIPPETS], start=1):
            if not isinstance(item, dict):
                continue
            body = _trim_snippet_text(str(item.get("snippet") or ""))
            if not body:
                continue
            fn = str(item.get("filename") or "").strip() or "documento"
            cat = str(item.get("categoria_documental") or "").strip()
            meta = f"{fn}" + (f" · {cat}" if cat else "")
            snippet_lines.append(f'{i}. ({meta}) "{body}"')

    useful = bool(subject or role or profile_line or snippet_lines)
    if not useful:
        return ""

    lines: List[str] = [
        _FORMAL_CONTEXT_POLICY,
        "",
        "DATOS DE ORIENTACIÓN (subordinados a rúbrica y documento):",
    ]
    if subject:
        lines.append(f"- Asignatura de trabajo: {subject}")
    if role:
        lines.append(f"- Rol documental: {role}")
    if profile_line:
        lines.append(f"- Perfil del documento (síntesis): {profile_line}")

    if snippet_lines:
        lines.append("")
        lines.append(
            f"Fragmentos de referencia (máximo {MAX_FORMAL_SNIPPETS}; uso puntual, sin imponer criterios ajenos a la rúbrica):"
        )
        lines.extend(snippet_lines)

    lines.append("")
    lines.append(f"Nota orientativa: {_orientation_note(bundle)}")

    return "\n".join(lines).strip()
