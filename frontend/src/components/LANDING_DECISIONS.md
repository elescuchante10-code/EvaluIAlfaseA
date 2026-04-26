# Landing pública (Fase E) — decisiones de demo

## Suscripción (Wompi)

CTA: **“Suscribirme por $35.000 COP/mes”**

- **Si el usuario NO está autenticado** (no hay `token` en `localStorage`):
  - Se redirige a `currentView='login'`
  - Se muestra el mensaje: **“Inicia sesión para suscribirte.”**
- **Si el usuario SÍ está autenticado**:
  - Se llama `POST /api/billing/wompi/payment-links` con `{ plan_code: 'pro' }`
  - Se redirige a `checkout_url`

Motivo: para demo comercial, el flujo es claro y evita crear “leads” por correo (canal único WhatsApp).

## Privacidad / assets

En este commit, las carpetas provistas `C:\Users\User\AgenciaIA\tmp_pdf_*` están **vacías**, por lo que la landing usa **micro‑animaciones y UI de referencia sin datos reales**.

Cuando haya fragmentos reales disponibles:
- Solo se incluirán si están **100% anonimizados** (sin nombres, correos, IDs, ni PII).
- Se guardarán en `frontend/src/assets/landing/` con nombres neutrales (ej. `exam-fragment-01.png`).

