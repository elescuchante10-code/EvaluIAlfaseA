"""
Reduce `evaluation_context_bundle` a un bloque de contexto de referencia para evaluación formal.

La rúbrica activa sigue definiendo la estructura de calificación; el material de Mi Espacio IB
aporta autoridad de contenido disciplinario para juicios de pertinencia, rigor y sentido.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from app.services.evaluation_context_bundle import BUNDLE_KIND
from app.services.teacher_context_tfidf import rerank_teacher_snippets_text_only

# Ventana de contexto — evaluación formal (alineado a insumo pedagógico; sin vector DB en repo)
MAX_REFERENCE_SNIPPETS = 12
MAX_SNIPPET_CHARS = 2000
MAX_PROFILE_SUMMARY_CHARS = 500
MAX_RUBRIC_ENCADRE_CHARS = 300
MAX_TOTAL_CONTEXT_CHARS = 18000

# Compatibilidad con tests que importan MAX_FORMAL_SNIPPETS
MAX_FORMAL_SNIPPETS = MAX_REFERENCE_SNIPPETS

_REFERENCE_CONTEXT_POLICY = """CONTEXTO DE REFERENCIA ACADÉMICA — MATERIAL DEL PROFESOR (Mi Espacio IB)

MARCO MULTI-ASIGNATURA (operativo)
- El evaluador actúa según los **tres insumos** de la petición: trabajo del estudiante, rúbrica activa y material de Mi Espacio IB.
  La **materia y el marco** (Biología, Matemáticas, Literatura, Física, Filosofía, otras; IB u otros programas) los define **solo**
  lo que digan la rúbrica y esos documentos —no se asume un programa fijo ni una asignatura concreta por defecto.
- Si rúbrica y referencias son explícitamente de un programa (p. ej. IB), úsalo con rigor **en la medida** en que esté
  contenido en ellos; si no lo son, mantén un juicio académico disciplinar al nivel que indique la rúbrica, sin forzar jerga
  de un currículo que no figure en los insumos.

ROL DE ESTE BLOQUE
Los fragmentos siguientes provienen de documentos que el profesor indexó como referencia
de la asignatura. Constituyen AUTORIDAD DE CONTENIDO: conceptos, marcos, estándares y
expectativas de la disciplina tal como el docente las organiza en su espacio de trabajo.

JERARQUÍA (operativa)
1) Texto o producto del estudiante — evidencia primaria: todo juicio debe poder defenderse
   con lo que el estudiante escribió o entregó.
2) Rúbrica activa — define cómo se califica (criterios, niveles, pesos). No inventes
   criterios ni columnas que no existan en esa rúbrica.
3) Material de referencia (este bloque) — calibra pertinencia, profundidad y lenguaje
   disciplinar: qué se espera en esta asignatura y nivel, sin sustituir a la rúbrica ni
   convertir la retro en un copia del material.

INSTRUCCIONES PARA EL EVALUADOR
- Contrasta el trabajo con las ideas y exigencias que sugieren los fragmentos cuando
  aporten luz sobre lagunas, imprecisiones o fortalezas reales.
- Si falta un concepto o matiz que la referencia trata como central, dilo como vacío
  disciplinario relevante y orienta con precisión (sin recitar el fragmento entero).
- Valora reinterpretaciones y síntesis propias del estudiante: indica si mantienen rigor
  frente a la referencia o si hay error conceptual.
- Prioriza retroalimentación útil y específica: qué funciona, qué no y un siguiente paso
  concreto; evita muletillas genéricas («profundizar más») sin anclaje al texto o a la
  referencia.
- No uses este bloque para imponer una única respuesta correcta de manual; sí para
  sostener juicios de sentido y criterio profesional.
- Si el estudiante aporta fuentes o líneas válidas no presentes en la referencia, reconócelo
  cuando fortalezca el trabajo.

