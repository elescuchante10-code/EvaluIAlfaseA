# Matriz de funciones (Plan por fases)

Este documento sirve para **diagnosticar** lo que ya existe y **registrar tareas pendientes** hasta llegar a un despliegue estable en producción (Coolify + Docker).

## Convenciones

- **Estado**
  - ✅ Hecho
  - 🟡 Parcial
  - ⬜ Pendiente
  - 🔴 Riesgo
- **Owner**
  - **Dev**: desarrollo (código, APIs, env vars, integración)
  - **Infra**: infraestructura (VPS, Coolify, dominios, backups)
  - **Producto**: definición funcional, reglas de negocio, flujos y validaciones

---

## Fase 0 — Diagnóstico local

**Objetivo**: confirmar stack, credenciales y ejecución en local.

- ✅ **[Dev] Frontend + Backend corriendo en local**
  - **Evidencia**: frontend `:3000` y backend `:8000` (`/health` OK).
  - **Siguiente paso**: validar flujo real (login → subir → evaluar → guardar).

- ✅ **[Producto] Usuario/contraseña de prueba documentados**
  - **Evidencia**: `juliolopez4p@gmail.com` / `password123` (por `backend/init_db.py`).
  - **Siguiente paso**: definir usuarios/roles reales para producción.

- ✅ **[Dev] Variables de entorno mínimas (local)**
  - **Evidencia**: `backend/.env` y `frontend/.env.development`.
  - **Siguiente paso**: inventario completo de envs para prod (Wompi/Groq/etc.).

### Tareas pendientes (agregar aquí)

- ✅ **[Dev/Producto] Registro 2026-04-25 — Landing + demo video + auditoría**
  - **Landing (solo UI, sin tocar motor)**:
    - Hero actualizado (nuevo título/subtítulo).
    - Navegación: eliminado tab **Resumen** (quedan Flujo, Capacidades, Workspace, Precios, FAQ).
    - Copy “sin tecnicismos”: eliminadas menciones visibles de endpoints tipo `/api/...`, JWT y rutas admin en la landing.
    - Pricing reescrito a 3 opciones:
      - Estándar $40.000 COP/mes — 500 créditos IA.
      - Institucional $2.000.000 COP/mes (aprox) — bolsa 20.000 créditos IA.
      - Pago por uso: recargas $20.000=200 créditos, $50.000=500 créditos, sin vencimiento.
    - FAQ: agregada explicación del sistema de créditos (5/10/1–2 créditos).
    - Animaciones: reveals por scroll con `IntersectionObserver` + soporte `prefers-reduced-motion`.
    - Estética: textura/grain/mesh/glows sutiles para evitar look “plano”.
  - **Demo video (compatibilidad web/Safari)**:
    - Se dejó video en `frontend/public/assets/` con MP4 liviano + poster + WebM.
    - Nota: en Safari/iOS el MP4 es el formato crítico (WebM no siempre reproduce).
  - **Auditoría de motor (sin Git)**:
    - `frontend/src/services/**` y `frontend/src/components/editor/**` sin cambios en las últimas 24h.
    - Backend importa y compila OK (`from app.main import app` OK).
    - IA: Groq implementado en `backend/app/routers/evaluate.py` y `backend/app/services/document_multimodal.py`, leyendo `GROQ_API_KEY`.
    - Alertas para producción (pendiente): `SECRET_KEY` hardcoded (`"1234"`), `ADMIN_BOOTSTRAP_PASSWORD` hardcoded, y revisar semántica de `WOMPI_EVENT_SECRET`.

- [ ] **[Dev/Producto] Mejorar y rediseñar la Landing Page (solo UI)**
  - **Alcance**: cambios únicamente en componentes/estilos/routing de la landing (frontend).
  - **No tocar**: lógica de negocio (“motor”), llamadas a API, autenticación, flujos internos de evaluación, ni endpoints backend.
  - **Referencia visual (modelo)**: Hero tipo “Astra” con **captura del dashboard** dentro de un frame con glow/borde animado.
    - **Repo referencia**: `Shreyas-29/astra`
    - **Ubicación en Astra**: `src/app/(marketing)/page.tsx` (usa `Image src="/assets/dashboard.svg"`).
  - **Criterios de aceptación**:
    - La landing queda con diseño moderno (responsive, accesible, copy claro, CTA visibles).
    - No se rompen rutas existentes ni vistas internas.
    - El login/flujo principal de la app sigue funcionando igual.
    - No se modifica el backend.
  - **Evidencia**: capturas “antes/después” + verificación rápida (abrir app, login, cargar 1 flujo clave).
