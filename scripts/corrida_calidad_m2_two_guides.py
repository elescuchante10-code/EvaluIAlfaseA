#!/usr/bin/env python3
"""
Protocolo M2: dos documentos «ready» + pregunta que pide contrastar o sintetizar.

1) Comprueba GET /api/documents/teacher-context/pack (conteo ready).
2) Si hay <2 y NO se pasa M2_SKIP_UPLOAD=1, sube un .txt mínimo vía POST /api/documents/upload
   (mismo criterio de upload que en producción: texto no vacío).
3) Reintenta el pack; ejecuta chat asistente_ia pidiendo comparar/relacionar ambas guías.

Requiere: EVALUAI_QA_EMAIL, EVALUAI_QA_PASSWORD, EVALUAI_API_BASE, backend y GROQ.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Tuple


def _get_json(url: str, token: str) -> Tuple[int, Any]:
    req = urllib.request.Request(
        url, headers={"Authorization": f"Bearer {token}"}, method="GET"
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = resp.read().decode("utf-8")
        return resp.status, json.loads(body) if body else {}


def _post_json(url: str, payload: dict, token: str | None) -> Tuple[int, Any]:
    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=120) as resp:
        b = resp.read().decode("utf-8")
        return resp.status, json.loads(b) if b else {}


def _login(base: str, email: str, password: str) -> str:
    st, b = _post_json(
        f"{base.rstrip('/')}/api/auth/login/json", {"email": email, "password": password}, ""
    )
    if st != 200 or not isinstance(b, dict):
        raise RuntimeError(f"login {st} {b}")
    t = b.get("access_token") or b.get("token")
    if not t:
        raise RuntimeError("no token")
    return str(t)


def _ready_docs(pack: Any) -> List[Dict[str, Any]]:
    if not isinstance(pack, dict):
        return []
    out: List[Dict[str, Any]] = []
    for d in pack.get("documents") or []:
        if not isinstance(d, dict):
            continue
        if str(d.get("markdown_status") or "").lower() == "ready":
            out.append(d)
    return out


def _upload_txt_curl(base: str, token: str, text: str, filename: str) -> Dict[str, Any]:
    """Multipart upload con curl (robusto, sin depender de requests en el script)."""
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".txt", delete=False, encoding="utf-8"
    ) as f:
        f.write(text)
        path = f.name
    try:
        cmd = [
            "curl",
            "-s",
            "-S",
            "-w",
            "\n%{http_code}",
            "-X",
            "POST",
            f"{base.rstrip('/')}/api/documents/upload",
            "-H",
            f"Authorization: Bearer {token}",
            "-F",
            f"file=@{path};type=text/plain;filename={filename}",
        ]
        raw = subprocess.check_output(cmd, timeout=120, stderr=subprocess.STDOUT)
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        return {"ok": False, "error": str(e), "note": "curl requerido para subida M2"}
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass

    lines = raw.decode("utf-8", "replace").strip().splitlines()
    http = int(lines[-1]) if lines else 0
    body = "\n".join(lines[:-1]) if len(lines) > 1 else ""
    try:
        j = json.loads(body) if body else {}
    except json.JSONDecodeError:
        j = {"raw": body[:1500], "http": http}
    if http != 200:
        return {"ok": False, "http": http, "detail": j}
    return {"ok": True, "http": http, "data": j}


def _summary_from_pack(pack: dict) -> dict:
    docs = pack.get("documents") or []
    preview = [d.get("filename") for d in docs[:5] if isinstance(d, dict) and d.get("filename")]
    n = len(docs)
    ready = len(
        [d for d in docs if str((d or {}).get("markdown_status", "")).lower() == "ready"]
    )
    asig = (pack.get("asignatura_activa") or "") or ""
    asig2 = (pack.get("asignatura_activa") or "") or ""
    return {
        "schema_version": "1",
        "summary_kind": "teacher_context_summary",
        "asignatura_activa": asig2,
        "document_count": n,
        "filenames_preview": preview,
        "one_liner": f"Asignatura: «{asig2}». {n} documento(s); {ready} listo(s). (corrida M2)",
        "honest_note": "Índice local; sin embeddings. Manifiesto: /api/documents/teacher-context/manifest",
    }


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
        print(json.dumps({"ok": False, "login": str(e)}))
        return 1

    out: Dict[str, Any] = {"steps": []}

    _, pack0 = _get_json(f"{base}/api/documents/teacher-context/pack", token)
    r0 = _ready_docs(pack0)
    out["initial_ready"] = len(r0)

    skip = os.environ.get("M2_SKIP_UPLOAD", "").strip() in ("1", "true", "yes")
    if len(r0) < 2 and not skip:
        up = _upload_txt_curl(
            base,
            token,
            text=(
                "Guía reducida — Biología (material de prueba protocolo M2). "
                "Criterio: comparar estructura de la célula eucariota. "
                "Foco en compartimientos, membrana y orgánulos. Uso de diagramas. "
                "Fecha de entrega: según unidad. Evitar copia con la guía de otras asignaturas del mismo banco."
            ),
            filename="guia_biologia_protocolo_m2.txt",
        )
        out["upload_second_doc"] = up
        for _ in range(25):
            time.sleep(1.0)
            _, p1 = _get_json(f"{base}/api/documents/teacher-context/pack", token)
            r1 = _ready_docs(p1)
            if len(r1) >= 2:
                pack0 = p1
                break
        out["ready_after_upload"] = len(_ready_docs(pack0))
    else:
        out["upload_skipped"] = bool(skip) or len(r0) >= 2

    rfin = _ready_docs(pack0)
    fns = [d.get("filename", "") for d in rfin[:3]]
    if len(rfin) < 2:
        out["M2"] = {
            "ok": False,
            "ready_count": len(rfin),
            "message": "No hay 2 documentos ready; reintentar o subir manual.",
        }
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 1

    wire = dict(pack0) if isinstance(pack0, dict) else {}
    summary = _summary_from_pack(wire)

    q = (
        "Tengo al menos dos guías indexadas. En **una sola respuesta** de máximo 8 frases, "
        "dime: (1) en qué se **parecen** ambas a nivel de estructura de tarea, y (2) en qué **difieren** "
        "tema o enfoque según títulos o cuerpo que puedas alinear. Si no alcanza el contexto, dilo."
    )
    st, ch = _post_json(
        f"{base}/api/evaluate/chat",
        {
            "mensaje": q,
            "contexto": {
                "superficie": "asistente_ia",
                "teacher_context_pack": wire,
                "teacher_context_summary": summary,
            },
            "historial": [],
            "image": None,
        },
        token,
    )
    rtr = (ch or {}).get("teacher_context_retrieval", {}) or {}
    out["M2"] = {
        "ok": st == 200 and (ch or {}).get("success"),
        "http": st,
        "ready_filenames": fns,
        "snippets": len((rtr.get("snippets") or [])),
        "docs_read": rtr.get("documents_read"),
        "response_preview": re.sub(
            r"\s+", " ", str((ch or {}).get("respuesta", ""))[:800]
        ),
    }

    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0 if out["M2"].get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
