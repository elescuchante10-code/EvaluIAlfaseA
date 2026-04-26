"""Servicios de integración Wompi para links de pago y webhooks."""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.models import (
    BillingEvent,
    PendingPayment,
    Subscription,
    SubscriptionPlan,
    SubscriptionStatus,
    User,
)
from app.schemas.schemas import WompiCheckoutRequest
from app.services.credits import add_credits_purchase_wompi, credits_for_plan


class WompiServiceError(RuntimeError):
    """Error controlado de integración con Wompi."""


def resolve_wompi_api_base_url() -> str:
    """Retorna la URL base del API según entorno/configuración."""
    settings = get_settings()
    if settings.WOMPI_API_BASE_URL:
        return settings.WOMPI_API_BASE_URL.rstrip("/")
    environment = (settings.WOMPI_ENVIRONMENT or "sandbox").strip().lower()
    if environment in {"prod", "production", "live"}:
        return "https://production.wompi.co/v1"
    return "https://sandbox.wompi.co/v1"


def resolve_wompi_checkout_base_url() -> str:
    """Retorna la URL base pública del checkout."""
    settings = get_settings()
    return (settings.WOMPI_CHECKOUT_BASE_URL or "https://checkout.wompi.co/l").rstrip("/")


def normalize_plan_code(plan_code: str) -> str:
    """Normaliza el plan a un catálogo pequeño y estable."""
    normalized = (plan_code or "").strip().lower()
    if normalized not in {SubscriptionPlan.PRO.value, SubscriptionPlan.ENTERPRISE.value}:
        raise WompiServiceError("plan_code must be 'pro' or 'enterprise'")
    return normalized


def plan_default_amount_in_cents(plan_code: str) -> int:
    """Obtiene el monto por defecto del plan comercial."""
    settings = get_settings()
    normalized = normalize_plan_code(plan_code)
    if normalized == SubscriptionPlan.PRO.value:
        amount = int(settings.WOMPI_INDIVIDUAL_AMOUNT_CENTS)
    else:
        amount = int(settings.WOMPI_INSTITUTIONAL_AMOUNT_CENTS)
    if amount <= 0:
        raise WompiServiceError("Configured Wompi amount must be greater than zero")
    return amount


def build_checkout_reference(user_id: int, plan_code: str) -> str:
    """Genera una referencia corta, trazable y única desde backend."""
    normalized = normalize_plan_code(plan_code)
    suffix = uuid.uuid4().hex[:10].upper()
    return f"EVAI-{normalized[:3].upper()}-U{int(user_id)}-{suffix}"


def build_redirect_url(reference: str, requested_url: Optional[str] = None) -> str:
    """Construye la URL de retorno, priorizando la solicitada por el cliente."""
    settings = get_settings()
    if requested_url:
        return requested_url
    base = settings.FRONTEND_URL.rstrip("/")
    success_path = (settings.WOMPI_PAYMENT_SUCCESS_PATH or "/payment-success").lstrip("/")
    return f"{base}/{success_path}?reference={reference}"


def build_payment_description(plan_code: str) -> str:
    """Describe el cobro de forma corta y clara."""
    normalized = normalize_plan_code(plan_code)
    return f"Suscripción EvaluAI {normalized.title()}"


