"""
Heurísticas locales para calidad de anclajes (sin LLM).

Penaliza anclajes de bajo valor pedagógico (portada, título aislado, conteo de palabras,
cabeceras puramente estructurales) al priorizar notas bajo techo de cobertura.
"""
from __future__ import annotations

import re
from typing import List, Tuple

_BIB_HEADING_RE = re.compile(
    r"^\s*(bibliograf[ií]a|referencias(\s+bibliogr[áa]ficas)?|works?\s+cited|fuentes)\s*:?\s*$",
    re.IGNORECASE,
)
_WORDCOUNT_LINE_RE = re.compile(
    r"^\s*(?:n[úu]mero\s+de\s+)?palabras?\s*[:\s]*\d+\s*$|^\s*\d+\s+palabras?\s*$",
    re.IGNORECASE,
)
_WORDCOUNT_TOKEN_RE = re.compile(r"\b\d{3,5}\s*palabras?\b", re.IGNORECASE)
_PORTADA_RE = re.compile(r"^\s*portada\s*$", re.IGNORECASE)


def count_words(text: str) -> int:
    return len(re.findall(r"\S+", text or ""))


def is_low_value_anchor_candidate(
    paragraph: str,
    paragraph_index: int,
    total_paragraphs: int,
) -> Tuple[bool, str]:
    """
    True si el párrafo es muy probablemente título, portada, conteo, cabecera o bloque
    puramente referencial — conviene no gastar ahí el presupuesto salvo severidad alta.
    """
    t = (paragraph or "").strip()
    if not t:
        return True, "vacío"

    wc = count_words(t)
    one_line = "\n" not in t and t.count(".") <= 1

    if _PORTADA_RE.match(t) and wc <= 4:
        return True, "portada"

    if _BIB_HEADING_RE.match(t) and wc <= 8:
        return True, "encabezado_bibliografia"

    if _WORDCOUNT_LINE_RE.match(t) or (wc <= 14 and _WORDCOUNT_TOKEN_RE.search(t) and len(t) < 100):
        return True, "conteo_palabras"

    # Primera unidad muy corta, sin predicación clara: suele ser título o metadato
    if paragraph_index == 0 and wc <= 10 and one_line:
        lower = t.lower()
        has_clause = any(
            x in lower
            for x in (
                " es ",
                " son ",
                " está",
                " est ",
                " fue ",
                " han ",
                " debe",
                " puede",
                " porque",
                " para ",
                " mediante",
                " según",
            )
        )
        if not has_clause and not t.endswith((".", "!", "?")):
            return True, "probable_titulo"

    # Encabezado de sección sin desarrollo (línea corta, sin punto final, estilo título)
    if wc <= 12 and one_line and not t.endswith((".", "!", "?", ":", ";")):
        if t.isupper() and wc <= 10:
            return True, "encabezado_mayusculas"
        # "1. Introducción" / "2.2 Marco teórico"
        if re.match(r"^\s*\d+(?:[.\s]\d+)*[.)]\s+\S", t):
            return True, "encabezado_numerado"

    # Bloque típico de referencia pura (URLs + poco texto)
    if wc >= 6 and t.count("http") >= 2 and wc <= 40:
        return True, "lista_referencias_url"

    # Últimos párrafos: línea aislada "Referencias" ya cubierta arriba; evitar duplicar heurística

    _ = total_paragraphs  # reservado para futuras señales de posición relativa
    return False, ""


def substantive_snippet_for_paragraph_fragment(
    paragraph: str,
    note_text: str,
    current_snippet: str,
    *,
    max_chars: int = 420,
) -> str:
    """
    Refuerza el snippet visible cuando anchor_type=paragraph_fragment: intenta centrar el
    extracto en palabras del comentario o en la porción media del párrafo si es muy largo.
    """
    para = (paragraph or "").strip()
    if not para:
        return current_snippet

    def window(start: int, end: int) -> str:
        frag = para[max(0, start) : min(len(para), end)].strip()
        if len(frag) > max_chars:
            frag = frag[:max_chars].rsplit(" ", 1)[0] + "…"
        return frag

    # Palabras significativas del comentario (mínimo 4 letras)
    tokens = [
        m.group(0).lower()
        for m in re.finditer(r"[a-záéíóúñü]{4,}", (note_text or "").lower())
    ]
    stop = {
        "esta", "este", "estos", "estas", "esta", "parte", "texto", "párrafo", "parrafo",
        "debe", "debería", "podria", "podría", "cuando", "donde", "sobre", "entre",
        "como", "cada", "todo", "toda", "todos", "aqui", "aqui", "aunque", "desde",
        "hacia", "hasta", "mismo", "misma", "según", "segun", "además", "ademas",
    }
    keywords = [w for w in tokens if w not in stop][:8]

    plain = re.sub(r"\s+", " ", para.lower())
    best_pos = -1
    for kw in keywords:
        idx = plain.find(kw)
        if idx >= 0:
            best_pos = idx
            break

    if best_pos >= 0:
        # Mapear índice aproximado en texto original (espacios)
        approx = int(best_pos * len(para) / max(len(plain), 1))
        return window(approx - 45, approx + 320)

    sn = (current_snippet or "").strip()
    if sn and sn.lower() in para.lower() and len(sn) >= 48:
        idx = para.lower().find(sn.lower()[: min(24, len(sn))])
        if idx >= 0:
            return window(idx - 30, idx + len(sn) + 220)

    # Párrafo largo: evitar que siempre sea "inicio del párrafo" genérico
    wlist = para.split()
    if len(wlist) > 95:
        mid = len(wlist) // 3
        chunk = " ".join(wlist[mid : mid + 72])
        if len(chunk) > max_chars:
            chunk = chunk[:max_chars].rsplit(" ", 1)[0] + "…"
        return chunk

    return current_snippet if current_snippet else para[:max_chars]
