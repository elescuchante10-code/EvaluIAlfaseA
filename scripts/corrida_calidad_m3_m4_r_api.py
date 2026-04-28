#!/usr/bin/env python3
"""
Casos de protocolo M3, M4 (chat) y R1, R2 (auth/créditos) vía API.
M2 requiere 2 documentos «ready» en Mi Espacio: si el pack solo tiene 1, se reporta como omitido.

Env: EVALUAI_QA_EMAIL, EVALUAI_QA_PASSWORD, EVALUAI_API_BASE (default http://127.0.0.1:8000)
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any, Dict, Tuple


def _post_json(url: str, payload: dict, token: str | None = None) -> Tuple[int, Any]:
    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=120) as resp:
        body = resp.read().decode("utf-8")
        return resp.status, json.loads(body) if body else {}


def _get_json(url: str, token: str) -> Tuple[int, Any]:
    req = urllib.request.Request(
        url, headers={"Authorization": f"Bearer {token}"}, method="GET"
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = resp.read().decode("utf-8")
        return resp.status, json.loads(body) if body else {}


def _chat(
    base: str, token: str, mensaje: str, contexto: Dict[str, Any]
) -> Tuple[int, Any]:
    st, body = _post_json(
        f"{base.rstrip('/')}/api/evaluate/chat",
        {"mensaje": mensaje, "contexto": contexto, "historial": [], "image": None},
        token,
    )
    return st, body


def main() -> int:
    base = os.environ.get("EVALUAI_API_BASE", "http://127.0.0.1:8000").rstrip("/")
    email = os.environ.get("EVALUAI_QA_EMAIL", "").strip()
    password = os.environ.get("EVALUAI_QA_PASSWORD", "")
    if not email or not password:
        print("Definir EVALUAI_QA_EMAIL y EVALUAI_QA_PASSWORD", file=sys.stderr)
        return 2

    out: Dict[str, Any] = {"R": {}, "M": {}}

    # R1: login + me; segundo login
    st, login1 = _post_json(
        f"{base}/api/auth/login/json", {"email": email, "password": password}
    )
    t1 = (login1 or {}).get("access_token") or (login1 or {}).get("token")
    if st != 200 or not t1:
        out["R"]["R1"] = {"ok": False, "http": st, "detail": "login"}
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 1

    m1, me1 = _get_json(f"{base}/api/auth/me", t1)
    st2, login2 = _post_json(
        f"{base}/api/auth/login/json", {"email": email, "password": password}
    )
    t2 = (login2 or {}).get("access_token") or (login2 or {}).get("token")
    m2, me2 = _get_json(f"{base}/api/auth/me", t2) if t2 else (0, {})
    out["R"]["R1"] = {
        "ok": m1 == 200 and m2 == 200 and st2 == 200 and bool(t2),
        "me_user_ids_match": (me1.get("id") if isinstance(me1, dict) else None)
        == (me2.get("id") if isinstance(me2, dict) else None),
    }

    # R2: créditos / saldo (campo varía; documentar el que venga)
    u = me2 if isinstance(me2, dict) else {}
    out["R"]["R2"] = {
        "ok": m2 == 200,
        "me_status": m2,
        "balance_fields": {
            k: u.get(k)
            for k in ("credits", "credits_balance", "credit_balance")
            if u.get(k) is not None
        },
    }

    # Pack servidor para M2
    p_st, pack = _get_json(f"{base}/api/documents/teacher-context/pack", t2)
    if p_st == 200 and isinstance(pack, dict):
        rdocs = [
            d
            for d in (pack.get("documents") or [])
            if str(d.get("markdown_status", "")).lower() == "ready"
        ]
        out["M"]["M2"] = {
            "ready_count": len(rdocs),
            "ok_if_two_docs": len(rdocs) >= 2,
            "note": "M2 requiere pregunta que combine 2 guías: ejecutar con 2+ ready o manual.",
        }
    else:
        out["M"]["M2"] = {"ok": False, "http": p_st}

    # M3: pack vacío (cero documentos) — honestidad / sin forzar Mi Espacio
    ctx_m3 = {
        "superficie": "asistente_ia",
        "teacher_context_pack": {
            "pack_kind": "teacher_context_pack",
            "asignatura_activa": "",
            "documents": [],
        },
        "teacher_context_summary": {
            "summary_kind": "teacher_context_summary",
            "asignatura_activa": "",
            "document_count": 0,
            "one_liner": "Sin documentos en Mi Espacio para esta comprobación.",
        },
    }
    st, body = _chat(
        base,
        t2,
        "Según lo que tengas de mi asignatura en Mi Espacio IB, ¿qué criterio de la guía aplica a la tesis?",
        ctx_m3,
    )
    ok_m3 = st == 200 and (body or {}).get("success") and (
        (body or {}).get("respuesta")
        and len(str((body or {}).get("respuesta", "")).strip()) > 20
    )
    r3 = (body or {}).get("teacher_context_retrieval", {}) or {}
    out["M"]["M3"] = {
        "ok": bool(ok_m3 and st == 200),
        "http": st,
        "retrieval_empty_expected": (r3.get("documents_read", 0) in (0, None)),
        "hint": "Debe ser honesto si no hay material (no inventar criterio de un doc inexistente).",
    }

    # M4: asignatura “equivocada” en contexto; material es de otra (filosofía en pack real si hay doc)
    _, pack_full = _get_json(f"{base}/api/documents/teacher-context/pack", t2)
    pdocs = (pack_full or {}).get("documents") or []
    if pdocs and any(
        str(d.get("markdown_status", "")).lower() == "ready" for d in pdocs
    ):
        wire = dict(pack_full) if isinstance(pack_full, dict) else {}
        fn = next(
            (
                d.get("filename", "")
                for d in pdocs
                if str(d.get("markdown_status", "")).lower() == "ready"
            ),
            "",
        )
        ctx_m4 = {
            "superficie": "asistente_ia",
            "asignatura_activa": "Química orgánica (activa en UI, disonante)",
            "teacher_context_pack": {
                "pack_kind": "teacher_context_pack",
                "asignatura_activa": "Química orgánica (activa en UI, disonante)",
                "documents": pdocs,
            },
            "teacher_context_summary": {
                "summary_kind": "teacher_context_summary",
                "asignatura_activa": "Química orgánica (activa en UI, disonante)",
                "document_count": len(pdocs),
                "one_liner": f"Archivo de otro contexto, p. ej.: {fn[:60]}",
            },
        }
        st4, b4 = _chat(
            base,
            t2,
            "Nombra el experimento concreto que exige mi guía de Química orgánica para el IA lab.",
            ctx_m4,
        )
        r4 = (b4 or {}).get("teacher_context_retrieval", {}) or {}
        txt4 = str((b4 or {}).get("respuesta", "")).lower()
        honest = any(
            x in txt4
            for x in (
                "no",
                "filosof",
                "otra",
                "asignatur",
                "encuentr",
                "química",
                "descuadre",
            )
        )
        out["M"]["M4"] = {
            "ok": st4 == 200 and (b4 or {}).get("success"),
            "http": st4,
            "read_docs": r4.get("documents_read", 0),
            "coherence_check": "disonancia química vs filo — revisar respuesta manual; heurística honesta="
            + str(honest),
        }
    else:
        out["M"]["M4"] = {
            "ok": None,
            "skipped": "Sin documento ready en el pack; M4 omitido en este entorno.",
        }

    print(json.dumps(out, ensure_ascii=False, indent=2))
    r_ok = out.get("R", {}).get("R1", {}).get("ok") and out.get("R", {}).get("R2", {}).get("ok")
    if not r_ok:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