- [ ] **[Dev] Construir nueva landing (síntesis) sin tocar motor/IA/backend**
  - **Objetivo**: reemplazar la landing actual por una versión final basada en lo mejor de referencias, manteniendo intacta la app interna.
  - **Referencias (solo inspiración / patrones UI)**:
    - `Shreyas-29/astra` (Hero + grid + glow + screenshot): `src/app/(marketing)/page.tsx` + `public/assets/dashboard.svg`
    - `Blazity/next-saas-starter` (marketing SaaS / secciones): `README.md` + estructura de landing
  - **Archivos permitidos (por defecto)**:
    - `frontend/src/components/LandingPage.js`
    - `frontend/src/components/LandingPage.css`
    - `frontend/public/assets/*` (capturas/ilustraciones)
    - (solo si es estrictamente necesario para wiring de la landing) `frontend/src/App.js` / `frontend/src/index.js` — **sin** cambiar lógica de evaluación/IA
  - **Prohibido**:
    - `backend/**`
    - cambios en `frontend/src/services/**`, hooks de evaluación, componentes del editor, prompts, integraciones LLM, endpoints, auth real (más allá de enlaces/CTA existentes)
    - agregar dependencias nuevas salvo justificación explícita y aprobación (default: **no**)
  - **Entregables**:
    - Hero con captura real del dashboard en `public/assets/dashboard-screenshot.png` (o `.webp`) + `alt` descriptivo
    - Secciones claras (propuesta de valor, cómo funciona, features, pricing/CTA, FAQ) con copy en español alineado a EvaluAI
    - Accesibilidad (contraste, foco, `aria-*`, `prefers-reduced-motion`)
    - Responsive (mobile-first)
  - **Verificación obligatoria**:
    - `npm run build` en `frontend/` OK
    - Smoke manual: landing carga, CTAs actuales siguen llamando a los mismos handlers (`onGoLogin`, `onGoRegister`, `onSubscribe`, etc.)
    - Login + 1 flujo interno mínimo sin regresiones

---

## Fase 1 — Empaquetado Docker

**Objetivo**: “Si funciona en tu compu, funciona en el servidor”.

- ✅ **[Dev] Dockerfile backend (FastAPI)**
  - **Evidencia**: `backend/Dockerfile` (uvicorn `app.main:app`).
  - **Siguiente paso**: definir healthcheck y estrategia de workers (1 vs multiproceso).

- ✅ **[Dev] Dockerfile frontend (build + nginx)**
  - **Evidencia**: `frontend/Dockerfile` (CRA build → nginx).
  - **Siguiente paso**: ajustar API URL de producción (dominio backend / proxy).

- ✅ **[Infra] docker-compose (frontend + backend + postgres)**
  - **Evidencia**: `docker-compose.yml` validado.
  - **Siguiente paso**: decidir si usar Postgres gestionado (recomendado) vs contenedor.

### Tareas pendientes (agregar aquí)

- [ ] (pendiente) …

---

## Fase 2 — VPS + Coolify

**Objetivo**: infraestructura y despliegue continuo por Git.

- ⬜ **[Infra] Crear VPS (Ubuntu 22.04/24.04) + acceso SSH**
  - **Evidencia**: no configurado aún.
  - **Siguiente paso**: elegir proveedor (Hetzner/DO), crear server, guardar IP/SSH key.

- ⬜ **[Infra] Instalar Coolify**
  - **Evidencia**: no instalado.
  - **Siguiente paso**: SSH → `curl -fsSL https://coollabs.io | bash` → panel `:8000`.

- ⬜ **[Infra] Conectar GitHub y desplegar Docker Compose**
  - **Evidencia**: no existe proyecto en Coolify.
  - **Siguiente paso**: Source → Project → Docker Compose → configurar env vars.

### Tareas pendientes (agregar aquí)

- [ ] (pendiente) …

---

## Fase 3 — Producción (dominio, seguridad, observabilidad)

**Objetivo**: cerrar brechas típicas de pasar de “local” a “prod”.

- ⬜ **[Infra] Dominios + SSL**
  - **Evidencia**: no configurado.
  - **Siguiente paso**: asignar dominio(s) a frontend y backend (o un solo dominio con proxy).

- 🟡 **[Dev] Secretos de producción (JWT, Groq, Wompi)**
  - **Evidencia**: `.env.example` agregado.
  - **Siguiente paso**: cargar valores reales en Coolify (no en git). Rotar llaves si aplica.

- ⬜ **[Dev] CORS y URLs finales**
  - **Evidencia**: local OK; prod depende de dominio.
  - **Siguiente paso**: `ALLOWED_ORIGINS` y `FRONTEND_URL` con dominio final.

- ⬜ **[Infra] Backups / migraciones / upgrades**
  - **Evidencia**: Alembic corre al startup; no hay política de backup.
  - **Siguiente paso**: backups Postgres, ventana de deploy, estrategia de rollback.

### Tareas pendientes (agregar aquí)

- [ ] (pendiente) …

---

## Backlog (tareas sueltas por clasificar)

- [ ] …