Salida técnica: respeta el contrato JSON del evaluador (p. ej. `evaluation_matrix` y notas al pie)
y el uso de severidades FORMAL / MENOR / RELEVANTE / CRÍTICO definido para esta evaluación formal."""


def _clean_text(text: str, max_len: int, add_ellipsis: bool = True) -> str:
    if not text:
        return ""
    s = re.sub(r"[ \t]+", " ", str(text).strip())
    s = re.sub(r"\n{3,}", "\n\n", s)
    if len(s) <= max_len:
        return s
    if not add_ellipsis:
        return s[:max_len]
    trunc = s[:max_len]
    last_break = max(trunc.rfind(". "), trunc.rfind("\n"), trunc.rfind("; "))
    if last_break > max_len * 0.65:
        return trunc[: last_break + 1].strip() + "\n[...]"
    return trunc[: max_len - 1].rstrip() + "…"


def _format_snippet(index: int, item: Dict[str, Any]) -> Optional[str]:
    body = str(item.get("snippet") or item.get("content") or "").strip()
    if not body:
        return None
    body = _clean_text(body, MAX_SNIPPET_CHARS)
    filename = str(item.get("filename") or item.get("source") or "documento").strip()
    categoria = str(item.get("categoria_documental") or item.get("category") or "").strip()
    tema = str(item.get("tema") or item.get("topic") or "").strip()
    relevancia = item.get("score") or item.get("relevance")
    meta_parts = [filename]
    if categoria:
        meta_parts.append(categoria)
    if tema:
        meta_parts.append(f"tema: {tema}")
    meta = " · ".join(meta_parts)
    header = f"[{index}] {meta}"
    if relevancia is not None:
        try:
            header += f" (señal: {float(relevancia):.2f})"
        except (TypeError, ValueError):
            pass
    return f"{header}\n{body}"


def _summarize_profile(profile: Any) -> str:
    if not isinstance(profile, dict):
        return ""
    parts: List[str] = []
    mode = str(profile.get("content_mode") or "").strip()
    src = str(profile.get("source_type") or "").strip()
    if mode:
        parts.append(f"modo: {mode}")
    if src:
        parts.append(f"origen: {src}")
    feature_map = {
        "has_tables": "tablas",
        "has_charts": "gráficos",
        "has_formulas": "fórmulas",
        "has_diagrams": "diagramas",
        "has_handwriting": "manuscrito",
        "has_images": "imágenes",
        "has_citations": "citas bibliográficas",
        "has_code": "código",
    }
    features = [label for key, label in feature_map.items() if profile.get(key)]
    if features:
        parts.append("contiene: " + ", ".join(features))
    if profile.get("visual_evidence_relevant") is True:
        parts.append("evidencia visual relevante")
    task_type = str(profile.get("task_type") or "").strip()
    if task_type:
        parts.append(f"tipo de tarea: {task_type}")
    raw = " | ".join(parts)
    return _clean_text(raw, MAX_PROFILE_SUMMARY_CHARS, add_ellipsis=False)


def _orientation_note(bundle: Dict[str, Any]) -> str:
    if bundle.get("retrieval_used"):
        conf = str(bundle.get("retrieval_confidence") or "").strip()
        tail = f" Confianza del índice: {conf}." if conf else ""
        return (
            "Los fragmentos se seleccionaron desde Mi Espacio IB con recuperación léxica "
            "sobre el Markdown indexado (sin embeddings en esta versión). "
            "Prioriza los que mejor encadenen rúbrica + texto del estudiante." + tail
        )
    subj = str(bundle.get("subject") or "").strip()
    if subj:
        return f"Contexto alineado a la asignatura indicada ({subj}); prioriza texto entregado y rúbrica."
    return "Contexto de referencia académica; prioriza texto entregado y rúbrica."


def _rubric_encadre_line(rubric_active_summary: Any) -> str:
    if not isinstance(rubric_active_summary, dict):
        return ""
    title = str(rubric_active_summary.get("title") or "").strip()
    preview = str(rubric_active_summary.get("preview") or "").strip()
    if not title and not preview:
        return ""
    if title and preview:
        core = f"{title} — {_clean_text(preview, 120, add_ellipsis=True)}"
    else:
        core = title or _clean_text(preview, 200, add_ellipsis=True)
    return _clean_text(
        f"Encuadre de rúbrica (la rúbrica completa está en el bloque principal; esto no la sustituye): {core}",
        MAX_RUBRIC_ENCADRE_CHARS,
        add_ellipsis=False,
    )


def _truncate_block(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    cut = text[:max_chars]
    last = cut.rfind("\n\n[")
    if last > max_chars * 0.5:
        cut = cut[:last].strip()
    return cut + "\n\n[... contexto truncado por límite de ventana ...]"


def build_formal_evaluation_prompt_context(bundle: Dict[str, Any]) -> str:
    """
    Texto para insertar en el user prompt de evaluación formal.
    """
    if not isinstance(bundle, dict) or bundle.get("bundle_kind") != BUNDLE_KIND:
        return ""

    subject = str(bundle.get("subject") or "").strip()
    role = str(bundle.get("document_role") or "").strip()
    task_topic = str(bundle.get("task_topic") or bundle.get("evaluation_focus") or "").strip()

    raw_profile = bundle.get("document_intelligence_profile")
    profile_for_summary: Any = raw_profile
    if isinstance(raw_profile, dict):
        profile_for_summary = {k: v for k, v in raw_profile.items() if k != "document_role"}
    profile_line = _summarize_profile(profile_for_summary)

    snippets_raw = bundle.get("teacher_context_snippets") or []
    snippet_blocks: List[str] = []
    if isinstance(snippets_raw, list):
        for i, item in enumerate(snippets_raw[:MAX_REFERENCE_SNIPPETS], start=1):
            if not isinstance(item, dict):
                continue
            block = _format_snippet(i, item)
            if block:
                snippet_blocks.append(block)

    rubric_line = _rubric_encadre_line(bundle.get("rubric_active_summary"))

    useful = bool(rubric_line or subject or role or profile_line or snippet_blocks or task_topic)
    if not useful:
        return ""

    lines: List[str] = [
        _REFERENCE_CONTEXT_POLICY,
        "",
        "=== DATOS DE LA EVALUACIÓN ===",
        "Marco disciplinar y de programa: tomarlo solo de los campos siguientes, la rúbrica activa y los fragmentos de referencia; "
        "no presuponer IB ni una asignatura fija si no constan explícitamente en esos insumos.",
    ]
    if subject:
        lines.append(f"Asignatura: {subject}")
    if role:
        lines.append(f"Rol del documento evaluado: {role}")
    if task_topic:
        lines.append(f"Tema / foco declarado: {task_topic}")
    if profile_line:
        lines.append(f"Perfil del documento entregado: {profile_line}")
    if rubric_line:
        lines.append(rubric_line)

    if snippet_blocks:
        lines.extend(
            [
                "",
                "=== FRAGMENTOS DE REFERENCIA (Mi Espacio IB) ===",
                f"(Incluidos: {len(snippet_blocks)} fragmentos; usar con criterio profesional, sin copiar literalmente.)",
                "",
            ]
        )
        lines.extend(snippet_blocks)

    lines.extend(
        [
            "",
            "---",
            f"Nota del sistema: {_orientation_note(bundle)}",
        ]
    )

    result = "\n".join(lines).strip()
    return _truncate_block(result, MAX_TOTAL_CONTEXT_CHARS)


def build_evaluation_context_with_retrieval(
    bundle: Dict[str, Any],
    query: str,
    subject: Optional[str] = None,
) -> str:
    """
    Construye el bloque formal de contexto. El bundle suele venir de `evaluation_context_bundle`
    (retrieval léxico + TF‑IDF en `build_teacher_context_snippets_bundle`).

    Si `query`/`subject` aportan texto distinto al usado en retrieval y el bundle no marcó
    `tfidf_rerank_applied`, se re-ordena una vez por TF‑IDF solo sobre los fragmentos ya elegidos.
    """
    if not isinstance(bundle, dict) or bundle.get("bundle_kind") != BUNDLE_KIND:
        return build_formal_evaluation_prompt_context(bundle)

    raw = bundle.get("teacher_context_snippets")
    enriched = " ".join(
        p for p in (query or "", subject or "") if p and str(p).strip()
    ).strip()
    if (
        isinstance(raw, list)
        and len(raw) > 1
        and enriched
        and not bundle.get("tfidf_rerank_applied")
    ):
        bundle = {
            **bundle,
            "teacher_context_snippets": rerank_teacher_snippets_text_only(enriched, list(raw)),
        }
    return build_formal_evaluation_prompt_context(bundle)
