"""
CORRECCIÓN DEFINITIVA - Backend FastAPI
Archivo: routers/auth.py o donde tengas la autenticación
"""

import bcrypt
import re
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, validator
from sqlalchemy.orm import Session
from jose import JWTError, jwt
import uuid

# Configuración
SECRET_KEY = "tu-clave-secreta-aqui"  # Cambiar en producción
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 horas

router = APIRouter(prefix="/auth", tags=["auth"])

# ==================== MODELOS ====================

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    institution: Optional[str] = ""
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('La contraseña debe tener al menos 6 caracteres')
        # Validación de bytes para bcrypt (72 bytes máximo)
        if len(v.encode('utf-8')) > 72:
            raise ValueError('La contraseña no puede exceder 72 bytes')
        return v
    
    @validator('full_name')
    def validate_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError('El nombre debe tener al menos 2 caracteres')
        return v.strip()

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    success: bool = True
    access_token: str
    token_type: str = "bearer"
    user: dict

class ErrorResponse(BaseModel):
    success: bool = False
    detail: str

# ==================== UTILIDADES ====================

def hash_password(password: str) -> str:
    """
    Hashea contraseña con bcrypt.
    bcrypt tiene límite de 72 bytes - ya validamos esto en el modelo,
    pero dejamos esta protección adicional.
    """
    password_bytes = password.encode('utf-8')
    
    # Protección adicional: truncar si por alguna razón llega más de 72 bytes
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica contraseña contra hash."""
    # Truncar también la contraseña plana si es necesario (bcrypt lo haría igual)
    password_bytes = plain_password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    
    return bcrypt.checkpw(password_bytes, hashed_password.encode('utf-8'))

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Crea JWT token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# ==================== ENDPOINTS ====================

@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse, "description": "Error de validación"},
        409: {"model": ErrorResponse, "description": "Email ya existe"},
        500: {"model": ErrorResponse, "description": "Error interno"},
    }
)
async def register(credentials: UserRegister, db: Session = Depends(get_db)):
    """
    Registra un nuevo usuario.
    La contraseña se valida (máx 72 bytes por limitación de bcrypt).
    """
    try:
        # Verificar si email ya existe
        existing_user = db.query(User).filter(User.email == credentials.email.lower()).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El email ya está registrado"
            )
        
        # Crear nuevo usuario
        user_id = str(uuid.uuid4())
        new_user = User(
            id=user_id,
            email=credentials.email.lower().strip(),
            hashed_password=hash_password(credentials.password),
            full_name=credentials.full_name,
            institution=credentials.institution,
            words_available=120000,  # Palabras iniciales
            words_used=0,
            plan_type="profesor",
            is_active=True,
            created_at=datetime.utcnow()
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Generar token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user_id}, 
            expires_delta=access_token_expires
        )
        
        return {
            "success": True,
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "email": new_user.email,
                "full_name": new_user.full_name,
                "words_available": new_user.words_available,
                "words_used": 0,
                "plan_type": "profesor"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        # Log del error real para debugging
        print(f"ERROR en registro: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al crear la cuenta: {str(e)}"
        )


@router.post(
    "/login",
    response_model=TokenResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Credenciales incorrectas"},
    }
)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Inicia sesión y retorna token JWT.
    """
    try:
        # Buscar usuario por email
        user = db.query(User).filter(User.email == form_data.username.lower()).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email o contraseña incorrectos",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Verificar contraseña
        if not verify_password(form_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email o contraseña incorrectos",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Verificar que usuario esté activo
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Cuenta desactivada",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Actualizar último login
        user.last_login = datetime.utcnow()
        db.commit()
        
        # Generar token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.id}, 
            expires_delta=access_token_expires
        )
        
        return {
            "success": True,
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "words_available": user.words_available,
                "words_used": user.words_used,
                "plan_type": user.plan_type
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR en login: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )


@router.get("/me", response_model=dict)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Obtiene información del usuario autenticado.
    """
    return {
        "success": True,
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "words_available": current_user.words_available,
            "words_used": current_user.words_used,
            "plan_type": current_user.plan_type,
            "institution": current_user.institution
        }
    }


# ==================== DEPENDENCIAS ====================

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Dependencia para obtener usuario actual desde token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    
    return user


# ==================== MODELO SQLALCHEMY (ejemplo) ====================
"""
from sqlalchemy import Column, String, Integer, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    institution = Column(String, default="")
    words_available = Column(Integer, default=120000)
    words_used = Column(Integer, default=0)
    plan_type = Column(String, default="profesor")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
"""
