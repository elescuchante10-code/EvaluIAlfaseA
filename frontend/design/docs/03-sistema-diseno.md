# EvaluAI - Sistema de Diseño

## 🎨 Identidad Visual

### Marca
- **Nombre:** EvaluAI
- **Tagline:** "Evaluación académica inteligente"
- **Personalidad:** Profesional, confiable, moderna, accesible

---

## 🌈 Paleta de Colores

### Colores Primarios
```css
--color-primary-50:  #EEF2FF;   /* Fondos sutiles */
--color-primary-100: #E0E7FF;   /* Hover states */
--color-primary-200: #C7D2FE;   /* Borders */
--color-primary-500: #6366F1;   /* Principal - Indigo */
--color-primary-600: #4F46E5;   /* Hover botones */
--color-primary-700: #4338CA;   /* Active/Press */
--color-primary-900: #312E81;   /* Textos importantes */
```

### Colores Secundarios (Gradiente original)
```css
--gradient-primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
--gradient-hover: linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%);
```

### Sistema de Semáforos (Calificaciones)
```css
/* Verde - Excelente (8-10) */
--semaforo-verde-bg: #DCFCE7;
--semaforo-verde-text: #166534;
--semaforo-verde-icon: #22C55E;

/* Amarillo - Aceptable (6-7.9) */
--semaforo-amarillo-bg: #FEF9C3;
--semaforo-amarillo-text: #A16207;
--semaforo-amarillo-icon: #EAB308;

/* Rojo - Necesita mejora (<6) */
--semaforo-rojo-bg: #FEE2E2;
--semaforo-rojo-text: #991B1B;
--semaforo-rojo-icon: #EF4444;
```

### Colores de Estado
```css
--success-500: #22C55E;   /* Éxito */
--warning-500: #F59E0B;   /* Advertencia */
--error-500: #EF4444;     /* Error */
--info-500: #3B82F6;      /* Información */
```

### Escala de Grises
```css
--gray-50:  #F9FAFB;   /* Fondo página */
--gray-100: #F3F4F6;   /* Cards secundarios */
--gray-200: #E5E7EB;   /* Bordes sutiles */
--gray-300: #D1D5DB;   /* Bordes */
--gray-400: #9CA3AF;   /* Texto deshabilitado */
--gray-500: #6B7280;   /* Texto secundario */
--gray-700: #374151;   /* Texto principal */
--gray-900: #111827;   /* Títulos */
```

---

## 🔤 Tipografía

### Familia
```css
--font-family-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-family-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

### Escala Tipográfica
```css
/* Títulos */
--text-h1: 2.5rem;      /* 40px - Títulos de página */
--text-h2: 2rem;        /* 32px - Secciones */
--text-h3: 1.5rem;      /* 24px - Subsecciones */
--text-h4: 1.25rem;     /* 20px - Cards */

/* Cuerpo */
--text-lg: 1.125rem;    /* 18px - Texto destacado */
--text-base: 1rem;      /* 16px - Texto normal */
--text-sm: 0.875rem;    /* 14px - Texto secundario */
--text-xs: 0.75rem;     /* 12px - Labels, captions */

/* Pesos */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Jerarquía de Texto
| Elemento | Tamaño | Peso | Color | Line-height |
|----------|--------|------|-------|-------------|
| H1 (Página) | 40px | Bold (700) | Gray-900 | 1.2 |
| H2 (Sección) | 32px | Bold (700) | Gray-900 | 1.3 |
| H3 (Card) | 24px | Semibold (600) | Gray-900 | 1.4 |
| Body | 16px | Normal (400) | Gray-700 | 1.6 |
| Small/Caption | 14px | Medium (500) | Gray-500 | 1.5 |
| Label | 12px | Semibold (600) | Gray-700 | 1.4 |

---

## 📐 Espaciado (Spacing Scale)

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

---

## 🎯 Componentes UI

### 1. Botones

#### Botón Primario
```css
.btn-primary {
  background: var(--gradient-primary);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 16px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 6px -1px rgba(102, 126, 234, 0.3);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 12px -1px rgba(102, 126, 234, 0.4);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}
```

#### Botón Secundario
```css
.btn-secondary {
  background: white;
  color: var(--color-primary-600);
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 16px;
  border: 2px solid var(--color-primary-200);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: var(--color-primary-50);
  border-color: var(--color-primary-500);
}
```

#### Botón Ghost
```css
.btn-ghost {
  background: transparent;
  color: var(--gray-600);
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
}

.btn-ghost:hover {
  background: var(--gray-100);
  color: var(--gray-900);
}
```

### 2. Inputs

#### Input de Texto
```css
.input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--gray-200);
  border-radius: 8px;
  font-size: 16px;
  color: var(--gray-900);
  background: white;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.input::placeholder {
  color: var(--gray-400);
}

.input-error {
  border-color: var(--error-500);
  background: #FEF2F2;
}
```

#### Select
```css
.select {
  appearance: none;
  background-image: url("data:image/svg+xml,..."); /* Chevron down */
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 40px;
  /* Resto igual a .input */
}
```

