"""
Modelos de base de datos - Sistema Data Flywheel.

La estrategia de Andrej Karpathy para el Data Flywheel implica:
1. La IA hace predicciones (AI_Annotation)
2. Los humanos corrigen esas predicciones (Human_Correction)
3. Estos datos se usan para reentrenar modelos locales
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum, Index, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class UserRole(str, enum.Enum):
    """Rol de aplicación (permisos)."""
    USER = "user"
    ADMIN = "admin"


class SubscriptionPlan(str, enum.Enum):
    """Plan comercial contratado (catálogo)."""
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class SubscriptionStatus(str, enum.Enum):
    """Estado del ciclo de facturación / derecho de uso."""
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    EXPIRED = "expired"


class DocumentStatus(str, enum.Enum):
    """Estados posibles de un documento."""
    PENDING = "pending"
    PROCESSING = "processing"
    MANUAL_REVIEW = "manual_review"
    GRADED = "graded"


class AnnotationColor(str, enum.Enum):
    """Colores del sistema de semáforo."""
    RED = "red"           # Errores críticos
    YELLOW = "yellow"     # Observaciones
    GREEN = "green"       # Mejoras sugeridas
    BLUE = "blue"         # Referencias


class User(Base):
    """Modelo de usuario (profesor)."""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Integer, default=1)  # 1 = activo, 0 = inactivo
    role = Column(String(20), nullable=False, default=UserRole.USER.value, server_default=UserRole.USER.value)
    credits_balance = Column(Integer, nullable=False, default=0, server_default="0")
    account_type = Column(String(32), nullable=False, default="individual", server_default="individual")
    institution_name = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relaciones
    documents = relationship("Document", back_populates="owner", cascade="all, delete-orphan")
    corrections = relationship("Human_Correction", back_populates="user")
    subscription = relationship(
        "Subscription",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="joined",
    )
    pending_payments = relationship("PendingPayment", back_populates="user", cascade="all, delete-orphan")
    billing_events = relationship("BillingEvent", back_populates="user")
    credit_ledger_events = relationship("CreditLedgerEvent", back_populates="user")
    
    def __repr__(self):
        return f"<User(email='{self.email}', name='{self.full_name}')>"


class CreditLedgerEvent(Base):
    """Ledger de créditos: consumos y recargas (fuente única de auditoría)."""
    __tablename__ = "credit_ledger_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    action = Column(String(64), nullable=False, index=True)
    surface = Column(String(64), nullable=False, index=True)

    credits_delta = Column(Integer, nullable=False)
    credits_before = Column(Integer, nullable=False)
    credits_after = Column(Integer, nullable=False)

    doc_id = Column(Integer, nullable=True, index=True)
    request_id = Column(String(80), nullable=False, unique=True, index=True)

    tokens_used = Column(Integer, nullable=True)
    provider_cost_usd = Column(Float, nullable=True)
    meta_json = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="credit_ledger_events")


class Subscription(Base):
    """
    Suscripción comercial por usuario (1:1).
    El estado (`status`) gobierna el entitlement de evaluación junto con `User.role`.
    """
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    plan_code = Column(String(32), nullable=False, default=SubscriptionPlan.FREE.value)
    status = Column(String(32), nullable=False, default=SubscriptionStatus.ACTIVE.value)
    current_period_start = Column(DateTime(timezone=True), nullable=True)
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="subscription")

    __table_args__ = (Index("idx_subscriptions_status", "status"),)

    def __repr__(self):
        return f"<Subscription(user_id={self.user_id}, plan={self.plan_code}, status={self.status})>"


class PendingPayment(Base):
    """Referencia comercial generada por backend antes del checkout Wompi."""
    __tablename__ = "pending_payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_code = Column(String(32), nullable=False, default=SubscriptionPlan.FREE.value)
    reference = Column(String(80), nullable=False, unique=True, index=True)
    provider = Column(String(32), nullable=False, default="wompi")
    status = Column(String(32), nullable=False, default="created")
    amount_in_cents = Column(Integer, nullable=False, default=0)
    currency = Column(String(8), nullable=False, default="COP")
    checkout_url = Column(String(500), nullable=True)
    wompi_payment_link_id = Column(String(80), nullable=True, unique=True, index=True)
    wompi_transaction_id = Column(String(120), nullable=True, index=True)
    redirect_url = Column(String(500), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="pending_payments")
    billing_events = relationship("BillingEvent", back_populates="pending_payment")

    __table_args__ = (
        Index("idx_pending_payments_user_status", "user_id", "status"),
    )

    def __repr__(self):
        return f"<PendingPayment(reference='{self.reference}', status='{self.status}', plan='{self.plan_code}')>"


class BillingEvent(Base):
    """Bitacora de eventos Wompi para auditoria y deduplicacion."""
    __tablename__ = "billing_events"

    id = Column(Integer, primary_key=True, index=True)
    event_key = Column(String(255), nullable=False, unique=True, index=True)
    event_type = Column(String(80), nullable=False, index=True)
    provider = Column(String(32), nullable=False, default="wompi")
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    pending_payment_id = Column(Integer, ForeignKey("pending_payments.id", ondelete="SET NULL"), nullable=True, index=True)
    reference = Column(String(80), nullable=True, index=True)
    transaction_id = Column(String(120), nullable=True, index=True)
    status = Column(String(32), nullable=True)
    checksum = Column(String(255), nullable=True)
    payload_json = Column(Text, nullable=False)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="billing_events")
    pending_payment = relationship("PendingPayment", back_populates="billing_events")

    def __repr__(self):
        return f"<BillingEvent(type='{self.event_type}', key='{self.event_key}')>"


class Rubric(Base):
    """Modelo de rúbricas guardadas por el profesor."""
    __tablename__ = "rubrics"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    nombre = Column(String(255), nullable=False, default="Rúbrica sin nombre")
    asignatura = Column(String(255), nullable=True, default="Sin asignatura")
    markdown = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    owner = relationship("User", backref="rubrics")
    
    def __repr__(self):
        return f"<Rubric(id={self.id}, nombre='{self.nombre}', asignatura='{self.asignatura}')>"


class Document(Base):
    """Modelo de documento (trabajo de estudiante)."""
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(500), nullable=False)
    original_text = Column(Text, nullable=True)
    # Tamaño del archivo subido (cupo wiki / teacher context). Fuente de verdad para quotas.
    file_size_bytes = Column(Integer, nullable=False, default=0, server_default="0")
    # Pipeline contextual (Mi Espacio IB / Karpathy-style): Markdown derivado en disco; sin embeddings.
    context_markdown_status = Column(String(20), nullable=False, default="pending")
    context_markdown_relpath = Column(String(500), nullable=True)
    status = Column(Enum(DocumentStatus), default=DocumentStatus.PENDING)
    final_grade = Column(Integer, nullable=True)  # Nota final 0-100
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relaciones
    owner = relationship("User", back_populates="documents")
    annotations = relationship("AI_Annotation", back_populates="document", cascade="all, delete-orphan")
    
    # Índices
    __table_args__ = (
        Index('idx_document_user_status', 'user_id', 'status'),
    )
    
    def __repr__(self):
        return f"<Document(id={self.id}, filename='{self.filename}', status='{self.status}')>"


class AI_Annotation(Base):
    """
    Predicciones de la IA sobre el documento.
    Cada anotación representa una sugerencia/corrección del modelo.
    """
    __tablename__ = "ai_annotations"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    
    # Posición en el texto
    start_index = Column(Integer, nullable=False)
    end_index = Column(Integer, nullable=False)
    selected_text = Column(String(1000), nullable=True)  # Texto seleccionado
    
    # Predicción de la IA
    predicted_color = Column(Enum(AnnotationColor), nullable=False)
    predicted_comment = Column(Text, nullable=True)
    suggested_text = Column(String(1000), nullable=True)  # Texto sugerido por IA
    
    # Metadatos
    ai_model_version = Column(String(50), default="v1.0")
    confidence_score = Column(Integer, nullable=True)  # 0-100
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relaciones
    document = relationship("Document", back_populates="annotations")
    human_correction = relationship("Human_Correction", back_populates="annotation", uselist=False)
    
    # Índices para búsquedas eficientes
    __table_args__ = (
        Index('idx_annotation_document', 'document_id'),
        Index('idx_annotation_color', 'predicted_color'),
    )
    
    def __repr__(self):
        return f"<AI_Annotation(id={self.id}, color='{self.predicted_color}', pos={self.start_index}-{self.end_index})>"


class Human_Correction(Base):
    """
    SISTEMA DATA FLYWHEEL - CORAZÓN DEL SISTEMA.
    
    Registra exactamente cómo el profesor modificó la evaluación de la IA.
    Estos datos son oro para:
    1. Reentrenar modelos locales (fine-tuning)
    2. Analizar patrones de corrección
    3. Mejorar las predicciones futuras
    
    Basado en la estrategia de Andrej Karpathy:
    "Human feedback is the most valuable data you can collect."
    """
    __tablename__ = "human_corrections"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Claves foráneas
    annotation_id = Column(Integer, ForeignKey("ai_annotations.id", ondelete="CASCADE"), unique=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    
    # Datos ORIGINALES de la IA (snapshot)
    original_ai_comment = Column(Text, nullable=True)
    original_color = Column(Enum(AnnotationColor), nullable=True)
    
    # Datos FINALES del humano (ground truth)
    final_human_comment = Column(Text, nullable=True)
    final_color = Column(Enum(AnnotationColor), nullable=True)
    final_text = Column(String(1000), nullable=True)  # Texto final aplicado
    
    # Tipo de acción del profesor
    action_type = Column(String(50), nullable=True)  # 'accept', 'modify', 'reject', 'add_comment'
    
    # Contexto adicional para análisis
    time_to_correct_seconds = Column(Integer, nullable=True)  # Tiempo que tomó la corrección
    correction_context = Column(Text, nullable=True)  # JSON con contexto adicional
    
    # Flags para el flywheel
    was_ai_correct = Column(Integer, nullable=True)  # 1=sí, 0=no, NULL=no evaluado
    severity_change = Column(String(20), nullable=True)  # 'increased', 'decreased', 'same'
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relaciones
    annotation = relationship("AI_Annotation", back_populates="human_correction")
    user = relationship("User", back_populates="corrections")
    
    # Índices para análisis del flywheel
    __table_args__ = (
        Index('idx_correction_user', 'user_id'),
        Index('idx_correction_document', 'document_id'),
        Index('idx_correction_was_correct', 'was_ai_correct'),
        Index('idx_correction_created', 'created_at'),
    )
    
    def __repr__(self):
        return f"<Human_Correction(id={self.id}, action='{self.action_type}', ai_correct={self.was_ai_correct})>"

    def calculate_accuracy(self) -> dict:
        """
        Calcula métricas de precisión de la IA para esta corrección.
        """
        ai_correct = True
        severity = "same"
        
        # Verificar si el color cambió
        if self.original_color != self.final_color:
            ai_correct = False
            # Determinar si la severidad aumentó o disminuyó
            severity_order = {"green": 1, "blue": 2, "yellow": 3, "red": 4}
            orig_sev = severity_order.get(self.original_color.value, 0)
            final_sev = severity_order.get(self.final_color.value, 0)
            if final_sev > orig_sev:
                severity = "increased"
            elif final_sev < orig_sev:
                severity = "decreased"
        
        # Verificar si el comentario cambió significativamente
        if self.original_ai_comment and self.final_human_comment:
            if len(self.original_ai_comment) > 10 and len(self.final_human_comment) > 10:
                # Comparación simple (en producción usarías embeddings o similaridad)
                if self.original_ai_comment[:50] != self.final_human_comment[:50]:
                    ai_correct = False
        
        return {
            "was_ai_correct": ai_correct,
            "severity_change": severity,
            "color_match": self.original_color == self.final_color,
            "comment_modified": self.original_ai_comment != self.final_human_comment
        }


class EvaluationRecord(Base):
    """
    Memoria a largo plazo del agente.
    Registra cada evaluación para analíticas y aprendizaje contextual.
    """
    __tablename__ = "evaluation_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    document_id = Column(Integer, nullable=True)
    footnote_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    improvement_count = Column(Integer, default=0)
    observation_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_eval_record_user", "user_id"),
        Index("idx_eval_record_created", "created_at"),
    )

    def __repr__(self):
        return f"<EvaluationRecord(id={self.id}, user_id={self.user_id}, footnotes={self.footnote_count})>"
