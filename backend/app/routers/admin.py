from __future__ import annotations

import csv
import io
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.models import CreditLedgerEvent, Subscription, SubscriptionPlan, SubscriptionStatus, User
from app.schemas.schemas import (
    AdminCreateUserRequest,
    AdminLedgerEventResponse,
    AdminLedgerListResponse,
    AdminResetPasswordRequest,
    AdminSetActiveRequest,
    AdminTopUpRequest,
    AdminUserDetailResponse,
    AdminUserListResponse,
    AdminUserResponse,
)
from app.services.auth import require_admin_user
from app.services.credits import add_credits_admin, ensure_request_id

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    try:
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        return datetime.fromisoformat(raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid datetime. Use ISO format (YYYY-MM-DD or full ISO).")


def _user_to_admin_user(u: User) -> AdminUserResponse:
    return AdminUserResponse(
        id=u.id,
        email=u.email,
        full_name=u.full_name,
        is_active=bool(u.is_active),
        role=str(u.role or "user"),
        credits_balance=int(getattr(u, "credits_balance", 0) or 0),
        account_type=str(getattr(u, "account_type", "individual") or "individual"),
        institution_name=getattr(u, "institution_name", None),
        created_at=u.created_at,
    )


def _event_to_response(e: CreditLedgerEvent, email: Optional[str] = None) -> AdminLedgerEventResponse:
    meta = {}
    try:
        meta = json.loads(e.meta_json or "{}") if e.meta_json else {}
    except Exception:
        meta = {}
    return AdminLedgerEventResponse(
        id=e.id,
        created_at=e.created_at,
        user_id=e.user_id,
        email=email,
        action=e.action,
        surface=e.surface,
        credits_delta=e.credits_delta,
        credits_before=e.credits_before,
        credits_after=e.credits_after,
        doc_id=e.doc_id,
        request_id=e.request_id,
        tokens_used=e.tokens_used,
        provider_cost_usd=e.provider_cost_usd,
        meta=meta,
    )


@router.get("/users", response_model=AdminUserListResponse)
def list_users(
    query: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    q = db.query(User).order_by(User.created_at.desc())
    if query:
        like = f"%{str(query).strip().lower()}%"
        q = q.filter(User.email.ilike(like))
    users = q.limit(200).all()
    return {"success": True, "users": [_user_to_admin_user(u) for u in users]}


@router.get("/users/{user_id}", response_model=AdminUserDetailResponse)
def get_user_detail(
    user_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    events = (
        db.query(CreditLedgerEvent)
        .filter(CreditLedgerEvent.user_id == user_id)
        .order_by(CreditLedgerEvent.created_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "success": True,
        "user": _user_to_admin_user(user),
        "ledger_events": [_event_to_response(e, email=user.email) for e in events],
    }


@router.post("/users", response_model=AdminUserDetailResponse, status_code=status.HTTP_201_CREATED)
def create_user_admin(
    payload: AdminCreateUserRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    logger = logging.getLogger(__name__)
    try:
        email = str(payload.email).strip().lower()
        if db.query(User).filter(User.email == email).first() is not None:
            raise HTTPException(status_code=400, detail="Email already registered")

        user = User(
            email=email,
            hashed_password=get_password_hash(payload.password),
            full_name=payload.full_name,
            is_active=1,
            role="user",
            credits_balance=0,
            account_type=payload.account_type,
            institution_name=payload.institution_name,
        )
        db.add(user)
        db.flush()
        db.add(
            Subscription(
                user_id=user.id,
                plan_code=SubscriptionPlan.FREE.value,
                status=SubscriptionStatus.ACTIVE.value,
            )
        )
        db.commit()
        db.refresh(user)

        credits_initial = int(payload.credits_initial or 0)
        if credits_initial > 0:
            request_id = ensure_request_id(
                payload.request_id
                or http_request.headers.get("X-Request-Id")
                or http_request.headers.get("X-Idempotency-Key")
            )
            add_credits_admin(
                db=db,
                user_id=user.id,
                credits_delta=credits_initial,
                request_id=f"{request_id}:initial",
                reason="initial_allocation",
                meta={"email": email},
            )
            db.refresh(user)

        events = (
            db.query(CreditLedgerEvent)
            .filter(CreditLedgerEvent.user_id == user.id)
            .order_by(CreditLedgerEvent.created_at.desc())
            .limit(50)
            .all()
        )
        return {
            "success": True,
            "user": _user_to_admin_user(user),
            "ledger_events": [_event_to_response(e, email=user.email) for e in events],
        }
    except Exception as e:
        logger.error(f"Error creating user admin: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/users/{user_id}/topup", response_model=AdminUserDetailResponse)
def topup_user(
    user_id: int,
    payload: AdminTopUpRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    logger = logging.getLogger(__name__)
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")

        request_id = ensure_request_id(
            payload.request_id
            or http_request.headers.get("X-Request-Id")
            or http_request.headers.get("X-Idempotency-Key")
        )
        add_credits_admin(
            db=db,
            user_id=user_id,
            credits_delta=payload.credits_delta,
            request_id=f"{request_id}:topup:{user_id}",
            reason=payload.reason,
            meta={"target_user_id": user_id},
        )
        db.refresh(user)

        events = (
            db.query(CreditLedgerEvent)
            .filter(CreditLedgerEvent.user_id == user_id)
            .order_by(CreditLedgerEvent.created_at.desc())
            .limit(50)
            .all()
        )
        return {
            "success": True,
            "user": _user_to_admin_user(user),
            "ledger_events": [_event_to_response(e, email=user.email) for e in events],
        }
    except Exception as e:
        logger.error(f"Error topping up user: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/users/{user_id}/reset-password")
def reset_password(
    user_id: int,
    payload: AdminResetPasswordRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        user.hashed_password = get_password_hash(payload.new_password)
        db.commit()
        return {"success": True}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/users/{user_id}/set-active")
def set_active(
    user_id: int,
    payload: AdminSetActiveRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        user.is_active = 1 if payload.is_active else 0
        db.commit()
        return {"success": True}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ledger", response_model=AdminLedgerListResponse)
def list_ledger(
    user_id: Optional[int] = None,
    from_: Optional[str] = Query(default=None, alias="from"),
    to: Optional[str] = Query(default=None, alias="to"),
    limit: int = Query(default=200, ge=1, le=2000),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    dt_from = _parse_dt(from_)
    dt_to = _parse_dt(to)
    q = db.query(CreditLedgerEvent, User.email).join(User, User.id == CreditLedgerEvent.user_id)
    if user_id is not None:
        q = q.filter(CreditLedgerEvent.user_id == user_id)
    if dt_from is not None:
        q = q.filter(CreditLedgerEvent.created_at >= dt_from)
    if dt_to is not None:
        q = q.filter(CreditLedgerEvent.created_at <= dt_to)
    rows = q.order_by(CreditLedgerEvent.created_at.desc()).limit(limit).all()
    events = [_event_to_response(e, email=email) for (e, email) in rows]
    return {"success": True, "events": events}


@router.get("/ledger/export.csv")
def export_ledger_csv(
    user_id: Optional[int] = None,
    from_: Optional[str] = Query(default=None, alias="from"),
    to: Optional[str] = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    logger = logging.getLogger(__name__)
    try:
        dt_from = _parse_dt(from_)
        dt_to = _parse_dt(to)
        q = db.query(CreditLedgerEvent, User.email).join(User, User.id == CreditLedgerEvent.user_id)
        if user_id is not None:
            q = q.filter(CreditLedgerEvent.user_id == user_id)
        if dt_from is not None:
            q = q.filter(CreditLedgerEvent.created_at >= dt_from)
        if dt_to is not None:
            q = q.filter(CreditLedgerEvent.created_at <= dt_to)
        rows = q.order_by(CreditLedgerEvent.created_at.desc()).limit(50_000).all()

        out = io.StringIO()
        writer = csv.writer(out)
        writer.writerow(
            [
                "created_at",
                "user_id",
                "email",
                "action",
                "surface",
                "credits_delta",
                "credits_before",
                "credits_after",
                "doc_id",
                "request_id",
                "tokens_used",
                "provider_cost_usd",
            ]
        )
        for (e, email) in rows:
            writer.writerow(
                [
                    e.created_at.isoformat() if e.created_at else "",
                    e.user_id,
                    email or "",
                    e.action,
                    e.surface,
                    e.credits_delta,
                    e.credits_before,
                    e.credits_after,
                    e.doc_id or "",
                    e.request_id,
                    e.tokens_used or "",
                    e.provider_cost_usd or "",
                ]
            )

        csv_text = out.getvalue()
        filename = "ledger_export.csv" if user_id is None else f"ledger_user_{user_id}.csv"
        return Response(
            content=csv_text,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except Exception as e:
        logger.error(f"Error exporting ledger CSV: {e}", exc_info=True)
        # Propagar error real si es HTTPException, de lo contrario 500 con detalle
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500,
            detail={
                "code": "export_error",
                "message": "Error al exportar los datos a CSV.",
                "error": str(e),
            },
        )

