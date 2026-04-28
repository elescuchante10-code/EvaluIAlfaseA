#!/usr/bin/env python3
"""
Corrida de calidad Fase A: llamadas a /api/evaluate/chat (M1, intro, F1, F2, F3).
Uso: export EVALUAI_QA_EMAIL y EVALUAI_QA_PASSWORD (cuenta con doc ready + créditos), luego
     python3 scripts/corrida_calidad_fase_a_api.py
API base: EVALUAI_API_BASE (default http://127.0.0.1:8000)
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


def _post_json(url: str, payload: dict, token: str | None = None) -> tuple[int, dict]:
    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=120) as resp:
        body = resp.read().decode("utf-8")
        return resp.status, json.loads(body) if body else {}


def _get_json(url: str, token: str) -> tuple[int, dict]:
    req = urllib.request.Request(
        url, headers={"Authorization": f"Bearer {token}"}, method="GET"
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = resp.read().decode("utf-8")
        return resp.status, json.loads(body) if body else {}


def build_summary_from_pack(pack: dict) -> dict:
    docs = pack.get("documents") or []
    preview = [d.get("filename") for d in docs[:5] if d.get("filename")]
    n = len(docs)
    ready = len([d for d in docs if d.get("markdown_status") == "ready"])
    asig = (pack.get("asignatura_activa") or "") or ""
    one_liner = (
        f"Asignatura activa: «{asig}». {n} documento(s) en Mi Espacio IB; {ready} con Markdown contextual listo. "
        "El chat puede recuperar fragmentos reales de esos .md en el backend (coincidencia simple, auditable)."
        if asig
        else "No hay asignatura activa en Mi Espacio IB; el contexto docente adicional está vacío."
    )
    return {
        "schema_version": "1",
        "summary_kind": "teacher_context_summary",
        "asignatura_activa": asig,
        "document_count": n,
        "filenames_preview": preview,
        "one_liner": one_liner,
        "honest_note": "Índice local + manifiesto/estado Markdown por document_id. Sin embeddings ni vector DB.",
    }


def main() -> int:
    base = os.environ.get("EVALUAI_API_BASE", "http://127.0.0.1:8000").rstrip("/")
    email = os.environ.get("EVALUAI_QA_EMAIL", "").strip()
    password = os.environ.get("EVALUAI_QA_PASSWORD", "")
    if not email or not password:
        print("Definir EVALUAI_QA_EMAIL y EVALUAI_QA_PASSWORD", file=sys.stderr)
        return 2

    try:
        _, login_body = _post_json(
            f"{base}/api/auth/login/json",
            {"email": email, "password": password},
        )
    except urllib.error.HTTPError as e:
        print("login HTTP", e.code, e.read().decode("utf-8", "replace")[:500], file=sys.stderr)
        return 1
    except Exception as e:
        print("login error:", e, file=sys.stderr)
        return 1

    token = login_body.get("access_token") or login_body.get("token")
    if not token:
        print("sin token en respuesta de login", file=sys.stderr)
        return 1

    me_status, me = _get_json(f"{base}/api/auth/me", token)
    if me_status != 200:
        print("me failed", me_status, file=sys.stderr)
        return 1

    try:
        _, pack = _get_json(f"{base}/api/documents/teacher-context/pack", token)
    except urllib.error.HTTPError as e:
        print("pack HTTP", e.code, e.read().decode()[:500], file=sys.stderr)
        return 1

    wire_pack = dict(pack)
    summary = build_summary_from_pack(pack)
    first_doc = next(
        (d for d in (pack.get("documents") or []) if d.get("markdown_status") == "ready"),
        None,
    )
    doc_id = int(first_doc["document_id"]) if first_doc and first_doc.get("document_id") is not None else None
    filename = (first_doc or {}).get("filename") or "documento"

    def chat(mensaje: str, contexto: dict) -> dict:
        payload = {
            "mensaje": mensaje,
            "contexto": contexto,
            "historial": [],
            "image": None,
        }
        try:
            st, body = _post_json(f"{base}/api/evaluate/chat", payload, token=token)
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", "replace")
            return {
                "http_error": e.code,
                "detail": err[:2000],
                "success": False,
            }
        return {**body, "http_status": st}

    cases: list[dict] = []

    # M1 — pregunta que exige material (estímulo / Neuralink)
    ctx_m1 = {
        "superficie": "asistente_ia",
        "teacher_context_pack": wire_pack,
        "teacher_context_summary": summary,
    }
    r_m1 = chat(
        "Según mi guía subida: ¿qué estímulo o caso concreto se presenta al inicio y qué riesgo ético enlaza con ese estímulo? Responde en máximo 6 frases.",
        ctx_m1,
    )
    cases.append({"id": "M1", "result": r_m1})

    # M1b — intención introducción/estímulo (Fase A retrieval)
    r_intro = chat(
        "¿Qué dice la introducción sobre el estímulo elegido y el chip Telepathy? Sé breve.",
        ctx_m1,
    )
    cases.append({"id": "M1_intro", "result": r_intro})

    # F1 — copiloto contextual, mejora de párrafo sin nota
    short_para = (
        "La autonomía se debilita cuando el cuerpo depende de un dispositivo invasivo "
        "sin políticas claras de reversibilidad."
    )
    ctx_f1 = {
        "superficie": "chat_contextual",
        "rubrica_activa": "ensayo NM (demo corrida)",
        "rubrica_activa_markdown": "# Criterio A\n- Argumentación: …\n# Criterio B\n- Uso de fuentes: …\n",
        "asignatura_activa": "Filosofía",
        "documento_activo": filename,
        "document_id": doc_id,
        "document_type": "text",
        "teacher_context_pack": wire_pack,
        "teacher_context_summary": summary,
    }
    r_f1 = chat(
        f"Sin asignar nota: sugiere cómo endurecer o clarificar este párrafo del ensayo, en 5 viñetas.\n\nPÁRRAFO:\n{short_para}\n",
        ctx_f1,
    )
    cases.append({"id": "F1", "result": r_f1})

    # F2 — mismo flujo: pedir criterio de rúbrica que aplica (MODELO F2)
    r_f2 = chat(
        "Con la rúbrica activa en el contexto: ¿qué criterio aplica con más fuerza a este "
        "párrafo? Menciona el nombre del criterio (A o B) y explica en máximo 4 frases, "
        "sin nota numérica.\n\nPÁRRAFO:\n"
        f"{short_para}\n",
        ctx_f1,
    )
    cases.append({"id": "F2", "result": r_f2})

    # F3 — sección media/final (Hardt/Negri, no introducción)
    r_f3 = chat(
        "En el mismo documento, ¿cómo describen Hardt y Negri el 'Imperio' en relación con el control biopolítico? "
        "No repitas toda la introducción; céntrate en lo que aporta el cuerpo central del texto.",
        ctx_f1,
    )
    cases.append({"id": "F3", "result": r_f3})

    out = {
        "user_id": me.get("id"),
        "credits": me.get("credits"),
        "pack_documents": len(pack.get("documents") or []),
        "cases": cases,
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
