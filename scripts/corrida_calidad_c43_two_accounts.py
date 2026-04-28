#!/usr/bin/env python3
"""
C4.3 — Humo API: usuario A y B no comparten document_id en el pack.
Requiere dos cuentas distintas con documentos (idealmente ambas con ≥1 `ready`).

Uso:
  EVALUAI_QA_EMAIL / EVALUAI_QA_PASSWORD — usuario A
  EVALUAI_QA_EMAIL_B / EVALUAI_QA_PASSWORD_B — usuario B
  EVALUAI_API_BASE (opcional)

Salida: JSON con ids_a, ids_b, disjoint, ok.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


def _post_json(url: str, payload: dict) -> tuple[int, dict]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = resp.read().decode("utf-8")
        return resp.status, json.loads(body) if body else {}


def _get_json(url: str, token: str) -> tuple[int, dict]:
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = resp.read().decode("utf-8")
        return resp.status, json.loads(body) if body else {}


def _login(base: str, email: str, password: str) -> str:
    st, body = _post_json(f"{base}/api/auth/login/json", {"email": email, "password": password})
    if st != 200:
        raise RuntimeError(f"login HTTP {st} {body}")
    token = body.get("access_token") or body.get("token")
    if not token:
        raise RuntimeError("sin token")
    return str(token)


def _pack_ids(base: str, token: str) -> set[int]:
    st, pack = _get_json(f"{base}/api/documents/teacher-context/pack", token)
    if st != 200:
        raise RuntimeError(f"pack HTTP {st} {pack}")
    out: set[int] = set()
    for d in pack.get("documents") or []:
        did = d.get("document_id")
        if did is not None:
            out.add(int(did))
    return out


def main() -> int:
    base = os.environ.get("EVALUAI_API_BASE", "http://127.0.0.1:8000").rstrip("/")
    ea, pa = os.environ.get("EVALUAI_QA_EMAIL", "").strip(), os.environ.get("EVALUAI_QA_PASSWORD", "")
    eb, pb = os.environ.get("EVALUAI_QA_EMAIL_B", "").strip(), os.environ.get("EVALUAI_QA_PASSWORD_B", "")
    if not ea or not pa or not eb or not pb:
        print(
            "Definir EVALUAI_QA_EMAIL, EVALUAI_QA_PASSWORD y "
            "EVALUAI_QA_EMAIL_B, EVALUAI_QA_PASSWORD_B",
            file=sys.stderr,
        )
        return 2
    if ea.lower() == eb.lower():
        print("Las dos cuentas deben ser distintas (email diferente).", file=sys.stderr)
        return 2
    try:
        ta = _login(base, ea, pa)
        tb = _login(base, eb, pb)
        ids_a = _pack_ids(base, ta)
        ids_b = _pack_ids(base, tb)
    except (urllib.error.HTTPError, OSError, RuntimeError) as e:
        print(str(e), file=sys.stderr)
        return 1
    disjoint = ids_a.isdisjoint(ids_b)
    out = {
        "user_a_email": ea,
        "user_b_email": eb,
        "document_ids_a": sorted(ids_a),
        "document_ids_b": sorted(ids_b),
        "intersection": sorted(ids_a & ids_b),
        "disjoint": disjoint,
        "ok_c43": disjoint,
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0 if disjoint else 3


if __name__ == "__main__":
    raise SystemExit(main())
