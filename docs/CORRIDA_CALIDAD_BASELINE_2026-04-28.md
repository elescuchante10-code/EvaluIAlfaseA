# Corrida baseline — protocolo de calidad (2026-04-28)

**Entorno:** `http://localhost:3000` · API `http://localhost:8000`  
**Cuenta nueva (regla acordada):**  
- Email: `evaluai.qa.baseline.20260428.run1@example.com`  
- Contraseña: `QABase#2026Run1!`  
- Usuario interno: `id=6` (tras registro)  

**Origen de documentos de prueba:**  
`/home/soluciones-de-ia/Descargas/planos de puebas /` (nota: el directorio tiene un **espacio al final** en el nombre).  
**Archivo usado en esta corrida:** `Camargo_Prada_Salomé_Filosofía_NM_2026.pdf`  

---

## 1) Registro (navegador controlado)

- Flujo: landing → **Crear cuenta** → formulario nombre / email / contraseña → envío.  
- Resultado: **OK**; sesión activa y dashboard (Mi Espacio IB).

## 2) Carga de documento (API; ver nota de protocolo)

- **Navegador:** el `input` de subida de archivos no se automatizó con ruta del sistema de archivos (limitación habitual del controlador de archivos en automatización).  
- **Sustitución aceptada para no bloquear el protocolo:** `POST /api/documents/upload` con `Authorization: Bearer <token de la cuenta>` y el PDF anterior.  
- **Respuesta HTTP:** 200, `document_id: 5`; markdown `ready` en el pack de servidor.  

## 3) Primer intento de Asistente IA (navegador)

- Pregunta tipo M1 (contenido específico de la guía, estímulo/intro).  
- Resultado: error **`insufficient_credits`** (`Créditos disponibles: 0` en la UI).  
- **Criterio afectado:** C4.2 (créditos) — usuario nuevo con saldo 0; el chat exige crédito según la política actual.  

## 4) Desbloqueo de créditos (operación de QA, no producto)

- `POST /api/admin/users/6/topup` con `+500` y razón de protocolo (rol admin: `juliolopez4p@gmail.com` en entorno local de desarrollo).  
- Saldo tras top-up: **500** créditos.  

*En producción se debe reemplazar esto por recarga comercial, usuario demo con crédito inicial, o política de onboarding explícita.*

## 5) Prueba M1 vía API (misma lógica que el Asistente: `asistente_ia` + `teacher_context_pack` servidor)

**Petición:** `POST /api/evaluate/chat` con `pack` de `GET /api/documents/teacher-context/pack` y resumen mínimo.

**Retrieval (evidencia):**

- `retrieval_mode`: `markdown_selective`  
- `documents_read`: `1`  
- Snippet con texto real del documento: chip *Telepathy* / Neuralink, cita a introducción.  

**Respuesta (resumen):** cita el estímulo (Neuralink / chip Telepathy) y relaciona con el enunciado de riesgos éticos.  

**Criterio:** C1.1–C1.2 y C2.2 verdes para este caso (pertinencia + prueba de uso de material; no puntuación formal).  

**Créditos:** se consumen según política del endpoint (revisar saldo vía `GET /api/auth/me` si hace falta trazabilidad contable en la siguiente corrida).

## 6) Sincronización UI (pendiente de repetición en navegador)

Tras el top-up, hace falta **sesión con `getMe` recargada** o nuevo login en el cliente para ver **500** créditos; una recarga a veces mantiene landing si la sesión de `localStorage` se pierde. Recomendación: repetir en navegador **entrar** con la misma cuenta y **Asistente** con la misma pregunta, o documentar “baseline API + baseline UI” como dos subfilas.

## 7) Puntuación provisional baseline (batería parcial M + R)

| Criterio / caso | Puntuación (0 / 0.5 / 1) | Nota |
|-----------------|---------------------------|------|
| C4.1 Registro y sesión | 1 | Registro OK. |
| C4.2 Créditos (usuario nuevo) | 0,5 o 0* | 0 salvo top-up: bloquea chat. |
| C1.1–C1.2 (M1, vía API) | 1 | Contenido recuperado y acorde al doc. |
| C2.1 (no evaluador) | 1* | Respuesta expositiva, sin nota IB inventada. |

*Validación en navegador y conjunto M2–F–E: pendiente siguiente sesión (o tras Fase A con UX de créditos más clara al registrarse).*

## 8) Riesgo de producto detectado

- **Cuenta nueva 0 créditos:** imposibilita probar el Asistente y el evaluador sin intervención (admin, compra o bono de bienvenida). Documentar decisión de producto para pruebas y clientes.  

---

*Ficha generada en contexto de [`MODELO_PRUEBA_CALIDAD_IA.md`](MODELO_PRUEBA_CALIDAD_IA.md). Reemplazar o archivar en cada corrida (registro nuevo por ejecución).*
