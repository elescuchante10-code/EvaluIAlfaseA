# Backend Requirements - Integración Frontend/Backend

> Documento técnico para unificar EvaluAI Frontend con Backend

---

## 🔌 URL Base

```
https://web-production-83f44.up.railway.app
```

---

## 📋 Endpoints Requeridos

### 1. Autenticación

#### POST `/auth/login`
**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response Exitoso (200):**
```json
{
  "success": true,
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": "uuid-del-usuario",
    "email": "user@example.com",
    "full_name": "Nombre Usuario",
    "words_available": 120000,
    "words_used": 0,
    "plan_type": "profesor"
  }
}
```

**Response Error (401):**
```json
{
  "success": false,
  "detail": "Credenciales incorrectas"
}
```

---

#### POST `/auth/register`
**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "Nombre Completo",
  "institution": "Colegio XYZ"  // opcional
}
```

**Response Exitoso (201):**
```json
{
  "success": true,
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": "uuid-del-usuario",
    "email": "user@example.com",
    "full_name": "Nombre Completo",
    "words_available": 120000,
    "words_used": 0,
    "plan_type": "profesor"
  }
}
```

**Response Error (400):**
```json
{
  "success": false,
  "detail": "El email ya está registrado"
}
```

---

#### GET `/auth/me`
**Headers:**
```
Authorization: Bearer <token>
```

**Response Exitoso (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid-del-usuario",
    "email": "user@example.com",
    "full_name": "Nombre Usuario",
    "words_available": 120000,
    "words_used": 0,
    "plan_type": "profesor"
  }
}
```

**Response Error (401):**
```json
{
  "success": false,
  "detail": "Token inválido o expirado"
}
```

---

### 2. Documentos

#### POST `/documentos/subir`
**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data  // El browser lo pone automáticamente
```

**Body (FormData):**
```
archivo: <archivo PDF/DOCX/TXT>
asignatura: "lenguaje"
rubrica_json: "{...}"  // opcional
```

**Response Exitoso (200):**
```json
{
  "success": true,
  "documento_id": "uuid-del-documento",
  "estimacion": {
    "temp_id": "uuid-temporal",
    "filename": "ensayo.pdf",
    "word_count": 1250,
    "num_segmentos": 5,
    "asignatura": "lenguaje",
    "texto_preview": "Primeras 200 caracteres...",
    "estimacion_costo": {
      "usd": 0.05,
      "cop": 205,
      "tokens_input": 2000,
      "tokens_output": 800
    }
  }
}
```

---

#### GET `/documentos`
**Headers:**
```
Authorization: Bearer <token>
```

**Query Params (opcionales):**
```
asignatura=lenguaje&limit=50&offset=0
```

**Response Exitoso (200):**
```json
{
  "success": true,
  "documentos": [
    {
      "id": "uuid-doc-1",
      "filename": "ensayo1.pdf",
      "asignatura": "lenguaje",
      "created_at": "2025-03-01T10:00:00Z",
      "calificacion_global": 8.5,
      "semaforo_global": "VERDE"
    }
  ]
}
```

---

### 3. Evaluaciones

#### POST `/evaluaciones/procesar`
**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Body (FormData):**
```
documento_id: "uuid-del-documento"
asignatura: "lenguaje"
rubrica: "{...}"  // opcional, JSON string
```

**Response Exitoso (200):**
```json
{
  "success": true,
  "id": "uuid-evaluacion",
  "calificacion_global": 8.5,
  "semaforo_global": "VERDE",
  "total_segments": 5,
  "segmentos": [
    {
      "id": 1,
      "tipo": "Introducción",
      "calificacion": 8.5,
      "semaforo": "VERDE",
      "retroalimentacion": "Excelente planteamiento del tema",
      "criterios": []
    },
    {
      "id": 2,
      "tipo": "Desarrollo 1",
      "calificacion": 7.8,
      "semaforo": "VERDE",
      "retroalimentacion": "Buenos argumentos",
      "criterios": []
    }
  ],
  "retroalimentacion": "El estudiante demuestra buen dominio...",
  "evaluacion": {
    "total_segments": 5,
    "calificacion_global": 8.5,
    "semaforo_global": "VERDE"
  }
}
```

---

#### GET `/evaluaciones/asignaturas/lista`
**Headers:**
```
Authorization: Bearer <token>
```

**Response Exitoso (200):**
```json
{
  "success": true,
  "asignaturas": [
    { "id": "matematicas", "nombre": "Matemáticas", "icono": "📐" },
    { "id": "lenguaje", "nombre": "Lengua Castellana", "icono": "📚" },
    { "id": "ingles", "nombre": "Inglés", "icono": "🗣️" },
    { "id": "sociales", "nombre": "Ciencias Sociales", "icono": "🌍" },
    { "id": "ciencias", "nombre": "Ciencias Naturales", "icono": "🔬" },
    { "id": "artes", "nombre": "Artes", "icono": "🎨" }
  ]
}
```

---

### 4. Agente IA

#### POST `/agente/chat`
**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "mensaje": "Quiero evaluar un ensayo",
  "contexto": {
    "asignatura": "lenguaje",
    "documento_actual": null
  },
  "historial": [
    { "role": "user", "content": "Hola" },
    { "role": "assistant", "content": "¡Hola! ¿En qué puedo ayudarte?" }
  ]
}
```

