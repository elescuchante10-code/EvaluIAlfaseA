# EvaluAI (Frontend + Backend)

Monorepo con:
- `frontend/`: React (Create React App)
- `backend/`: FastAPI + SQLAlchemy/Alembic

## Credenciales de prueba (local)

Al inicializar la DB con `backend/init_db.py` se crea:
- **Usuario (email)**: `juliolopez4p@gmail.com`
- **Contraseña**: `password123`

Login (JSON):
```bash
curl -X POST "http://localhost:8000/api/auth/login/json" \
  -H "Content-Type: application/json" \
  -d '{"email":"juliolopez4p@gmail.com","password":"password123"}'
```

## Desarrollo local (sin Docker)

### Backend
```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python init_db.py
python run.py
```

Backend en `http://localhost:8000` (docs en `/docs`).

### Frontend
```bash
cd frontend
npm install
npm start
```

Frontend en `http://localhost:3000`.

## Docker (recomendado para Coolify)

Este repo incluye `backend/Dockerfile`, `frontend/Dockerfile` y `docker-compose.yml`.

Levantar todo con Postgres:
```bash
docker compose up --build
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000/health`

## Variables de entorno (para Coolify)

Usa `.env.example` como base (no subas `.env` de producción al repo).

## Despliegue en Coolify (resumen)

### Paso 1: Preparar tu servidor (VPS)

1. Crea una cuenta en Hetzner o DigitalOcean.
2. Crea una instancia con **Ubuntu 22.04 o 24.04**.
3. Guarda la **IP** y tu método de acceso (**SSH key** o contraseña).

### Paso 2: Instalar Coolify

Conéctate por SSH:
```bash
ssh root@LA_IP_DE_TU_SERVIDOR
```

Instala Coolify:
```bash
curl -fsSL https://coollabs.io | bash
```

Al terminar, entra al panel en `http://TU_IP:8000`.

### Paso 3: Desplegar “tal cual como en tu compu” (Docker Compose)

1. En Coolify, conecta GitHub en **Sources**.
2. Crea un **Project**.
3. Selecciona este repositorio.
4. Despliega con **Docker Compose** usando `docker-compose.yml` (levanta `frontend` + `backend` + `postgres`).
5. Copia variables desde `.env.example` al panel de Coolify (sección env vars).

### Paso 4: Dominio + SSL

1. En la app dentro de Coolify, configura **Domains** (ej. `https://tu-dominio.com`).
2. Coolify gestiona el **SSL** automáticamente.
3. Deploy.