def _http_json(
    method: str,
    url: str,
    payload: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """Realiza una petición JSON al API de Wompi sin dependencia externa."""
    settings = get_settings()
    merged_headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if headers:
        merged_headers.update(headers)

    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")

    request = Request(url, data=data, headers=merged_headers, method=method.upper())
    try:
        with urlopen(request, timeout=settings.WOMPI_TIMEOUT_SECONDS) as response:
            raw = response.read().decode("utf-8").strip()
            return json.loads(raw) if raw else {}
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore") if exc.fp else ""
        raise WompiServiceError(
            f"Wompi API error ({exc.code}) while calling {url}: {body or exc.reason}"
        ) from exc
    except URLError as exc:
        raise WompiServiceError(f"Wompi API connection error while calling {url}: {exc.reason}") from exc


def create_wompi_payment_link(
    *,
    reference: str,
    plan_code: str,
    amount_in_cents: int,
    redirect_url: str,
    expires_at: datetime,
    single_use: bool,
) -> Dict[str, Any]:
    """Crea el link de pago en Wompi y devuelve el payload normalizado."""
    settings = get_settings()
    private_key = (settings.WOMPI_PRIVATE_KEY or "").strip()
    if not private_key:
        raise WompiServiceError("WOMPI_PRIVATE_KEY is required to create payment links")

    api_base = resolve_wompi_api_base_url()
    url = f"{api_base}/payment_links"
    payload = {
        "name": f"EvaluAI - {normalize_plan_code(plan_code).title()}",
        "description": build_payment_description(plan_code),
        "single_use": bool(single_use),
        "collect_shipping": False,
        "currency": "COP",
        "amount_in_cents": int(amount_in_cents),
        "redirect_url": redirect_url,
        "expires_at": expires_at.astimezone(timezone.utc).replace(tzinfo=None, microsecond=0).isoformat(),
        "sku": reference[:36],
    }
    response = _http_json(
        "POST",
        url,
        payload=payload,
        headers={"Authorization": f"Bearer {private_key}"},
    )
    data = response.get("data") or response
    payment_link_id = data.get("id") or data.get("payment_link_id")
    if not payment_link_id:
        raise WompiServiceError("Wompi did not return a payment link id")
    checkout_url = f"{resolve_wompi_checkout_base_url()}/{payment_link_id}"
    return {
        "payment_link_id": payment_link_id,
        "checkout_url": checkout_url,
        "raw": response,
    }


def _extract_nested_value(payload: Dict[str, Any], path: str) -> Optional[Any]:
    current: Any = payload
    for part in path.split("."):
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


def compute_event_checksum(payload: Dict[str, Any], secret: str) -> str:
    """Calcula el checksum esperado según el contrato Wompi."""
    signature = payload.get("signature") or {}
    properties = signature.get("properties") or []
    values: list[str] = []
    for path in properties:
        value = _extract_nested_value(payload, path)
        values.append("" if value is None else str(value))
    timestamp = payload.get("timestamp")
    if timestamp is None:
        timestamp = ""
    values.append(str(timestamp))
    values.append(secret)
    concatenated = "".join(values)
    return hashlib.sha256(concatenated.encode("utf-8")).hexdigest()


def validate_wompi_event_signature(
    payload: Dict[str, Any],
    headers: Optional[Dict[str, str]] = None,
) -> bool:
    """Valida la firma del evento con el secreto configurado."""
    settings = get_settings()
    if settings.WOMPI_SKIP_SIGNATURE_VALIDATION:
        return True
    secret = (settings.WOMPI_EVENT_SECRET or "").strip()
    if not secret:
        raise WompiServiceError("WOMPI_EVENT_SECRET is required to validate webhook events")

    checksum_expected = compute_event_checksum(payload, secret)
    signature = payload.get("signature") or {}
    body_checksum = str(signature.get("checksum") or "").strip().lower()
    header_checksum = ""
    if headers:
        lowered_headers = {str(key).lower(): value for key, value in dict(headers).items()}
        for key in ("x-event-checksum", "event-checksum", "x_checksum"):
            if key in lowered_headers:
                header_checksum = str(lowered_headers.get(key) or "").strip().lower()
                break

    expected = checksum_expected.lower()
    if header_checksum and header_checksum == expected:
        return True
    if body_checksum and body_checksum == expected:
        return True
    return False


def _ensure_subscription(db: Session, user: User) -> Subscription:
    subscription = user.subscription
    if subscription is not None:
        return subscription
    subscription = Subscription(
        user_id=user.id,
        plan_code=SubscriptionPlan.FREE.value,
        status=SubscriptionStatus.ACTIVE.value,
    )
    db.add(subscription)
    db.flush()
    return subscription


def _activate_subscription_from_payment(db: Session, payment: PendingPayment, transaction: Dict[str, Any]) -> None:
    user = payment.user
    if user is None:
        user = db.query(User).filter(User.id == payment.user_id).first()
    if user is None:
        raise WompiServiceError("Pending payment is not linked to a valid user")

    subscription = _ensure_subscription(db, user)
    subscription.plan_code = payment.plan_code
    subscription.status = SubscriptionStatus.ACTIVE.value
    subscription.current_period_start = datetime.now(timezone.utc)
    subscription.current_period_end = subscription.current_period_start + timedelta(days=30)

    payment.status = "approved"
    payment.wompi_transaction_id = str(
        transaction.get("id")
        or transaction.get("transaction_id")
        or payment.wompi_transaction_id
        or ""
    )
    if transaction.get("payment_link_id"):
        payment.wompi_payment_link_id = str(transaction["payment_link_id"])


def _mark_payment_inactive(payment: PendingPayment, transaction: Dict[str, Any]) -> None:
    status = str(transaction.get("status") or "").strip().lower()
    if status in {"approved", "successful"}:
        payment.status = "approved"
    elif status in {"declined", "rejected", "failed"}:
        payment.status = "declined"
    elif status in {"expired"}:
        payment.status = "expired"
    else:
        payment.status = status or "received"
    if transaction.get("id"):
        payment.wompi_transaction_id = str(transaction["id"])
    if transaction.get("payment_link_id"):
        payment.wompi_payment_link_id = str(transaction["payment_link_id"])


def create_payment_link_for_user(
    db: Session,
    user: User,
    request: WompiCheckoutRequest,
) -> Dict[str, Any]:
    """Crea la referencia backend, persiste el pending payment y llama a Wompi."""
    plan_code = normalize_plan_code(request.plan_code)
    amount_in_cents = int(request.amount_in_cents or 0) or plan_default_amount_in_cents(plan_code)
    if amount_in_cents <= 0:
        raise WompiServiceError("amount_in_cents must be greater than zero")

    reference = build_checkout_reference(user.id, plan_code)
    redirect_url = build_redirect_url(reference, request.redirect_url)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=int(request.expires_in_minutes))

    pending = PendingPayment(
        user_id=user.id,
        plan_code=plan_code,
        reference=reference,
        provider="wompi",
        status="creating",
        amount_in_cents=amount_in_cents,
        currency="COP",
        redirect_url=redirect_url,
        expires_at=expires_at,
    )
    db.add(pending)
    db.flush()

    link_result = create_wompi_payment_link(
        reference=reference,
        plan_code=plan_code,
        amount_in_cents=amount_in_cents,
        redirect_url=redirect_url,
        expires_at=expires_at,
        single_use=request.single_use,
    )
    pending.status = "created"
    pending.checkout_url = link_result["checkout_url"]
    pending.wompi_payment_link_id = link_result["payment_link_id"]
    db.commit()
    db.refresh(pending)

    return {
        "pending_payment": pending,
        "checkout_url": pending.checkout_url,
        "payment_link_id": pending.wompi_payment_link_id,
    }


