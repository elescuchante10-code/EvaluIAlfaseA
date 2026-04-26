from __future__ import annotations

import json
import uuid
from typing import Any, Dict, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, noload

from app.models.models import CreditLedgerEvent, User


INSUFFICIENT_CREDITS_DETAIL = {
    "code": "insufficient_credits",
    "message": (
        "Has agotado tus créditos. Por favor, recarga tu cuenta o contacta al administrador "
        "de tu colegio para continuar."
    ),
}

def _is_admin(user: User) -> bool:
    return str(getattr(user, "role", "") or "").strip().lower() == "admin"


def get_action_cost(action: str, has_image: bool = False, surface: Optional[str] = None) -> int:
    normalized_action = str(action or "").strip()
    if normalized_action == "Evaluate_Full_Doc_Text":
        return 5
    if normalized_action == "Evaluate_Full_Doc_OCR_Vision":
        return 10
    if normalized_action == "Chat_Copilot_Text":
        return 1
    if normalized_action == "Chat_Copilot_Image":
        return 2
    if normalized_action == "Chat_Assistant_RAG":
        return 2 if has_image else 1
    raise ValueError(f"Unknown credits action: {action}")


def credits_for_plan(plan_code: str) -> int:
    normalized = str(plan_code or "").strip().lower()
    if normalized == "pro":
        return 500
    return 0



def assert_has_credits(user: User, cost: int) -> None:
    # Admin: acceso total sin consumo de créditos.
    if _is_admin(user):
        return
    balance = int(getattr(user, "credits_balance", 0) or 0)
    if balance < int(cost or 0):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=INSUFFICIENT_CREDITS_DETAIL)


def ensure_request_id(request_id: Optional[str]) -> str:
    rid = str(request_id or "").strip()
    return rid if rid else str(uuid.uuid4())


def deduct_credits_after_success(
    *,
    db: Session,
    user_id: int,
    action: str,
    surface: str,
    cost: int,
    request_id: str,
    doc_id: Optional[int] = None,
    tokens_used: Optional[int] = None,
    provider_cost_usd: Optional[float] = None,
    meta: Optional[Dict[str, Any]] = None,
) -> CreditLedgerEvent:
    """
    Deducción post-éxito + ledger atómico.

    - No descuenta si el mismo request_id ya fue procesado (idempotencia).
    - Si el saldo no alcanza en el momento de deducir (carrera), devuelve 403 estándar.
    """
    request_id = ensure_request_id(request_id)
    action = str(action or "").strip()
    surface = str(surface or "").strip() or "unknown"

    existing = db.query(CreditLedgerEvent).filter(CreditLedgerEvent.request_id == request_id).first()
    if existing is not None:
        return existing

    user = (
        db.query(User).options(noload(User.subscription))
        .filter(User.id == user_id)
        .with_for_update()
        .one()
    )

    before = int(user.credits_balance or 0)
    # Admin: registrar el evento pero no descontar saldo.
    if _is_admin(user):
        event = CreditLedgerEvent(
            user_id=user_id,
            action=action,
            surface=surface,
            credits_delta=0,
            credits_before=before,
            credits_after=before,
            doc_id=doc_id,
            request_id=request_id,
            tokens_used=tokens_used,
            provider_cost_usd=provider_cost_usd,
            meta_json=json.dumps({**(meta or {}), "admin_free": True}, ensure_ascii=False),
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return event
    delta = -int(cost or 0)
    after = before + delta
    if after < 0:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=INSUFFICIENT_CREDITS_DETAIL)

    user.credits_balance = after
    event = CreditLedgerEvent(
        user_id=user_id,
        action=action,
        surface=surface,
        credits_delta=delta,
        credits_before=before,
        credits_after=after,
        doc_id=doc_id,
        request_id=request_id,
        tokens_used=tokens_used,
        provider_cost_usd=provider_cost_usd,
        meta_json=json.dumps(meta or {}, ensure_ascii=False),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def add_credits_admin(
    *,
    db: Session,
    user_id: int,
    credits_delta: int,
    request_id: str,
    reason: str,
    meta: Optional[Dict[str, Any]] = None,
) -> CreditLedgerEvent:
    """
    Suma de créditos (top-up) + ledger atómico (idempotente por request_id).
    """
    request_id = ensure_request_id(request_id)
    delta = int(credits_delta or 0)
    if delta <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="credits_delta must be > 0")

    existing = db.query(CreditLedgerEvent).filter(CreditLedgerEvent.request_id == request_id).first()
    if existing is not None:
        return existing

    user = (
        db.query(User).options(noload(User.subscription))
        .filter(User.id == user_id)
        .with_for_update()
        .one()
    )

    before = int(user.credits_balance or 0)
    after = before + delta
    user.credits_balance = after
    payload = dict(meta or {})
    payload["reason"] = str(reason or "").strip()

    event = CreditLedgerEvent(
        user_id=user_id,
        action="Admin_TopUp",
        surface="admin_topup",
        credits_delta=delta,
        credits_before=before,
        credits_after=after,
        doc_id=None,
        request_id=request_id,
        tokens_used=None,
        provider_cost_usd=None,
        meta_json=json.dumps(payload, ensure_ascii=False),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def add_credits_purchase_wompi(
    *,
    db: Session,
    user_id: int,
    plan_code: str,
    amount_in_cents: Optional[int],
    reference: Optional[str],
    transaction_id: Optional[str],
    event_key: str,
) -> CreditLedgerEvent:
    """
    Acredita créditos por compra (Wompi). Idempotente por request_id.
    """
    credits_delta = credits_for_plan(plan_code)
    if credits_delta <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported plan for credit purchase")

    request_id = str(transaction_id or "").strip()
    if request_id:
        request_id = f"wompi:tx:{request_id}"
    else:
        request_id = f"wompi:event:{ensure_request_id(event_key)}"

    existing = db.query(CreditLedgerEvent).filter(CreditLedgerEvent.request_id == request_id).first()
    if existing is not None:
        return existing

    user = (
        db.query(User).options(noload(User.subscription))
        .filter(User.id == user_id)
        .with_for_update()
        .one()
    )

    before = int(user.credits_balance or 0)
    after = before + int(credits_delta)
    user.credits_balance = after
    event = CreditLedgerEvent(
        user_id=user_id,
        action="Wompi_CreditPurchase",
        surface="wompi",
        credits_delta=int(credits_delta),
        credits_before=before,
        credits_after=after,
        doc_id=None,
        request_id=request_id,
        tokens_used=None,
        provider_cost_usd=None,
        meta_json=json.dumps(
            {
                "provider": "wompi",
                "reference": reference,
                "transaction_id": transaction_id,
                "event_key": event_key,
                "plan_code": str(plan_code or "").strip().lower(),
                "amount_in_cents": int(amount_in_cents) if amount_in_cents is not None else None,
            },
            ensure_ascii=False,
        ),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event

