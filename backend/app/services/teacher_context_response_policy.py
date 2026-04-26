"""
Política de respuesta cuando el chat usa contexto recuperado de Mi Espacio IB.

Separa el estilo esperado por superficie (`asistente_ia` vs `chat_contextual`) sin
tocar el retrieval ni el bundle auditable `teacher_context_retrieval`.
"""
from __future__ import annotations

from typing import Any, Dict, Optional


def resolve_chat_superficie(context: Optional[Dict[str, Any]]) -> str:
    if not isinstance(context, dict):
        return "default"
    raw = str(context.get("superficie") or "").strip().lower().replace("-", "_")
    if raw in ("asistente_ia", "asistenteia"):
        return "asistente_ia"
    if raw in ("chat_contextual", "chatcontextual"):
        return "chat_contextual"
    return "default"


def build_teacher_context_snippets_prompt_footer(superficie: str) -> str:
    """Reglas breves bajo la lista de fragmentos «» en el bloque de contexto fusionado."""
    sf = superficie if superficie in ("asistente_ia", "chat_contextual") else "default"
    if sf == "asistente_ia":
        return (
            "Política de uso (Asistente IA): los textos entre «» son material de apoyo (grounding), no el guion de la respuesta. "
            "Sintetiza e interpreta con mirada pedagógica y de copiloto (planificación, énfasis, conexiones); "
            "evita sonar como extracto o como «según el fragmento…». "
            "Cita literal solo si el usuario pide una cita, si la precisión textual es indispensable o una afirmación puntual lo exige. "
            "Si el contexto no alcanza, dilo con honestidad; no inventes detalles sobre archivos del profesor no respaldados."
        )
    if sf == "chat_contextual":
        return (
            "Política de uso (chat contextual): usa los «» como ancla de comprensión; prioriza interpretación docente y utilidad táctica. "
            "No repitas ni parafrasees el fragmento de forma extensa; no actúes como repetidor del snippet. "
            "No clasifiques este intercambio con taxonomía FORMAL / MENOR / RELEVANTE / CRÍTICO (eso corresponde a la evaluación formal del documento, no a este chat). "
            "Cita literal solo cuando aporte precisión necesaria o lo solicite el usuario. "
            "Si el contexto no alcanza, dilo; no inventes hechos sobre archivos del profesor."
        )
    return (
        "Política de uso: los textos entre «» fundamentan tu comprensión; sintetiza e integra antes que citar de forma extensa. "
        "Cita literal solo cuando sea necesario. Si el contexto no alcanza, dilo; no inventes contenido no respaldado."
    )


def build_chat_mi_espacio_policy_section(superficie: str) -> str:
    """Bloque para el system prompt del endpoint /chat según la superficie activa."""
    sf = superficie if superficie in ("asistente_ia", "chat_contextual") else "default"
    if sf == "asistente_ia":
        return """POLÍTICA · CONTEXTO DOCENTE (Mi Espacio IB · Asistente IA):
Actúa como copiloto docente. Los fragmentos recuperados y los metadatos de Mi Espacio IB sirven para comprender mejor, sintetizar mejor y orientar mejor la respuesta; no para copiar el documento ni para sonar como extractor de fragmentos.
- Integra el sentido del material: qué enfatiza tu guía o recurso, qué implica en la práctica de aula y cómo conectar ideas con la pregunta del profesor.
- Prefiere formulaciones del tipo «tu guía enfatiza…», «esto sugiere que en esta unidad conviene trabajar…» antes que «según el fragmento…» o paráfrasis pegadas al texto entre «».
- Cita textual solo si el usuario pide una cita, si la precisión literal es indispensable o si una afirmación concreta lo requiere.
- Si el contexto recuperado no alcanza, dilo con claridad. No inventes contenido atribuible a archivos del profesor sin respaldo en el contexto disponible."""

    if sf == "chat_contextual":
        return """POLÍTICA · CONTEXTO DOCENTE (Mi Espacio IB · chat contextual):
Mantén respuestas tácticas y precisas respecto del documento, la rúbrica o el fragmento en foco, con mayor elaboración docente y menos eco del snippet recuperado.
- Usa los fragmentos como grounding: interpreta, sintetiza y orienta (siguiente paso, lectura del pasaje, vínculo con criterios) en lugar de repetir el texto entre «».
- No uses para este intercambio la taxonomía FORMAL / MENOR / RELEVANTE / CRÍTICO; esos niveles son propios de la evaluación formal del documento, no de este chat.
- Cita literal solo cuando aporte precisión necesaria o lo solicite el usuario.
- Si el contexto no alcanza, dilo; no inventes hechos sobre archivos del profesor."""

    return """POLÍTICA · CONTEXTO DOCENTE (Mi Espacio IB):
Si aparece el bloque «Fragmentos recuperados · Mi Espacio IB», úsalo como fundamento para pensar y orientar, no como texto a reproducir.
Sintetiza; evita citas literales extensas. Si no alcanza el contexto, dilo sin inventar contenido atribuible a los archivos del profesor."""
