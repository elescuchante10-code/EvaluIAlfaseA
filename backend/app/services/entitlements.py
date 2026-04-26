"""
Entitlements comerciales: quién puede ejecutar evaluación de documentos.
"""
from fastapi import HTTPException, status

from app.models.models import SubscriptionStatus, UserRole, User


# Estados que permiten consumir evaluación (sin pasarela de pago en esta fase).
EVALUATION_ALLOWED_STATUSES = frozenset(
    {
        SubscriptionStatus.TRIALING.value,
        SubscriptionStatus.ACTIVE.value,
    }
)


def assert_can_evaluate_document(user: User) -> None:
    """
    Bloquea evaluación si el usuario no tiene derecho comercial.
    Los administradores siempre pasan.
    """
    role = getattr(user, "role", None) or UserRole.USER.value
    if role == UserRole.ADMIN.value:
        return

    sub = getattr(user, "subscription", None)
    if sub is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "subscription_required",
                "message": "No hay suscripción asociada a la cuenta.",
            },
        )

    raw_status = getattr(sub, "status", None)
    st = str(raw_status or "").strip().lower()
    if st not in EVALUATION_ALLOWED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "subscription_inactive",
                "message": "La suscripción no permite evaluar documentos en este momento.",
                "status": str(getattr(sub, "status", "") or ""),
                "plan_code": str(getattr(sub, "plan_code", "") or ""),
            },
        )
