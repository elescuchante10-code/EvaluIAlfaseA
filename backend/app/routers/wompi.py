"""Rutas de billing Wompi para EvaluAI."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import PendingPayment, User
from app.schemas.schemas import (
    WompiCheckoutRequest,
    WompiCheckoutResponse,
    WompiPaymentStatusResponse,
    WompiWebhookAck,
)
from app.services.auth import get_current_active_user
from app.services.wompi_service import (
    WompiServiceError,
    create_payment_link_for_user,
    get_payment_status_payload,
    process_wompi_event,
)


router = APIRouter(prefix="/api/billing/wompi", tags=["billing", "wompi"])


@router.post("/payment-links", response_model=WompiCheckoutResponse)
def create_payment_link(
    payload: WompiCheckoutRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Crea un link de pago Wompi asociado al usuario autenticado."""
    try:
        result = create_payment_link_for_user(db=db, user=current_user, request=payload)
    except WompiServiceError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    pending: PendingPayment = result["pending_payment"]
    return {
        "success": True,
        "provider": pending.provider,
        "plan_code": pending.plan_code,
        "reference": pending.reference,
        "checkout_url": result["checkout_url"],
        "payment_link_id": result["payment_link_id"],
        "amount_in_cents": pending.amount_in_cents,
        "currency": pending.currency,
        "status": pending.status,
        "expires_at": pending.expires_at,
    }


@router.get("/payments/{reference}", response_model=WompiPaymentStatusResponse)
def get_payment_status(
    reference: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Retorna el estado de un pending payment para polling post-redirect."""
    pending = (
        db.query(PendingPayment)
        .filter(PendingPayment.reference == reference, PendingPayment.user_id == current_user.id)
        .first()
    )
    if pending is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment reference not found")
    return get_payment_status_payload(pending)


@router.post("/webhook", response_model=WompiWebhookAck)
async def wompi_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """Webhook firmado de Wompi."""
    try:
        payload = await request.json()
    except Exception as exc:  # pragma: no cover - parse error path
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload") from exc

    try:
        ack = process_wompi_event(db=db, payload=payload, headers=dict(request.headers))
    except WompiServiceError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return ack
