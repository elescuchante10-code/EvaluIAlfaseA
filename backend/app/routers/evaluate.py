"""
Rutas de evaluación de documentos con IA — Auditoría técnica académica rigurosa.
Usa Groq + meta-llama/llama-4-scout-17b-16e-instruct con temperature=0.0 en evaluación.
"""
import os
import io
import json
import html
import logging
import re
import zipfile
import asyncio
import unicodedata
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from groq import Groq

import httpx
from app.core.config import get_settings
from app.core.database import get_db
from app.services.auth import get_current_active_user
from app.services.entitlements import assert_can_evaluate_document
from app.services.credits import assert_has_credits, deduct_credits_after_success, ensure_request_id, get_action_cost
from app.services.document_multimodal import (
    build_chat_image_thumbnail,
    get_cached_document_processing,
    transcribe_chat_image,
)
from app.services.document_intelligence import (
    build_document_intelligence_profile,
    format_profile_for_prompt,
)
from app.services.teacher_context_response_policy import (
    build_chat_mi_espacio_policy_section,
    resolve_chat_superficie,
)
from app.services.teacher_context_retrieval import merge_chat_context_with_teacher_snippets
from app.services.evaluation_context_bundle import SHADOW_NOTE, build_evaluation_context_bundle
from app.services.evaluation_prompt_context import build_formal_evaluation_prompt_context
from app.services.evaluation_coverage_policy import (
    build_evaluation_coverage_policy,
    extend_feedback_prompt_lines,
)
from app.services.footnote_anchor_quality import (
    is_low_value_anchor_candidate,
    substantive_snippet_for_paragraph_fragment,
)
from app.models.models import User, Rubric, Document, EvaluationRecord

settings = get_settings()
GROQ_API_KEY = (settings.GROQ_API_KEY or "").strip().strip('"').strip("'")
# Usar un cliente HTTP básico sin HTTP2 para máxima compatibilidad en contenedores/Railway
_http_client = httpx.Client(http2=False, timeout=30.0)
groq_client = Groq(api_key=GROQ_API_KEY, http_client=_http_client)
MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
logger = logging.getLogger(__name__)

SHORT_DOCUMENT_WORD_LIMIT = 3000
CHUNK_TARGET_WORDS = 600
CHUNK_MAX_WORDS = 700
RAW_RESPONSE_LOG_LIMIT = 8000
COMMENT_MAX_SENTENCES = 3
SEVERITY_LEVELS = ("CRÍTICO", "RELEVANTE", "MENOR", "FORMAL")
SEVERITY_WEIGHTS = {"CRÍTICO": 4, "RELEVANTE": 3, "MENOR": 2, "FORMAL": 1}
NOTE_TYPE_WEIGHTS = {"error": 3, "improvement": 2, "observation": 1}
# paragraph_fragment priorizado frente a phrase en ranking y recorte (mejor anclaje a contexto).
ANCHOR_WEIGHTS = {"paragraph_fragment": 4, "paragraph": 3, "line": 2, "phrase": 1, "capture": 0}

ROBOTIC_PHRASE_REPLACEMENTS = {
    "conviene ampliar": "amplía este punto",
    "vale la pena": "es mejor",
    "resulta pertinente": "corresponde",
    "se recomienda ampliar": "amplía",
    "se recomienda": "señala",
    "se sugiere": "propongo",
    "conviene incorporar": "incorpora",
    "resulta más útil añadir": "añade",
    "es preferible integrar": "integra",
    "sería útil": "necesitas",
    "seria util": "necesitas",
    "podría mejorarse": "mejora",
    "podria mejorarse": "mejora",
    "podría reforzarse": "refuerza",
    "podria reforzarse": "refuerza",
    "conviene que": "debes hacer que",
}

DISCIPLINE_PROFILES = {
    "general": {
        "label": "General académico",
        "aliases": [],
        "discipline_lens": (
            "Separa problemas de forma y microdetalle de fallas que afectan el cumplimiento del criterio, la validez del "
            "razonamiento o la consigna; no trates como equivalentes."
        ),
        "keywords": ["rubrica", "criterio", "analisis", "argumento", "evidencia"],
        "feedback_vocabulary": ["criterio", "evidencia", "coherencia", "desarrollo", "precisión"],
        "analysis_criteria": [
            "alineación con la rúbrica",
            "claridad conceptual",
            "coherencia argumentativa",
            "uso suficiente de evidencia",
        ],
        "improvement_examples": [
            "explicita la idea central antes de desarrollarla",
            "justifica cada afirmación con evidencia verificable",
            "reordena el apartado para que la progresión del argumento sea visible",
        ],
        "severity_guidance": {
            "CRÍTICO": "errores que invalidan el sentido, el criterio o la comprensión de la respuesta",
            "RELEVANTE": "fallas que debilitan de forma sustantiva el desempeño del criterio",
            "MENOR": "omisiones puntuales que mejoran la calidad, pero no alteran la comprensión central",
            "FORMAL": "problemas de ortografía, puntuación, formato o presentación",
        },
        "severity_rules": {
            "CRÍTICO": ["incomprensible", "contradic", "error conceptual", "confunde", "invalida"],
            "RELEVANTE": ["sin evidencia", "sin justificar", "coherencia", "estructura", "argumento"],
            "MENOR": ["faltaria", "podria", "detalle", "ejemplo", "matiz"],
            "FORMAL": ["ortograf", "tild", "puntu", "redaccion", "formato", "acentu"],
        },
    },
    "historia": {
        "label": "Historia",
        "aliases": ["historia", "historico", "histórica", "historica"],
        "discipline_lens": (
            "Prioriza fuentes, contexto, cronología y causalidad; distingue anacronismos o atribución errónea de hechos "
            "de matiz secundario."
        ),
        "keywords": ["causalidad", "fuente", "contexto", "cronologia", "proceso historico"],
        "feedback_vocabulary": ["causalidad", "evidencia histórica", "fuente", "contexto", "proceso"],
        "analysis_criteria": [
            "relación causal entre hechos",
            "uso y lectura de fuentes",
            "contextualización temporal y espacial",
            "precisión en actores y procesos históricos",
        ],
        "improvement_examples": [
            "explica la cadena causal entre el hecho y su consecuencia",
            "sustenta la interpretación con una fuente o dato histórico específico",
            "sitúa el argumento en su contexto temporal y político",
        ],
        "severity_guidance": {
            "CRÍTICO": "causalidad falsa, anacronismos o interpretaciones históricas que alteran el sentido del proceso",
            "RELEVANTE": "fuentes mal usadas o contexto insuficiente que debilita la explicación",
            "MENOR": "fechas o detalles puntuales secundarios",
            "FORMAL": "problemas de redacción, ortografía o formato",
        },
        "severity_rules": {
            "CRÍTICO": ["causalidad falsa", "anacron", "proceso historico", "hecho falso", "confunde periodo"],
            "RELEVANTE": ["fuente", "contexto", "evidencia historica", "interpretacion", "causalidad"],
            "MENOR": ["fecha", "cronologia", "dato puntual", "nombre propio"],
            "FORMAL": ["ortograf", "puntu", "redaccion", "formato"],
        },
    },
    "matematicas": {
        "label": "Matemáticas",
        "aliases": ["matematica", "matemáticas", "matematica", "algebra", "geometria", "cálculo", "calculo"],
        "discipline_lens": (
            "Prioriza validez del procedimiento, justificación de pasos, notación y coherencia entre desarrollo y "
            "resultado respecto al enunciado."
        ),
        "keywords": ["procedimiento", "demostracion", "ecuacion", "teorema", "resultado numerico"],
        "feedback_vocabulary": ["procedimiento", "demostración", "justificación", "resultado", "notación"],
        "analysis_criteria": [
            "validez del procedimiento",
            "justificación de cada paso",
            "uso correcto de notación y propiedades",
            "coherencia entre desarrollo y resultado",
        ],
        "improvement_examples": [
            "muestra el paso intermedio que justifica el cambio de expresión",
            "explicita la propiedad o teorema usado en la transformación",
            "verifica el resultado final sustituyéndolo o contrastándolo con el enunciado",
        ],
        "severity_guidance": {
            "CRÍTICO": "errores de procedimiento, demostración o resultado que invalidan la resolución",
            "RELEVANTE": "saltos de justificación o uso impreciso de notación que debilitan la solución",
            "MENOR": "omisiones menores de presentación matemática",
            "FORMAL": "presentación, ortografía o formato",
        },
        "severity_rules": {
            "CRÍTICO": ["procedimiento", "resultado incorrecto", "calculo incorrecto", "demostracion", "ecuacion"],
            "RELEVANTE": ["justifica", "notacion", "propiedad", "paso intermedio", "unidad"],
            "MENOR": ["detalle", "orden", "presentacion matematica"],
            "FORMAL": ["ortograf", "puntu", "formato"],
        },
    },
    "biologia": {
        "label": "Biología",
        "aliases": ["biologia", "biología", "genetica", "ecologia", "celular"],
        "discipline_lens": (
            "Prioriza precisión conceptual de procesos y relaciones causa–efecto en el sistema vivo; valora evidencia "
            "y ejemplos pertinentes."
        ),
        "keywords": ["sistema", "organismo", "funcion", "evidencia experimental", "proceso biologico"],
        "feedback_vocabulary": ["proceso biológico", "función", "evidencia", "relación", "precisión conceptual"],
        "analysis_criteria": [
            "precisión de conceptos biológicos",
            "relación entre estructura y función",
            "uso de evidencia o ejemplos biológicos",
            "explicación de procesos",
        ],
        "improvement_examples": [
            "precisa el mecanismo biológico antes de describir sus efectos",
            "vincula la estructura con la función del sistema analizado",
            "apoya la explicación con evidencia experimental o un ejemplo concreto",
        ],
        "severity_guidance": {
            "CRÍTICO": "errores conceptuales que alteran un proceso o mecanismo biológico",
            "RELEVANTE": "explicaciones incompletas o sin evidencia suficiente",
            "MENOR": "precisiones secundarias o ejemplos faltantes",
            "FORMAL": "redacción o formato",
        },
        "severity_rules": {
            "CRÍTICO": ["error conceptual", "proceso biologico", "mecanismo", "funcion incorrecta"],
            "RELEVANTE": ["evidencia", "explica", "relacion", "variable biologica"],
            "MENOR": ["ejemplo", "detalle", "precision secundaria"],
            "FORMAL": ["ortograf", "puntu", "formato"],
        },
    },
    "quimica": {
        "label": "Química",
        "aliases": ["quimica", "química", "estequiometria", "reaccion quimica", "mol"],
        "discipline_lens": (
            "Prioriza modelo, reacción, variables controladas, unidades y coherencia procedimiento–resultado; valora "
            "evidencia experimental explícita."
        ),
        "keywords": ["reaccion", "variable", "evidencia experimental", "modelo molecular", "balanceo"],
        "feedback_vocabulary": ["reacción", "variable", "evidencia", "modelo", "precisión conceptual"],
        "analysis_criteria": [
            "precisión de conceptos y modelos químicos",
            "coherencia entre procedimiento y resultado",
            "tratamiento de variables y unidades",
            "uso de evidencia experimental",
        ],
        "improvement_examples": [
            "explica qué variable cambia y cuál permanece controlada",
            "justifica el procedimiento con el modelo químico correspondiente",
            "verifica unidades y balanceo antes de cerrar la respuesta",
        ],
        "severity_guidance": {
            "CRÍTICO": "errores en reacción, procedimiento o modelo que invalidan la explicación",
            "RELEVANTE": "variables, unidades o evidencia mal tratadas",
            "MENOR": "precisiones puntuales o ejemplos faltantes",
            "FORMAL": "redacción o formato",
        },
        "severity_rules": {
            "CRÍTICO": ["reaccion", "balanceo", "resultado incorrecto", "modelo quimico", "estequiometr"],
            "RELEVANTE": ["variable", "unidad", "evidencia experimental", "procedimiento"],
            "MENOR": ["detalle", "ejemplo", "precision secundaria"],
            "FORMAL": ["ortograf", "puntu", "formato"],
        },
    },
    "fisica": {
        "label": "Física",
        "aliases": ["fisica", "física", "mecanica", "dinamica", "electricidad"],
        "discipline_lens": (
            "Prioriza modelo físico, leyes aplicadas, magnitudes y unidades, y contraste con evidencia o enunciado; "
            "evita confundir notación con error conceptual."
        ),
        "keywords": ["magnitud", "modelo fisico", "procedimiento", "variable", "evidencia experimental"],
        "feedback_vocabulary": ["magnitud", "modelo", "variable", "evidencia", "precisión"],
        "analysis_criteria": [
            "consistencia entre modelo físico y fenómeno",
            "uso correcto de magnitudes y unidades",
            "claridad del procedimiento",
            "interpretación de evidencia experimental",
        ],
        "improvement_examples": [
            "define la magnitud implicada antes de operar con ella",
            "justifica qué ley física respalda el procedimiento",
            "contrasta el resultado con el comportamiento esperado del sistema",
        ],
        "severity_guidance": {
            "CRÍTICO": "errores de modelo, procedimiento o unidades que invalidan la explicación física",
            "RELEVANTE": "variables mal justificadas o evidencia mal interpretada",
            "MENOR": "omisiones puntuales de precisión",
            "FORMAL": "redacción o formato",
        },
        "severity_rules": {
            "CRÍTICO": ["procedimiento", "modelo fisico", "resultado incorrecto", "magnitud", "unidad incorrecta"],
            "RELEVANTE": ["variable", "evidencia experimental", "justifica", "ley fisica"],
            "MENOR": ["detalle", "precision", "ejemplo"],
            "FORMAL": ["ortograf", "puntu", "formato"],
        },
    },
    "lengua_espanol": {
        "label": "Lengua/Español",
        "aliases": ["lengua", "espanol", "español", "gramatica", "gramática", "redaccion"],
        "discipline_lens": (
            "Prioriza tesis, coherencia global, cohesión y registro; distingue error que oscurece el sentido de "
            "ajuste estilístico menor."
        ),
        "keywords": ["coherencia", "cohesion", "registro", "sintaxis", "tesis"],
        "feedback_vocabulary": ["cohesión", "coherencia", "registro", "sintaxis", "tesis"],
        "analysis_criteria": [
            "claridad de la tesis o idea principal",
            "cohesión entre enunciados",
            "adecuación gramatical y sintáctica",
            "registro y precisión léxica",
        ],
        "improvement_examples": [
            "reformula la oración para que el sujeto y la idea principal queden nítidos",
            "usa conectores que hagan visible la relación entre ideas",
            "corrige la estructura sintáctica antes de ampliar el contenido",
        ],
        "severity_guidance": {
            "CRÍTICO": "el mensaje se vuelve confuso o incomprensible",
            "RELEVANTE": "fallas de cohesión o sintaxis que afectan la claridad global",
            "MENOR": "precisiones léxicas o de estilo puntuales",
            "FORMAL": "ortografía, puntuación o formato",
        },
        "severity_rules": {
            "CRÍTICO": ["incomprensible", "mensaje confuso", "sin sentido", "contradic"],
            "RELEVANTE": ["coherencia", "cohesion", "sintaxis", "tesis", "registro"],
            "MENOR": ["lexico", "estilo", "matiz", "repeticion"],
            "FORMAL": ["ortograf", "puntu", "tild", "formato"],
        },
    },
    "idiomas_extranjeros": {
        "label": "Inglés/Francés",
        "aliases": ["ingles", "inglés", "frances", "francés", "english", "french"],
        "discipline_lens": (
            "Prioriza comprensibilidad del mensaje, gramática y registro según la tarea; valora coherencia entre ideas "
            "en la lengua meta."
        ),
        "keywords": ["coherence", "grammar", "message", "vocabulary", "structure"],
        "feedback_vocabulary": ["claridad del mensaje", "gramática", "vocabulario", "coherencia", "registro"],
        "analysis_criteria": [
            "comprensibilidad del mensaje",
            "corrección gramatical",
            "adecuación léxica",
            "coherencia entre ideas",
        ],
        "improvement_examples": [
            "reconstruye la oración para que el mensaje sea comprensible",
            "elige el tiempo verbal y el conector que mejor sostienen la idea",
            "sustituye vocabulario ambiguo por una formulación precisa",
        ],
        "severity_guidance": {
            "CRÍTICO": "el mensaje resulta incomprensible o cambia de sentido",
            "RELEVANTE": "errores gramaticales o léxicos que afectan la claridad",
            "MENOR": "ajustes puntuales de estilo o naturalidad",
            "FORMAL": "ortografía, puntuación o formato",
        },
        "severity_rules": {
            "CRÍTICO": ["incomprensible", "message unclear", "changes meaning", "sin sentido"],
            "RELEVANTE": ["grammar", "gramatica", "vocabulary", "coherence", "register"],
            "MENOR": ["style", "naturalidad", "word choice", "matiz"],
            "FORMAL": ["spelling", "orthograph", "punctuation", "formato"],
        },
    },
    "literatura": {
        "label": "Literatura",
        "aliases": ["literatura", "poesia", "poesía", "narrativa", "teatro", "cuento", "novela"],
        "discipline_lens": (
            "Prioriza sustento textual de la interpretación, lectura de recursos formales y coherencia de la lectura "
            "respecto al conflicto central."
        ),
        "keywords": ["simbolo", "voz", "estructura", "interpretacion", "narrador"],
        "feedback_vocabulary": ["símbolo", "voz", "estructura", "interpretación", "lectura textual"],
        "analysis_criteria": [
            "interpretación del núcleo del texto",
            "lectura de símbolos y recursos",
            "análisis de estructura y voz",
            "sustento textual de la interpretación",
        ],
        "improvement_examples": [
            "explica cómo el símbolo elegido sostiene la interpretación central",
            "relaciona la voz narrativa con el efecto del texto",
            "cita un pasaje que demuestre la lectura propuesta",
        ],
        "severity_guidance": {
            "CRÍTICO": "interpretación errada del núcleo del texto o de su conflicto central",
            "RELEVANTE": "lecturas débiles de símbolos, estructura o voz",
            "MENOR": "matices interpretativos secundarios",
            "FORMAL": "ortografía y forma",
        },
        "severity_rules": {
            "CRÍTICO": ["interpretacion central", "lectura errada", "conflicto central", "simbolo mal leido"],
            "RELEVANTE": ["simbolo", "estructura", "voz", "narrador", "interpretacion"],
            "MENOR": ["matiz", "detalle secundario", "ejemplo"],
            "FORMAL": ["ortograf", "puntu", "formato"],
        },
    },
    "tecnologia_informatica": {
        "label": "Tecnología/Informática",
        "aliases": ["tecnologia", "tecnología", "informatica", "informática", "programacion", "programación", "computacion"],
        "discipline_lens": (
            "Prioriza corrección lógica o técnica, claridad de entradas–salidas, trazabilidad de variables y pruebas o "
            "evidencia de funcionamiento."
        ),
        "keywords": ["algoritmo", "sistema", "variable", "precision tecnica", "evidencia"],
        "feedback_vocabulary": ["algoritmo", "sistema", "variable", "precisión técnica", "evidencia"],
        "analysis_criteria": [
            "corrección técnica del procedimiento o solución",
            "relación entre entrada, proceso y salida",
            "precisión en variables, datos o componentes",
            "uso de evidencia o pruebas",
        ],
        "improvement_examples": [
            "explica el flujo lógico antes de describir la herramienta",
            "define la variable, dato o componente que cambia en cada paso",
            "muestra una prueba o ejemplo que valide la solución propuesta",
        ],
        "severity_guidance": {
            "CRÍTICO": "errores técnicos que rompen la lógica o la solución",
            "RELEVANTE": "omisiones de variables, pasos o evidencia que debilitan la explicación",
            "MENOR": "ajustes de precisión técnica no críticos",
            "FORMAL": "formato, nomenclatura o redacción",
        },
        "severity_rules": {
            "CRÍTICO": ["algoritmo", "rompe", "error tecnico", "logica", "solucion incorrecta"],
            "RELEVANTE": ["variable", "paso", "evidencia", "prueba", "sistema"],
            "MENOR": ["detalle tecnico", "precision", "ejemplo"],
            "FORMAL": ["ortograf", "formato", "nomenclatura"],
        },
    },
    "filosofia": {
        "label": "Filosofía",
        "aliases": ["filosofia", "filosofía", "etica", "ética", "metafisica", "metafísica", "epistemologia", "epistemología"],
        "discipline_lens": (
            "Prioriza tesis explícita, validez y claridad de inferencias, respuesta a objeciones y uso disciplinario de "
            "autores; distingue mala lectura de autor de problema redaccional."
        ),
        "keywords": ["tesis", "premisa", "inferencia", "objecion", "contraargumento", "autor"],
        "feedback_vocabulary": ["tesis", "premisa", "inferencia", "objeción", "consistencia conceptual"],
        "analysis_criteria": [
            "claridad de tesis y premisas",
            "validez de inferencias",
            "uso de objeciones y contraargumentos",
            "consistencia conceptual y uso de autores",
        ],
        "improvement_examples": [
            "formula la tesis en una proposición discutible antes de defenderla",
            "explicita la premisa que conecta el ejemplo con la conclusión",
            "integra una objeción real y responde con un contraargumento consistente",
        ],
        "severity_guidance": {
            "CRÍTICO": "inferencia inválida, tesis contradictoria o uso incorrecto de un autor que rompe el argumento",
            "RELEVANTE": "premisas insuficientes, objeciones ausentes o conceptos poco precisos",
            "MENOR": "matices conceptuales secundarios",
            "FORMAL": "forma y corrección superficial",
        },
        "severity_rules": {
            "CRÍTICO": ["inferencia", "tesis contradictoria", "autor mal", "falacia", "premisa falsa"],
            "RELEVANTE": ["premisa", "objecion", "contraargumento", "consistencia conceptual", "autor"],
            "MENOR": ["matiz conceptual", "precision secundaria", "ejemplo"],
            "FORMAL": ["ortograf", "puntu", "formato"],
        },
    },
}

