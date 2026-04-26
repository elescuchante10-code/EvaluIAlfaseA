# Wireframe: Dashboard

## Vista Desktop (1440px)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  [LOGO] EvaluAI                              Dashboard  Evaluar  Historial  [👤 ▼] │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  👋 ¡Hola, María!                                                        ⚙️ Config  │
│  Hoy es 1 de marzo de 2025                                                          │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                             │   │
│  │                        ➕ NUEVA EVALUACIÓN                                   │   │
│  │                                                                             │   │
│  │              Comienza a evaluar trabajos de tus estudiantes                  │   │
│  │                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐ │
│  │  📊             │  │  📝             │  │  💰             │  │  ⏱️            │ │
│  │                 │  │                 │  │                 │  │                │ │
│  │  12             │  │  45,230         │  │  $30,000        │  │  8.5 horas     │ │
│  │                 │  │                 │  │  COP            │  │                │ │
│  │  Evaluaciones   │  │  Palabras       │  │  Plan activo    │  │  Ahorradas     │ │
│  │  esta semana    │  │  restantes      │  │  este mes       │  │  esta semana   │ │
│  │                 │  │                 │  │                 │  │                │ │
│  │  ↑ 3 vs semana  │  │  ↓ 12% usado    │  │  Renueva: 15/03 │  │  ↑ 25% vs mes  │ │
│  │  anterior       │  │                 │  │                 │  │  anterior      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └────────────────┘ │
│                                                                                     │
│  🔔 Alertas                                                                        │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  ⚠️ Te quedan 10,000 palabras (8% de tu plan). Considera comprar más.      │   │
│  │                                                                             │   │
│  │  💡 Nueva función: Ahora puedes exportar evaluaciones a Excel.             │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  📋 Evaluaciones Recientes                                           [Ver todas →] │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                             │   │
│  │  Fecha        Estudiante      Asignatura        Calificación    Acciones    │   │
│  │  ────────────────────────────────────────────────────────────────────────   │   │
│  │                                                                             │   │
│  │  Hoy, 10:30   Juan Pérez      Matemáticas       8.5 🟢         [Ver] [↓]   │   │
│  │  Hoy, 09:15   Ana Gómez       Lengua            7.2 🟡         [Ver] [↓]   │   │
│  │  Ayer         Carlos Ruiz     Inglés            9.0 🟢         [Ver] [↓]   │   │
│  │  Ayer         María López     Sociales          6.5 🟡         [Ver] [↓]   │   │
│  │  28 Feb       Pedro Martínez  Ciencias          4.2 🔴         [Ver] [↓]   │   │
│  │                                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│                                                                                     │
│  © 2025 EvaluAI • Ayuda • Contacto • Términos                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