#### File Input / Dropzone
```css
.dropzone {
  border: 2px dashed var(--gray-300);
  border-radius: 12px;
  padding: 48px 24px;
  text-align: center;
  background: var(--gray-50);
  cursor: pointer;
  transition: all 0.2s ease;
}

.dropzone:hover {
  border-color: var(--color-primary-500);
  background: var(--color-primary-50);
}

.dropzone-active {
  border-color: var(--color-primary-500);
  background: var(--color-primary-50);
  border-style: solid;
}
```

### 3. Cards

#### Card Base
```css
.card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--gray-100);
}

.card-hover:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
  transition: all 0.3s ease;
}
```

#### Card con Header
```css
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--gray-100);
}
```

### 4. Badges y Tags

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
}

.badge-verde {
  background: var(--semaforo-verde-bg);
  color: var(--semaforo-verde-text);
}

.badge-amarillo {
  background: var(--semaforo-amarillo-bg);
  color: var(--semaforo-amarillo-text);
}

.badge-rojo {
  background: var(--semaforo-rojo-bg);
  color: var(--semaforo-rojo-text);
}
```

### 5. Progress Bar y Loaders

```css
/* Progress Bar */
.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--gray-200);
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--gradient-primary);
  border-radius: 4px;
  transition: width 0.3s ease;
}

/* Spinner */
.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--gray-200);
  border-top-color: var(--color-primary-500);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### 6. Alerts y Notifications

```css
.alert {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  border-left: 4px solid;
}

.alert-info {
  background: #EFF6FF;
  border-color: var(--info-500);
  color: #1E40AF;
}

.alert-warning {
  background: #FFFBEB;
  border-color: var(--warning-500);
  color: #92400E;
}

.alert-error {
  background: #FEF2F2;
  border-color: var(--error-500);
  color: #991B1B;
}

.alert-success {
  background: #F0FDF4;
  border-color: var(--success-500);
  color: #166534;
}
```

---

## 📱 Responsive Breakpoints

```css
/* Mobile first */
--breakpoint-sm: 640px;   /* Teléfonos grandes */
--breakpoint-md: 768px;   /* Tablets */
--breakpoint-lg: 1024px;  /* Laptops */
--breakpoint-xl: 1280px;  /* Desktops */
--breakpoint-2xl: 1536px; /* Pantallas grandes */
```

### Comportamiento Responsive
- **Mobile (< 768px):** Layout de una columna, navegación inferior
- **Tablet (768px - 1024px):** Dos columnas donde aplique
- **Desktop (> 1024px):** Layout completo, navegación lateral

---

## 🎭 Iconografía

### Estilo
- **Tipo:** Iconos outline (línea) para UI, filled para estados/acciones
- **Tamaños:** sm (16px), md (20px), lg (24px), xl (32px)
- **Set recomendado:** Lucide React o Heroicons

### Iconos clave necesarios
| Uso | Icono | Nombre |
|-----|-------|--------|
| Dashboard | 🏠 | Home |
| Nueva evaluación | ➕ | Plus |
| Historial | 📋 | ClipboardList |
| Rúbricas | 📊 | LayoutList |
| Perfil | 👤 | User |
| Éxito | ✅ | CheckCircle |
| Error | ❌ | XCircle |
| Advertencia | ⚠️ | AlertTriangle |
| Info | ℹ️ | Info |
| Cargando | ⏳ | Loader |
| Subir archivo | 📤 | Upload |
| Descargar | 📥 | Download |
| Ver detalle | 👁️ | Eye |
| Editar | ✏️ | Pencil |
| Eliminar | 🗑️ | Trash2 |
| Configuración | ⚙️ | Settings |
| Logout | 🚪 | LogOut |

---

## 📐 Layout Grid

```css
/* Container */
.container {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 16px;
}

@media (min-width: 768px) {
  .container {
    padding: 0 24px;
  }
}

@media (min-width: 1024px) {
  .container {
    padding: 0 32px;
  }
}

/* Grid system */
.grid {
  display: grid;
  gap: 24px;
}

.grid-cols-1 { grid-template-columns: repeat(1, 1fr); }
.grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
.grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
.grid-cols-4 { grid-template-columns: repeat(4, 1fr); }

@media (min-width: 768px) {
  .md\:grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
  .md\:grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
}

@media (min-width: 1024px) {
  .lg\:grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
  .lg\:grid-cols-4 { grid-template-columns: repeat(4, 1fr); }
}
```

---

## ♿ Accesibilidad (A11y)

### Contraste
- Texto normal: Ratio mínimo 4.5:1
- Texto grande (18px+ bold): Ratio mínimo 3:1
- Todos los colores del sistema cumplen WCAG AA

### Focus States
```css
/* Focus visible para navegación por teclado */
*:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

/* Skip to content link */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--color-primary-900);
  color: white;
  padding: 8px;
  text-decoration: none;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
```

### Tamaños táctiles
- Botones: Mínimo 44x44px
- Inputs: Altura mínima 44px
- Espaciado entre elementos táctiles: Mínimo 8px

### Semántica HTML
- Usar `<main>`, `<nav>`, `<header>`, `<footer>` correctamente
- Headings jerárquicos (h1 > h2 > h3)
- Labels asociados a inputs (`htmlFor`)
- Alt text descriptivo en imágenes
