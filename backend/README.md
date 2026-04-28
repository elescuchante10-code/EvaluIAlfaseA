# EvaluAI Backend

Backend FastAPI con autenticación JWT, SQLAlchemy y sistema Data Flywheel.

## 🚀 Quick Start

### 1. Instalar dependencias
```bash
cd backend
pip install -r requirements.txt
```

### 2. Inicializar base de datos
```bash
python init_db.py
```

Esto creará:
- Tablas en SQLite (o PostgreSQL si configuras DATABASE_URL)
- Usuario de prueba: `juliolopez4p@gmail.com` / `password123`
- Documento y anotaciones de ejemplo

### 3. Iniciar servidor
```bash
python run.py
```

Servidor corriendo en:
- 🌐 API: http://localhost:8000
- 📚 Swagger UI: http://localhost:8000/docs
- 🔧 Test CORS: http://localhost:8000/api/test-cors

## 📁 Estructura del Proyecto

```
backend/
├── app/
│   ├── core/           # Configuración central
│   │   ├── config.py   # Settings
│   │   ├── database.py # SQLAlchemy config
│   │   └── security.py # JWT y hashing
│   ├── models/         # Modelos SQLAlchemy
│   │   └── models.py   # User, Document, AI_Annotation, Human_Correction
│   ├── schemas/        # Esquemas Pydantic
│   │   └── schemas.py  # Validación de datos
│   ├── services/       # Lógica de negocio
│   │   └── auth.py     # Servicios de autenticación
│   ├── routers/        # Endpoints
│   │   └── auth.py     # Rutas de auth
│   └── main.py         # App FastAPI + CORS
├── migrations/         # Alembic (versiones; script_location en alembic.ini)
├── tests/              # Pytest
├── init_db.py          # Script de inicialización
├── run.py              # Script para ejecutar
└── requirements.txt    # Dependencias
```

## 🔐 Endpoints de Autenticación

### POST /api/auth/login
Login con OAuth2 (form-data):
```bash
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=juliolopez4p@gmail.com&password=password123"
```

### POST /api/auth/login/json
Login con JSON:
```bash
curl -X POST "http://localhost:8000/api/auth/login/json" \
  -H "Content-Type: application/json" \
  -d '{"email":"juliolopez4p@gmail.com","password":"password123"}'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "juliolopez4p@gmail.com",
    "full_name": "Julio López",
    "is_active": true,
    "created_at": "2024-01-15T10:30:00"
  }
}
```

## Pruebas automáticas (pytest)

Tras `pip install -r requirements.txt`, desde `backend/`:

```bash
python -m pytest
```

La configuración vive en `pytest.ini` (`pythonpath`, asyncio). Las revisiones SQL de Alembic están en `migrations/` (no en una carpeta llamada `alembic/`, para no sombrear el paquete PyPI al correr tests).

### GET /api/auth/me
Obtener usuario actual (requiere Bearer token):
```bash
curl -X GET "http://localhost:8000/api/auth/me" \
  -H "Authorization: Bearer <access_token>"
```

## 🎯 Sistema Data Flywheel

El modelo `Human_Correction` captura:
- **original_ai_comment**: Lo que la IA sugirió
- **final_human_comment**: Lo que el profesor decidió
- **was_ai_correct**: Si la IA acertó (1/0)
- **severity_change**: Si cambió la severidad
- **time_to_correct_seconds**: Tiempo de corrección

Estos datos permiten:
1. Fine-tuning de modelos locales
2. Análisis de patrones de error
3. Mejora continua de predicciones

## ⚙️ Configuración

Variables de entorno (`.env`):
```env
DATABASE_URL=sqlite:///./evaluai.db
SECRET_KEY=your-secret-key-change-in-production
FRONTEND_URL=http://localhost:3000
DEBUG=True
```

Para PostgreSQL:
```env
DATABASE_URL=postgresql://user:password@localhost/evaluai
```

## 🧪 Testing desde el Frontend

### Test de CORS
```javascript
fetch('http://localhost:8000/api/test-cors')
  .then(r => r.json())
  .then(console.log)
```

### Login
```javascript
const login = async () => {
  const response = await fetch('http://localhost:8000/api/auth/login/json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'juliolopez4p@gmail.com',
      password: 'password123'
    })
  });
  const data = await response.json();
  localStorage.setItem('token', data.access_token);
  return data;
};
```

## 📊 Modelos de Datos

### User
- `id`, `email` (único), `hashed_password`, `full_name`, `is_active`

### Document
- `id`, `user_id`, `filename`, `original_text`, `status`, `final_grade`

### AI_Annotation
- `id`, `document_id`, `start_index`, `end_index`
- `predicted_color`, `predicted_comment`, `suggested_text`
- `confidence_score`, `ai_model_version`

### Human_Correction (Data Flywheel)
- `id`, `annotation_id`, `user_id`, `document_id`
- `original_ai_comment`, `original_color`
- `final_human_comment`, `final_color`, `final_text`
- `was_ai_correct`, `severity_change`, `time_to_correct_seconds`
