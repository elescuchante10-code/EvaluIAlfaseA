#!/usr/bin/env python3
"""
Batería E1–E3 (MODELO) vía POST /api/evaluate/footnotes.
Requiere API en marcha, GROQ_API_KEY, cuenta con créditos, EVALUAI_QA_EMAIL / EVALUAI_QA_PASSWORD.

Uso: export EVALUAI_QA_EMAIL=... EVALUAI_QA_PASSWORD=... EVALUAI_API_BASE=http://127.0.0.1:8000
     python3 scripts/corrida_calidad_fase_b_e123.py

Salida: JSON resumido en stdout (sin contraseñas). Fallos: código HTTP y detalle.
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from typing import Any, Dict, List, Tuple

RUBRIC_E1 = """---
asignatura: Filosofía
---
# Rúbrica — ensayo corto (E1)
| Criterio | Peso |
|----------|------|
| Tesis y problema | 40% |
| Uso de ideas | 30% |
| Comunicación | 30% |
"""

RUBRIC_E2 = """---
asignatura: Economía
---
# Rúbrica — interpretación de datos (E2)
Criterio A: lectura e interpretación de la tabla. Criterio B: conclusiones justificadas.
Ponderación: A 50%, B 50%.
"""

RUBRIC_E3 = """---
asignatura: Matemáticas
---
# Rúbrica NM — E3 (otra asignatura)
- **Procedimiento** (cálculo y justificación de pasos).
- **Resultado y claridad** (respuesta coherente con el enunciado).
"""


def _post_json(url: str, payload: dict, token: str) -> Tuple[int, Any]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        body = resp.read().decode("utf-8")
        return resp.status, json.loads(body) if body else {}


def _login(base: str, email: str, password: str) -> str:
    st, body = _post_json(
        f"{base.rstrip('/')}/api/auth/login/json",
        {"email": email, "password": password},
        "",
    )
    if st != 200 or not isinstance(body, dict):
        raise RuntimeError(f"login {st}: {body}")
    tok = body.get("access_token") or body.get("token")
    if not tok:
        raise RuntimeError("token ausente en login")
    return str(tok)


def _fold(s: str) -> str:
    t = re.sub(r"\s+", " ", (s or "").lower())
    return re.sub(r"[^a-záéíóúñ0-9%]+", " ", t, flags=re.IGNORECASE).strip()


def _heuristic_c3(
    rubric: str,
    matrix: Any,
    footnotes: List[Any],
    paragraphs: List[str],
) -> Dict[str, Any]:
    """Comprobaciones ligeras alineables a C3.1–C3.2; C3.3–C3.4 siguen siendo juicio en ficha."""
    c31 = None
    try:
        crits = (matrix or {}).get("criteria") or []
        rub_f = _fold(rubric)
        if isinstance(crits, list) and crits:
            ok = 0
            for c in crits:
                if not isinstance(c, dict):
                    continue
                name = str(c.get("criterion") or "")
                if not name or len(_fold(name)) < 3:
                    continue
                if _fold(name)[:20] in rub_f or any(
                    w in rub_f for w in _fold(name).split() if len(w) > 4
                ):
                    ok += 1
            c31 = round(min(1.0, 0.5 if ok == 0 else 1.0 if ok == len(crits) else 0.5), 2)
        else:
            c31 = 0.0
    except Exception as exc:
        c31 = f"err:{exc}"

    c32 = None
    try:
        ok_n = 0
        n = 0
        for fn in footnotes or []:
            if not isinstance(fn, dict):
                continue
            n += 1
            idx = int(fn.get("paragraph_index", -1))
            sn = str(fn.get("snippet") or "")
            ptxt = str(paragraphs[idx]) if 0 <= idx < len(paragraphs) else ""
            if not sn or len(sn) < 4 or not ptxt:
                continue
            sn_c = re.sub(r"\W+", " ", sn.lower()[:200])
            for w in sn_c.split():
                if len(w) > 3 and w in ptxt.lower():
                    ok_n += 1
                    break
        c32 = 1.0 if n and ok_n / n >= 0.5 else 0.5 if n and ok_n else 0.0
    except Exception as exc:
        c32 = f"err:{exc}"

    return {"C3_1_matrix_vs_rubric": c31, "C3_2_snippet_vs_paragraph": c32}

def main() -> int:
    base = os.environ.get("EVALUAI_API_BASE", "http://127.0.0.1:8000").rstrip("/")
    email = os.environ.get("EVALUAI_QA_EMAIL", "").strip()
    password = os.environ.get("EVALUAI_QA_PASSWORD", "")
    if not email or not password:
        print("Definir EVALUAI_QA_EMAIL y EVALUAI_QA_PASSWORD", file=sys.stderr)
        return 2

    try:
        token = _login(base, email, password)
    except Exception as e:
        print(json.dumps({"error": "login", "message": str(e)}))
        return 1

    # document_id: usar uno existente en caché si aplica; 5 alineado con pruebas locales habituales
    doc = int(os.environ.get("EVALUAI_E_DOC_ID", "5"))

    e1_paras = [
        "La tesis sostiene que la libertad negativa basta para una primera aproximación, pero no explica el conflicto con recursos escasos.",
        "Se menciona a Rawls y a Sen, sin conectar con el ejemplo del documento, lo que debilita el criterio de relevancia.",
    ]

    e2_paras = [
        "A continuación se presenta un extracto de ventas (unidades) por región (datos simulados para el ejercicio).",
        "| Región    | 2022 | 2023 |\n|-----------|-----|-----|\n| Norte     | 120  | 135  |\n| Sur       | 80   | 77   |\n",
        "A la baja en el Sur atribuimos cierre temporal; conviene señalar que un solo dato anual no justifica tendencia. Falta proyección y comparación con competencia, según pide el encargo de interpretar la tabla con rigor.",
    ]

    e3_paras = [
        "Problema: Calcular el área bajo f(x)=x^2 en [0,2] usando primitiva.",
        "Una primitiva es F(x)=x^3/3. Entonces F(2)-F(0)=8/3.",
        "Pero 8/3 ≈ 2,666 y en la hoja escribo 2,67, podría explicitar unidades o redondeo, y verificar con integral definida o sumas de Riemann (aprox) para reforzar el criterio de procedimiento y claridad de resultado.",
    ]

    cases: List[Dict[str, Any]] = []
    for eid, rubric, paras, label in (
        ("E1", RUBRIC_E1, e1_paras, "Entrega corta, Filosofía"),
        ("E2", RUBRIC_E2, e2_paras, "Entrega con tabla, Economía"),
        ("E3", RUBRIC_E3, e3_paras, "Matemáticas, otra rúbrica"),
    ):
        payload = {
            "document_id": doc,
            "paragraphs": paras,
            "rubric_markdown": rubric,
            "document_context": {},
        }
        try:
            st, data = _post_json(f"{base}/api/evaluate/footnotes", payload, token)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", "replace")[:4000]
            try:
                detail = json.loads(err_body)
            except Exception:
                detail = err_body
            cases.append(
                {
                    "id": eid,
                    "ok": False,
                    "http": e.code,
                    "detail": detail,
                }
            )
            continue
        if st != 200 or not data.get("success"):
            cases.append(
                {
                    "id": eid,
                    "ok": False,
                    "http": st,
                    "data": str(data)[:2000],
                }
            )
            continue
        m = data.get("evaluation_matrix") or {}
        fns = data.get("footnotes") or []
        b = data.get("evaluation_context_bundle") or {}
        c3h = _heuristic_c3(rubric, m, fns, paras)
        cases.append(
            {
                "id": eid,
                "ok": True,
                "label": label,
                "http": st,
                "matrix_levels": m.get("overall_level"),
                "criteria_count": len(m.get("criteria") or []),
                "footnote_count": len(fns),
                "formal_prompt_context_injected": b.get("formal_prompt_context_injected"),
                "retrieval_used": b.get("retrieval_used"),
                "C3_heurístico": c3h,
                "sample_criterion": (
                    (m.get("criteria") or [{}])[0].get("criterion") if m.get("criteria") else None
                ),
            }
        )

    out = {"cases": cases, "document_id": doc, "api_base": base}
    print(json.dumps(out, ensure_ascii=False, indent=2))
    if any(
        not (isinstance(c, dict) and c.get("ok") is True) for c in cases
    ):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