ANTI_REPETITION_VARIANTS = {
    "no desarrolla": [
        "menciona pero no articula",
        "enuncia sin justificar",
        "deja apenas esbozada",
    ],
    "no explica": [
        "no aclara con precisión",
        "deja implícita sin demostrar",
        "omite justificar con claridad",
    ],
    "falta contexto": [
        "el marco queda insuficientemente contextualizado",
        "la idea aparece sin encuadre académico suficiente",
        "el punto queda aislado de su contexto disciplinar",
    ],
    "debe profundizar": [
        "conviene precisar el mecanismo",
        "hace falta sostenerlo con más detalle analítico",
        "necesita una justificación más completa",
    ],
    "se recomienda ampliar": [
        "incorpora una precisión adicional",
        "añade un desarrollo puntual",
        "explicita mejor este punto",
    ],
    "se recomienda": [
        "señala",
        "fortalece",
        "prioriza",
    ],
    "se sugiere": [
        "propongo",
        "refuerza",
        "incorpora",
    ],
    "debería incluirse": [
        "incorpora",
        "añade",
        "integra",
    ],
}

EMPTY_COMMENT_PATTERNS = {
    "mejora redaccion",
    "mejora la redaccion",
    "profundiza mas",
    "falta analisis",
    "explica mejor",
    "desarrolla mas",
    "debe profundizar",
    "debe profundizar mas",
    "requiere mayor profundidad",
    "falta profundidad",
    "necesita mas analisis",
    "falta rigor",
    "poco rigor",
}

SEMANTIC_STOPWORDS = {
    "a", "al", "algo", "alguna", "alguno", "ante", "antes", "aqui", "así", "aun",
    "cada", "como", "con", "contra", "cual", "cuando", "de", "del", "desde", "donde",
    "dos", "el", "ella", "ellas", "ellos", "en", "entre", "era", "es", "esa", "ese",
    "eso", "esta", "este", "esto", "fue", "ha", "hay", "hacia", "hasta", "la", "las",
    "le", "les", "lo", "los", "mas", "más", "me", "mi", "mis", "muy", "ni", "no",
    "nos", "o", "otra", "otro", "para", "pero", "poco", "por", "porque", "que",
    "quien", "se", "si", "sin", "sobre", "su", "sus", "tambien", "también", "te",
    "tu", "un", "una", "uno", "y", "ya",
}

router = APIRouter(prefix="/api/evaluate", tags=["evaluation"])


# ── Pydantic schemas ────────────────────────────────────────────────────────────

class EvaluateRequest(BaseModel):
    document_id: int
    paragraphs: List[str]
    rubric_markdown: str
    evaluation_methodology: Optional[str] = None
    custom_instruction: Optional[str] = None
    document_context: Optional[Dict[str, Any]] = None
    request_id: Optional[str] = None


class FootnoteItem(BaseModel):
    number: int
    paragraph_index: int
    snippet: str
    anchor_type: str  # 'line' | 'phrase' | 'paragraph' | 'capture'
    note_type: str    # 'improvement' | 'error' | 'observation'
    severity: Optional[str] = None
    note_text: str
    comment: str
    type: str


class AnnotatedParagraph(BaseModel):
    index: int
    text: str
    footnote_numbers: List[int]


class FootnoteEvaluateResponse(BaseModel):
    success: bool
    document_id: int
    paragraphs: List[AnnotatedParagraph]
    footnotes: List[FootnoteItem]
    evaluation_matrix: dict
    metrics: dict


class ChatRequest(BaseModel):
    mensaje: str = ""
    contexto: dict = {}
    historial: list = []
    image: Optional[Dict[str, Any]] = None
    request_id: Optional[str] = None


class BatchDocumentItem(BaseModel):
    document_id: int
    paragraphs: List[str]
    filename: str


class BatchEvaluateRequest(BaseModel):
    documents: List[BatchDocumentItem]
    rubric_markdown: str
    request_id: Optional[str] = None


# ── Helper: call Groq ──────────────────────────────────────────────────────────

def call_groq(
    messages: list,
    max_tokens: int = 4000,
    temperature: float = 0.0,
) -> str:
    if not GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "llm_unconfigured",
                "message": "El modelo de IA no está configurado (falta GROQ_API_KEY).",
            },
        )
    try:
        completion = groq_client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=False,
            timeout=20.0,
        )
        return completion.choices[0].message.content
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "llm_provider_error",
                "message": "Falló la llamada al proveedor de IA.",
                "provider": "groq",
                "model": MODEL,
                "error": str(e),
            },
        )


class LLMJsonParseError(ValueError):
    """Raised when an LLM response cannot be repaired into valid JSON."""


def count_words(text: str) -> int:
    return len(re.findall(r"\S+", text or ""))


def count_words_in_paragraphs(paragraphs: List[str]) -> int:
    return sum(count_words(paragraph) for paragraph in paragraphs)


def routing_paragraph_stats(paragraphs: List[str]) -> Dict[str, Any]:
    n = len(paragraphs)
    if n == 0:
        return {"paragraph_count": 0, "mean_words": 0.0, "max_words": 0}
    wc = [count_words(p) for p in paragraphs]
    return {
        "paragraph_count": n,
        "mean_words": sum(wc) / float(n),
        "max_words": max(wc),
    }


def should_use_long_evaluation(paragraphs: List[str], total_words: int) -> bool:
    """
    Además del umbral de palabras, usa la ruta en chunks cuando hay pocos bloques muy largos
    (monografías mal segmentadas) que de otro modo recibirían una sola pasada corta.
    """
    if total_words > SHORT_DOCUMENT_WORD_LIMIT:
        return True
    if total_words < 750:
        return False
    stats = routing_paragraph_stats(paragraphs)
    n = int(stats["paragraph_count"])
    max_w = int(stats["max_words"])
    mean_w = float(stats["mean_words"])
    if n <= 0:
        return False
    if total_words >= 2000 and n <= 5 and max_w >= 320:
        return True
    if total_words >= 1400 and n <= 7 and max_w >= int(0.34 * total_words):
        return True
    if total_words >= 1200 and max_w >= 480:
        return True
    if total_words >= 1000 and n <= 4 and mean_w >= 230:
        return True
    if total_words >= 900 and n <= 3:
        return True
    return False


def should_trigger_coverage_backfill(
    preliminary_n_obs: int,
    coverage_policy: Dict[str, Any],
    total_words: int,
    paragraph_count: int,
) -> bool:
    """Segunda pasada solo si el documento es sustantivo y la cobertura queda claramente baja."""
    if total_words < 850:
        return False
    target = int(coverage_policy.get("target_observation_count") or 0)
    if target < 9:
        return False
    # Entero: ~78 % del techo ya alcanzado → no forzar segunda pasada
    if preliminary_n_obs * 100 >= target * 78:
        return False
    gap = target - preliminary_n_obs
    if gap < 4:
        return False
    if paragraph_count < 4:
        return False
    return True


def _undercovered_paragraph_indices(
    footnotes: List[dict],
    paragraph_count: int,
    max_indices: int = 10,
) -> List[int]:
    if paragraph_count <= 0:
        return []
    counts = [0] * paragraph_count
    for fn in footnotes:
        try:
            pi = int(fn.get("paragraph_index", 0))
        except (TypeError, ValueError):
            continue
        if 0 <= pi < paragraph_count:
            counts[pi] += 1
    order = sorted(range(paragraph_count), key=lambda i: (counts[i], i))
    picked: List[int] = []
    for i in order:
        if counts[i] == 0:
            picked.append(i)
        elif counts[i] <= 1 and len(picked) < max_indices:
            picked.append(i)
        if len(picked) >= max_indices:
            break
    return picked[:max_indices]