**Response Exitoso (200):**
```json
{
  "success": true,
  "respuesta": "¡Perfecto! Para evaluar un documento, sube el archivo...",
  "accion": "evaluar",
  "data": null
}
```

**Posibles acciones:**
- `"evaluar"` - El frontend abre el selector de archivo
- `"rubrica"` - El frontend muestra el configurador de rúbrica
- `"info"` - Solo mostrar información
- `null` - Respuesta normal

---

## ⚙️ Configuración CORS Requerida

El backend debe permitir CORS desde el frontend:

```python
# FastAPI ejemplo
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",           # Desarrollo local
        "https://elescuchante10-code.github.io",  # GitHub Pages
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 🔐 JWT Token

- **Header:** `Authorization: Bearer <token>`
- **Algoritmo:** HS256 (recomendado)
- **Expiración:** 24 horas (recomendado)
- **Payload mínimo:**
```json
{
  "sub": "uuid-del-usuario",
  "exp": 1234567890,
  "iat": 1234567890
}
```

---

## 🚨 Manejo de Errores Estándar

Todos los errores deben seguir este formato:

```json
{
  "success": false,
  "detail": "Mensaje descriptivo del error",
  "code": "ERROR_CODE_OPCIONAL"
}
```

**Códigos HTTP a usar:**
- `200` - OK (GET, POST exitoso)
- `201` - Created (registro exitoso)
- `400` - Bad Request (datos inválidos)
- `401` - Unauthorized (token inválido/faltante)
- `403` - Forbidden (sin permisos)
- `404` - Not Found
- `500` - Server Error

---

## 📁 Campos de Archivo Soportados

**Tipos MIME permitidos:**
- `application/pdf`
- `application/msword`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `text/plain`

**Tamaño máximo recomendado:** 10MB

---

## ✅ Checklist Backend

- [ ] CORS configurado para `localhost:3000` y GitHub Pages
- [ ] JWT middleware funcionando
- [ ] `/auth/login` retorna `access_token` y `user`
- [ ] `/auth/register` retorna `access_token` y `user`
- [ ] `/auth/me` retorna datos del usuario autenticado
- [ ] `/documentos/subir` acepta multipart/form-data
- [ ] `/evaluaciones/procesar` acepta multipart/form-data
- [ ] `/evaluaciones/asignaturas/lista` retorna lista de asignaturas
- [ ] Todas las respuestas tienen campo `success`
- [ ] Errores retornan JSON con `detail`

---

*Versión: 1.0.0*
*Frontend: React 18*
*Última actualización: 2025-03-02*
