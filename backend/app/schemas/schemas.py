"""
Esquemas Pydantic para validación de datos.
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
from typing import Any, Dict


# ==================== ENUMS ====================

class DocumentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    MANUAL_REVIEW = "manual_review"
    GRADED = "graded"


class AnnotationColor(str, Enum):
    RED = "red"
    YELLOW = "yellow"
    GREEN = "green"
    BLUE = "blue"


# ==================== USER ====================

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    # Aceptar tanto 'nombre' (frontend) como 'full_name' (backend)
    nombre: Optional[str] = None
    full_name: Optional[str] = None
    
    def get_full_name(self) -> Optional[str]:
        """Retorna el nombre completo, priorizando full_name sobre nombre."""
        return self.full_name or self.nombre


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class SubscriptionInfo(BaseModel):
    """Estado comercial actual (1:1 con usuario)."""
    plan_code: str
    status: str
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserResponse(UserBase):
    id: int
    role: str 
    is_active: bool
    credits_balance: int = 0
    account_type: str = "individual"
    institution_name: Optional[str] = None
    subscription: Optional[SubscriptionInfo] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== TOKEN ====================

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    email: Optional[str] = None


# ==================== DOCUMENT ====================

class DocumentBase(BaseModel):
    filename: str


class DocumentCreate(DocumentBase):
    original_text: Optional[str] = None


class DocumentResponse(DocumentBase):
    id: int
    user_id: int
    status: DocumentStatus
    final_grade: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# ==================== AI ANNOTATION ====================

class AIAnnotationBase(BaseModel):
    start_index: int
    end_index: int
    selected_text: Optional[str] = None
    predicted_color: AnnotationColor
    predicted_comment: Optional[str] = None
    suggested_text: Optional[str] = None


class AIAnnotationCreate(AIAnnotationBase):
    document_id: int
    confidence_score: Optional[int] = None


class AIAnnotationResponse(AIAnnotationBase):
    id: int
    document_id: int
    ai_model_version: str
    confidence_score: Optional[int]
    created_at: datetime
    has_human_correction: bool = False
    
    class Config:
        from_attributes = True


# ==================== HUMAN CORRECTION (DATA FLYWHEEL) ====================

class HumanCorrectionBase(BaseModel):
    final_human_comment: Optional[str] = None
    final_color: Optional[AnnotationColor] = None
    final_text: Optional[str] = None
    action_type: str = Field(..., pattern="^(accept|modify|reject|add_comment)$")


class HumanCorrectionCreate(HumanCorrectionBase):
    annotation_id: int
    time_to_correct_seconds: Optional[int] = None
    correction_context: Optional[str] = None  # JSON string


class HumanCorrectionResponse(HumanCorrectionBase):
    id: int
    user_id: Optional[int]
    document_id: int
    annotation_id: int
    
    # Datos originales de IA
    original_ai_comment: Optional[str]
    original_color: Optional[AnnotationColor]
    
    # Métricas del flywheel
    was_ai_correct: Optional[bool]
    severity_change: Optional[str]
    
    created_at: datetime
    
    class Config:
        from_attributes = True


class CorrectionStats(BaseModel):
    """Estadísticas del Data Flywheel."""
    total_corrections: int
    ai_correct_predictions: int
    ai_incorrect_predictions: int
    accuracy_percentage: float
    corrections_by_color: dict
    average_correction_time: Optional[float]


# ==================== REQUEST/RESPONSE ESPECÍFICOS ====================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class WompiCheckoutRequest(BaseModel):
    plan_code: str = Field(..., pattern="^(pro|enterprise)$")
    amount_in_cents: Optional[int] = Field(default=None, ge=0)
    redirect_url: Optional[str] = None
    expires_in_minutes: int = Field(default=120, ge=15, le=7 * 24 * 60)
    single_use: bool = True


class WompiCheckoutResponse(BaseModel):
    success: bool = True
    provider: str = "wompi"
    plan_code: str
    reference: str
    checkout_url: str
    payment_link_id: str
    amount_in_cents: int
    currency: str = "COP"
    status: str
    expires_at: Optional[datetime] = None


class WompiWebhookAck(BaseModel):
    success: bool = True
    processed: bool = True
    event: str
    status: str
    reference: Optional[str] = None
    transaction_id: Optional[str] = None


class WompiPaymentStatusResponse(BaseModel):
    success: bool = True
    provider: str = "wompi"
    plan_code: str
    reference: str
    checkout_url: Optional[str] = None
    payment_link_id: Optional[str] = None
    transaction_id: Optional[str] = None
    amount_in_cents: int
    currency: str = "COP"
    status: str
    expires_at: Optional[datetime] = None


class AnnotationWithCorrection(BaseModel):
    """Respuesta combinada de anotación + corrección humana."""
    annotation: AIAnnotationResponse
    human_correction: Optional[HumanCorrectionResponse] = None


# ==================== ADMIN (MVP) ====================

class AdminCreateUserRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None
    credits_initial: int = Field(default=0, ge=0)
    account_type: str = Field(default="individual", pattern="^(individual|colegio)$")
    institution_name: Optional[str] = None
    request_id: Optional[str] = None


class AdminTopUpRequest(BaseModel):
    credits_delta: int = Field(..., gt=0)
    reason: str = Field(..., min_length=2, max_length=240)
    request_id: Optional[str] = None


class AdminResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8)


class AdminSetActiveRequest(BaseModel):
    is_active: bool


class AdminUserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
    is_active: bool
    role: str
    credits_balance: int
    account_type: str
    institution_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AdminUserListResponse(BaseModel):
    success: bool = True
    users: List[AdminUserResponse]


class AdminLedgerEventResponse(BaseModel):
    id: int
    created_at: datetime
    user_id: int
    email: Optional[str] = None
    action: str
    surface: str
    credits_delta: int
    credits_before: int
    credits_after: int
    doc_id: Optional[int] = None
    request_id: str
    tokens_used: Optional[int] = None
    provider_cost_usd: Optional[float] = None
    meta: Dict[str, Any] = {}


class AdminUserDetailResponse(BaseModel):
    success: bool = True
    user: AdminUserResponse
    ledger_events: List[AdminLedgerEventResponse] = []


class AdminLedgerListResponse(BaseModel):
    success: bool = True
    events: List[AdminLedgerEventResponse]