def run_coverage_backfill_pass(
    paragraphs: List[str],
    rubric_markdown: str,
    methodology_config: Dict[str, str],
    document_context: Optional[Dict[str, Any]],
    formal_evaluation_context_prompt: Optional[str],
    coverage_policy: Dict[str, Any],
    preliminary_footnotes: List[dict],
    discipline_profile: Dict[str, Any],
) -> dict:
    """
    Una pasada focalizada en párrafos con poca o ninguna observación; prohibido relleno o duplicados.
    """
    total_words = count_words_in_paragraphs(paragraphs)
    p_count = len(paragraphs)
    focus_idx = _undercovered_paragraph_indices(preliminary_footnotes, p_count)
    if not focus_idx:
        return {"footnotes": []}

    existing_summaries = []
    for fn in preliminary_footnotes[:40]:
        nt = str(fn.get("note_text") or "")[:160].strip()
        if nt:
            existing_summaries.append(nt)

    methodology_prompt = build_methodology_prompt(methodology_config)
    document_type_prompt = build_document_type_prompt(document_context)
    discipline_prompt = build_discipline_prompt(discipline_profile)
    visual_context_prompt = build_visual_context_prompt(document_context)
    visual_context_block = f"CONTEXTO VISUAL:\n{visual_context_prompt}\n\n" if visual_context_prompt else ""
    formal_ib_block = (
        f"CONTEXTO IB COMPLEMENTARIO (evaluación formal):\n{formal_evaluation_context_prompt}\n\n"
        if formal_evaluation_context_prompt
        else ""
    )
    target_cap = int(coverage_policy.get("target_observation_count", 12))
    # Presupuesto de la pasada: suficiente para cerrar huecos sin pedir relleno trivial
    backfill_max = min(14, max(5, (target_cap * 50 + 99) // 100))
    feedback_budget_prompt = build_feedback_budget_prompt(
        total_words,
        max_notes=backfill_max,
        coverage_policy=coverage_policy,
    )

    subset = [{"index": i, "text": paragraphs[i]} for i in focus_idx if 0 <= i < p_count]
    user_prompt = (
        f"RÚBRICA DE EVALUACIÓN:\n{rubric_markdown}\n\n"
        f"METODOLOGÍA DE EVALUACIÓN:\n{methodology_prompt}\n\n"
        f"TIPO DOCUMENTAL:\n{document_type_prompt}\n\n"
        f"PERFIL DISCIPLINAR:\n{discipline_prompt}\n\n"
        f"{formal_ib_block}"
        f"{visual_context_block}"
        f"PRESUPUESTO DE FEEDBACK (pasada de cobertura):\n{feedback_budget_prompt}\n\n"
        f"CONTRATO DE CALIDAD DEL FEEDBACK:\n{PEDAGOGICAL_FEEDBACK_CONTRACT}\n\n"
        "PASADA SUPLEMENTARIA — COBERTURA: ya existen observaciones previas listadas abajo. "
        "Añade SOLO notas nuevas, de alto valor, ancladas a los párrafos indicados. "
        "PROHIBIDO duplicar o parafrasear observaciones existentes; si no hay aportes nuevos reales, devuelve footnotes: []. "
        "Evita gastar notas en título, portada, conteo de palabras o encabezados vacíos; prioriza el desarrollo argumentativo. "
        "Prioriza anchor_type='paragraph_fragment' con snippet que cite el tramo analizado; "
        "usa 'phrase' solo para errores claramente locales.\n\n"
        f"OBSERVACIONES YA EXISTENTES (resumen, no repetir):\n{json.dumps(existing_summaries, ensure_ascii=False)}\n\n"
        f"PÁRRAFOS A REVISAR (índices absolutos):\n{json.dumps(subset, ensure_ascii=False)}"
    )

    system_prompt = (
        "Eres un auditor técnico académico. Esta es una PASADA SUPLEMENTARIA para mejorar cobertura.\n"
        'Debes devolver SOLO JSON válido con la misma forma que una evaluación parcial: {"footnotes": [ ... ]}\n'
        "Sin evaluation_matrix. Sin texto fuera del JSON.\n\n"
        + PEDAGOGICAL_FEEDBACK_CONTRACT
        + "\n\nReglas extra de esta pasada:\n"
        '- Si no encuentras problemas nuevos distintos a los ya listados, devuelve "footnotes": [].\n'
        "- No inventes defectos leves solo para aumentar cantidad.\n"
        "- Cada note_text debe ser específica y accionable (1-3 frases).\n"
    )
    raw = call_groq(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=3200,
        temperature=0.0,
    )
    return extract_json(raw)


def chunk_paragraphs(
    paragraphs: List[str],
    target_words: int = CHUNK_TARGET_WORDS,
    max_words: int = CHUNK_MAX_WORDS,
) -> List[Dict[str, Any]]:
    """
    Chunk by whole paragraphs to avoid splitting sentences mid-way.
    If a single paragraph exceeds the budget, it remains intact as a single chunk.
    """
    chunks: List[Dict[str, Any]] = []
    current: List[Dict[str, Any]] = []
    current_words = 0

    for index, paragraph in enumerate(paragraphs):
        paragraph_words = count_words(paragraph)
        should_close = (
            current
            and current_words >= target_words
            and current_words + paragraph_words > max_words
        )
        if should_close:
            chunks.append(
                {
                    "start_index": current[0]["index"],
                    "end_index": current[-1]["index"],
                    "word_count": current_words,
                    "paragraphs": current,
                }
            )
            current = []
            current_words = 0

        current.append({"index": index, "text": paragraph})
        current_words += paragraph_words

        if current_words >= max_words:
            chunks.append(
                {
                    "start_index": current[0]["index"],
                    "end_index": current[-1]["index"],
                    "word_count": current_words,
                    "paragraphs": current,
                }
            )
            current = []
            current_words = 0

    if current:
        chunks.append(
            {
                "start_index": current[0]["index"],
                "end_index": current[-1]["index"],
                "word_count": current_words,
                "paragraphs": current,
            }
        )

    return chunks


def _strip_markdown_fences(text: str) -> str:
    cleaned = re.sub(r"```(?:json)?", "", text, flags=re.IGNORECASE)
    return cleaned.strip()


def _repair_trailing_commas(text: str) -> str:
    repaired = re.sub(r",\s*([}\]])", r"\1", text)
    return repaired.rstrip(", \n\r\t")


def _balance_json_candidate(text: str) -> str:
    candidate = text.strip()
    if not candidate or candidate[0] not in "{[":
        return candidate

    stack: List[str] = []
    in_string = False
    escaped = False

    for idx, char in enumerate(candidate):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "{":
            stack.append("}")
        elif char == "[":
            stack.append("]")
        elif char in "}]":
            if stack and char == stack[-1]:
                stack.pop()
                if not stack:
                    return candidate[: idx + 1]
            else:
                return candidate[:idx].rstrip(", \n\r\t")

    balanced = candidate.rstrip(", \n\r\t")
    if in_string:
        balanced += '"'
    if stack:
        balanced += "".join(reversed(stack))
    return balanced


def _candidate_variants(candidate: str) -> List[str]:
    variants = [candidate.strip()]
    balanced = _balance_json_candidate(candidate)
    if balanced:
        variants.append(balanced)
    repaired = _repair_trailing_commas(balanced or candidate)
    if repaired:
        variants.append(repaired)

    unique: List[str] = []
    for variant in variants:
        normalized = variant.strip()
        if normalized and normalized not in unique:
            unique.append(normalized)
    return unique


def sanitize_llm_json_response(raw: str) -> Any:
    """
    Repair common LLM JSON issues:
    - Removes markdown fences
    - Ignores text before/after the JSON payload
    - Repairs trailing commas
    - Attempts to close truncated arrays/objects when safely possible
    - Logs raw output for debugging
    """
    raw_text = raw or ""
    logger.warning(
        "LLM raw response preview (%s chars): %s",
        len(raw_text),
        raw_text[:RAW_RESPONSE_LOG_LIMIT],
    )

    cleaned = _strip_markdown_fences(raw_text.replace("\ufeff", "")).strip()
    if not cleaned:
        raise LLMJsonParseError("La respuesta del modelo llegó vacía.")

    decoder = json.JSONDecoder()
    parse_errors: List[str] = []

    for match in re.finditer(r"[\{\[]", cleaned):
        fragment = cleaned[match.start():].strip()
        for candidate in _candidate_variants(fragment):
            try:
                parsed, _ = decoder.raw_decode(candidate)
                return parsed
            except json.JSONDecodeError as exc:
                parse_errors.append(str(exc))

    error_preview = parse_errors[-1] if parse_errors else "No se encontró un objeto JSON válido."
    raise LLMJsonParseError(
        f"No se pudo sanear la respuesta JSON del modelo. Último error: {error_preview}"
    )


def extract_json(raw: str) -> dict:
    parsed = sanitize_llm_json_response(raw)
    if not isinstance(parsed, dict):
        raise LLMJsonParseError("Se esperaba un objeto JSON en la respuesta del modelo.")
    return parsed


DEFAULT_EVALUATION_METHODOLOGY = "general_document"

EVALUATION_METHODOLOGY_LABELS = {
    "general_document": "General del documento",
    "by_paragraph": "Por párrafos",
    "line_by_line": "Línea por línea",
    "phrase_by_phrase": "Frase por frase",
    "custom": "Personalizada",
}

ANCHOR_TYPES = {"line", "phrase", "paragraph", "paragraph_fragment", "capture"}

# Patrones que justifican mantener CRÍTICO (modelo o heurística). Si ninguno coincide, se degrada a RELEVANTE.
_CRITICAL_SEVERTY_MARKERS = (
    "invalida",
    "invalidan",
    "invalidación",
    "incomprensib",
    "contradicción irresoluble",
    "contradice la tesis",
    "tesis contradictoria",
    "no responde a la consigna",
    "no cumple la consigna",
    "incumple",
    "desvio sustantivo",
    "desvío sustantivo",
    "falacia grave",
    "inferencia inválida",
    "inferencia invalida",
    "falsa premisa",
    "premisa falsa",
    "resultado incorrecto",
    "respuesta incorrecta",
    "error conceptual grave",
    "anacronismo grave",
    "causalidad falsa",
    "compromete la validez",
    "afecta de forma central",
    "rompe la validez",
    "sin validez",
    "invalida el criterio",
    "invalida la respuesta",
    "invalida el argumento",
    "invalida la demostración",
    "invalida la demostracion",
    "procedimiento incorrecto",
    "demostración incorrecta",
    "demostracion incorrecta",
    "lectura errónea",
    "lectura erronea",
    "interpretación central errónea",
    "interpretacion central erronea",
    "modelo incorrecto",
    "reacción incorrecta",
    "reaccion incorrecta",
    "balanceo incorrecto",
    "algoritmo incorrecto",
    "hecho histórico falso",
    "hecho historico falso",
    "autor mal interpretado",
    "ecuación incorrecta",
    "ecuacion incorrecta",
    "grave error",
    "error grave",
)


def substantiates_critical_severity(text: str) -> bool:
    """True si el texto permite sostener CRÍTICO (no basta un adjetivo suelto fuera de contexto)."""
    blob = _strip_accents((text or "").lower())
    if len(blob.strip()) < 12:
        return False
    for marker in _CRITICAL_SEVERTY_MARKERS:
        if _strip_accents(marker.lower()) in blob:
            return True
    return False


def calibrate_critical_severity(severity: str, note_text: str, snippet: str) -> str:
    """Evita CRÍTICO inflado cuando el modelo o una heurística exagera la gravedad."""
    label = normalize_severity(severity) or "MENOR"
    if label != "CRÍTICO":
        return label
    combined = f"{note_text} {snippet}"
    if substantiates_critical_severity(combined):
        return "CRÍTICO"
    return "RELEVANTE"


def tertile_index(paragraph_index: int, paragraph_count: int) -> int:
    if paragraph_count <= 1:
        return 0
    a = max(1, paragraph_count // 3)
    b = max(a + 1, (2 * paragraph_count) // 3)
    if paragraph_index < a:
        return 0
    if paragraph_index < b:
        return 1
    return 2


def enrich_footnote_snippets(footnotes: List[dict], paragraphs: List[str]) -> List[dict]:
    """Amplía snippets demasiado cortos o ambiguos usando el párrafo de anclaje."""
    if not paragraphs:
        return footnotes

    def _first_chars(paragraph: str, max_chars: int) -> str:
        t = paragraph.strip()
        if len(t) <= max_chars:
            return t
        cut = t[:max_chars]
        for sep in (". ", "; ", "\n"):
            pos = cut.rfind(sep)
            if pos > 50:
                return cut[: pos + 1].strip()
        return cut.strip()

    out: List[dict] = []
    for fn in footnotes:
        pi = int(fn.get("paragraph_index", 0))
        if pi < 0 or pi >= len(paragraphs):
            out.append(fn)
            continue
        para = paragraphs[pi]
        sn = str(fn.get("snippet") or "").strip()
        anchor = str(fn.get("anchor_type") or "paragraph").strip().lower()
        note_txt = str(fn.get("note_text") or fn.get("comment") or "")
        word_n = count_words(sn)
        len_sn = len(sn)
        # paragraph_fragment: forzar extracto representativo (evita "todo el párrafo" o anclaje vago)
        if anchor == "paragraph_fragment":
            need_refine = (
                word_n < 10
                or len_sn < 42
                or (word_n >= 12 and sn.strip().lower() == para.strip().lower()[: len_sn])
            )
            if need_refine:
                refined = substantive_snippet_for_paragraph_fragment(
                    para,
                    note_txt,
                    sn,
                )
                if refined:
                    item = dict(fn)
                    item["snippet"] = refined
                    out.append(item)
                    continue
        if word_n >= 12 and len_sn >= 48:
            out.append(fn)
            continue
        pl = _strip_accents(para.lower())
        sl = _strip_accents(sn.lower()) if sn else ""
        idx = pl.find(sl) if sl and len(sl) >= 4 else -1
        if idx < 0 and sn and len(sn) >= 8:
            idx = pl.find(_strip_accents(sn[:24].lower()))
        if idx >= 0:
            start = max(0, idx - 28)
            end = min(len(para), idx + len(sn) + 200)
            frag = para[start:end].strip()
            frag = frag[:420] if len(frag) > 420 else frag
        else:
            frag = _first_chars(para, 320)
        if frag:
            item = dict(fn)
            item["snippet"] = frag
            out.append(item)
        else:
            out.append(fn)
    return out


def normalize_methodology(value: Any) -> str:
    normalized = str(value or "").strip().lower().replace(" ", "_")
    aliases = {
        "general": "general_document",
        "general_del_documento": "general_document",
        "por_parrafos": "by_paragraph",
        "por_párrafos": "by_paragraph",
        "linea_por_linea": "line_by_line",
        "línea_por_línea": "line_by_line",
        "linea_por_línea": "line_by_line",
        "línea_por_linea": "line_by_line",
        "frase_por_frase": "phrase_by_phrase",
        "personalizada": "custom",
    }
    normalized = aliases.get(normalized, normalized)
    if normalized in EVALUATION_METHODOLOGY_LABELS:
        return normalized
    return DEFAULT_EVALUATION_METHODOLOGY


def extract_frontmatter(markdown: str) -> Dict[str, str]:
    if not markdown:
        return {}

    match = re.match(r"^---\s*\n([\s\S]*?)\n---\s*\n?", markdown)
    if not match:
        return {}

    frontmatter: Dict[str, str] = {}
    for line in match.group(1).splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        frontmatter[key.strip()] = value.strip().strip("\"'")
    return frontmatter


def resolve_methodology_config(request: EvaluateRequest) -> Dict[str, str]:
    frontmatter = extract_frontmatter(request.rubric_markdown)
    methodology = normalize_methodology(
        request.evaluation_methodology or frontmatter.get("metodologia_evaluacion")
    )
    custom_instruction = (
        str(request.custom_instruction or frontmatter.get("instruccion_ia") or "").strip()
    )

    if methodology != "custom":
        custom_instruction = ""

    return {
        "methodology": methodology,
        "methodology_label": EVALUATION_METHODOLOGY_LABELS[methodology],
        "custom_instruction": custom_instruction,
    }


def build_methodology_prompt(config: Dict[str, str]) -> str:
    methodology = config["methodology"]
    instructions = [
        "La metodología MODULA la aplicación de la rúbrica, pero JAMÁS reemplaza ni altera los criterios de la rúbrica.",
        f"Modalidad obligatoria: {config['methodology_label']}.",
        "Toda observación debe incluir SIEMPRE: paragraph_index, snippet, anchor_type, note_type, note_text.",
    ]

    if methodology == "general_document":
        instructions.extend([
            "Produce observaciones macro del documento, pero ancla cada nota a un párrafo relevante.",
            "Prefer anchor_type='paragraph_fragment' (varias frases coherentes del mismo párrafo) o 'paragraph'; "
            "usa 'phrase' solo para errores claramente locales (una palabra o frase puntual).",
        ])
    elif methodology == "by_paragraph":
        instructions.extend([
            "Evalúa párrafo por párrafo.",
            "Cada nota debe quedar ligada al párrafo exacto correspondiente.",
            "Usa anchor_type='paragraph' salvo que una frase concreta sea claramente más precisa.",
        ])
    elif methodology == "line_by_line":
        instructions.extend([
            "Evalúa con granularidad línea por línea dentro de cada párrafo.",
            "Usa anchor_type='line' y un snippet corto que identifique la línea exacta o su fragmento más cercano.",
        ])
    elif methodology == "phrase_by_phrase":
        instructions.extend([
            "Evalúa con granularidad frase por frase.",
            "Usa anchor_type='phrase' y el snippet debe ser la frase exacta o el fragmento mínimo inequívoco.",
        ])
    elif methodology == "custom":
        instructions.extend([
            "Sigue la instrucción personalizada del profesor, manteniendo siempre los criterios de la rúbrica.",
            f"Instrucción personalizada: {config['custom_instruction'] or 'No provista.'}",
        ])

    return "\n".join(f"- {instruction}" for instruction in instructions)


def _strip_accents(text: Any) -> str:
    normalized = unicodedata.normalize("NFD", str(text or ""))
    return "".join(char for char in normalized if unicodedata.category(char) != "Mn")


def _normalize_topic_text(text: Any) -> str:
    normalized = _strip_accents(text).lower()
    normalized = re.sub(r"[^\w\s]", " ", normalized)
    return " ".join(normalized.split())


def _extract_subject_hints(markdown: str) -> List[str]:
    hints: List[str] = []
    frontmatter = extract_frontmatter(markdown)
    for key in ("asignatura", "materia", "subject", "disciplina"):
        value = frontmatter.get(key)
        if value:
            hints.append(value)

    heading_match = re.search(r"^\s*#\s+(.+)$", markdown or "", flags=re.MULTILINE)
    if heading_match:
        hints.append(heading_match.group(1))

    for pattern in (
        r"^\s*asignatura\s*:\s*(.+)$",
        r"^\s*materia\s*:\s*(.+)$",
        r"^\s*subject\s*:\s*(.+)$",
    ):
        for match in re.finditer(pattern, markdown or "", flags=re.IGNORECASE | re.MULTILINE):
            hints.append(match.group(1))

    return [_normalize_text(hint) for hint in hints if _normalize_text(hint)]


def detect_discipline(rubric_markdown: str) -> Dict[str, Any]:
    rubric_text = _normalize_topic_text(rubric_markdown)
    subject_hints = [_normalize_topic_text(hint) for hint in _extract_subject_hints(rubric_markdown)]

    best_key = "general"
    best_score = 0

    for key, profile in DISCIPLINE_PROFILES.items():
        if key == "general":
            continue

        score = 0
        for alias in profile["aliases"]:
            normalized_alias = _normalize_topic_text(alias)
            if any(normalized_alias in hint for hint in subject_hints):
                score += 10
            if normalized_alias and normalized_alias in rubric_text:
                score += 4

        for keyword in profile["keywords"]:
            normalized_keyword = _normalize_topic_text(keyword)
            if normalized_keyword and normalized_keyword in rubric_text:
                score += 1

        if score > best_score:
            best_key = key
            best_score = score

    return DISCIPLINE_PROFILES[best_key if best_score >= 4 else "general"]


def build_discipline_prompt(profile: Dict[str, Any]) -> str:
    lines = [
        f"Disciplina detectada: {profile['label']}. Evalúa como profesor especialista de esa asignatura.",
    ]
    lens = profile.get("discipline_lens")
    if lens:
        lines.append(f"Lente disciplinar: {lens}")
    lines.extend(
        [
            f"Vocabulario del feedback: {', '.join(profile['feedback_vocabulary'])}.",
            f"Criterios de análisis prioritarios: {', '.join(profile['analysis_criteria'])}.",
            f"Ejemplos de mejora esperables: {', '.join(profile['improvement_examples'])}.",
            "Severidad contextual obligatoria:",
        ]
    )
    for severity in SEVERITY_LEVELS:
        guidance = profile["severity_guidance"].get(severity)
        if guidance:
            lines.append(f"{severity}: {guidance}.")
    return "\n".join(f"- {line}" for line in lines)


def compute_feedback_budget(total_words: int) -> int:
    if total_words <= 400:
        return 4
    if total_words <= 800:
        return 6
    if total_words <= 1200:
        return 8
    if total_words <= 2000:
        return 10
    if total_words <= 3000:
        return 12
    if total_words <= 4000:
        return 16
    return 20


def compute_chunk_feedback_budget(chunk_words: int, total_words: int, total_budget: int) -> int:
    if total_words <= 0:
        return 3
    proportional_budget = round(total_budget * (chunk_words / total_words))
    return max(2, min(6, proportional_budget or 1))


def compute_global_feedback_budget(total_budget: int) -> int:
    return max(1, min(4, round(total_budget * 0.2) or 1))


def build_feedback_budget_prompt(
    total_words: int,
    max_notes: Optional[int] = None,
    scope_label: str = "documento",
    coverage_policy: Optional[Dict[str, Any]] = None,
) -> str:
    budget = max_notes if max_notes is not None else compute_feedback_budget(total_words)
    lines = [
        f"Para este {scope_label} ({total_words} palabras), prioriza un máximo de {budget} observaciones de alto valor.",
        "Fusiona errores repetidos en una sola observación si comparten la misma causa o mejora pedagógica.",
        "No llenes la salida con microcorrecciones ni con observaciones mínimas de escaso impacto.",
        "Si detectas muchos problemas formales pequeños, agrúpalos solo si pertenecen al mismo patrón.",
    ]
    if coverage_policy:
        extend_feedback_prompt_lines(lines, coverage_policy)
    return "\n".join(f"- {line}" for line in lines)


def resolve_document_context(request: EvaluateRequest) -> Dict[str, Any]:
    cached = get_cached_document_processing(request.document_id)
    cached_dict = dict(cached) if isinstance(cached, dict) else {}
    # Caché del servidor primero; la petición (p. ej. multimodal + teacher pack del cliente) gana en claves repetidas.
    # Así no se pierde el procesamiento en caché si el cliente envía solo refuerzos de contexto docente.
    if isinstance(request.document_context, dict):
        ctx = {**cached_dict, **request.document_context}
    else:
        ctx = cached_dict
    if isinstance(ctx, dict) and "document_intelligence_profile" not in ctx:
        ctx["document_intelligence_profile"] = build_document_intelligence_profile(
            "",
            "\n\n".join(request.paragraphs or []),
            ctx,
        )
    return ctx


def resolve_document_router(document_context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    context = document_context if isinstance(document_context, dict) else {}
    router = context.get("document_router")
    if isinstance(router, dict):
        doc_type = str(router.get("type") or "").strip().lower()
        if doc_type in {"exam", "essay", "report", "rubric", "guide", "generic"}:
            return {
                "type": doc_type,
                "confidence": router.get("confidence"),
                "signals": router.get("signals") or [],
            }

    doc_type = str(context.get("document_type") or "").strip().lower()
    if doc_type in {"exam", "essay", "report", "rubric", "guide", "generic"}:
        return {
            "type": doc_type,
            "confidence": context.get("document_type_confidence"),
            "signals": [],
        }

    return {"type": "generic", "confidence": 0.0, "signals": []}


def build_document_type_prompt(document_context: Optional[Dict[str, Any]]) -> str:
    router = resolve_document_router(document_context)
    doc_type = router["type"]
    confidence = router.get("confidence")
    confidence_label = f"{confidence:.2f}" if isinstance(confidence, (int, float)) else "n/a"
    signals = router.get("signals") or []

    lines = [
        f"Tipo documental detectado: {doc_type} (confianza: {confidence_label}).",
    ]
    if signals:
        lines.append(f"Señales heurísticas: {', '.join(str(signal) for signal in signals[:6])}.")

    if doc_type == "exam":
        lines.extend([
            "Trata el documento como un examen o prueba, no como ensayo.",
            "NO penalices ni exijas introducción, conclusión o bibliografía.",
            "Prioriza claridad de las preguntas, gradación de dificultad, estructura de secciones, alineación con la asignatura y calidad técnica.",
            "Si hay instrucciones ambiguas, numeración inconsistente o cobertura desigual, señálalo explícitamente.",
        ])
    elif doc_type == "rubric":
        lines.extend([
            "Trata el documento como una rúbrica o instrumento de evaluación, no como ensayo.",
            "Evalúa claridad de criterios, progresión de descriptores, consistencia entre niveles y utilidad pedagógica.",
            "NO exijas introducción o conclusión.",
            "Incluye en el análisis una recomendación breve de conversión a rúbrica editable cuando detectes estructura aprovechable.",
        ])
    elif doc_type == "guide":
        lines.extend([
            "Trata el documento como guía, syllabus o handbook.",
            "Prioriza consistencia documental, claridad de instrucciones, secuencia, completitud y alineación pedagógica.",
        ])
    elif doc_type == "report":
        lines.extend([
            "Trata el documento como informe académico o técnico.",
            "Prioriza hallazgos, metodología, evidencia, estructura y trazabilidad del análisis.",
        ])
    elif doc_type == "essay":
        lines.extend([
            "Trata el documento como ensayo académico.",
            "Prioriza tesis, argumentación, estructura, evidencia y cierre conclusivo.",
        ])
    else:
        lines.append("Si la tipología es ambigua, mantén el flujo general del documento y evita suposiciones fuertes.")

    return "\n".join(f"- {line}" for line in lines)


def build_visual_context_prompt(document_context: Optional[Dict[str, Any]]) -> str:
    context = document_context if isinstance(document_context, dict) else {}
    visual_context = context.get("visual_context")
    if not context.get("visual_context_enabled") or not isinstance(visual_context, list) or not visual_context:
        return ""

    lines = [
        "CONTEXTO VISUAL COMPLEMENTARIO:",
        "El texto nativo del documento sigue siendo la fuente principal.",
        "Usa las imágenes SOLO para complementar o aclarar el texto ya presente; nunca reemplaces el análisis textual por interpretación visual.",
        "Si una imagen no aporta al criterio o al argumento del estudiante, ignórala.",
    ]
    if context.get("text_source") in {"ocr_transcription", "mixed"}:
        lines.append("Se activó transcripción visual porque el texto nativo era insuficiente o mixto; prioriza cualquier texto explícito recuperado.")

    for index, item in enumerate(visual_context, start=1):
        if not isinstance(item, dict):
            continue
        image_type = str(item.get("type") or "foto").strip().lower()
        summary = _normalize_text(item.get("summary") or "sin descripción breve")
        relevance = str(item.get("probable_relevance") or "medium").strip().lower()
        page_label = f" en página {item['page_number']}" if item.get("page_number") else ""
        lines.append(
            f"Imagen {index}{page_label}: tipo={image_type}; relevancia probable={relevance}; resumen={summary}."
        )

    return "\n".join(f"- {line}" for line in lines)


def normalize_footnote_type(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in {"error", "improvement", "observation"}:
        return normalized
    return "observation"


def normalize_severity(value: Any) -> str:
    normalized = _normalize_topic_text(value).replace(" ", "")
    severity_map = {
        "critico": "CRÍTICO",
        "relevante": "RELEVANTE",
        "menor": "MENOR",
        "formal": "FORMAL",
    }
    return severity_map.get(normalized, "")


def infer_severity(item: dict, discipline_profile: Optional[Dict[str, Any]] = None) -> str:
    """
    Heurística conservadora: CRÍTICO solo si el propio texto del ítem contiene señales fuertes.
    El resto de niveles usa reglas por palabra clave sin inflar la gravedad.
    """
    profile = discipline_profile or DISCIPLINE_PROFILES["general"]
    raw_combined = f"{item.get('note_text', '')} {item.get('snippet', '')}"
    combined_text = _normalize_topic_text(raw_combined)

    if substantiates_critical_severity(raw_combined):
        return "CRÍTICO"

    matched_severities: List[str] = []
    for source_profile in (DISCIPLINE_PROFILES["general"], profile):
        for severity in ("RELEVANTE", "MENOR", "FORMAL"):
            keywords = source_profile.get("severity_rules", {}).get(severity, [])
            if any(_normalize_topic_text(keyword) in combined_text for keyword in keywords):
                matched_severities.append(severity)

    if matched_severities:
        return max(matched_severities, key=lambda sev: SEVERITY_WEIGHTS[sev])

    note_type = normalize_footnote_type(item.get("note_type", item.get("type")))
    if note_type == "error":
        return "RELEVANTE"
    if note_type == "improvement":
        return "MENOR"
    return "MENOR"


def normalize_footnotes(
    raw_footnotes: Any,
    paragraph_count: int,
    fallback_range: Optional[Tuple[int, int]] = None,
    discipline_profile: Optional[Dict[str, Any]] = None,
) -> List[dict]:
    if not isinstance(raw_footnotes, list):
        return []

    normalized: List[dict] = []
    for item in raw_footnotes:
        if not isinstance(item, dict):
            continue

        note_text = " ".join(
            str(item.get("note_text") or item.get("comment") or "").split()
        )
        if not note_text:
            continue

        paragraph_index = item.get("paragraph_index", item.get("paragraph"))
        try:
            paragraph_index = int(paragraph_index)
        except (TypeError, ValueError):
            paragraph_index = fallback_range[0] if fallback_range else 0

        if paragraph_count > 0:
            lower_bound = fallback_range[0] if fallback_range else 0
            upper_bound = fallback_range[1] if fallback_range else paragraph_count - 1
            paragraph_index = max(lower_bound, min(paragraph_index, upper_bound))

        snippet = " ".join(str(item.get("snippet", "")).split())
        if not snippet and paragraph_count > 0 and 0 <= paragraph_index < paragraph_count:
            snippet = " ".join((item.get("text") or "").split())
        anchor_type = str(item.get("anchor_type", "paragraph")).strip().lower()
        # Normalizer textual: el pipeline /evaluate/footnotes NO debe emitir 'capture'
        # (ese tipo se crea sólo desde la captura manuscrita en chat, lado frontend).
        if anchor_type not in {"line", "phrase", "paragraph", "paragraph_fragment"}:
            anchor_type = "paragraph"
        note_type = normalize_footnote_type(item.get("note_type", item.get("type")))
        severity = normalize_severity(item.get("severity"))
        if not severity:
            severity = infer_severity(
                {
                    "note_type": note_type,
                    "note_text": note_text,
                    "snippet": snippet,
                },
                discipline_profile=discipline_profile,
            )
        severity = calibrate_critical_severity(severity, note_text, snippet)

        normalized.append(
            {
                "number": 0,
                "paragraph_index": paragraph_index,
                "snippet": snippet,
                "anchor_type": anchor_type,
                "note_type": note_type,
                "severity": severity,
                "note_text": note_text,
                "comment": note_text,
                "type": note_type,
            }
        )

    return normalized


def _normalize_text(text: Any) -> str:
    return " ".join(str(text or "").split())


def _normalize_for_matching(text: str) -> str:
    normalized = _normalize_text(text).lower()
    normalized = re.sub(r"[^\w\sáéíóúñü]", "", normalized)
    return normalized.strip()


def _split_sentences(text: str) -> List[str]:
    return [segment.strip() for segment in re.split(r"(?<=[.!?])\s+", text.strip()) if segment.strip()]


def _limit_comment_sentences(text: str, max_sentences: int = COMMENT_MAX_SENTENCES) -> str:
    sentences = _split_sentences(text)
    if not sentences:
        return ""
    limited = " ".join(sentences[:max_sentences]).strip()
    return limited if limited.endswith((".", "!", "?")) else f"{limited}."


def _comment_tokens(text: str) -> set:
    tokens = [
        token
        for token in re.findall(r"[a-záéíóúñü]{3,}", _normalize_for_matching(text))
        if token not in SEMANTIC_STOPWORDS
    ]
    return set(tokens[:18])


def _jaccard_similarity(left: set, right: set) -> float:
    if not left or not right:
        return 0.0
    union = left | right
    if not union:
        return 0.0
    return len(left & right) / len(union)


def _is_empty_comment(text: str) -> bool:
    return _normalize_for_matching(text) in EMPTY_COMMENT_PATTERNS


def _replace_phrase_once(text: str, old_phrase: str, new_phrase: str) -> str:
    pattern = re.compile(re.escape(old_phrase), flags=re.IGNORECASE)

    def _replacement(match: re.Match) -> str:
        original = match.group(0)
        if original.isupper():
            return new_phrase.upper()
        if original[:1].isupper():
            return new_phrase[:1].upper() + new_phrase[1:]
        return new_phrase

    return pattern.sub(_replacement, text, count=1)


def _replace_phrase_all(text: str, old_phrase: str, new_phrase: str) -> str:
    pattern = re.compile(re.escape(old_phrase), flags=re.IGNORECASE)

    def _replacement(match: re.Match) -> str:
        original = match.group(0)
        if original.isupper():
            return new_phrase.upper()
        if original[:1].isupper():
            return new_phrase[:1].upper() + new_phrase[1:]
        return new_phrase

    return pattern.sub(_replacement, text)


def _apply_anti_repetition_memory(text: str, phrase_usage: Dict[str, int]) -> str:
    updated = text
    lowered = updated.lower()

    for phrase, variants in ANTI_REPETITION_VARIANTS.items():
        if phrase not in lowered:
            continue

        usage = phrase_usage[phrase]
        if usage >= 1 and variants:
            replacement = variants[min(usage - 1, len(variants) - 1)]
            updated = _replace_phrase_once(updated, phrase, replacement)
            lowered = updated.lower()

        phrase_usage[phrase] += 1

    return updated


def _humanize_feedback_text(text: str) -> str:
    updated = text
    for robotic_phrase, natural_phrase in ROBOTIC_PHRASE_REPLACEMENTS.items():
        updated = _replace_phrase_all(updated, robotic_phrase, natural_phrase)
    return _normalize_text(updated)


def _footnote_priority(footnote: dict) -> Tuple[int, int, int, int]:
    severity = SEVERITY_WEIGHTS.get(str(footnote.get("severity") or "MENOR"), 0)
    note_type = NOTE_TYPE_WEIGHTS.get(
        str(footnote.get("note_type") or footnote.get("type") or "observation"),
        0,
    )
    anchor = ANCHOR_WEIGHTS.get(str(footnote.get("anchor_type") or "paragraph"), 0)
    richness = min(len(_comment_tokens(str(footnote.get("note_text") or ""))), 12)
    return severity, note_type, anchor, richness


def _footnote_rank_tuple(
    footnote: dict,
    paragraphs: Optional[List[str]],
) -> Tuple[int, int, int, int, int]:
    """
    Orden para recorte bajo techo: prioridad base + penalización por anclaje de bajo valor
    (título, portada, conteo, cabeceras vacías), salvo severidad CRÍTICO/RELEVANTE.
    """
    base = _footnote_priority(footnote)
    if not paragraphs:
        return (*base, 0)
    pi = int(footnote.get("paragraph_index", 0))
    if pi < 0 or pi >= len(paragraphs):
        return (*base, 0)
    low, _reason = is_low_value_anchor_candidate(paragraphs[pi], pi, len(paragraphs))
    if not low:
        return (*base, 0)
    sev = str(footnote.get("severity") or "MENOR")
    if sev in ("CRÍTICO", "RELEVANTE"):
        return (*base, 0)
    # tie-break: notas sobre tramos estructurales quedan detrás cuando hay que recortar
    return (*base, -1)


def _extract_action_sentence(text: str) -> str:
    action_markers = (
        "añade",
        "agrega",
        "explica",
        "precisa",
        "desarrolla",
        "justifica",
        "corrige",
        "reformula",
        "incorpora",
        "vincula",
        "demuestra",
        "define",
    )
    sentences = _split_sentences(text)
    for sentence in reversed(sentences):
        normalized = _normalize_topic_text(sentence)
        if any(marker in normalized for marker in action_markers):
            return sentence
    return sentences[-1] if sentences else ""


def _compose_merged_note_text(text: str, merged_count: int) -> str:
    if merged_count <= 1:
        return _limit_comment_sentences(text)

    normalized = _normalize_topic_text(text)
    if "reaparece en otros apartados del documento" in normalized:
        return _limit_comment_sentences(text)

    sentences = _split_sentences(text)
    if not sentences:
        return ""

    action_sentence = _extract_action_sentence(text)
    parts = [
        sentences[0],
        "El mismo problema reaparece en otros apartados del documento y debe corregirse con el mismo criterio.",
    ]
    if action_sentence and action_sentence not in parts:
        parts.append(action_sentence)
    return _limit_comment_sentences(" ".join(parts))


def polish_footnotes(
    footnotes: List[dict],
    discipline_profile: Optional[Dict[str, Any]] = None,
) -> List[dict]:
    polished: List[dict] = []
    semantic_memory: List[Dict[str, Any]] = []
    phrase_usage: Dict[str, int] = defaultdict(int)

    for footnote in footnotes:
        note_text = _normalize_text(footnote.get("note_text") or footnote.get("comment"))
        if not note_text or _is_empty_comment(note_text):
            continue

        note_text = _humanize_feedback_text(note_text)
        note_text = _limit_comment_sentences(note_text)
        if not note_text:
            continue

        note_tokens = _comment_tokens(note_text)
        snippet_tokens = _comment_tokens(str(footnote.get("snippet") or ""))
        note_type = str(footnote.get("note_type") or footnote.get("type") or "observation")
        severity = normalize_severity(footnote.get("severity")) or infer_severity(
            {
                **footnote,
                "note_type": note_type,
                "note_text": note_text,
            },
            discipline_profile=discipline_profile,
        )
        severity = calibrate_critical_severity(severity, note_text, str(footnote.get("snippet") or ""))

        is_semantic_duplicate = False
        for seen in semantic_memory:
            if note_type != seen["note_type"]:
                continue

            text_similarity = _jaccard_similarity(note_tokens, seen["note_tokens"])
            snippet_similarity = _jaccard_similarity(snippet_tokens, seen["snippet_tokens"])

            if text_similarity >= 0.9:
                is_semantic_duplicate = True
                break
            if text_similarity >= 0.72 and snippet_similarity >= 0.72:
                is_semantic_duplicate = True
                break

        if is_semantic_duplicate:
            continue

        note_text = _apply_anti_repetition_memory(note_text, phrase_usage)

        polished.append(
            {
                **footnote,
                "note_text": note_text,
                "comment": note_text,
                "type": note_type,
                "severity": severity,
            }
        )
        semantic_memory.append(
            {
                "note_type": note_type,
                "note_tokens": note_tokens,
                "snippet_tokens": snippet_tokens,
            }
        )

    return polished


def merge_redundant_footnotes(footnotes: List[dict]) -> List[dict]:
    merged: List[dict] = []

    for footnote in footnotes:
        note_tokens = _comment_tokens(str(footnote.get("note_text") or ""))
        snippet_tokens = _comment_tokens(str(footnote.get("snippet") or ""))
        match: Optional[dict] = None

        for candidate in merged:
            if footnote.get("note_type") != candidate.get("note_type"):
                continue

            text_similarity = _jaccard_similarity(note_tokens, candidate["_note_tokens"])
            snippet_similarity = _jaccard_similarity(snippet_tokens, candidate["_snippet_tokens"])

            if text_similarity >= 0.64 or (text_similarity >= 0.52 and snippet_similarity >= 0.34):
                match = candidate
                break

        if match is None:
            merged.append(
                {
                    **footnote,
                    "_note_tokens": note_tokens,
                    "_snippet_tokens": snippet_tokens,
                    "_merged_count": 1,
                }
            )
            continue

        if _footnote_priority(footnote) > _footnote_priority(match):
            for key, value in footnote.items():
                match[key] = value

        match["severity"] = max(
            [str(match.get("severity") or "MENOR"), str(footnote.get("severity") or "MENOR")],
            key=lambda severity: SEVERITY_WEIGHTS.get(severity, 0),
        )
        match["_note_tokens"] = match["_note_tokens"] | note_tokens
        match["_snippet_tokens"] = match["_snippet_tokens"] | snippet_tokens
        match["_merged_count"] += 1
        match["note_text"] = _compose_merged_note_text(
            str(match.get("note_text") or footnote.get("note_text") or ""),
            match["_merged_count"],
        )
        match["comment"] = match["note_text"]

    return [{key: value for key, value in footnote.items() if not key.startswith("_")} for footnote in merged]


def limit_footnotes_by_budget(
    footnotes: List[dict],
    total_words: int,
    max_notes: Optional[int] = None,
    paragraph_count: int = 0,
    paragraphs: Optional[List[str]] = None,
) -> List[dict]:
    budget = max_notes if max_notes is not None else compute_feedback_budget(total_words)
    if len(footnotes) <= budget:
        return sorted(
            footnotes,
            key=lambda footnote: (
                int(footnote.get("paragraph_index", 0)),
                -SEVERITY_WEIGHTS.get(str(footnote.get("severity") or "MENOR"), 0),
            ),
        )

    ranked = sorted(
        enumerate(footnotes),
        key=lambda entry: (_footnote_rank_tuple(entry[1], paragraphs), -entry[0]),
        reverse=True,
    )
    ordered = [footnote for _, footnote in ranked]

    if paragraph_count < 6 or budget < 6:
        selected = ordered[:budget]
    else:
        buckets: List[List[dict]] = [[], [], []]
        for fn in ordered:
            ti = tertile_index(int(fn.get("paragraph_index", 0)), paragraph_count)
            buckets[ti].append(fn)

        selected = []
        ptrs = [0, 0, 0]
        advanced = True
        while len(selected) < budget and advanced:
            advanced = False
            for b in range(3):
                if len(selected) >= budget:
                    break
                if ptrs[b] < len(buckets[b]):
                    selected.append(buckets[b][ptrs[b]])
                    ptrs[b] += 1
                    advanced = True
        if len(selected) < budget:
            rest = [fn for fn in ordered if fn not in selected]
            for fn in rest:
                if len(selected) >= budget:
                    break
                selected.append(fn)

    return sorted(
        selected,
        key=lambda footnote: (
            int(footnote.get("paragraph_index", 0)),
            -SEVERITY_WEIGHTS.get(str(footnote.get("severity") or "MENOR"), 0),
        ),
    )


def finalize_footnotes(
    footnotes: List[dict],
    total_words: int,
    discipline_profile: Optional[Dict[str, Any]] = None,
    feedback_budget: Optional[int] = None,
    paragraphs: Optional[List[str]] = None,
) -> List[dict]:
    cleaned = dedupe_footnotes(footnotes)
    if paragraphs:
        cleaned = enrich_footnote_snippets(cleaned, paragraphs)
    cleaned = polish_footnotes(cleaned, discipline_profile=discipline_profile)
    cleaned = merge_redundant_footnotes(cleaned)
    cleaned = [
        {
            **fn,
            "severity": calibrate_critical_severity(
                str(fn.get("severity") or "MENOR"),
                str(fn.get("note_text") or ""),
                str(fn.get("snippet") or ""),
            ),
        }
        for fn in cleaned
    ]
    cleaned = dedupe_footnotes(cleaned)
    pcount = len(paragraphs) if paragraphs else 0
    cleaned = limit_footnotes_by_budget(
        cleaned,
        total_words=total_words,
        max_notes=feedback_budget,
        paragraph_count=pcount,
        paragraphs=paragraphs,
    )
    return reindex_footnotes(cleaned)


def dedupe_footnotes(footnotes: List[dict]) -> List[dict]:
    seen = set()
    deduped: List[dict] = []
    for footnote in footnotes:
        key = (
            footnote.get("paragraph_index"),
            footnote.get("note_type"),
            footnote.get("anchor_type"),
            str(footnote.get("snippet", "")).strip().lower(),
            str(footnote.get("note_text", "")).strip().lower(),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(footnote)
    return deduped


def reindex_footnotes(footnotes: List[dict]) -> List[dict]:
    return [{**footnote, "number": idx} for idx, footnote in enumerate(footnotes, start=1)]


def build_annotated_paragraphs(paragraphs: List[str], footnotes: List[dict]) -> List[dict]:
    index_to_numbers = {idx: [] for idx in range(len(paragraphs))}
    for footnote in footnotes:
        paragraph_index = footnote.get("paragraph_index", -1)
        if paragraph_index in index_to_numbers:
            index_to_numbers[paragraph_index].append(footnote["number"])

    return [
        {
            "index": idx,
            "text": text,
            "footnote_numbers": index_to_numbers[idx],
        }
        for idx, text in enumerate(paragraphs)
    ]


def build_metrics(footnotes: List[dict]) -> dict:
    def get_type(footnote: dict) -> str:
        return str(footnote.get("note_type") or footnote.get("type") or "").strip().lower()

    return {
        "total": len(footnotes),
        "improvement": sum(1 for f in footnotes if get_type(f) == "improvement"),
        "error": sum(1 for f in footnotes if get_type(f) == "error"),
        "observation": sum(1 for f in footnotes if get_type(f) == "observation"),
    }


def summarize_chunk_for_global_review(chunk: Dict[str, Any], chunk_result: dict) -> dict:
    joined_text = " ".join(paragraph["text"] for paragraph in chunk["paragraphs"])
    n = len(joined_text)
    if n <= 960:
        excerpt = joined_text.strip()
    else:
        head = joined_text[:320].strip()
        mid_start = max(0, n // 2 - 160)
        mid = joined_text[mid_start : mid_start + 320].strip()
        tail = joined_text[-320:].strip()
        excerpt = f"[Inicio chunk] {head} … [Mitad chunk] {mid} … [Final chunk] {tail}"
    chunk_summary = chunk_result.get("chunk_summary", {}) if isinstance(chunk_result, dict) else {}
    issues = chunk_summary.get("issues", []) if isinstance(chunk_summary, dict) else []

    return {
        "paragraph_range": [chunk["start_index"], chunk["end_index"]],
        "word_count": chunk["word_count"],
        "excerpt": excerpt,
        "detected_issues": issues[:8] if isinstance(issues, list) else [],
    }


def _normalize_summary_items(value: Any, max_items: int = 5) -> List[str]:
    if isinstance(value, str):
        candidates = [segment.strip("- ").strip() for segment in value.splitlines() if segment.strip()]
    elif isinstance(value, list):
        candidates = [_normalize_text(item) for item in value if _normalize_text(item)]
    else:
        return []

    normalized_items: List[str] = []
    for candidate in candidates:
        if _is_empty_comment(candidate):
            continue
        candidate = _limit_comment_sentences(_humanize_feedback_text(candidate))
        if candidate and candidate not in normalized_items:
            normalized_items.append(candidate)
        if len(normalized_items) >= max_items:
            break
    return normalized_items


def _derive_strengths_from_criteria(criteria: Any) -> List[str]:
    strengths: List[str] = []
    if not isinstance(criteria, list):
        return strengths

    for criterion in criteria:
        if not isinstance(criterion, dict):
            continue
        score = criterion.get("score")
        max_score = criterion.get("max_score")
        criterion_name = _normalize_text(criterion.get("criterion"))
        level = _normalize_text(criterion.get("level"))
        if not criterion_name or not isinstance(score, (int, float)) or not isinstance(max_score, (int, float)):
            continue
        if max_score <= 0:
            continue
        if score / max_score >= 0.7:
            statement = f"Buen desempeño en {criterion_name.lower()}."
            if level:
                statement = f"{statement[:-1]} con nivel {level.lower()}."
            if statement not in strengths:
                strengths.append(statement)
    return strengths[:5]


def _derive_main_weaknesses_from_footnotes(footnotes: List[dict], max_items: int = 5) -> List[str]:
    weaknesses: List[str] = []
    if not footnotes:
        return weaknesses

    ranked_footnotes = sorted(footnotes, key=_footnote_priority, reverse=True)
    pmax = max(int(f.get("paragraph_index", 0)) for f in footnotes)
    paragraph_count = pmax + 1

    if paragraph_count < 6:
        for footnote in ranked_footnotes:
            first_sentence = _split_sentences(str(footnote.get("note_text") or ""))
            if not first_sentence:
                continue
            weakness = _humanize_feedback_text(first_sentence[0])
            if weakness and weakness not in weaknesses:
                weaknesses.append(weakness)
            if len(weaknesses) >= max_items:
                break
        return weaknesses

    buckets: List[List[dict]] = [[], [], []]
    for footnote in ranked_footnotes:
        buckets[tertile_index(int(footnote.get("paragraph_index", 0)), paragraph_count)].append(footnote)

    ptrs = [0, 0, 0]
    advanced = True
    while len(weaknesses) < max_items and advanced:
        advanced = False
        for b in range(3):
            if len(weaknesses) >= max_items:
                break
            if ptrs[b] >= len(buckets[b]):
                continue
            footnote = buckets[b][ptrs[b]]
            ptrs[b] += 1
            first_sentence = _split_sentences(str(footnote.get("note_text") or ""))
            if not first_sentence:
                continue
            weakness = _humanize_feedback_text(first_sentence[0])
            if weakness and weakness not in weaknesses:
                weaknesses.append(weakness)
                advanced = True
    return weaknesses


def _revision_word_range(total_words: int) -> str:
    if total_words <= 800:
        return "150 a 220 palabras"
    if total_words <= 1500:
        return "220 a 320 palabras"
    if total_words <= 3000:
        return "320 a 450 palabras"
    return "450 a 650 palabras"


def _build_improvement_plan(
    footnotes: List[dict],
    total_words: int,
    discipline_profile: Dict[str, Any],
) -> str:
    actions: List[str] = []
    ranked_footnotes = sorted(footnotes, key=_footnote_priority, reverse=True)
    for footnote in ranked_footnotes:
        action_sentence = _extract_action_sentence(str(footnote.get("note_text") or ""))
        if action_sentence and action_sentence not in actions:
            actions.append(action_sentence.rstrip("."))
        if len(actions) >= 3:
            break

    if not actions:
        actions = discipline_profile.get("improvement_examples", [])[:3]

    ordered_actions = "; ".join(actions[:3])
    return (
        f"En una reescritura de {_revision_word_range(total_words)}, prioriza los errores de mayor impacto "
        f"y trabaja en este orden: {ordered_actions}."
    )


def normalize_evaluation_matrix(
    raw_matrix: Any,
    footnotes: List[dict],
    total_words: int,
    discipline_profile: Dict[str, Any],
) -> dict:
    if not isinstance(raw_matrix, dict):
        return {}

    matrix = dict(raw_matrix)
    if matrix.get("general_summary"):
        matrix["general_summary"] = _limit_comment_sentences(
            _humanize_feedback_text(str(matrix.get("general_summary") or "")),
            max_sentences=3,
        )

    strengths = _normalize_summary_items(
        matrix.get("strengths") or matrix.get("fortalezas"),
        max_items=5,
    )
    if len(strengths) < 3:
        for strength in _derive_strengths_from_criteria(matrix.get("criteria", [])):
            if strength not in strengths:
                strengths.append(strength)
            if len(strengths) >= 5:
                break

    weaknesses = _normalize_summary_items(
        matrix.get("main_weaknesses")
        or matrix.get("weaknesses")
        or matrix.get("debilidades_principales"),
        max_items=5,
    )
    if len(weaknesses) < 3:
        for weakness in _derive_main_weaknesses_from_footnotes(footnotes):
            if weakness not in weaknesses:
                weaknesses.append(weakness)
            if len(weaknesses) >= 5:
                break

    improvement_plan = _normalize_text(
        matrix.get("improvement_plan") or matrix.get("plan_de_mejora")
    )
    if not improvement_plan:
        improvement_plan = _build_improvement_plan(
            footnotes,
            total_words=total_words,
            discipline_profile=discipline_profile,
        )

    matrix["strengths"] = strengths[:5]
    matrix["main_weaknesses"] = weaknesses[:5]
    matrix["improvement_plan"] = _limit_comment_sentences(improvement_plan, max_sentences=3)
    return matrix


def normalize_evaluation_result(
    paragraphs: List[str],
    raw_result: dict,
    fallback_range: Optional[Tuple[int, int]] = None,
    discipline_profile: Optional[Dict[str, Any]] = None,
    total_words: Optional[int] = None,
    feedback_budget: Optional[int] = None,
) -> dict:
    resolved_profile = discipline_profile or DISCIPLINE_PROFILES["general"]
    resolved_total_words = total_words if total_words is not None else count_words_in_paragraphs(paragraphs)
    footnotes = normalize_footnotes(
        raw_result.get("footnotes", []),
        paragraph_count=len(paragraphs),
        fallback_range=fallback_range,
        discipline_profile=resolved_profile,
    )
    footnotes = finalize_footnotes(
        footnotes,
        total_words=resolved_total_words,
        discipline_profile=resolved_profile,
        feedback_budget=feedback_budget,
        paragraphs=paragraphs,
    )

    return {
        "paragraphs": build_annotated_paragraphs(paragraphs, footnotes),
        "footnotes": footnotes,
        "evaluation_matrix": normalize_evaluation_matrix(
            raw_result.get("evaluation_matrix", {}),
            footnotes,
            total_words=resolved_total_words,
            discipline_profile=resolved_profile,
        ),
        "metrics": build_metrics(footnotes),
    }


# ── System prompt: rigorous academic auditor ──────────────────────────────────

PEDAGOGICAL_FEEDBACK_CONTRACT = """\
CALIDAD PEDAGÓGICA OBLIGATORIA PARA CADA note_text:
- Escribe como docente experto: firme, claro, útil y no robótico.
- Longitud máxima: 1 a 3 frases.
- Estructura ideal: 1) detecta la falla textual real, 2) explica el impacto académico o disciplinar, 3) indica una mejora concreta accionable.
- Evita muletillas de duda ("sería útil…", "podría…", "conviene…") si puedes enunciar la acción pedagógica de forma directa.
- Cada observación debe incluir severity con uno de estos valores: CRÍTICO, RELEVANTE, MENOR, FORMAL.
- Calibración obligatoria de severity (subordinada siempre a la rúbrica):
  · CRÍTICO: solo si el problema compromete de forma clara la validez del razonamiento o la tesis frente al encargo, el cumplimiento sustantivo de un criterio, o contiene error técnico/conceptual que invalida la respuesta en ese punto.
  · RELEVANTE: falla importante que debilita el desempeño del criterio pero no arrasa la respuesta completa.
  · MENOR: mejora sustantiva de alcance acotado.
  · FORMAL: forma, citación, redacción superficial o precisiones técnicas menores.
  · No uses CRÍTICO por tono, por extensión del párrafo ni por defectos meramente deseables: la gravedad depende del impacto académico real.
- Cada comentario debe vincularse explícitamente con el criterio de la rúbrica aplicado o con una dimensión inequívoca de ese criterio.
- Cada comentario debe referirse, según corresponda, a uno de estos focos: concepto, argumento, estructura, evidencia, transición, cita, relación entre autores o coherencia interna.
- No inventes criterios externos, contenidos no presentes ni exigencias ajenas a la rúbrica.
- Si el problema se repite en varios párrafos, fusiónalo en una sola observación de alto valor y ancla la nota en el párrafo más representativo.
- No ancles observaciones en título, portada, línea de conteo de palabras, encabezados de sección sin desarrollo ni bloques puramente bibliográficos, salvo que el problema sea grave o central en ese punto.
- Para desarrollo argumentativo usa anchor_type='paragraph_fragment' y un snippet que cite varias frases del tramo evaluado (no el párrafo entero salvo que sea imprescindible).

MEMORIA ANTI-REPETICIÓN:
- Antes de redactar cada nota, revisa mentalmente las anteriores del mismo documento.
- No repitas más de una vez por documento estas fórmulas: "no desarrolla", "no explica", "falta contexto", "debe profundizar", "se recomienda ampliar".
- Si una de esas fórmulas ya apareció, reformula con otra estructura y otro ángulo.
- Evita duplicados semánticos: si dos comentarios dicen lo mismo, conserva solo el más preciso y útil.
- Evita expresiones robóticas como: "conviene ampliar", "vale la pena", "resulta pertinente".

ANTI-COMENTARIOS VACÍOS:
- PROHIBIDO escribir comentarios genéricos como: "Mejora redacción", "Profundiza más", "Falta análisis", "Explica mejor", "Desarrolla más".
- Toda observación debe decir QUÉ falla exactamente y CÓMO corregirlo.
"""

AUDITOR_SYSTEM_PROMPT = f"""\
Eres un auditor técnico académico extremadamente exigente.
MODO AUDITOR ESTRICTO:
- PROHIBIDO resumir el documento
- PROHIBIDO halagar o suavizar errores reales
- Revisa párrafo por párrafo
- Selecciona las incidencias de mayor valor pedagógico y evita saturar la salida con microcorrecciones
- Evalúa ortografía, gramática, claridad, citas, lógica argumentativa, redacción académica, ambigüedad, redundancia, consistencia conceptual y alineación con la rúbrica
- Usa SIEMPRE los paragraph_index provistos
- NO repitas el texto completo de los párrafos en la salida

{PEDAGOGICAL_FEEDBACK_CONTRACT}

ESTRUCTURA JSON DE RESPUESTA (responde ÚNICAMENTE con este JSON, sin texto adicional):
{{
  "footnotes": [
    {{
      "paragraph_index": 0,
      "snippet": "fragmento de varias frases tomado del párrafo (no una sola palabra suelta salvo cita inevitable)",
      "anchor_type": "paragraph_fragment",
      "note_type": "error",
      "severity": "RELEVANTE",
      "note_text": "Problema textual específico + impacto académico + mejora concreta accionable, en 1-3 frases y vinculada al criterio."
    }}
  ],
  "evaluation_matrix": {{
    "criteria": [
      {{
        "criterion": "Nombre exacto del criterio de la rúbrica",
        "weight": "30%",
        "score": 6,
        "max_score": 10,
        "level": "Regular",
        "key_examples": ["[1] Breve cita del error", "[3] Otro ejemplo"]
      }}
    ],
    "total_score": 65,
    "overall_level": "Regular",
    "general_summary": "Valoración global en 2-3 oraciones precisas.",
    "strengths": ["Fortaleza real 1", "Fortaleza real 2", "Fortaleza real 3"],
    "main_weaknesses": ["Debilidad principal 1", "Debilidad principal 2", "Debilidad principal 3"],
    "improvement_plan": "Plan de mejora concreto y secuenciado según la extensión del documento."
  }}
}}

Tipos de notas válidos: "error" (error conceptual/lógico/técnico), "improvement" (mejora necesaria), \
"observation" (anotación neutral relevante).
anchor_type válido: "paragraph_fragment" (preferido para varias frases), "paragraph", "line", "phrase" (solo errores puntuales).
Un mismo paragraph_index puede tener varias observaciones si los problemas son distintos.
severity válido: "CRÍTICO", "RELEVANTE", "MENOR", "FORMAL".
Niveles válidos: "Excelente" (9-10), "Bueno" (7-8), "Regular" (5-6), "Deficiente" (0-4).
NO incluyas ningún texto fuera del JSON.\
"""

CHUNK_AUDIT_SYSTEM_PROMPT = f"""\
Eres un auditor técnico académico extremadamente exigente.
Audita SOLO el chunk recibido, párrafo por párrafo, priorizando incidencias de mayor valor pedagógico.
Debes usar siempre los paragraph_index absolutos que llegan en la entrada.
NO repitas el texto completo de los párrafos en la salida.

{PEDAGOGICAL_FEEDBACK_CONTRACT}

Responde SOLO con JSON válido:
{{
  "footnotes": [
    {{
      "paragraph_index": 0,
      "snippet": "fragmento de varias frases del párrafo",
      "anchor_type": "paragraph_fragment",
      "note_type": "error",
      "severity": "RELEVANTE",
      "note_text": "Problema textual específico + impacto académico + mejora concreta accionable, en 1-3 frases."
    }}
  ],
  "chunk_summary": {{
    "issues": ["problema clave 1", "problema clave 2"]
  }}
}}
"""

GLOBAL_AUDIT_SYSTEM_PROMPT = f"""\
Eres un auditor técnico académico extremadamente exigente.
Harás una segunda pasada GLOBAL sobre un documento largo usando resúmenes estructurados por chunk.
Tu foco exclusivo es detectar problemas de coherencia, estructura, redundancia, argumentación y consistencia conceptual.
Si detectas problemas globales, asígnalos al paragraph_index más representativo.
Al sintetizar evaluation_matrix: strengths, main_weaknesses y key_examples deben reflejar el documento completo (inicio, desarrollo y cierre),
no solo el primer chunk; cuando menciones ejemplos, reparte referencias entre distintos tramos si los hallazgos lo permiten.

{PEDAGOGICAL_FEEDBACK_CONTRACT}

Responde SOLO con JSON válido:
{{
  "global_footnotes": [
    {{
      "paragraph_index": 0,
      "snippet": "fragmento representativo o síntesis muy breve",
      "anchor_type": "paragraph",
      "note_type": "improvement",
      "severity": "RELEVANTE",
      "note_text": "Problema global específico + impacto académico + mejora concreta accionable, en 1-3 frases."
    }}
  ],
  "evaluation_matrix": {{
    "criteria": [
      {{
        "criterion": "Nombre exacto del criterio",
        "weight": "30%",
        "score": 6,
        "max_score": 10,
        "level": "Regular",
        "key_examples": ["[1] Ejemplo breve"]
      }}
    ],
    "total_score": 65,
    "overall_level": "Regular",
    "general_summary": "Valoración global en 2-3 oraciones precisas.",
    "strengths": ["Fortaleza real 1", "Fortaleza real 2", "Fortaleza real 3"],
    "main_weaknesses": ["Debilidad principal 1", "Debilidad principal 2", "Debilidad principal 3"],
    "improvement_plan": "Plan de mejora concreto y secuenciado según la extensión del documento."
  }}
}}
"""


def evaluate_short_document(
    paragraphs: List[str],
    rubric_markdown: str,
    methodology_config: Dict[str, str],
    document_context: Optional[Dict[str, Any]] = None,
    formal_evaluation_context_prompt: Optional[str] = None,
    coverage_policy: Optional[Dict[str, Any]] = None,
) -> dict:
    total_words = count_words_in_paragraphs(paragraphs)
    if coverage_policy is None:
        coverage_policy = build_evaluation_coverage_policy(
            document_context if isinstance(document_context, dict) else {},
            paragraphs,
            total_words,
        )
    feedback_cap = int(coverage_policy["target_observation_count"])
    discipline_profile = detect_discipline(rubric_markdown)
    feedback_budget_prompt = build_feedback_budget_prompt(
        total_words,
        max_notes=feedback_cap,
        coverage_policy=coverage_policy,
    )
    discipline_prompt = build_discipline_prompt(discipline_profile)
    document_type_prompt = build_document_type_prompt(document_context)
    visual_context_prompt = build_visual_context_prompt(document_context)
    visual_context_block = f"CONTEXTO VISUAL:\n{visual_context_prompt}\n\n" if visual_context_prompt else ""
    formal_ib_block = (
        f"CONTEXTO IB COMPLEMENTARIO (evaluación formal):\n{formal_evaluation_context_prompt}\n\n"
        if formal_evaluation_context_prompt
        else ""
    )
    paragraphs_json = json.dumps(
        [{"index": i, "text": p} for i, p in enumerate(paragraphs)],
        ensure_ascii=False,
    )
    methodology_prompt = build_methodology_prompt(methodology_config)
    user_prompt = (
        f"RÚBRICA DE EVALUACIÓN:\n{rubric_markdown}\n\n"
        f"METODOLOGÍA DE EVALUACIÓN:\n{methodology_prompt}\n\n"
        f"TIPO DOCUMENTAL:\n{document_type_prompt}\n\n"
        f"PERFIL DISCIPLINAR:\n{discipline_prompt}\n\n"
        f"{formal_ib_block}"
        f"{visual_context_block}"
        f"PRESUPUESTO DE FEEDBACK:\n{feedback_budget_prompt}\n\n"
        f"CONTRATO DE CALIDAD DEL FEEDBACK:\n{PEDAGOGICAL_FEEDBACK_CONTRACT}\n\n"
        "AUDITA TODOS LOS PÁRRAFOS. Reparte la atención entre introducción, desarrollo y cierre según la relevancia; "
        "prioriza observaciones de alto impacto pedagógico y fusiona repeticiones. "
        "No gastes cupos en metadatos (título aislado, portada, conteo de palabras) salvo falla importante.\n"
        f"PÁRRAFOS DEL DOCUMENTO A AUDITAR:\n{paragraphs_json}"
    )
    raw = call_groq(
        [
            {"role": "system", "content": AUDITOR_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=4500,
        temperature=0.0,
    )
    parsed = extract_json(raw)
    prelim = normalize_footnotes(
        parsed.get("footnotes", []),
        paragraph_count=len(paragraphs),
        discipline_profile=discipline_profile,
    )
    if should_trigger_coverage_backfill(len(prelim), coverage_policy, total_words, len(paragraphs)):
        try:
            backfill = run_coverage_backfill_pass(
                paragraphs,
                rubric_markdown,
                methodology_config,
                document_context,
                formal_evaluation_context_prompt,
                coverage_policy,
                prelim,
                discipline_profile,
            )
            extra = backfill.get("footnotes") if isinstance(backfill, dict) else []
            if isinstance(extra, list) and extra:
                parsed.setdefault("footnotes", []).extend(extra)
        except Exception as exc:
            logger.warning("Coverage backfill pass failed: %s", exc)
    return normalize_evaluation_result(
        paragraphs,
        parsed,
        discipline_profile=discipline_profile,
        total_words=total_words,
        feedback_budget=feedback_cap,
    )


def evaluate_long_document(
    paragraphs: List[str],
    rubric_markdown: str,
    methodology_config: Dict[str, str],
    document_context: Optional[Dict[str, Any]] = None,
    formal_evaluation_context_prompt: Optional[str] = None,
    coverage_policy: Optional[Dict[str, Any]] = None,
) -> dict:
    total_words = count_words_in_paragraphs(paragraphs)
    if coverage_policy is None:
        coverage_policy = build_evaluation_coverage_policy(
            document_context if isinstance(document_context, dict) else {},
            paragraphs,
            total_words,
        )
    total_budget = int(coverage_policy["target_observation_count"])
    discipline_profile = detect_discipline(rubric_markdown)
    chunks = chunk_paragraphs(paragraphs)
    aggregated_footnotes: List[dict] = []
    chunk_reviews: List[dict] = []
    chunk_failures = 0
    methodology_prompt = build_methodology_prompt(methodology_config)
    discipline_prompt = build_discipline_prompt(discipline_profile)
    document_type_prompt = build_document_type_prompt(document_context)
    visual_context_prompt = build_visual_context_prompt(document_context)
    visual_context_block = f"CONTEXTO VISUAL:\n{visual_context_prompt}\n\n" if visual_context_prompt else ""
    formal_ib_block = (
        f"CONTEXTO IB COMPLEMENTARIO (evaluación formal):\n{formal_evaluation_context_prompt}\n\n"
        if formal_evaluation_context_prompt
        else ""
    )

    for chunk_number, chunk in enumerate(chunks, start=1):
        chunk_budget = compute_chunk_feedback_budget(
            chunk["word_count"],
            total_words=total_words,
            total_budget=total_budget,
        )
        chunk_payload = json.dumps(chunk["paragraphs"], ensure_ascii=False)
        chunk_prompt = (
            f"RÚBRICA DE EVALUACIÓN:\n{rubric_markdown}\n\n"
            f"METODOLOGÍA DE EVALUACIÓN:\n{methodology_prompt}\n\n"
            f"TIPO DOCUMENTAL:\n{document_type_prompt}\n\n"
            f"PERFIL DISCIPLINAR:\n{discipline_prompt}\n\n"
            f"{formal_ib_block}"
            f"{visual_context_block}"
            f"PRESUPUESTO DE FEEDBACK:\n{build_feedback_budget_prompt(chunk['word_count'], max_notes=chunk_budget, scope_label='chunk', coverage_policy=coverage_policy)}\n\n"
            f"CONTRATO DE CALIDAD DEL FEEDBACK:\n{PEDAGOGICAL_FEEDBACK_CONTRACT}\n\n"
            f"CHUNK {chunk_number}/{len(chunks)} (párrafos índices {chunk['start_index']}–{chunk['end_index']}). "
            "Evalúa solo este bloque, párrafo por párrafo, usando los paragraph_index absolutos. "
            "No asumas que el resto del documento repite los mismos problemas: distribuye la mirada dentro de este tramo. "
            "Prioriza observaciones de alto impacto y no repitas el texto completo en la salida.\n\n"
            f"PÁRRAFOS DEL CHUNK:\n{chunk_payload}"
        )
        try:
            raw = call_groq(
                [
                    {"role": "system", "content": CHUNK_AUDIT_SYSTEM_PROMPT},
                    {"role": "user", "content": chunk_prompt},
                ],
                max_tokens=2200,
                temperature=0.0,
            )
            chunk_result = extract_json(raw)
            aggregated_footnotes.extend(
                normalize_footnotes(
                    chunk_result.get("footnotes", []),
                    paragraph_count=len(paragraphs),
                    fallback_range=(chunk["start_index"], chunk["end_index"]),
                    discipline_profile=discipline_profile,
                )
            )
            chunk_reviews.append(summarize_chunk_for_global_review(chunk, chunk_result))
        except Exception as exc:
            chunk_failures += 1
            logger.warning(
                "Chunk %s/%s failed during long-document evaluation: %s",
                chunk_number,
                len(chunks),
                exc,
            )
            chunk_reviews.append(
                {
                    "paragraph_range": [chunk["start_index"], chunk["end_index"]],
                    "word_count": chunk["word_count"],
                    "excerpt": " ".join(p["text"] for p in chunk["paragraphs"])[:500].strip(),
                    "detected_issues": [f"Chunk no procesado completamente: {exc}"],
                }
            )
            continue

    if chunk_failures == len(chunks):
        raise HTTPException(
            status_code=502,
            detail="La IA no pudo procesar ninguno de los chunks del documento largo.",
        )

    global_prompt = (
        f"RÚBRICA DE EVALUACIÓN:\n{rubric_markdown}\n\n"
        f"METODOLOGÍA DE EVALUACIÓN:\n{methodology_prompt}\n\n"
        f"TIPO DOCUMENTAL:\n{document_type_prompt}\n\n"
        f"PERFIL DISCIPLINAR:\n{discipline_prompt}\n\n"
        f"{formal_ib_block}"
        f"{visual_context_block}"
        f"PRESUPUESTO DE FEEDBACK:\n{build_feedback_budget_prompt(total_words, max_notes=compute_global_feedback_budget(total_budget), scope_label='revisión global', coverage_policy=coverage_policy)}\n\n"
        f"CONTRATO DE CALIDAD DEL FEEDBACK:\n{PEDAGOGICAL_FEEDBACK_CONTRACT}\n\n"
        "A partir de los hallazgos por chunk, realiza una segunda pasada GLOBAL del documento. "
        "Debes revisar coherencia, estructura, redundancia, argumentación y consistencia conceptual. "
        "Si detectas incidencias globales, asígnalas al paragraph_index más representativo. "
        "Evita síntesis que dependan solo del primer fragmento: integra inicio, núcleo y cierre a partir de los resúmenes.\n\n"
        f"RESUMEN ESTRUCTURADO DEL DOCUMENTO:\n{json.dumps(chunk_reviews, ensure_ascii=False)}"
    )

    global_result: dict = {}
    try:
        raw_global = call_groq(
            [
                {"role": "system", "content": GLOBAL_AUDIT_SYSTEM_PROMPT},
                {"role": "user", "content": global_prompt},
            ],
            max_tokens=2600,
            temperature=0.0,
        )
        global_result = extract_json(raw_global)
    except Exception as exc:
        logger.warning("Global review failed after chunk merge: %s", exc)

    merged_footnotes = aggregated_footnotes + normalize_footnotes(
        global_result.get("global_footnotes", []),
        paragraph_count=len(paragraphs),
        discipline_profile=discipline_profile,
    )
    if should_trigger_coverage_backfill(len(merged_footnotes), coverage_policy, total_words, len(paragraphs)):
        try:
            backfill = run_coverage_backfill_pass(
                paragraphs,
                rubric_markdown,
                methodology_config,
                document_context,
                formal_evaluation_context_prompt,
                coverage_policy,
                merged_footnotes,
                discipline_profile,
            )
            extra = backfill.get("footnotes") if isinstance(backfill, dict) else []
            if isinstance(extra, list) and extra:
                merged_footnotes.extend(
                    normalize_footnotes(
                        extra,
                        paragraph_count=len(paragraphs),
                        discipline_profile=discipline_profile,
                    )
                )
        except Exception as exc:
            logger.warning("Coverage backfill pass failed (long document): %s", exc)

    merged_footnotes = finalize_footnotes(
        merged_footnotes,
        total_words=total_words,
        discipline_profile=discipline_profile,
        feedback_budget=total_budget,
        paragraphs=paragraphs,
    )

    return {
        "paragraphs": build_annotated_paragraphs(paragraphs, merged_footnotes),
        "footnotes": merged_footnotes,
        "evaluation_matrix": normalize_evaluation_matrix(
            global_result.get("evaluation_matrix", {}),
            merged_footnotes,
            total_words=total_words,
            discipline_profile=discipline_profile,
        ),
        "metrics": build_metrics(merged_footnotes),
    }


def evaluate_document_with_strategy(
    paragraphs: List[str],
    rubric_markdown: str,
    methodology_config: Dict[str, str],
    document_context: Optional[Dict[str, Any]] = None,
    formal_evaluation_context_prompt: Optional[str] = None,
    coverage_policy: Optional[Dict[str, Any]] = None,
) -> dict:
    total_words = count_words_in_paragraphs(paragraphs)
    if coverage_policy is None:
        coverage_policy = build_evaluation_coverage_policy(
            document_context if isinstance(document_context, dict) else {},
            paragraphs,
            total_words,
        )
    use_long = total_words > SHORT_DOCUMENT_WORD_LIMIT or should_use_long_evaluation(
        paragraphs,
        total_words,
    )
    if use_long:
        return evaluate_long_document(
            paragraphs,
            rubric_markdown,
            methodology_config,
            document_context=document_context,
            formal_evaluation_context_prompt=formal_evaluation_context_prompt,
            coverage_policy=coverage_policy,
        )
    return evaluate_short_document(
        paragraphs,
        rubric_markdown,
        methodology_config,
        document_context=document_context,
        formal_evaluation_context_prompt=formal_evaluation_context_prompt,
        coverage_policy=coverage_policy,
    )


# ── Endpoint: Granular Footnote Evaluation ─────────────────────────────────────

@router.post("/footnotes")
async def evaluate_with_footnotes(
    request: EvaluateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Evaluación párrafo a párrafo con anotaciones incrementales y matriz de evaluación final.
    temperature=0.0 garantiza resultados deterministas y rigurosos.
    """
    assert_can_evaluate_document(current_user)
    if not request.paragraphs:
        raise HTTPException(status_code=400, detail="No hay párrafos para evaluar.")

    # Validate that paragraphs have extractable text
    total_text = " ".join(request.paragraphs).strip()
    if not total_text:
        raise HTTPException(
            status_code=422,
            detail="Los párrafos están vacíos. Verifica que el documento fue extraído correctamente.",
        )

    try:
        methodology_config = resolve_methodology_config(request)
        document_context = resolve_document_context(request)
        document_router = resolve_document_router(document_context)
        discipline_profile = detect_discipline(request.rubric_markdown)

        evaluation_context_bundle = build_evaluation_context_bundle(
            document_id=request.document_id,
            paragraphs=request.paragraphs,
            rubric_markdown=request.rubric_markdown,
            document_context=document_context,
            discipline_profile=discipline_profile,
            db=db,
            db_user_id=int(current_user.id),
        )
        formal_ctx = build_formal_evaluation_prompt_context(evaluation_context_bundle)
        evaluation_context_bundle["formal_prompt_context_injected"] = bool(formal_ctx)

        total_words_eval = count_words_in_paragraphs(request.paragraphs)
        coverage_policy = build_evaluation_coverage_policy(
            document_context,
            request.paragraphs,
            total_words_eval,
        )
        evaluation_context_bundle["coverage_policy"] = coverage_policy

        result = evaluate_document_with_strategy(
            request.paragraphs,
            request.rubric_markdown,
            methodology_config,
            document_context=document_context,
            formal_evaluation_context_prompt=formal_ctx or None,
            coverage_policy=coverage_policy,
        )

        paragraphs_out = result["paragraphs"]
        footnotes_out = result["footnotes"]
        evaluation_matrix = result["evaluation_matrix"]
        metrics = result["metrics"]

        try:
            record = EvaluationRecord(
                user_id=current_user.id,
                document_id=request.document_id,
                footnote_count=metrics["total"],
                error_count=metrics["error"],
                improvement_count=metrics["improvement"],
                observation_count=metrics["observation"],
            )
            db.add(record)
            db.commit()
        except Exception:
            db.rollback()

        return {
            "success": True,
            "document_id": request.document_id,
            "paragraphs": paragraphs_out,
            "footnotes": footnotes_out,
            "evaluation_matrix": evaluation_matrix,
            "metrics": metrics,
            "document_router": document_router,
            "document_intelligence_profile": document_context.get("document_intelligence_profile"),
            "evaluation_context_bundle": evaluation_context_bundle,
        }

    except LLMJsonParseError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Error al sanear la respuesta de IA como JSON: {str(e)}",
        )
    except HTTPException:
        # Propagar errores de créditos o lógica controlada sin transformarlos en 500
        raise
    except Exception as e:
        logger.exception("Error inesperado en evaluate_with_footnotes")
        raise HTTPException(status_code=500, detail=f"Error en evaluación: {str(e)}")


def _legacy_note_type_label_es(note_type: str) -> str:
    t = (note_type or "").strip().lower()
    return {
        "error": "error",
        "improvement": "mejora",
        "observation": "observación",
    }.get(t, t or "nota")


def _tertile_section_label(tertile: int) -> str:
    return {
        0: "Tramo inicial del documento",
        1: "Tramo central",
        2: "Tramo final",
    }.get(tertile, "Observaciones")


def render_legacy_evaluation_html(
    *,
    paragraphs: List[str],
    footnotes: List[dict],
    evaluation_matrix: Optional[dict] = None,
    coverage_policy: Optional[Dict[str, Any]] = None,
) -> str:
    """
    HTML estable para POST /api/evaluate/: deriva el informe visible desde el mismo resultado
    estructurado que alimenta /footnotes (matriz + footnotes), sin segunda opinión del LLM.
    """
    matrix = evaluation_matrix if isinstance(evaluation_matrix, dict) else {}
    esc = html.escape

    parts: List[str] = ['<div class="evaluai-formal-report">']
    parts.append("<h2>Informe de evaluación</h2>")

    meta_bits: List[str] = []
    if isinstance(coverage_policy, dict):
        dr = str(coverage_policy.get("document_role") or "").strip()
        cm = str(coverage_policy.get("content_mode") or "").strip()
        if dr:
            meta_bits.append(f"Rol documental: {esc(dr)}")
        if cm:
            meta_bits.append(f"Modo de contenido: {esc(cm)}")
    if meta_bits:
        parts.append(f"<p>{' · '.join(meta_bits)}</p>")

    if isinstance(coverage_policy, dict):
        mode = esc(str(coverage_policy.get("coverage_mode") or ""))
        rationale = str(coverage_policy.get("coverage_rationale") or "").strip()
        target = coverage_policy.get("target_observation_count")
        parts.append("<h3>Cobertura evaluativa</h3>")
        if rationale:
            parts.append(f"<p>{esc(rationale)}</p>")
        parts.append(f"<p><strong>Modo de cobertura:</strong> {mode}</p>")
        if target is not None:
            parts.append(
                "<p><strong>Observaciones en este informe:</strong> "
                f"{len(footnotes)} (techo orientativo según política: {int(target)})</p>"
            )

    summary = str(matrix.get("general_summary") or "").strip()
    if summary:
        parts.append("<h3>Síntesis</h3>")
        parts.append(f"<p>{esc(summary)}</p>")

    score_bits: List[str] = []
    if matrix.get("total_score") is not None:
        score_bits.append(f"Puntuación global: {esc(str(matrix.get('total_score')))}")
    ol = str(matrix.get("overall_level") or "").strip()
    if ol:
        score_bits.append(f"Nivel cualitativo: {esc(ol)}")
    if score_bits:
        parts.append(f"<p>{' · '.join(score_bits)}</p>")

    criteria = matrix.get("criteria")
    if isinstance(criteria, list) and criteria:
        parts.append("<h3>Criterios de la rúbrica</h3>")
        parts.append("<ul>")
        for c in criteria:
            if not isinstance(c, dict):
                continue
            name = esc(str(c.get("criterion") or "").strip())
            if not name:
                continue
            weight = esc(str(c.get("weight") or "").strip())
            level = esc(str(c.get("level") or "").strip())
            score_v = c.get("score")
            mx = c.get("max_score")
            score_txt = ""
            if isinstance(score_v, (int, float)) and isinstance(mx, (int, float)):
                score_txt = f"{score_v}/{mx}"
            elif score_v is not None:
                score_txt = str(score_v)
            head = f"<strong>{name}</strong>"
            if weight:
                head += f" ({weight})"
            if score_txt:
                head += f" — puntaje: {esc(score_txt)}"
            if level:
                head += f" — nivel: {level}"
            parts.append(f"<li>{head}")
            kex = c.get("key_examples")
            if isinstance(kex, list) and kex:
                items = "".join(
                    f"<li>{esc(str(x).strip())}</li>" for x in kex if str(x).strip()
                )
                if items:
                    parts.append(f"<ul>{items}</ul>")
            parts.append("</li>")
        parts.append("</ul>")

    for title, key in (
        ("Fortalezas", "strengths"),
        ("Debilidades principales", "main_weaknesses"),
    ):
        arr = matrix.get(key)
        if isinstance(arr, list) and arr:
            parts.append(f"<h3>{esc(title)}</h3>")
            parts.append("<ul>")
            for it in arr:
                t = str(it).strip()
                if t:
                    parts.append(f"<li>{esc(t)}</li>")
            parts.append("</ul>")

    plan = str(matrix.get("improvement_plan") or "").strip()
    if plan:
        parts.append("<h3>Plan de mejora</h3>")
        parts.append(f"<p>{esc(plan)}</p>")

    p_count = len(paragraphs)
    if footnotes:
        parts.append("<h3>Observaciones detalladas</h3>")
        by_t: Dict[int, List[dict]] = defaultdict(list)
        for fn in footnotes:
            pi = int(fn.get("paragraph_index", 0))
            ti = tertile_index(pi, p_count) if p_count else 0
            by_t[ti].append(fn)
        for ti in sorted(by_t.keys()):
            parts.append(f"<h4>{esc(_tertile_section_label(ti))}</h4>")
            parts.append("<ol>")
            ordered = sorted(
                by_t[ti],
                key=lambda f: (
                    int(f.get("paragraph_index", 0)),
                    int(f.get("number", 0)),
                ),
            )
            for fn in ordered:
                num = int(fn.get("number", 0))
                pi = int(fn.get("paragraph_index", 0))
                sev = esc(str(fn.get("severity") or ""))
                nt = esc(_legacy_note_type_label_es(str(fn.get("note_type") or "")))
                anchor = esc(str(fn.get("anchor_type") or ""))
                snippet = str(fn.get("snippet") or "").strip()
                note = str(fn.get("note_text") or "").strip()
                parts.append("<li>")
                parts.append(
                    "<p><strong>"
                    f"[{num}]</strong> Párrafo "
                    f"{pi + 1} · {sev} · {nt} · ancla: {anchor}</p>"
                )
                if snippet:
                    parts.append(f"<blockquote>{esc(snippet)}</blockquote>")
                if note:
                    parts.append(f"<p>{esc(note)}</p>")
                parts.append("</li>")
            parts.append("</ol>")

    parts.append("</div>")
    return "".join(parts)


# ── Endpoint: Legacy HTML evaluation ──────────────────────────────────────────


def _legacy_shadow_context_bundle(
    *,
    document_id: int,
    paragraphs: List[str],
    rubric_markdown: str,
    document_context: Dict[str, Any],
    discipline_profile: Dict[str, Any],
    db: Session,
    db_user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Misma construcción que /footnotes. Si falla, devuelve un bundle mínimo de error.
    """
    try:
        return build_evaluation_context_bundle(
            document_id=document_id,
            paragraphs=paragraphs or [],
            rubric_markdown=rubric_markdown,
            document_context=document_context,
            discipline_profile=discipline_profile,
            db=db,
            db_user_id=db_user_id,
        )
    except Exception as exc:
        logger.warning(
            "evaluation_context_bundle (shadow) no construido para POST /api/evaluate/: %s",
            exc,
            exc_info=True,
        )
        return {
            "bundle_kind": "evaluation_context_bundle",
            "bundle_mode": "shadow",
            "subject": None,
            "document_role": None,
            "document_intelligence_profile": None,
            "rubric_active_summary": None,
            "retrieval_used": False,
            "retrieval_query_excerpt": "",
            "teacher_context_snippets": [],
            "related_document_categories": [],
            "teacher_context_retrieval_debug": {
                "pack_source": "none",
                "query_tokens": [],
                "internal_note": str(exc),
            },
            "scope_note": (
                "No se pudo construir el bundle de contexto para auditoría (shadow); "
                "detalle en teacher_context_retrieval_debug.internal_note."
            ),
            "retrieval_confidence": "none",
            "note": f"{SHADOW_NOTE} Bundle mínimo por fallo al preparar el contexto.",
            "formal_prompt_context_injected": False,
        }


@router.post("/")
async def evaluate_document(
    request: EvaluateRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    assert_can_evaluate_document(current_user)
    document_text = "\n\n".join(request.paragraphs)
    if not document_text.strip():
        document_context = resolve_document_context(request)
        discipline_profile = detect_discipline(request.rubric_markdown)
        evaluation_context_bundle = _legacy_shadow_context_bundle(
            document_id=request.document_id,
            paragraphs=request.paragraphs or [],
            rubric_markdown=request.rubric_markdown,
            document_context=document_context,
            discipline_profile=discipline_profile,
            db=db,
            db_user_id=int(current_user.id),
        )
        evaluation_context_bundle["formal_prompt_context_injected"] = False
        tw_empty = count_words_in_paragraphs(request.paragraphs or [])
        evaluation_context_bundle["coverage_policy"] = build_evaluation_coverage_policy(
            document_context,
            request.paragraphs or [],
            tw_empty,
        )
        return {
            "success": True,
            "evaluation": "",
            "evaluation_context_bundle": evaluation_context_bundle,
        }

    cached_processing = get_cached_document_processing(request.document_id) or {}
    processing = cached_processing.get("processing") if isinstance(cached_processing, dict) else {}
    text_source = ""
    if isinstance(processing, dict):
        text_source = str(processing.get("text_source") or "").strip().lower()
    is_ocr_or_vision = text_source in {"ocr_transcription", "mixed"}
    action = "Evaluate_Full_Doc_OCR_Vision" if is_ocr_or_vision else "Evaluate_Full_Doc_Text"
    cost = get_action_cost(action)

    request_id = ensure_request_id(
        request.request_id
        or http_request.headers.get("X-Request-Id")
        or http_request.headers.get("X-Idempotency-Key")
    )
    assert_has_credits(current_user, cost)

    try:
        methodology_config = resolve_methodology_config(request)
        document_context = resolve_document_context(request)
        discipline_profile = detect_discipline(request.rubric_markdown)
        evaluation_context_bundle = _legacy_shadow_context_bundle(
            document_id=request.document_id,
            paragraphs=request.paragraphs,
            rubric_markdown=request.rubric_markdown,
            document_context=document_context,
            discipline_profile=discipline_profile,
            db=db,
            db_user_id=int(current_user.id),
        )
        formal_ctx = build_formal_evaluation_prompt_context(evaluation_context_bundle)
        evaluation_context_bundle["formal_prompt_context_injected"] = bool(formal_ctx)
        total_words = count_words_in_paragraphs(request.paragraphs)
        coverage_policy = build_evaluation_coverage_policy(
            document_context,
            request.paragraphs,
            total_words,
        )
        evaluation_context_bundle["coverage_policy"] = coverage_policy

        strategy_result = evaluate_document_with_strategy(
            request.paragraphs,
            request.rubric_markdown,
            methodology_config,
            document_context=document_context,
            formal_evaluation_context_prompt=formal_ctx or None,
            coverage_policy=coverage_policy,
        )
        footnotes = strategy_result.get("footnotes") or []
        evaluation_matrix = strategy_result.get("evaluation_matrix") or {}
        metrics = strategy_result.get("metrics") or build_metrics(footnotes)

        evaluation_html = render_legacy_evaluation_html(
            paragraphs=request.paragraphs,
            footnotes=footnotes,
            evaluation_matrix=evaluation_matrix,
            coverage_policy=coverage_policy,
        )

        try:
            record = EvaluationRecord(
                user_id=current_user.id,
                document_id=request.document_id,
                footnote_count=metrics["total"],
                error_count=metrics["error"],
                improvement_count=metrics["improvement"],
                observation_count=metrics["observation"],
            )
            db.add(record)
            db.commit()
        except Exception:
            db.rollback()

        try:
            deduct_credits_after_success(
                db=db,
                user_id=current_user.id,
                action=action,
                surface="evaluate",
                cost=cost,
                request_id=request_id,
                doc_id=request.document_id,
                meta={
                    "text_source": text_source or None,
                    "model": MODEL,
                },
            )
        except HTTPException:
            raise
        except Exception:
            db.rollback()

        return {
            "success": True,
            "document_id": request.document_id,
            "evaluation": evaluation_html,
            "evaluation_context_bundle": evaluation_context_bundle,
        }
    except LLMJsonParseError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Error al sanear la respuesta de IA como JSON: {str(e)}",
        )
    except HTTPException:
        raise
    except HTTPException:
        # Propagar errores intencionales (403 créditos, 503 llm_unconfigured, 502 provider, etc.)
        raise
    except Exception as e:
        # En producción, varios errores llegan con str(e)==""; devolver un payload útil
        # y dejar traza en logs para diagnóstico.
        try:
            logger.exception("chat_agent failed request_id=%s", request_id)
        except Exception:
            logger.exception("chat_agent failed (request_id unavailable)")
        raise HTTPException(
            status_code=500,
            detail={
                "code": "chat_internal_error",
                "message": "Error interno ejecutando el chat.",
                "request_id": request_id,
                "error": str(e) or repr(e),
            },
        )


# ── Endpoint: Chat Agente ──────────────────────────────────────────────────────

CHAT_IMAGE_MIME_TYPES = {"image/png", "image/jpeg"}
MAX_CHAT_IMAGE_DATA_URL_LENGTH = 8_000_000

MAX_TEACHER_CONTEXT_ONE_LINER_CHARS = 480
MAX_TEACHER_PREVIEW_FILENAMES = 6
MAX_TEACHER_CATEGORY_LABELS = 12
MAX_TEACHER_JOIN_CHARS = 240


def _teacher_documents_from_pack(pack: Dict[str, Any]) -> List[Dict[str, Any]]:
    docs = pack.get("documents")
    if not isinstance(docs, list):
        return []
    return [d for d in docs if isinstance(d, dict)]


def _truncate_join(items: List[str], max_chars: int) -> str:
    joined = ", ".join(items)
    if len(joined) <= max_chars:
        return joined
    return joined[: max_chars - 1].rstrip() + "…"


def _build_teacher_mi_espacio_ib_lines(payload: Dict[str, Any]) -> List[str]:
    """Líneas breves sobre Mi Espacio IB para prompts de chat (sin volcar el pack ni retrieval)."""
    raw_summary = payload.get("teacher_context_summary")
    raw_pack = payload.get("teacher_context_pack")
    summary = raw_summary if isinstance(raw_summary, dict) else None
    pack = raw_pack if isinstance(raw_pack, dict) else None

    summary_usable = bool(
        summary
        and (
            summary.get("summary_kind") == "teacher_context_summary"
            or summary.get("one_liner")
            or isinstance(summary.get("document_count"), int)
        )
    )
    pack_usable = bool(
        pack
        and (pack.get("pack_kind") == "teacher_context_pack" or isinstance(pack.get("documents"), list))
    )

    if not summary_usable and not pack_usable:
        return []

    lines: List[str] = []

    ib_subject = ""
    if summary_usable:
        ib_subject = _normalize_text(summary.get("asignatura_activa"))
    if not ib_subject and pack_usable:
        ib_subject = _normalize_text(pack.get("asignatura_activa"))
    if not ib_subject:
        ib_subject = _normalize_text(payload.get("espacio_ib_asignatura_activa"))

    one_liner = ""
    if summary_usable:
        one_liner = _normalize_text(summary.get("one_liner"))
    if len(one_liner) > MAX_TEACHER_CONTEXT_ONE_LINER_CHARS:
        one_liner = one_liner[: MAX_TEACHER_CONTEXT_ONE_LINER_CHARS - 1].rstrip() + "…"

    doc_count: Optional[int] = None
    if summary_usable and isinstance(summary.get("document_count"), int):
        doc_count = summary["document_count"]
    elif pack_usable:
        doc_count = len(_teacher_documents_from_pack(pack))

    honest = ""
    if summary_usable:
        honest = _normalize_text(summary.get("honest_note"))

    categories: List[str] = []
    if pack_usable:
        seen = set()
        for doc in _teacher_documents_from_pack(pack):
            cat = _normalize_text(doc.get("categoria_documental"))
            if cat and cat not in seen:
                seen.add(cat)
                categories.append(cat)
            if len(categories) >= MAX_TEACHER_CATEGORY_LABELS:
                break

    preview: List[str] = []
    if summary_usable:
        raw_preview = summary.get("filenames_preview")
        if isinstance(raw_preview, list):
            preview = [_normalize_text(str(x)) for x in raw_preview if _normalize_text(str(x))]
    if not preview and pack_usable:
        for doc in _teacher_documents_from_pack(pack)[:MAX_TEACHER_PREVIEW_FILENAMES]:
            fn = _normalize_text(doc.get("filename"))
            if fn:
                preview.append(fn)
    preview = preview[:MAX_TEACHER_PREVIEW_FILENAMES]

    if one_liner:
        lines.append(f"Mi Espacio IB: {one_liner}")
    else:
        fallback_bits: List[str] = []
        if ib_subject:
            fallback_bits.append(f"asignatura activa «{ib_subject}»")
        if doc_count is not None:
            fallback_bits.append(f"{doc_count} documento(s) en el índice local (solo metadatos)")
        if fallback_bits:
            lines.append(f"Mi Espacio IB: {', '.join(fallback_bits)}.")
        elif pack_usable or summary_usable:
            lines.append(
                "Mi Espacio IB: contexto docente recibido sin resumen textual; usa solo metadatos disponibles."
            )

    if categories:
        lines.append(
            f"Categorías documentales en Mi Espacio IB: {_truncate_join(categories, MAX_TEACHER_JOIN_CHARS)}."
        )

    if preview:
        lines.append(
            f"Vista previa de archivos indexados: {_truncate_join(preview, MAX_TEACHER_JOIN_CHARS)}."
        )

    if honest:
        lines.append(f"Alcance del índice: {honest}")
    else:
        lines.append(
            "Alcance del índice: metadatos locales (nombre, categoría, ids); sin embeddings ni vector DB. "
            "Los fragmentos de Markdown útiles se recuperan aparte con coincidencia simple cuando el backend lo considera pertinente."
        )

    return lines


def build_chat_context_block(context: Optional[Dict[str, Any]]) -> str:
    payload = context if isinstance(context, dict) else {}
    lines: List[str] = []

    rubric_name = _normalize_text(payload.get("rubrica_activa") or payload.get("rubrica_activa_nombre"))
    if rubric_name:
        lines.append(f"Rúbrica activa: {rubric_name}.")

    rubric_markdown = _normalize_text(payload.get("rubrica_activa_markdown"))
    if rubric_markdown:
        lines.append(f"Contenido de la rúbrica activa: {rubric_markdown[:1200]}.")

    subject = _normalize_text(payload.get("asignatura_activa") or payload.get("subject"))
    if subject:
        lines.append(f"Asignatura activa: {subject}.")

    document_name = _normalize_text(payload.get("documento_activo"))
    if document_name:
        lines.append(f"Documento activo: {document_name}.")

    document_type = _normalize_text(payload.get("document_type"))
    if document_type:
        lines.append(f"Tipo documental activo: {document_type}.")

    doc_intel_line = ""
    raw_doc_id = payload.get("document_id")
    if raw_doc_id is not None:
        try:
            did = int(raw_doc_id)
        except (TypeError, ValueError):
            did = None
        if did:
            cached = get_cached_document_processing(did)
            if isinstance(cached, dict):
                prof = cached.get("document_intelligence_profile")
                if not isinstance(prof, dict):
                    prof = build_document_intelligence_profile(
                        str(payload.get("documento_activo") or ""),
                        "",
                        cached,
                    )
                doc_intel_line = format_profile_for_prompt(prof)
    if doc_intel_line:
        lines.append(doc_intel_line)

    lines.extend(_build_teacher_mi_espacio_ib_lines(payload))

    user_context = _normalize_text(payload.get("user_context"))
    if user_context:
        lines.append(f"Contexto adicional del profesor: {user_context}.")

    return "\n".join(f"- {line}" for line in lines)


def normalize_chat_image_payload(image_payload: Optional[Dict[str, Any]]) -> Optional[Dict[str, str]]:
    if not isinstance(image_payload, dict):
        return None

    data_url = str(image_payload.get("data_url") or "").strip()
    mime_type = str(image_payload.get("mime_type") or "").strip().lower()
    if mime_type == "image/jpg":
        mime_type = "image/jpeg"

    if not data_url:
        return None
    if mime_type not in CHAT_IMAGE_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Solo se admiten imágenes PNG o JPEG en el chat.")
    if not data_url.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Formato de imagen inválido para el chat.")
    if len(data_url) > MAX_CHAT_IMAGE_DATA_URL_LENGTH:
        raise HTTPException(status_code=413, detail="La imagen del chat es demasiado grande.")

    return {
        "data_url": data_url,
        "mime_type": mime_type,
        "filename": _normalize_text(image_payload.get("filename")) or "clipboard-image",
    }


def build_image_chat_prompt(req: ChatRequest) -> str:
    context_block = build_chat_context_block(req.contexto)
    user_instruction = _normalize_text(req.mensaje)
    lines = [
        "Analiza esta imagen según la rúbrica activa.",
        "Si es gráfica, tabla, ejercicio, diagrama o respuesta manuscrita, entrega retroalimentación docente concreta.",
        "Prioriza un análisis pedagógico breve y accionable, no una descripción superficial de la imagen.",
        "Si falta contexto para evaluar con certeza, dilo explícitamente y conserva una recomendación útil.",
        "Formato obligatorio de salida:",
        "Hallazgo principal: ...",
        "Error / mejora: ...",
        "Acción sugerida: ...",
        "Si aplica, termina con una línea final exacta: NOTA AL PIE: ...",
    ]
    if context_block:
        lines.append(f"Contexto activo:\n{context_block}")
    if user_instruction:
        lines.append(f"Instrucción adicional del usuario: {user_instruction}")
    return "\n".join(lines)


def _confidence_label_spanish(label: Optional[str]) -> str:
    normalized = str(label or "").strip().lower()
    if normalized == "high":
        return "alta"
    if normalized == "medium":
        return "media"
    return "baja"


def _extract_single_footnote_line(content: str) -> Tuple[str, Optional[str]]:
    lines = str(content or "").splitlines()
    body_lines: List[str] = []
    footnote: Optional[str] = None
    for line in lines:
        match = re.match(r"\s*NOTA AL PIE:\s*(.+)\s*$", line, flags=re.IGNORECASE)
        if match and not footnote:
            footnote = match.group(1).strip()
            continue
        body_lines.append(line)
    return "\n".join(body_lines).strip(), footnote


def build_chat_image_feedback_prompt(req: ChatRequest, transcription: Dict[str, Any]) -> str:
    # El system prompt del chat ya incluye fragmentos recuperados; aquí solo el bloque base
    # evita duplicar snippets en el mensaje de usuario de la segunda llamada al modelo.
    context_block = build_chat_context_block(req.contexto)
    user_instruction = _normalize_text(req.mensaje)
    transcribed_text = "\n".join(transcription.get("transcribed_paragraphs") or []) or "[sin texto legible]"
    confidence_label = _confidence_label_spanish(transcription.get("transcription_confidence"))
    source_type = str(transcription.get("source_type") or "scanned_printed").strip().lower()

    lines = [
        "Evalúa una captura pegada en el chat sin tratarla como documento completo.",
        f"Tipo de fuente detectada: {source_type}.",
        f"Confianza estimada de transcripción: {confidence_label}.",
        "Usa la rúbrica activa si está disponible.",
        "Si la confianza es baja, dilo explícitamente y limita el juicio a lo verificable.",
        "Responde con EXACTAMENTE estos bloques:",
        "Retroalimentación: ...",
        "Si aplica, termina con una única línea final exacta: NOTA AL PIE: ...",
        f"Texto transcrito:\n{transcribed_text}",
    ]
    if transcription.get("low_confidence_spans"):
        uncertain = ", ".join(
            str(span.get("text"))
            for span in (transcription.get("low_confidence_spans") or [])[:6]
            if isinstance(span, dict) and span.get("text")
        )
        if uncertain:
            lines.append(f"Tramos dudosos: {uncertain}")
    if context_block:
        lines.append(f"Contexto activo:\n{context_block}")
    if user_instruction:
        lines.append(f"Instrucción adicional del usuario: {user_instruction}")
    return "\n".join(lines)


def _coerce_page_hint(value: Any) -> Optional[int]:
    """Normaliza un page_hint proveniente del contexto del chat.

    Acepta enteros, strings numéricos (1-based). Cualquier otra cosa → None.
    """
    if value is None:
        return None
    try:
        parsed = int(str(value).strip())
    except (TypeError, ValueError):
        return None
    if parsed <= 0:
        return None
    return parsed


def build_chat_image_asset(
    image_payload: Dict[str, str],
    transcription: Dict[str, Any],
    suggested_footnote: Optional[str],
    page_hint: Optional[int],
) -> Dict[str, Any]:
    """Construye el bloque estructurado `chat_image_asset` para el frontend.

    No devuelve la imagen completa: reduce a thumbnail liviano.
    """
    thumbnail = build_chat_image_thumbnail(
        image_payload["data_url"],
        image_payload["mime_type"],
    )

    transcribed_paragraphs = [
        str(p).strip()
        for p in (transcription.get("transcribed_paragraphs") or [])
        if str(p).strip()
    ]
    transcription_text = "\n".join(transcribed_paragraphs)

    return {
        "filename": image_payload.get("filename") or "clipboard-image",
        "mime_type": thumbnail.get("mime_type") or image_payload.get("mime_type") or "image/png",
        "thumbnail_data_url": thumbnail.get("thumbnail_data_url"),
        "thumbnail_width": int(thumbnail.get("width") or 0),
        "thumbnail_height": int(thumbnail.get("height") or 0),
        "original_width": int(thumbnail.get("original_width") or 0),
        "original_height": int(thumbnail.get("original_height") or 0),
        "transcription": {
            "text": transcription_text,
            "paragraphs": transcribed_paragraphs,
            "confidence": transcription.get("transcription_confidence"),
            "confidence_score": transcription.get("transcription_confidence_score"),
            "source_type": transcription.get("source_type"),
            "low_confidence_spans": transcription.get("low_confidence_spans") or [],
        },
        "suggested_footnote": suggested_footnote,
        "page_hint": page_hint,
    }


def format_image_chat_response(transcription: Dict[str, Any], feedback: str) -> str:
    transcribed_text = " ".join(
        str(paragraph).strip()
        for paragraph in (transcription.get("transcribed_paragraphs") or [])
        if str(paragraph).strip()
    ) or "No fue posible leer texto suficiente en la imagen."
    confidence_label = _confidence_label_spanish(transcription.get("transcription_confidence"))
    feedback_body, footnote = _extract_single_footnote_line(feedback)
    if not feedback_body:
        feedback_body = (
            "Retroalimentación: No pude ofrecer una retroalimentación fiable porque la transcripción visual fue insuficiente. "
            "Conviene reenviar una captura más nítida o con mayor contraste."
        )
    elif not feedback_body.lower().startswith("retroalimentación:"):
        feedback_body = f"Retroalimentación: {feedback_body}"

    lines = [
        f"Texto detectado: {transcribed_text}",
        f"Confianza estimada: {confidence_label}",
        feedback_body,
    ]
    if footnote:
        lines.append(f"NOTA AL PIE: {footnote}")
    return "\n".join(lines)

@router.post("/chat")
async def chat_agent(
    req: ChatRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Chat conversacional con contexto de rúbricas y memoria de evaluaciones."""
    # Definir request_id lo antes posible para observabilidad incluso si falla el pre-procesamiento.
    request_id = ensure_request_id(
        req.request_id
        or http_request.headers.get("X-Request-Id")
        or http_request.headers.get("X-Idempotency-Key")
    )
    user_rubrics = db.query(Rubric).filter(Rubric.user_id == current_user.id).all()
    rubrics_context = "\n-----\n".join(
        [f"TÍTULO: {r.nombre} (Asignatura: {r.asignatura})\nCONTENIDO:\n{r.markdown}"
         for r in user_rubrics]
    )

    recent_evals = (
        db.query(EvaluationRecord)
        .filter(EvaluationRecord.user_id == current_user.id)
        .order_by(EvaluationRecord.created_at.desc())
        .limit(5)
        .all()
    )
    memory_context = ""
    if recent_evals:
        memory_context = "\nEVALUACIONES RECIENTES:\n" + "\n".join(
            [f"- Doc {r.document_id}: {r.footnote_count} notas ({r.error_count} errores, "
             f"{r.improvement_count} mejoras) el {r.created_at.strftime('%d/%m') if r.created_at else 'N/A'}"
             for r in recent_evals]
        )

    base_context_block = build_chat_context_block(req.contexto)
    context_block, teacher_context_retrieval = merge_chat_context_with_teacher_snippets(
        base_context_block,
        req.mensaje,
        req.contexto,
        db=db,
        owner_user_id=int(current_user.id),
    )
    image_payload = normalize_chat_image_payload(req.image)
    chat_superficie = resolve_chat_superficie(req.contexto)
    mi_espacio_policy = build_chat_mi_espacio_policy_section(chat_superficie)

    is_assistant = chat_superficie == "asistente_ia"
    has_image = bool(image_payload)
    if is_assistant:
        action = "Chat_Assistant_RAG"
        cost = get_action_cost(action, has_image=has_image, surface=chat_superficie)
    else:
        action = "Chat_Copilot_Image" if has_image else "Chat_Copilot_Text"
        cost = get_action_cost(action, has_image=has_image, surface=chat_superficie)
    assert_has_credits(current_user, cost)

    system_prompt = f"""Eres el Agente Evaluador IA de EvaluAI — asistente experto para profesores.

RÚBRICAS ACTIVAS:
{rubrics_context if user_rubrics else "Ninguna rúbrica guardada todavía."}
{memory_context}

CONTEXTO ACTIVO DE LA SESIÓN:
{context_block if context_block else "No se recibió contexto adicional."}

{mi_espacio_policy}

CAPACIDADES:
1. Crear rúbricas en Markdown estructurado. Cuando el profesor pida "Crea una rúbrica de X", genera la rúbrica COMPLETA en Markdown con criterios, ponderaciones y niveles. Incluye <!--RUBRICA_LISTA_PARA_GUARDAR--> al final.
2. Evaluar selecciones de texto — cuando el profesor comparte un fragmento seleccionado, auditarlo contra la rúbrica activa.
3. Responder preguntas pedagógicas sobre evaluación.
4. Analizar resultados de evaluaciones pasadas.
5. Sugerir mejoras a rúbricas existentes.
6. Analizar imágenes educativas cuando el usuario pegue una captura en el chat.

REGLAS:
- Si te piden crear una rúbrica, genera el Markdown COMPLETO con título H1, criterios en tabla, y ponderaciones. Incluye <!--RUBRICA_LISTA_PARA_GUARDAR--> al final.
- Si te comparten un fragmento de texto para evaluar, actúa como auditor exigente: cita el fragmento, identifica el criterio de rúbrica violado y proporciona retroalimentación específica.
- Si llega una imagen, responde con foco docente, formato claro y sin tratarla como documento completo.
- Sé conciso pero técnicamente preciso.
"""

    messages = [{"role": "system", "content": system_prompt}]
    for msg in req.historial[-8:]:
        role = "user" if msg.get("tipo") == "usuario" else "assistant"
        messages.append({"role": role, "content": msg.get("contenido", "")})
    if not image_payload:
        messages.append({"role": "user", "content": req.mensaje})

    try:
        chat_image_asset: Optional[Dict[str, Any]] = None
        if image_payload:
            transcription = transcribe_chat_image(
                image_payload["data_url"],
                image_payload["mime_type"],
                image_payload["filename"],
            )
            feedback_messages = list(messages)
            feedback_messages.append(
                {
                    "role": "user",
                    "content": build_chat_image_feedback_prompt(req, transcription),
                }
            )
            raw_feedback = call_groq(feedback_messages, max_tokens=1200, temperature=0.3)
            respuesta = format_image_chat_response(transcription, raw_feedback)

            # Ancla honesta: además del bloque de texto (intacto), emitimos un
            # asset estructurado con thumbnail + transcripción + confianza para
            # que el frontend pueda crear una footnote tipo 'capture' trazable.
            _, extracted_footnote = _extract_single_footnote_line(raw_feedback)
            page_hint = _coerce_page_hint(
                (req.contexto or {}).get("page_hint") if isinstance(req.contexto, dict) else None
            )
            try:
                chat_image_asset = build_chat_image_asset(
                    image_payload,
                    transcription,
                    extracted_footnote,
                    page_hint,
                )
            except Exception:
                # Nunca romper el chat si falla la construcción del asset.
                chat_image_asset = None
        else:
            respuesta = call_groq(messages, max_tokens=2000, temperature=0.7)

        rubrica_lista = "<!--RUBRICA_LISTA_PARA_GUARDAR-->" in respuesta
        respuesta_limpia = respuesta.replace("<!--RUBRICA_LISTA_PARA_GUARDAR-->", "").strip()

        doc_id = None
        if isinstance(req.contexto, dict):
            try:
                raw_doc_id = req.contexto.get("document_id")
                doc_id = int(raw_doc_id) if raw_doc_id is not None else None
            except Exception:
                doc_id = None

        try:
            deduct_credits_after_success(
                db=db,
                user_id=current_user.id,
                action=action,
                surface=chat_superficie if chat_superficie in ("asistente_ia", "chat_contextual") else "contextual_chat",
                cost=cost,
                request_id=request_id,
                doc_id=doc_id,
                meta={
                    "has_image": has_image,
                    "model": MODEL,
                },
            )
        except HTTPException:
            raise
        except Exception:
            db.rollback()

        return {
            "success": True,
            "respuesta": respuesta_limpia,
            "rubrica_lista": rubrica_lista,
            "markdown_rubrica": respuesta_limpia if rubrica_lista else None,
            "chat_image_asset": chat_image_asset,
            "teacher_context_retrieval": teacher_context_retrieval,
        }
    except HTTPException:
        # Dejar pasar errores de créditos (403), LLM proveedor (502), etc.
        raise
    except Exception as e:
        logger.exception("chat_agent failed request_id=%s", request_id)
        raise HTTPException(status_code=500, detail=str(e))


# ── Endpoint: Batch JSON (legacy) ─────────────────────────────────────────────

@router.post("/batch")
async def batch_evaluate(
    request: BatchEvaluateRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Evalúa hasta 10 documentos en paralelo. Devuelve JSON de resultados."""
    assert_can_evaluate_document(current_user)
    if len(request.documents) > 10:
        raise HTTPException(status_code=400, detail="Máximo 10 documentos por lote.")

    batch_request_id = ensure_request_id(
        request.request_id
        or http_request.headers.get("X-Request-Id")
        or http_request.headers.get("X-Idempotency-Key")
    )

    per_doc_actions: List[str] = []
    per_doc_costs: List[int] = []
    per_doc_text_sources: List[str] = []
    for doc in request.documents:
        cached_processing = get_cached_document_processing(doc.document_id) or {}
        processing = cached_processing.get("processing") if isinstance(cached_processing, dict) else {}
        text_source = ""
        if isinstance(processing, dict):
            text_source = str(processing.get("text_source") or "").strip().lower()
        is_ocr_or_vision = text_source in {"ocr_transcription", "mixed"}
        action = "Evaluate_Full_Doc_OCR_Vision" if is_ocr_or_vision else "Evaluate_Full_Doc_Text"
        per_doc_actions.append(action)
        per_doc_costs.append(get_action_cost(action))
        per_doc_text_sources.append(text_source)

    total_cost = sum(per_doc_costs)
    assert_has_credits(current_user, total_cost)

    async def evaluate_single(doc: BatchDocumentItem, index: int) -> dict:
        await asyncio.sleep(index * 0.8)
        text = "\n\n".join(doc.paragraphs[:20])
        visual_context_prompt = build_visual_context_prompt(get_cached_document_processing(doc.document_id))
        visual_context_block = (
            f"Contexto visual complementario:\n{visual_context_prompt}\n\n"
            if visual_context_prompt
            else ""
        )
        if not text.strip():
            return {"filename": doc.filename, "success": False, "error": "Documento vacío"}

        system_prompt = (
            "Eres un auditor académico exigente. Evalúa el trabajo según la rúbrica. "
            "Responde SOLO con JSON válido: "
            '{"score": <0-100>, "level": "<Excelente|Bueno|Regular|Deficiente>", '
            '"summary": "<resumen 2-3 oraciones>", '
            '"key_issues": ["<issue1>", "<issue2>"], "strengths": ["<fortaleza1>"]}'
        )
        try:
            raw = call_groq(
                [
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": (
                            f"Rúbrica: {request.rubric_markdown[:500]}\n\n"
                            f"{visual_context_block}"
                            f"Documento: {text[:2000]}"
                        ),
                    },
                ],
                max_tokens=800,
                temperature=0.0,
            )
            result = extract_json(raw)
            return {"filename": doc.filename, "document_id": doc.document_id, "success": True, **result}
        except Exception as e:
            return {"filename": doc.filename, "success": False, "error": str(e)}

    tasks = [evaluate_single(doc, i) for i, doc in enumerate(request.documents)]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    processed = []
    for r in results:
        if isinstance(r, Exception):
            processed.append({"success": False, "error": str(r)})
        else:
            processed.append(r)

    # Cobro post-éxito (secuencial): no usar la Session en paralelo
    for idx, (doc, result) in enumerate(zip(request.documents, processed)):
        if not isinstance(result, dict) or not result.get("success"):
            continue
        action = per_doc_actions[idx] if idx < len(per_doc_actions) else "Evaluate_Full_Doc_Text"
        cost = per_doc_costs[idx] if idx < len(per_doc_costs) else 5
        text_source = per_doc_text_sources[idx] if idx < len(per_doc_text_sources) else ""
        try:
            deduct_credits_after_success(
                db=db,
                user_id=current_user.id,
                action=action,
                surface="batch",
                cost=cost,
                request_id=f"{batch_request_id}:{doc.document_id}:{idx}",
                doc_id=doc.document_id,
                meta={
                    "text_source": text_source or None,
                    "model": MODEL,
                },
            )
        except HTTPException:
            raise
        except Exception:
            db.rollback()

    return {"success": True, "results": processed, "total": len(processed)}


# ── Endpoint: Batch ZIP (new — returns .md files in ZIP) ─────────────────────

@router.post("/batch-zip")
async def batch_evaluate_zip(
    request: BatchEvaluateRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Evalúa hasta 10 documentos con análisis línea a línea.
    Devuelve un archivo ZIP con un .md de retroalimentación por cada documento.
    """
    assert_can_evaluate_document(current_user)
    if len(request.documents) > 10:
        raise HTTPException(status_code=400, detail="Máximo 10 documentos por lote.")

    batch_request_id = ensure_request_id(
        request.request_id
        or http_request.headers.get("X-Request-Id")
        or http_request.headers.get("X-Idempotency-Key")
    )

    per_doc_actions: List[str] = []
    per_doc_costs: List[int] = []
    per_doc_text_sources: List[str] = []
    for doc in request.documents:
        cached_processing = get_cached_document_processing(doc.document_id) or {}
        processing = cached_processing.get("processing") if isinstance(cached_processing, dict) else {}
        text_source = ""
        if isinstance(processing, dict):
            text_source = str(processing.get("text_source") or "").strip().lower()
        is_ocr_or_vision = text_source in {"ocr_transcription", "mixed"}
        action = "Evaluate_Full_Doc_OCR_Vision" if is_ocr_or_vision else "Evaluate_Full_Doc_Text"
        per_doc_actions.append(action)
        per_doc_costs.append(get_action_cost(action))
        per_doc_text_sources.append(text_source)

    total_cost = sum(per_doc_costs)
    assert_has_credits(current_user, total_cost)

    batch_system_prompt = """\
Eres un auditor técnico académico extremadamente exigente. Analiza RIGUROSAMENTE el trabajo contra la rúbrica.
Responde SOLO con JSON válido:
{
  "score": <0-100>,
  "level": "<Excelente|Bueno|Regular|Deficiente>",
  "summary": "<valoración global en 2-3 oraciones>",
  "key_issues": ["<error específico con cita textual>"],
  "strengths": ["<fortaleza específica>"],
  "criteria": [
    {"criterion": "nombre", "score": 0-10, "max_score": 10, "comment": "observación técnica"}
  ]
}\
"""

    async def evaluate_single_detailed(doc: BatchDocumentItem, index: int) -> dict:
        await asyncio.sleep(index * 1.0)
        text = "\n\n".join(doc.paragraphs)
        visual_context_prompt = build_visual_context_prompt(get_cached_document_processing(doc.document_id))
        visual_context_block = (
            f"CONTEXTO VISUAL COMPLEMENTARIO:\n{visual_context_prompt}\n\n"
            if visual_context_prompt
            else ""
        )
        if not text.strip():
            return {"filename": doc.filename, "success": False, "error": "Documento vacío"}
        try:
            raw = call_groq(
                [
                    {"role": "system", "content": batch_system_prompt},
                    {
                        "role": "user",
                        "content": (
                            f"RÚBRICA:\n{request.rubric_markdown[:1000]}\n\n"
                            f"{visual_context_block}"
                            f"DOCUMENTO: {doc.filename}\n{text[:3000]}"
                        ),
                    },
                ],
                max_tokens=2000,
                temperature=0.0,
            )
            result = extract_json(raw)
            return {"filename": doc.filename, "document_id": doc.document_id, "success": True, **result}
        except Exception as e:
            return {"filename": doc.filename, "success": False, "error": str(e)}

    tasks = [evaluate_single_detailed(doc, i) for i, doc in enumerate(request.documents)]
    results_raw = await asyncio.gather(*tasks, return_exceptions=True)

    results: List[dict] = []
    for r in results_raw:
        if isinstance(r, Exception):
            results.append({"success": False, "error": str(r), "filename": "unknown"})
        else:
            results.append(r)

    # Cobro post-éxito (secuencial): no usar la Session en paralelo
    for idx, (doc, result) in enumerate(zip(request.documents, results)):
        if not isinstance(result, dict) or not result.get("success"):
            continue
        action = per_doc_actions[idx] if idx < len(per_doc_actions) else "Evaluate_Full_Doc_Text"
        cost = per_doc_costs[idx] if idx < len(per_doc_costs) else 5
        text_source = per_doc_text_sources[idx] if idx < len(per_doc_text_sources) else ""
        try:
            deduct_credits_after_success(
                db=db,
                user_id=current_user.id,
                action=action,
                surface="batch",
                cost=cost,
                request_id=f"{batch_request_id}:{doc.document_id}:{idx}",
                doc_id=doc.document_id,
                meta={
                    "text_source": text_source or None,
                    "model": MODEL,
                },
            )
        except HTTPException:
            raise
        except Exception:
            db.rollback()

    # Build ZIP with .md files
    zip_buffer = io.BytesIO()
    now_str = datetime.now().strftime("%Y-%m-%d")

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for r in results:
            fname = r.get("filename", "documento")
            stem = fname.rsplit(".", 1)[0] if "." in fname else fname

            if not r.get("success"):
                md = f"# Evaluación: {fname}\n\n**ERROR:** {r.get('error', 'Error desconocido')}\n"
            else:
                # Build markdown report
                criteria_table = ""
                criteria_list = r.get("criteria", [])
                if criteria_list:
                    criteria_table = (
                        "\n## Matriz de Evaluación por Criterio\n\n"
                        "| Criterio | Puntaje | Nivel | Observación |\n"
                        "|----------|---------|-------|-------------|\n"
                    )
                    for c in criteria_list:
                        score = c.get("score", "—")
                        max_s = c.get("max_score", 10)
                        lvl = (
                            "Excelente" if isinstance(score, (int, float)) and score >= 9
                            else "Bueno" if isinstance(score, (int, float)) and score >= 7
                            else "Regular" if isinstance(score, (int, float)) and score >= 5
                            else "Deficiente"
                        )
                        criteria_table += (
                            f"| {c.get('criterion','—')} | {score}/{max_s} | {lvl} | {c.get('comment','—')} |\n"
                        )

                issues = r.get("key_issues", [])
                strengths = r.get("strengths", [])

                issues_md = "\n".join(f"- {i}" for i in issues) if issues else "_Ninguno registrado._"
                strengths_md = "\n".join(f"- {s}" for s in strengths) if strengths else "_Ninguno registrado._"

                md = f"""\
# Evaluación: {fname}

**Fecha de evaluación:** {now_str}  
**Puntaje global:** {r.get('score', '—')}/100 — {r.get('level', '—')}

---

## Resumen General

{r.get('summary', '_Sin resumen._')}

---

## Problemas Identificados

{issues_md}

---

## Fortalezas Reconocidas

{strengths_md}
{criteria_table}
---

*Evaluación generada automáticamente por EvaluAI · Auditoría Académica Rigurosa*
"""

            md_filename = f"{stem}_evaluacion.md"
            zf.writestr(md_filename, md)

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="evaluaciones_lote_{now_str}.zip"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# ── Endpoint: Analytics ────────────────────────────────────────────────────────

@router.get("/analytics")
async def get_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    records = (
        db.query(EvaluationRecord)
        .filter(EvaluationRecord.user_id == current_user.id)
        .order_by(EvaluationRecord.created_at.asc())
        .all()
    )

    if not records:
        return {
            "success": True,
            "total_evaluations": 0,
            "history": [],
            "totals": {"errors": 0, "improvements": 0, "observations": 0},
            "avg_footnotes": 0,
        }

    history = [
        {
            "date": r.created_at.strftime("%d/%m") if r.created_at else "N/A",
            "footnotes": r.footnote_count or 0,
            "errors": r.error_count or 0,
            "improvements": r.improvement_count or 0,
            "observations": r.observation_count or 0,
        }
        for r in records
    ]

    totals = {
        "errors": sum(r.error_count or 0 for r in records),
        "improvements": sum(r.improvement_count or 0 for r in records),
        "observations": sum(r.observation_count or 0 for r in records),
    }

    return {
        "success": True,
        "total_evaluations": len(records),
        "history": history,
        "totals": totals,
        "avg_footnotes": round(sum(r.footnote_count or 0 for r in records) / len(records), 1),
    }
