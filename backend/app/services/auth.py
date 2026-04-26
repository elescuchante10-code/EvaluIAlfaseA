"""
Servicios de autenticación.
"""
from datetime import timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status, Request, Query
from fastapi.security import OAuth2PasswordBearer, HTTPBasic, HTTPBasicCredentials
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    decode_access_token
)
from app.core.config import get_settings
from app.models.models import (
    User,
    Subscription,
    UserRole,
    SubscriptionPlan,
    SubscriptionStatus,
)
from app.schemas.schemas import UserCreate, TokenData


# Configuración OAuth2
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)
security_basic = HTTPBasic(auto_error=False)


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Obtiene un usuario por su email."""
    return db.query(User).filter(User.email == email).first()


def get_user_by_email_ci(db: Session, email: str) -> Optional[User]:
    """Misma búsqueda, ignorando mayúsculas en el email (el login no debe fallar por eso)."""
    e = (email or "").strip().lower()
    if not e:
        return None
    return db.query(User).filter(func.lower(User.email) == e).first()


def create_user(db: Session, user: UserCreate) -> User:
    """Crea un nuevo usuario."""
    try:
        # Verificar si el email ya existe
        db_user = get_user_by_email(db, email=user.email)
        if db_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Crear usuario
        hashed_password = get_password_hash(user.password)
        full_name = user.get_full_name()
        
        print(f"[🔧 CREATE_USER] Creando usuario: email={user.email}, full_name={full_name}")
        
        db_user = User(
            email=user.email,
            hashed_password=hashed_password,
            full_name=full_name,
            is_active=1,
            role=UserRole.USER.value,
            credits_balance=0,
        )
        db.add(db_user)
        db.flush()
        db.add(
            Subscription(
                user_id=db_user.id,
                plan_code=SubscriptionPlan.FREE.value,
                status=SubscriptionStatus.ACTIVE.value,
            )
        )
        db.commit()
        db.refresh(db_user)
        
        print(f"[🔧 CREATE_USER] Usuario creado exitosamente: id={db_user.id}")
        return db_user
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[❌ CREATE_USER ERROR] Error al crear usuario: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error creating user: {str(e)}"
        )


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """
    Autentica un usuario verificando email y contraseña.
    Retorna el usuario si es válido, None si no.
    """
    user = get_user_by_email_ci(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def login_user(db: Session, email: str, password: str) -> dict:
    """
    Realiza el login de un usuario y retorna el token.
    """
    user = authenticate_user(db, email, password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    # Crear token
    access_token_expires = timedelta(minutes=60 * 24)  # 24 horas
    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    basic_creds: Optional[HTTPBasicCredentials] = Depends(security_basic),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependencia para obtener el usuario actual.
    Soporta:
    1. Bearer token (Cabecera Authorization)
    2. Token en URL (?token=...)
    3. Basic Auth (Para que funcionen los popups nativos del navegador)
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # 1. Intentar con TOKEN (JWT) - Cabecera o Query
    actual_token = token or request.query_params.get("token")
    if actual_token:
        payload = decode_access_token(actual_token)
        if payload:
            email: str = payload.get("sub")
            if email:
                user = get_user_by_email_ci(db, email=email)
                if user:
                    return user

    # 2. Intentar con BASIC AUTH (Email/Password en popup del navegador)
    if basic_creds:
        user = authenticate_user(db, basic_creds.username, basic_creds.password)
        if user:
            # Login exitoso via Basic Auth
            return user
    
    # 3. Fallo total
    raise credentials_exception


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependencia que verifica que el usuario esté activo.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


async def require_admin_user(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """
    Dependency para endpoints administrativos (solo role=admin).
    """
    role = str(getattr(current_user, "role", "") or "").strip().lower()
    if role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "admin_required", "message": "Acceso restringido a administradores."},
        )
    return current_user


def ensure_admin_bootstrap(db: Session) -> None:
    """
    Si ADMIN_BOOTSTRAP_EMAIL y ADMIN_BOOTSTRAP_PASSWORD están definidos y el email
    no existe, crea un usuario con rol admin y suscripción activa.
    """
    settings = get_settings()
    email = (settings.ADMIN_BOOTSTRAP_EMAIL or "").strip().lower()
    password = settings.ADMIN_BOOTSTRAP_PASSWORD
    if not email or not password:
        return
    existing = db.query(User).filter(func.lower(User.email) == email).first()
    if existing:
        # Cuenta ya existía (p. ej. se registró antes): alinear con bootstrap — admin
        # y misma contraseña que en entorno, para no quedar atrapado con rol user.
        changed = False
        if existing.role != UserRole.ADMIN.value:
            existing.role = UserRole.ADMIN.value
            changed = True
        if not verify_password(password, existing.hashed_password):
            existing.hashed_password = get_password_hash(password)
            changed = True
        if changed:
            db.commit()
        return
    admin = User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name="Administrator",
        is_active=1,
        role=UserRole.ADMIN.value,
    )
    db.add(admin)
    db.flush()
    db.add(
        Subscription(
            user_id=admin.id,
            plan_code=SubscriptionPlan.ENTERPRISE.value,
            status=SubscriptionStatus.ACTIVE.value,
        )
    )
    db.commit()


def get_user_stats(db: Session, user_id: int) -> dict:
    """
    Obtiene estadísticas del usuario para el dashboard.
    """
    from app.models.models import Document, AI_Annotation, Human_Correction
    
    total_docs = db.query(Document).filter(Document.user_id == user_id).count()
    graded_docs = db.query(Document).filter(
        Document.user_id == user_id,
        Document.status == "graded"
    ).count()
    
    total_annotations = db.query(AI_Annotation).join(Document).filter(
        Document.user_id == user_id
    ).count()
    
    total_corrections = db.query(Human_Correction).filter(
        Human_Correction.user_id == user_id
    ).count()
    
    return {
        "total_documents": total_docs,
        "graded_documents": graded_docs,
        "total_ai_annotations": total_annotations,
        "total_human_corrections": total_corrections
    }
