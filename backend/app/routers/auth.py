"""
Rutas de autenticación.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Annotated

from app.core.database import get_db
from app.services.auth import (
    create_user,
    login_user,
    get_current_active_user,
    get_user_by_email
)
from app.schemas.schemas import (
    UserCreate,
    UserResponse,
    LoginResponse,
    Token
)
from app.models.models import User

router = APIRouter(prefix="/api/auth", tags=["authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    user: UserCreate,
    db: Session = Depends(get_db)
):
    """
    Registra un nuevo usuario.
    """
    try:
        print(f"[📥 REGISTER] Recibida solicitud de registro: email={user.email}, nombre={user.nombre}, full_name={user.full_name}")
        db_user = create_user(db=db, user=user)
        print(f"[✅ REGISTER] Usuario registrado exitosamente: id={db_user.id}")
        return db_user
    except HTTPException as he:
        print(f"[❌ REGISTER HTTPException] {he.status_code}: {he.detail}")
        raise he
    except Exception as e:
        print(f"[❌ REGISTER ERROR] Error inesperado: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al registrar usuario: {str(e)}"
        )


@router.post("/login", response_model=LoginResponse)
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db)
):
    """
    Endpoint de login OAuth2.
    Recibe username (email) y password, retorna JWT token.
    """
    result = login_user(
        db, email=form_data.username.strip().lower(), password=form_data.password
    )
    return {
        "access_token": result["access_token"],
        "token_type": result["token_type"],
        "user": result["user"]
    }


@router.post("/login/json", response_model=LoginResponse)
def login_json(
    credentials: dict,
    db: Session = Depends(get_db)
):
    """
    Endpoint de login alternativo que recibe JSON.
    Útil para el frontend cuando OAuth2PasswordRequestForm da problemas con CORS.
    """
    email = (credentials.get("email") or "").strip().lower()
    password = credentials.get("password")
    
    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password required"
        )
    
    result = login_user(db, email=email, password=password)
    return {
        "access_token": result["access_token"],
        "token_type": result["token_type"],
        "user": result["user"]
    }


@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtiene información del usuario autenticado.
    Requiere token JWT válido en el header Authorization: Bearer <token>
    """
    return current_user


@router.post("/refresh", response_model=Token)
def refresh_token(
    current_user: User = Depends(get_current_active_user)
):
    """
    Refresca el token de acceso.
    """
    from app.core.security import create_access_token
    from datetime import timedelta
    
    access_token_expires = timedelta(minutes=60 * 24)
    access_token = create_access_token(
        data={"sub": current_user.email},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }
