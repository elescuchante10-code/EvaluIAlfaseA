# EvaluAI - Documentación Técnica para Agentes

## 📋 Resumen del Proyecto

**EvaluAPP** es una plataforma SaaS para profesores colombianos que evalúa trabajos estudiantiles con IA, página por página, según rúbricas personalizadas.

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   FRONTEND      │────▶│     BACKEND      │────▶│   AGENTE IA     │
│   React 18      │     │   FastAPI        │     │   (DeepSeek)    │
│   localhost:3000│     │   Railway        │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│   LocalStorage  │     │   PostgreSQL     │
│   (Token JWT)   │     │   Railway        │
└─────────────────┘     └──────────────────┘
```

---

## 🔗 URLs Importantes

| Servicio | URL |
|----------|-----|
| Frontend Local | `http://localhost:3000` |
| Backend Railway | `https://web-production-83f44.up.railway.app` |
| Docs Backend | `https://web-production-83f44.up.railway.app/docs` |
| GitHub Frontend | `https://github.com/elescuchante10-code/evaluai-frontend` |

---

## 📁 Estructura del Frontend

```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── ChatPrincipal.js      # Chat con Agente IA
│   │   └── PanelEvaluacion.js    # Panel de resultados
│   ├── services/
│   │   └── api.js                # Todos los servicios API
│   ├── App.js                    # App principal con rutas
│   └── index.js
├── design/
│   ├── docs/                     # Documentación de diseño UX
│   │   ├── 01-user-journey.md
│   │   ├── 02-arquitectura-informacion.md
│   │   ├── 03-sistema-diseno.md
│   │   └── 04-flujo-optimizado-landing.md
│   └── wireframes/               # Wireframes ASCII
│       ├── 01-login-wireframe.md
│       ├── 02-dashboard-wireframe.md
│       ├── 03-flujo-evaluacion-wireframe.md
│       └── 04-resultados-wireframe.md
├── package.json
└── README.md
```

---

## 🔌 Servicios API (src/services/api.js)

### Auth API
```javascript
authAPI.login(email, password)           → POST /auth/login
authAPI.register(email, password, name)  → POST /auth/register
authAPI.getMe()                          → GET /auth/me
authAPI.logout()
```

### Agente API
```javascript
agenteAPI.chat(mensaje, contexto, historial)  → POST /agente/chat
agenteAPI.sugerirRubrica(asignatura)          → GET /agente/sugerir-rubrica
```

### Documentos API
```javascript
documentosAPI.subir(file, asignatura)    → POST /documentos/subir
documentosAPI.listar()                   → GET /documentos
documentosAPI.obtener(id)                → GET /documentos/{id}
documentosAPI.eliminar(id)               → DELETE /documentos/{id}
```

### Evaluaciones API
```javascript
evaluacionesAPI.procesar(docId, asignatura)  → POST /evaluaciones/procesar
evaluacionesAPI.obtener(id)                  → GET /evaluaciones/{id}
evaluacionesAPI.listarAsignaturas()          → GET /evaluaciones/asignaturas/lista
```

---

## 🎨 Componentes Principales

### 1. ChatPrincipal.js
**Props:**
- `asignaturas` - Lista de asignaturas disponibles
- `evaluacionActiva` - Documento siendo evaluado
- `procesoEvaluacion` - Array de pasos del proceso
- `resultadoEvaluacion` - Resultado final
- `onSubirDocumento` - Callback al subir archivo
- `user` - Usuario actual

**Estado interno:**
- `mensajes` - Array de mensajes del chat
- `input` - Texto del input
- `cargando` - Estado de carga
- `contexto` - Contexto para el agente

### 2. App.js
**Vistas:**
- `landing` - Página de inicio
- `login` - Inicio de sesión
- `register` - Registro de usuario
- `dashboard` - Panel principal con chat

**Estado global:**
- `user` - Usuario autenticado
- `evaluacionActiva` - Evaluación en progreso
- `resultadoEvaluacion` - Resultado de evaluación
- `historialEvaluaciones` - Historial del usuario

---

## 🔄 Flujos de Usuario

### Flujo 1: Registro → Dashboard
```
Landing → Register → POST /auth/register → Dashboard
```

### Flujo 2: Login → Dashboard
```
Landing → Login → POST /auth/login → Dashboard
```

### Flujo 3: Evaluación Completa
```
1. Usuario escribe en chat → POST /agente/chat
2. Agente responde con acción "evaluar"
3. Usuario sube archivo → POST /documentos/subir
4. Frontend muestra estimación
5. Usuario confirma → POST /evaluaciones/procesar
6. Backend procesa (3-5 segundos)
7. Frontend muestra resultado en chat
8. Usuario puede descargar PDF o pedir ajustes
```

---

## 🎭 Acciones del Agente IA

El backend puede retornar estas acciones en `respuesta.accion`:

| Acción | Frontend debe... |
|--------|------------------|
| `evaluar` | Abrir selector de archivo |
| `rubrica` | Mostrar configurador de rúbrica |
| `info` | Solo mostrar mensaje |
| `general` | Mostrar respuesta normal |

---

## 🔐 Autenticación

### Token JWT
- Se guarda en `localStorage.getItem('token')`
- Se envía en header: `Authorization: Bearer <token>`
- El backend lo valida en endpoints protegidos

### Usuario en localStorage
```javascript
localStorage.getItem('user') → {
  id: "uuid",
  email: "user@ejemplo.com",
  full_name: "Nombre",
  words_available: 120000,
  words_used: 0
}
```

---

## 🐛 Modo DEBUG

Para activar modo demo sin backend:

```javascript
// En src/services/api.js
const MODO_DEMO = true;  // Cambiar a false para backend real
```

En modo demo:
- Auth simulado (cualquier email funciona)
- Chat con respuestas predefinidas
- Evaluaciones con datos de ejemplo

---

## 📦 Dependencias

```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-scripts": "5.0.1"
}
```

Sin dependencias adicionales - solo React puro con fetch API.

---

## 🚀 Comandos

```bash
# Desarrollo
cd frontend
npm start

# Build producción
npm run build

# Deploy GitHub
npm run deploy
```

---

## ⚠️ Issues Conocidos

1. **CORS**: Si el backend no tiene CORS configurado, las peticiones fallan
   - Solución: Backend debe incluir `Access-Control-Allow-Origin: *`

2. **MODO_DEMO**: Si `MODO_DEMO = true`, todo es simulado
   - Para producción: Cambiar a `false`

3. **Estado del chat**: El historial se pierde al recargar
   - Opcional: Persistir en localStorage o backend

---

## 📝 Notas para Desarrollo

### Agregar nuevo endpoint:
1. Crear función en `src/services/api.js`
2. Usar `getHeaders()` para autenticación
3. Incluir `mode: 'cors'` en fetch
4. Manejar errores con try/catch

### Modificar el chat:
- Editar `ChatPrincipal.js`
- El formato de mensajes es:
  ```javascript
  {
    id: timestamp,
    tipo: 'usuario' | 'agente' | 'proceso' | 'resultado',
    contenido: 'string',
    tiempo: Date
  }
  ```

### Agregar nueva vista:
1. Crear función render en `App.js`
2. Agregar estado para controlar vista
3. Incluir en el switch final del render

---

## 🔗 Endpoints Backend (Confirmados)

| Método | Endpoint | Estado |
|--------|----------|--------|
| POST | /auth/register | ✅ |
| POST | /auth/login | ✅ |
| GET | /auth/me | ✅ |
| POST | /agente/chat | ✅ |
| POST | /documentos/subir | ✅ |
| GET | /documentos | ✅ |
| POST | /evaluaciones/procesar | ✅ |
| GET | /evaluaciones/asignaturas/lista | ✅ |

---

## 💡 Tips

1. Si el backend devuelve 404, verificar que Railway haya hecho redeploy
2. Si hay error CORS, verificar configuración en backend
3. El token JWT expira - si falla, redirigir a login
4. El chat mantiene contexto en memoria (se pierde al recargar)

---

*Última actualización: 2025-03-01*
*Versión: 1.0.0*