def get_payment_status_payload(pending: PendingPayment) -> Dict[str, Any]:
    """Serializa un pending payment para polling del frontend."""
    return {
        "success": True,
        "provider": pending.provider,
        "plan_code": pending.plan_code,
        "reference": pending.reference,
        "checkout_url": pending.checkout_url,
        "payment_link_id": pending.wompi_payment_link_id,
        "transaction_id": pending.wompi_transaction_id,
        "amount_in_cents": pending.amount_in_cents,
        "currency": pending.currency,
        "status": pending.status,
        "expires_at": pending.expires_at,
    }


def process_wompi_event(
    db: Session,
    payload: Dict[str, Any],
    headers: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """Procesa un evento Wompi, con validación y deduplicación."""
    if not validate_wompi_event_signature(payload, headers=headers):
        raise WompiServiceError("Invalid Wompi event checksum")

    event_name = str(payload.get("event") or "unknown").strip()
    signature = payload.get("signature") or {}
    lowered_headers = {str(key).lower(): value for key, value in dict(headers or {}).items()}
    event_key = (
        str(signature.get("checksum") or "").strip()
        or str(lowered_headers.get("x-event-checksum") or "").strip()
        or f"{event_name}:{payload.get('timestamp')}"
    )
    existing = db.query(BillingEvent).filter(BillingEvent.event_key == event_key).first()
    if existing is not None:
        return {
            "success": True,
            "processed": False,
            "event": event_name,
            "status": existing.status or "duplicate",
            "reference": existing.reference,
            "transaction_id": existing.transaction_id,
        }

    transaction = ((payload.get("data") or {}).get("transaction") or {})
    reference = str(transaction.get("reference") or transaction.get("sku") or "").strip() or None
    payment_link_id = transaction.get("payment_link_id")
    transaction_id = transaction.get("id")

    payment = None
    if reference:
        payment = db.query(PendingPayment).filter(PendingPayment.reference == reference).first()
    if payment is None and payment_link_id:
        payment = db.query(PendingPayment).filter(PendingPayment.wompi_payment_link_id == str(payment_link_id)).first()
    if payment is None and transaction_id:
        payment = db.query(PendingPayment).filter(PendingPayment.wompi_transaction_id == str(transaction_id)).first()

    if payment is None:
        event_record = BillingEvent(
            event_key=event_key,
            event_type=event_name,
            provider="wompi",
            reference=reference,
            transaction_id=str(transaction_id) if transaction_id else None,
            status=str(transaction.get("status") or "").strip(),
            checksum=str(signature.get("checksum") or "").strip() or None,
            payload_json=json.dumps(payload, ensure_ascii=False),
        )
        db.add(event_record)
        db.commit()
        return {
            "success": True,
            "processed": False,
            "event": event_name,
            "status": "ignored",
            "reference": reference,
            "transaction_id": str(transaction_id) if transaction_id else None,
        }

    _mark_payment_inactive(payment, transaction)
    tx_status = str(transaction.get("status") or "").strip().upper()
    if tx_status == "APPROVED":
        _activate_subscription_from_payment(db, payment, transaction)
        # Acreditación de créditos (solo plan individual PRO). Idempotencia por tx_id o event_key.
        if credits_for_plan(payment.plan_code) > 0 and payment.user_id:
            add_credits_purchase_wompi(
                db=db,
                user_id=payment.user_id,
                plan_code=payment.plan_code,
                amount_in_cents=payment.amount_in_cents,
                reference=payment.reference,
                transaction_id=payment.wompi_transaction_id,
                event_key=event_key,
            )

    event_record = BillingEvent(
        event_key=event_key,
        event_type=event_name,
        provider="wompi",
        user_id=payment.user_id,
        pending_payment_id=payment.id,
        reference=payment.reference,
        transaction_id=payment.wompi_transaction_id,
        status=payment.status,
        checksum=str(signature.get("checksum") or "").strip() or None,
        payload_json=json.dumps(payload, ensure_ascii=False),
        processed_at=datetime.now(timezone.utc),
    )
    db.add(event_record)
    db.commit()

    return {
        "success": True,
        "processed": True,
        "event": event_name,
        "status": payment.status,
        "reference": payment.reference,
        "transaction_id": payment.wompi_transaction_id,
    }
