# EvaluAI - Arquitectura de Información

## 📱 Estructura de Pantallas

### Navegación Principal
```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]  Dashboard  Evaluar  Historial  Rúbricas  [Perfil]  │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Pantalla: Login

**Propósito:** Acceso seguro al sistema

**Elementos:**
- Logo EvaluAI + tagline
- Campo: Email
- Campo: Contraseña
- Botón: "Iniciar sesión"
- Link: "¿Olvidaste tu contraseña?"
- Link: "Crear cuenta" (para nuevos usuarios)

**Validaciones:**
- Email formato válido
- Contraseña mínimo 8 caracteres

---

## 2. Pantalla: Dashboard (Home)

**Propósito:** Vista general y acceso rápido

**Secciones:**

### Header
- Saludo personalizado: "¡Hola, María!"
- Fecha actual
- Notificaciones (bell icon)

### Stats Cards (4 columnas)
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Evaluaciones│  │   Palabras   │  │    Saldo    │  │   Tiempo    │
│   esta semana│  │   restantes  │  │   disponible│  │   ahorrado  │
│     12       │  │   45,230     │  │ $30,000 COP │  │   8.5 hrs   │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

### Acción Principal
- Botón grande: "➕ Nueva Evaluación"

### Evaluaciones Recientes (tabla)
| Fecha | Estudiante | Asignatura | Calificación | Acciones |
|-------|------------|------------|--------------|----------|
| Hoy | Juan Pérez | Matemáticas | 8.5 🟢 | Ver |
| Ayer | Ana Gómez | Lengua | 7.2 🟡 | Ver |

### Alertas/Notificaciones
- "Te quedan 10,000 palabras (8% de tu plan)"
- "Nueva función: Exportar a Excel disponible"

---

## 3. Pantalla: Flujo de Evaluación (Wizard)

**Tipo:** Wizard de 3 pasos con barra de progreso

### Paso 1: Configurar
**Título:** "¿Qué vas a evaluar?"

**Campos:**
1. **Asignatura** (selector)
   - 📐 Matemáticas
   - 📚 Lengua Castellana
   - 🗣️ Inglés
   - 🌍 Ciencias Sociales
   - 🔬 Ciencias Naturales
   - 🎨 Artes
   - 📊 Filosofía
   - ⚽ Educación Física

2. **Tipo de trabajo** (selector dependiente)
   - Según asignatura: Ensayo, Ejercicios, Problemas, etc.

3. **Rúbrica** (selector + opción crear nueva)
   - "Rúbrica por defecto [Asignatura]"
   - "Usar rúbrica personalizada..."
   - "➕ Crear nueva rúbrica"

4. **Nombre del estudiante** (opcional, para organización)

**Botones:**
- "Cancelar" (secundario)
- "Continuar →" (primario)

---

### Paso 2: Subir Documento
**Título:** "Sube el trabajo del estudiante"

**Área de carga:**
- Dropzone grande con icono 📄
- Texto: "Arrastra archivos aquí o haz click para seleccionar"
- Formatos soportados: PDF, DOCX, TXT
- Tamaño máximo: 10MB

**Preview del archivo:**
- Nombre del archivo
- Tamaño
- Icono según tipo
- Botón "Eliminar" (si quiere cambiar)

**Validaciones visuales:**
- ✅ Archivo válido
- ❌ Formato no soportado (rojo)
- ❌ Archivo muy grande >10MB

**Botones:**
- "← Volver"
- "Continuar →"

---

### Paso 3: Confirmar y Evaluar
**Título:** "Revisa antes de evaluar"

**Resumen Card:**
```
┌─────────────────────────────────────┐
│  📄 DOCUMENTO                       │
│  nombre_archivo.pdf                 │
│                                     │
│  📊 ESTIMACIÓN                      │
│  • Palabras: 1,250                  │
│  • Segmentos: 5 párrafos            │
│  • Tiempo estimado: 15 segundos     │
│                                     │
│  💰 COSTO                           │
│  • $180 COP (~$0.04 USD)            │
│                                     │
│  💳 TU SALDO                        │
│  • 45,230 palabras restantes        │
│  • ✅ Suficiente para esta evaluación│
└─────────────────────────────────────┘
```

**Alertas condicionales:**
- 🟡 Saldo bajo (< 20%): "Te quedan pocos créditos. Considera comprar más."
- 🔴 Sin saldo: "No tienes suficientes palabras. Compra un bloque extra para continuar."

**Botones:**
- "← Volver"
- "✅ Confirmar y Evaluar" (destacado)

---

## 4. Pantalla: Procesando

**Propósito:** Feedback durante la espera

**Elementos:**
- Animación de carga (spinner o progress bar)
- Mensajes rotativos:
  - "Analizando documento..."
  - "Segmentando por párrafos..."
  - "Evaluando cada sección con IA..."
  - "Generando retroalimentación..."
- Tiempo estimado restante
- Botón "Cancelar" (opcional)

---

## 5. Pantalla: Resultados

**Propósito:** Mostrar evaluación completa

### Header de Resultado
```
┌─────────────────────────────────────────────────────────┐
│  ✅ ¡Evaluación Completada!                             │
│                                                         │
│  🟢 8.5/10              Excelente trabajo               │
│  [Barra de color verde]                                 │
└─────────────────────────────────────────────────────────┘
```

**Sistema de Semáforos:**
- 🟢 **Verde** (8-10): Excelente / Desempeño sobresaliente
- 🟡 **Amarillo** (6-7.9): Aceptable / Con observaciones
- 🔴 **Rojo** (<6): Requiere revisión / Necesita mejorar

### Tabs de Navegación
- "Resumen" | "Detalle por Segmento" | "Retroalimentación" | "Reporte PDF"

### Tab: Resumen
- Calificación global con semáforo grande
- Distribución de calificaciones por criterio (gráfico de barras)
- Fortalezas principales (lista con ✅)
- Áreas de mejora (lista con 📌)
- Recomendación general (párrafo)

### Tab: Detalle por Segmento (Tabla)
| Segmento | Tipo | Calificación | Semáforo | Acción |
|----------|------|--------------|----------|--------|
| Introducción | Párrafo | 9.0 | 🟢 | Ver |
| Desarrollo 1 | Párrafo | 7.5 | 🟡 | Ver |
| Desarrollo 2 | Párrafo | 8.0 | 🟢 | Ver |
| Conclusión | Párrafo | 9.5 | 🟢 | Ver |

### Tab: Retroalimentación Detallada
- Acordeones expandibles por segmento
- Cada uno contiene:
  - Texto original (resaltado)
  - Comentarios específicos
  - Correcciones sugeridas
  - Recursos recomendados

### Acciones Finales
- "📥 Descargar Reporte (PDF)"
- "📋 Copiar calificación"
- "📝 Editar retroalimentación"
- "🔄 Evaluar otro documento"

---

## 6. Pantalla: Historial

**Propósito:** Ver evaluaciones pasadas

**Filtros:**
- Rango de fechas
- Asignatura
- Estudiante (búsqueda)
- Calificación (rango)

**Lista/Tarjetas de evaluaciones:**
```
┌─────────────────────────────────────┐
│ 📄 Ensayo_JuanPerez.pdf             │
│ 📚 Lengua Castellana | 8.5 🟢       │
│ Juan Pérez | 15/02/2025             │
│                                     │
│ [Ver] [Descargar] [Eliminar]        │
└─────────────────────────────────────┘
```

---

## 7. Pantalla: Rúbricas

**Propósito:** Gestionar rúbricas personalizadas

**Lista de rúbricas:**
- Rúbrica por defecto (no editable)
- Mis rúbricas personalizadas

**Editor de Rúbrica:**
- Nombre de rúbrica
- Tabla de criterios:
  | Criterio | Descripción | Peso % | Acciones |
  |----------|-------------|--------|----------|
  | Tesis | Claridad de la tesis | 25% | ✏️ 🗑️ |
  | Coherencia | Organización lógica | 25% | ✏️ 🗑️ |

- Botón: "➕ Agregar criterio"
- Validación: Suma de pesos debe ser 100%

---

## 8. Pantalla: Perfil/Configuración

**Secciones:**
- **Datos personales:** Nombre, email, institución
- **Plan y facturación:**
  - Plan actual (Profesor $30k/mes)
  - Palabras usadas este mes (gráfico)
  - Historial de pagos
  - Botón: "Comprar bloque extra"
- **Preferencias:**
  - Notificaciones (email/push)
  - Tema (claro/oscuro)
  - Idioma (español/portugués/inglés futuro)

---

## 🧭 Navegación Global

### Navbar (siempre visible)
```
[Logo: EvaluAI]  [Dashboard] [+ Nueva Evaluación] [Historial] [Rúbricas]  [Perfil ▼]
```

### Footer
- Links: Ayuda, Contacto, Términos, Privacidad
- Versión de la app
- Copyright

### Mobile (Bottom Navigation)
```
[🏠 Inicio] [➕ Evaluar] [📋 Historial] [👤 Perfil]
```

---

## 📐 Jerarquía Visual

1. **Títulos:** 24-32px, bold, color primario
2. **Subtítulos:** 18-20px, semibold
3. **Texto normal:** 14-16px, regular
4. **Labels/pequeño:** 12px, medium
5. **Botones primarios:** Fondo primario, texto blanco
6. **Botones secundarios:** Borde primario, texto primario
