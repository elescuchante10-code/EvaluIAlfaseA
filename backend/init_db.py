"""
Script de inicialización de la base de datos.

Crea las tablas e inserta un usuario de prueba para testing inmediato.
"""
import sys
import os

# Añadir el directorio backend al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import engine, Base, SessionLocal
from app.core.security import get_password_hash
from app.models.models import (
    User,
    Subscription,
    Document,
    AI_Annotation,
    Human_Correction,
    UserRole,
    SubscriptionPlan,
    SubscriptionStatus,
)


def init_database():
    """Inicializa la base de datos creando tablas y datos de prueba."""
    
    print("Inicializando base de datos de EvaluAI...")
    print("=" * 60)
    
    # Crear todas las tablas
    print("\n[Creando tablas...]")
    Base.metadata.create_all(bind=engine)
    print("[OK] Tablas creadas exitosamente")
    
    # Crear sesión
    db = SessionLocal()
    
    try:
        # Verificar si ya existe usuario de prueba
        existing_user = db.query(User).filter(User.email == "juliolopez4p@gmail.com").first()
        
        if existing_user:
            print("\n[!] Usuario de prueba ya existe:")
            print(f"   Email: {existing_user.email}")
            print(f"   Nombre: {existing_user.full_name}")
            sub = (
                db.query(Subscription)
                .filter(Subscription.user_id == existing_user.id)
                .first()
            )
            if not sub:
                db.add(
                    Subscription(
                        user_id=existing_user.id,
                        plan_code=SubscriptionPlan.FREE.value,
                        status=SubscriptionStatus.ACTIVE.value,
                    )
                )
                db.commit()
                print("   [+] Suscripción free/active añadida (faltaba).")
        else:
            # Crear usuario de prueba
            print("\n[Creando usuario de prueba...]")
            test_user = User(
                email="juliolopez4p@gmail.com",
                hashed_password=get_password_hash("password123"),
                full_name="Julio López",
                is_active=1,
                role=UserRole.USER.value,
            )
            db.add(test_user)
            db.commit()
            db.refresh(test_user)
            db.add(
                Subscription(
                    user_id=test_user.id,
                    plan_code=SubscriptionPlan.FREE.value,
                    status=SubscriptionStatus.ACTIVE.value,
                )
            )
            db.commit()
            
            print("[OK] Usuario de prueba creado:")
            print(f"   Email: {test_user.email}")
            print(f"   Nombre: {test_user.full_name}")
            print(f"   Password: password123")
            print(f"   ID: {test_user.id}")
        
        # Crear documento de prueba
        existing_doc = db.query(Document).filter(Document.filename == "ensayo_demo.txt").first()
        
        if not existing_doc:
            print("\n[Creando documento de prueba...]")
            test_doc = Document(
                user_id=1,
                filename="ensayo_demo.txt",
                original_text="La Revolución Francesa fue un período de gran cambio social...",
                status="manual_review"
            )
            db.add(test_doc)
            db.commit()
            db.refresh(test_doc)
            print(f"[OK] Documento creado: ID {test_doc.id}")
            
            # Crear anotaciones de IA de prueba
            print("\n[Creando anotaciones de IA de prueba...]")
            
            annotation1 = AI_Annotation(
                document_id=test_doc.id,
                start_index=55,
                end_index=60,
                selected_text="cambio",
                predicted_color="green",
                predicted_comment="Término más académico sugerido",
                suggested_text="transformación social radical",
                confidence_score=85
            )
            
            annotation2 = AI_Annotation(
                document_id=test_doc.id,
                start_index=12,
                end_index=32,
                selected_text="Revolución Francesa",
                predicted_color="blue",
                predicted_comment="Agregar fechas para precisión histórica",
                suggested_text="Revolución Francesa (1789-1799)",
                confidence_score=92
            )
            
            annotation3 = AI_Annotation(
                document_id=test_doc.id,
                start_index=81,
                end_index=92,
                selected_text="tuvo lugar",
                predicted_color="red",
                predicted_comment="Verbo más formal para contexto académico",
                suggested_text="se produjo",
                confidence_score=78
            )
            
            db.add_all([annotation1, annotation2, annotation3])
            db.commit()
            
            print(f"[OK] {3} anotaciones de IA creadas")
            
            # Crear corrección humana de ejemplo (Data Flywheel)
            print("\n[Creando correccion humana (Data Flywheel)...]")
            
            correction = Human_Correction(
                annotation_id=annotation1.id,
                user_id=1,
                document_id=test_doc.id,
                original_ai_comment="Término más académico sugerido",
                original_color="green",
                final_human_comment="Aceptado - buena sugerencia para nivel universitario",
                final_color="green",
                final_text="transformación social radical",
                action_type="accept",
                was_ai_correct=1,
                severity_change="same",
                time_to_correct_seconds=15
            )
            
            db.add(correction)
            db.commit()
            print("[OK] Correccion humana registrada en el Data Flywheel")
        
        print("\n" + "=" * 60)
        print("Base de datos inicializada correctamente!")
        print("\nDatos de acceso para testing:")
        print("   Email: juliolopez4p@gmail.com")
        print("   Password: password123")
        print("\nEndpoints disponibles:")
        print("   POST /api/auth/login - Login (OAuth2)")
        print("   POST /api/auth/login/json - Login (JSON)")
        print("   GET  /api/auth/me - Info del usuario")
        print("   GET  /docs - Documentación Swagger")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n[ERROR] {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    init_database()