FONDO: #F9FAFB (gray-50)
STATS CARDS: Blanco, shadow suave
TABLE: Blanco, filas alternadas en hover
CTA BUTTON: Gradiente, full width card
```

---

## Vista Mobile (375px)

```
┌─────────────────┐
│ ≡  [LOGO]   🔔 👤│
├─────────────────┤
│                 │
│ 👋 ¡Hola,       │
│    María!       │
│                 │
│ ┌─────────────┐ │
│ │  ➕         │ │
│ │  NUEVA      │ │
│ │ EVALUACIÓN  │ │
│ └─────────────┘ │
│                 │
│ 📊 Tus Stats    │
│                 │
│ ┌───┐ ┌───┐     │
│ │12 │ │45K│     │
│ │Ev │ │Pal│     │
│ └───┘ └───┘     │
│ ┌───┐ ┌───┐     │
│ │30K│ │8.5│     │
│ │COP│ │hrs│     │
│ └───┘ └───┘     │
│                 │
│ ⚠️ Te quedan... │
│                 │
│ 📋 Recientes    │
│ [Ver todas →]   │
│                 │
│ ┌─────────────┐ │
│ │Juan Pérez   │ │
│ │Matemáticas  │ │
│ │8.5 🟢 Hoy   │ │
│ │[Ver] [↓]    │ │
│ └─────────────┘ │
│                 │
│ ┌─────────────┐ │
│ │Ana Gómez    │ │
│ │Lengua       │ │
│ │7.2 🟡 Ayer  │ │
│ │[Ver] [↓]    │ │
│ └─────────────┘ │
│                 │
│ [🏠] [➕] [📋] [👤│
└─────────────────┘
NAVBAR INFERIOR
```

---

## Componentes Detallados

### 1. Stats Card

```
┌─────────────────┐
│  📊             │  ← Icono 24px, color primario
│                 │
│     45,230      │  ← Número 32px, bold, gray-900
│                 │
│  Palabras       │  ← Label 14px, medium, gray-500
│  restantes      │
│                 │
│  ↓ 12% usado    │  ← Trend 12px, color según dirección
│                 │     ↑ verde, ↓ rojo/amarillo
└─────────────────┘

SIZE: ~220px x 140px desktop
      ~45% width mobile (2 por fila)
PADDING: 24px
BORDER-RADIUS: 16px
BACKGROUND: white
SHADOW: 0 1px 3px rgba(0,0,0,0.1)
```

### 2. Alert Banner

```
┌────────────────────────────────────────┐
│ ⚠️                                     │  ← Icono warning
│ Te quedan 10,000 palabras (8%).        │  ← Texto principal
│ [Comprar más →]                        │  ← CTA opcional
└────────────────────────────────────────┘

VARIANTES:
🟡 Warning (saldo bajo): bg-amarillo-suave, border-amarillo
🔴 Danger (sin saldo): bg-rojo-suave, border-rojo
🔵 Info (nueva función): bg-azul-suave, border-azul
🟢 Success (pago exitoso): bg-verde-suave, border-verde
```

### 3. Tabla de Evaluaciones

```
┌────────────────────────────────────────────────────────┐
│ Fecha     │ Estudiante │ Asignatura   │ Nota  │ Acc  │
├───────────┼────────────┼──────────────┼───────┼──────┤
│ Hoy 10:30 │ Juan Pérez │ Matemáticas  │ 8.5 🟢 │ 👁 ↓ │
├───────────┼────────────┼──────────────┼───────┼──────┤
│ Hoy 09:15 │ Ana Gómez  │ Lengua       │ 7.2 🟡 │ 👁 ↓ │
└───────────┴────────────┴──────────────┴───────┴──────┘

ROW HOVER: bg-gray-50
SEMAFOROS: 
  🟢 Verde bg: #DCFCE7, text: #166534
  🟡 Amarillo bg: #FEF9C3, text: #A16207
  🔴 Rojo bg: #FEE2E2, text: #991B1B

MOBILE: Convierte a cards apiladas verticalmente
```

---

## Navegación

### Desktop (Navbar superior)
```
[LOGO] EvaluAI    Dashboard  Evaluar  Historial  Rúbricas    [👤 Perfil ▼]
                   (active)
```

### Mobile (Bottom navigation)
```
┌─────────┬─────────┬─────────┬─────────┐
│   🏠    │    ➕    │    📋   │    👤   │
│  Inicio │ Evaluar │ Historial│ Perfil │
└─────────┴─────────┴─────────┴─────────┘

ACTIVE: Icono + texto en color primario
INACTIVE: Icono + texto en gray-400
```

---

## Estados de la Tabla

### Empty State (sin evaluaciones)
```
┌────────────────────────────────────────┐
│                                        │
│              📄 Empty                  │
│                                        │
│      Aún no tienes evaluaciones        │
│                                        │
│   Comienza evaluando tu primer         │
│   trabajo de estudiante                │
│                                        │
│        [➕ Nueva Evaluación]           │
│                                        │
└────────────────────────────────────────┘
```

### Loading State
```
┌────────────────────────────────────────┐
│ ⏳ Cargando evaluaciones...            │
│                                        │
│  ┌────────────────────────────────┐    │
│  │ ████████████████░░░░░░░░░░░░░░ │    │  ← Skeleton loader
│  └────────────────────────────────┘    │
│  ┌────────────────────────────────┐    │
│  │ ████████████████░░░░░░░░░░░░░░ │    │
│  └────────────────────────────────┘    │
└────────────────────────────────────────┘
```

---

## Interacciones

| Elemento | Hover | Click |
|----------|-------|-------|
| Stats Card | Shadow aumenta, lift 2px | - |
| Fila tabla | bg-gray-50 | Navega a detalle |
| Botón "Ver" | - | Abre modal/página detalle |
| Botón "↓" | - | Descarga PDF |
| "Nueva Evaluación" | Shadow + lift | Navega a /evaluar |
| Alerta cerrar | - | Desaparece con animación |
