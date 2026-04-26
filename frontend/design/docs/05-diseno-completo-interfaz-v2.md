# 🎨 Diseño Completo Interfaz EvaluAI v2.0

> Documento de diseño para aprobación del cliente antes de implementación

---

## 📱 ESTRUCTURA GENERAL DE LA INTERFAZ

La aplicación tendrá **3 paneles principales**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  HEADER SUPERIOR (fijo)                                                                  │
│  [LOGO]  EvaluAI                    [🔍 Buscar]  [🔔]  [👤 Perí± Profesor ▼]  [⚙️]      │
├──────────────┬───────────────────────────────────────────────────────┬──────────────────┤
│              │                                                       │                  │
│   PANEL      │                                                       │    PANEL         │
│   IZQUIERDO  │         PANEL CENTRAL (Contenido Principal)          │    DERECHO       │
│   (250px)    │                                                       │    (300px)       │
│              │                                                       │                  │
│  Navegación  │   ┌─────────────────────────────────────────────┐    │  Contexto/       │
│  y Gestión   │   │                                             │    │  Herramientas    │
│              │   │   ÁREA DE TRABAJO PRINCIPAL                 │    │                  │
│              │   │                                             │    │  - Estado de     │
│              │   │   [Chat IA] o [Documento Estudiante]        │    │    evaluación    │
│              │   │                                             │    │  - Rúbrica       │
│              │   │   Según el modo activo                      │    │  - Controles     │
│              │   │                                             │    │  - Acciones      │
│              │   └─────────────────────────────────────────────┘    │                  │
│              │                                                       │                  │
│              │   [Input del Chat - Siempre visible abajo]           │                  │
│              │                                                       │                  │
├──────────────┴───────────────────────────────────────────────────────┴──────────────────┤
│  FOOTER (opcional)                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ PANEL IZQUIERDO - NAVEGACIÓN Y GESTIÓN

```
┌─────────────────────┐
│  [🏠] Dashboard     │  ← Pantalla principal
├─────────────────────┤
│  EVALUACIONES       │  ← Sección
│  ─────────────────  │
│  [➕] Nueva Eval    │  ← Inicia flujo de evaluación
│  [📁] Mis Evaluac.  │  ← Historial
│  [⏳] Pendientes    │  ← En proceso de revisión
├─────────────────────┤
│  MIS RÚBRICAS       │  ← Sección clave
│  ─────────────────  │
│  [📋] Ver Rúbricas  │  ← Lista de rúbricas creadas
│  [➕] Crear Rúbrica │  ← Wizard de creación
│  [📥] Importar      │  ← Desde Excel/Word
│  [🌐] Biblioteca    │  ← Plantillas públicas
├─────────────────────┤
│  DOCUMENTOS         │
│  ─────────────────  │
│  [📄] Biblioteca    │  ← Todos los trabajos subidos
│  [🗃️] Por Estudian. │  ← Organizado por alumno
│  [📚] Por Asignat.  │  ← Organizado por materia
├─────────────────────┤
│  ASISTENTE IA       │
│  ─────────────────  │
│  [💬] Chat General  │  ← Consultas sin documento
│  [🤖] Config. IA    │  ← Preferencias del agente
├─────────────────────┤
│  MI CUENTA          │
│  ─────────────────  │
│  [👤] Perfil        │
│  [💳] Suscripción   │
│  [📊] Uso           │  ← Palabras usadas/disponibles
│  [❓] Ayuda         │
│  [🚪] Cerrar Sesión │
└─────────────────────┘
```

---

## 📋 FLUJO 1: CREAR Y GESTIONAR RÚBRICAS

### Paso 1: Mis Rúbricas (Lista)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ PANEL IZQUIERDO          PANEL CENTRAL - MIS RÚBRICAS              PANEL DERECHO        │
├────────────────┬───────────────────────────────────────────────────┬────────────────────┤
│                │                                                   │                    │
│ [➕] Nueva     │  📋 MIS RÚBRICAS DE EVALUACIÓN                    │ ➕ ACCIONES        │
│ Evaluación     │                                                   │                    │
│                │  [Buscar rúbricas...]     [🔍] [Filtros ▼]       │ [Crear Nueva]      │
│ [📋] Ver       │                                                   │ [Importar]         │
│ Rúbricas   ◄───┼──┬───────────────────────────────────────────┐   │ [Usar Plantilla]   │
│                │  │ 📝 ENSAYO ARGUMENTATIVO - LENGUA          │   │                    │
│ [➕] Crear     │  │ 📚 Lengua Castellana  |  🏫 Secundaria    │   │ 📊 ESTADÍSTICAS    │
│ Rúbrica    ◄───┼──┤                                           │   │                    │
│                │  │ Criterios: 4  |  Usada: 12 veces          │   │ Total rúbricas: 8  │
│ [📥] Importar ◄┼──┤ [Ver] [Editar] [Duplicar] [🗑️]           │   │ Esta semana: +2    │
│                │  └───────────────────────────────────────────┘   │                    │
│ [🌐] Bibliotec.◄┼──┬───────────────────────────────────────────┐   │                    │
│                │  │ 🔢 RESOLUCIÓN PROBLEMAS - FÍSICA          │   │                    │
│                │  │ 🔬 Ciencias Naturales |  🏫 Bachillerato  │   │                    │
│                │  │ Criterios: 4  |  Usada: 5 veces           │   │                    │
│                │  │ [Ver] [Editar] [Duplicar] [🗑️]            │   │                    │
│                │  └───────────────────────────────────────────┘   │                    │
│                │                                                   │                    │
│                │  ─── RÚBRICAS PREDETERMINADAS DEL SISTEMA ───    │                    │
│                │  ┌───────────────────────────────────────────┐   │                    │
│                │  │ 📊 GENÉRICA - CUALQUIER ASIGNATURA        │   │                    │
│                │  │ ✓ Sistema recomendado por defecto         │   │                    │
│                │  │ [Ver] [Usar como base]                    │   │                    │
│                │  └───────────────────────────────────────────┘   │                    │
│                │                                                   │                    │
└────────────────┴───────────────────────────────────────────────────┴────────────────────┘
```

### Paso 2: Crear Nueva Rúbrica (Wizard)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                     CREAR NUEVA RÚBRICA                                  │
│                         [◄ Volver a Mis Rúbricas]                                        │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  PASO 1 DE 3                    PASO 2                    PASO 3                         │
│  [●──────○──────○]             [○──────●──────○]         [○──────○──────●]               │
│   Información básica ───────▶  Definir criterios  ─────▶  Revisar y guardar              │
│                                      ▲                                                   │
│                                 ESTOY AQUÍ                                               │
│                                                                                          │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  1. ¿CÓMO SE LLAMA TU RÚBRICA?                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐        │
│  │ 📝 Ej: Evaluación de Ensayos Argumentativos - 10° Grado                    │        │
│  └─────────────────────────────────────────────────────────────────────────────┘        │
│                                                                                          │
│  2. ¿PARA QUÉ ASIGNATURA?                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────┐        │
│  │ 📚 Selecciona asignatura...                                    [▼]         │        │
│  └─────────────────────────────────────────────────────────────────────────────┘        │
│     Opciones: Lengua Castellana, Matemáticas, Ciencias, Sociales, Inglés, etc.          │
│                                                                                          │
│  3. ¿QUÉ TIPO DE TRABAJO EVALÚA?                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────┐        │
│  │ 📝 Selecciona tipo...                                          [▼]         │        │
│  └─────────────────────────────────────────────────────────────────────────────┘        │
│     Opciones: Ensayo, Problemas/Ejercicios, Informe, Presentación, Proyecto, etc.       │
│                                                                                          │
│  4. NIVEL EDUCATIVO                                                                      │
│  [◉] Primaria  [◯] Secundaria  [◯] Bachillerato  [◯] Universitario                     │
│                                                                                          │
│  5. ¿CÓMO SE EVALÚA? (Segmentación)                                                      │
│  [◉] Párrafo por párrafo                                                                 │
│  [◯] Página por página                                                                   │
│  [◯] Por secciones (Intro, Desarrollo, Conclusión)                                       │
│  [◯] Paso a paso (para ejercicios)                                                       │
│                                                                                          │
│                                    [Cancelar]  [Siguiente ▶]                             │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Paso 3: Definir Criterios de la Rúbrica

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              DEFINIR CRITERIOS DE EVALUACIÓN                             │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  Rúbrica: Evaluación de Ensayos Argumentativos                                          │
│  Total ponderado: 85% (falta 15%)                                                       │
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │ CRITERIO 1: TESIS Y ARGUMENTACIÓN                                    [🗑️] [✎] │    │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │    │
│  │ Peso: [███████████████░░] 30%              [▲] [▼]                              │    │
│  │                                                                                  │    │
│  │ Descripción: Claridad de la tesis central y coherencia de los argumentos        │    │
│  │ ┌─────────────────────────────────────────────────────────────────────────┐     │    │
│  │ │ El estudiante plantea una tesis clara y la defiende con argumentos      │     │    │
│  │ │ lógicos y bien fundamentados...                                         │     │    │
│  │ └─────────────────────────────────────────────────────────────────────────┘     │    │
│  │                                                                                  │    │
│  │ ¿Qué busca la IA en este criterio?                                              │    │
│  │ ☑️ Tesis claramente identificable                                              │    │
│  │ ☑️ Argumentos con evidencia                                                    │    │
│  │ ☐ Contrargumentos presentados                                                  │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │ CRITERIO 2: COHERENCIA Y COHESIÓN                                    [🗑️] [✎] │    │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │    │
│  │ Peso: [█████████░░░░░░░░] 20%              [▲] [▼]                              │    │
│  │                                                                                  │    │
│  │ Descripción: Uso de conectores lógicos y fluidez entre párrafos                 │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │ CRITERIO 3: USO DE REFERENCIAS Y CITAS                               [🗑️] [✎] │    │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │    │
│  │ Peso: [█████████████░░░░] 25%              [▲] [▼]                              │    │
│  │                                                                                  │    │
│  │ Descripción: Citas bibliográficas correctas y referencias académicas            │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                          │
│  [➕ Agregar otro criterio]                                                               │
│                                                                                          │
│                                    [← Anterior]  [💾 Guardar Rúbrica]                    │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 FLUJO 2: EVALUAR UN TRABAJO (Interfaz de 3 Paneles)

### Estado A: Sin Documento Cargado (Modo Chat General)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER: [LOGO] EvaluAI    [Chat General]    [🔔]  [👤 Prof. García ▼]                   │
├──────────────┬───────────────────────────────────────────────────────┬──────────────────┤
│              │                                                       │                  │
│  PANEL       │              PANEL CENTRAL - CHAT IA                  │   PANEL          │
│  IZQUIERDO   │                                                       │   DERECHO        │
│              │  ┌─────────────────────────────────────────────────┐  │                  │
│  [➕] Nueva  │  │ 🤖 EvaluAI                                      │  │  📊 MI RESUMEN   │
│  Evaluación  │  │                                                 │  │                  │
│              │  │ ¡Hola Profesor García! 👋                       │  │  Bienvenido de   │
│  ─────────── │  │                                                 │  │  vuelta          │
│              │  │ ¿En qué puedo ayudarte hoy?                     │  │                  │
│  📋 MIS      │  │                                                 │  │  ─────────────   │
│  RÚBRICAS    │  │ Puedo:                                          │  │                  │
│              │  │ • Evaluar trabajos de estudiantes               │  │  📈 Estadísticas │
│  [📋] Ver    │  │ • Ayudarte a preparar clases                    │  │  ─────────────   │
│  Rúbricas    │  │ • Crear materiales educativos                   │  │  Evaluaciones    │
│              │  │ • Sugerir mejoras a tus rúbricas                │  │  este mes: 24    │
│  [➕] Crear  │  │                                                 │  │                  │
│  Rúbrica     │  └─────────────────────────────────────────────────┘  │  ⏳ Pendientes: 3  │
│              │                                                       │                  │
│  [📥] Impor- │  ┌─────────────────────────────────────────────────┐  │  ✓ Completadas:  │
│  tar         │  │ 👤 Prof. García                                 │  │  21              │
│              │  │                                                 │  │                  │
│  [🌐] Biblio-│  │ Necesito preparar una clase sobre la Revolución │  │  ─────────────   │
│  teca        │  │ Francesa para 10° grado, ¿me ayudas?            │  │                  │
│              │  └─────────────────────────────────────────────────┘  │  💳 TU PLAN      │
│              │                                                       │                  │
│  ─────────── │  ┌─────────────────────────────────────────────────┐  │  Profesor Pro    │
│              │  │ 🤖 EvaluAI                                      │  │  ─────────────   │
│  💬 CHAT     │  │                                                 │  │                  │
│              │  │ ¡Por supuesto! Aquí tienes un plan de clase:    │  │  Palabras usadas:│
│  [💬] Chat   │  │                                                 │  │  ████████░░░░░░  │
│  General ◄───┼──┤ 📚 PLANTILLA DE CLASE: REVOLUCIÓN FRANCESA    │  │  45,230 /        │
│              │  │                                                 │  │  120,000         │
│  [🤖] Conf.  │  │ 1. INTRODUCCIÓN (15 min)                        │  │                  │
│  IA          │  │    • Contexto histórico previo                  │  │  [💳 Recargar]   │
│              │  │    • Causas inmediatas y profundas              │  │                  │
│              │  │                                                 │  │  ─────────────   │
│  ─────────── │  │ 2. DESARROLLO (30 min)                          │  │                  │
│              │  │    • Etapas de la Revolución                    │  │  🎯 ACCIONES     │
│  📁 DOCU-    │  │    • Personajes clave                           │  │  RÁPIDAS         │
│  MENTOS      │  │    • Documento para análisis:                   │  │                  │
│              │  │      "Declaración de DDHH"                      │  │  [➕ Nueva       │
│  [📄] Biblio-│  │                                                 │  │  Evaluación]     │
│  teca        │  │ ¿Te gustaría que...                             │  │                  │
│              │  │ [Cree un cuestionario] [Busque recursos]        │  │  [📤 Subir       │
│              │  └─────────────────────────────────────────────────┘  │  Trabajo]        │
│              │                                                       │                  │
│              │                                                       │  [📋 Ver         │
│              │                                                       │  Rúbricas]       │
│              │                                                       │                  │
├──────────────┼───────────────────────────────────────────────────────┼──────────────────┤
│              │  💬 Escribe tu mensaje o pega texto del estudiante...              │                  │
│              │  [📎] [🎙️]  ┌──────────────────────────────────┐  [➤ Enviar]       │
│              │             │                                  │                    │
│              │             └──────────────────────────────────┘                    │
└──────────────┴───────────────────────────────────────────────────────┴──────────────────┘
```

### Estado B: Con Documento Cargado (Modo Evaluación)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER: [LOGO] EvaluAI    [Evaluando: Ensayo_JuanPerez.docx]    [🔔]  [👤 Prof. García]│
├──────────────┬───────────────────────────────────────────────────────┬──────────────────┤
│              │                                                       │                  │
│  PANEL       │         PANEL CENTRAL - VISTA DE TRABAJO            │   PANEL          │
│  IZQUIERDO   │                                                       │   DERECHO        │
│              │  ┌─────────────────────────────────────────────────┐  │                  │
│  [➕] Nueva  │  │ 📄 DOCUMENTO DEL ESTUDIANTE                     │  │  📋 RÚBRICA      │
│  Evaluación  │  │                                                 │  │  ACTIVA          │
│              │  │ 👤 Juan Pérez | 📚 Lengua | 📝 Ensayo           │  │                  │
│  [📁] Mis    │  │                                                 │  │  Ensayo Argum.   │
│  Evaluac.    │  │ ┌───────────────────────────────────────────┐   │  │  - Lengua        │
│              │  │ │                                           │   │  │                  │
│  [⏳] Pendien-│  │ │   LA REVOLUCIÓN FRANCESA                  │   │  │  Criterios:      │
│  tes    ◄────┼──┤ │                                           │   │  │                  │
│              │  │ │   La Revolución Francesa fue un período   │   │  │  1. Tesis        │
│  ─────────── │  │ │   de gran [🟡 cambio] transformación      │   │  │  [███████░] 30%  │
│              │  │ │   social que [🔴 tuvo] tuvo lugar en      │   │  │                  │
│  📋 MIS      │  │ │   Francia durante el siglo XVIII...       │   │  │  2. Coherencia   │
│  RÚBRICAS    │  │ │                                           │   │  │  [█████░░░] 20%  │
│              │  │ │   Este evento histórico [🟡 marco]        │   │  │                  │
│  [📋] Ver    │  │ │   marcó el inicio de...                   │   │  │  3. Referencias  │
│  Rúbricas    │  │ │                                           │   │  │  [██████░░] 25%  │
│              │  │ │   [Párrafo 1 de 5]                        │   │  │                  │
│  [➕] Crear  │  │ │                                           │   │  │  ─────────────   │
│  Rúbrica     │  │ └───────────────────────────────────────────┘   │  │                  │
│              │  │                                                 │  │  📊 PROGRESO     │
│              │  │ [◀ Anterior]  [1/5 párrafos]  [Siguiente ▶]    │  │                  │
│              │  └─────────────────────────────────────────────────┘  │  Revisando:      │
│              │                                                       │  Párrafo 1       │
│              │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │                  │
│              │                                                       │  [████████░░]    │
│              │  💬 ¿Qué necesitas?                                   │  80% completado  │
│              │  ┌─────────────────────────────────────────────────┐  │                  │
│              │  │ 🤖 EvaluAI: He analizado el primer párrafo.    │  │  ─────────────   │
│              │  │ Tienes 3 correcciones pendientes:               │  │                  │
│              │  │ 🟡 2 mejoras de estilo | 🔴 1 error             │  │  🎛️ CONTROLES    │
│              │  │                                                 │  │                  │
│              │  │ ¿Quieres revisarlas una por una o aplicar      │  │  [✓ Aceptar      │
│              │  │ las VERDES automáticamente?                     │  │  todo verde]     │
│              │  │                                                 │  │                  │
│              │  │ [👁️ Revisar una por una]                        │  │  [🔍 Ver         │
│              │  │ [✨ Aplicar VERDES automático]                  │  │  detalles]       │
│              │  └─────────────────────────────────────────────────┘  │                  │
│              │                                                       │  [⚙️ Config.      │
│              │  👤 Prof. García: Quiero revisar una por una      │  │  auto]           │
│              │                                                       │                  │
│              │                                                       │  ─────────────   │
│              │                                                       │                  │
│              │                                                       │  📋 CORRECCIONES │
│              │                                                       │  EN ESTE PÁRRAFO │
│              │                                                       │                  │
│              │                                                       │  🟡 #1: "cambio" │
│              │                                                       │  → "transform..."│
│              │                                                       │  [✓] [✗] [ℹ️]    │
│              │                                                       │                  │
│              │                                                       │  🔴 #2: "tuvo"   │
│              │                                                       │  → "se produjo"  │
│              │                                                       │  [✓] [✗] [ℹ️]    │
│              │                                                       │                  │
│              │                                                       │  🟡 #3: "marco"  │
│              │                                                       │  → "determinó"   │
│              │                                                       │  [✓] [✗] [ℹ️]    │
│              │                                                       │                  │
│              │                                                       │  ─────────────   │
│              │                                                       │                  │
│              │                                                       │  🎯 ACCIONES     │
│              │                                                       │  [💾 Guardar     │
│              │                                                       │  borrador]       │
│              │                                                       │  [📄 Generar     │
│              │                                                       │  informe final]  │
│              │                                                       │                  │
└──────────────┴───────────────────────────────────────────────────────┴──────────────────┘
│                                    [💬 Escribe aquí o arrastra otro documento...]       │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 PANEL DERECHO - DETALLE DE COMPONENTES

### A. Cuando NO hay documento cargado:

```
┌─────────────────────┐
│  📊 MI RESUMEN      │
│  ─────────────────  │
│  "¡Buenos días,     │
│   Profesor!"        │
│                     │
│  📈 ESTADÍSTICAS    │
│  ─────────────────  │
│  Evaluaciones       │
│  este mes: 24       │
│                     │
│  ⏳ Pendientes: 3   │
│  ✓ Completadas: 21  │
│                     │
│  ─────────────────  │
│                     │
│  💳 TU PLAN         │
│  ─────────────────  │
│  Profesor Pro       │
│                     │
│  Palabras usadas:   │
│  ████████░░░░░░     │
│  45,230 / 120,000   │
│                     │
│  [💳 Recargar]      │
│                     │
│  ─────────────────  │
│                     │
│  🎯 ACCIONES        │
│  RÁPIDAS            │
│  ─────────────────  │
│                     │
│  [➕ Nueva          │
│   Evaluación]       │
│                     │
│  [📤 Subir          │
│   Trabajo]          │
│                     │
│  [📋 Ver            │
│   Rúbricas]         │
│                     │
│  [📚 Biblioteca     │
│   de Documentos]    │
│                     │
└─────────────────────┘
```

### B. Cuando HAY documento cargado (Modo Revisión):

```
┌─────────────────────┐
│  📋 RÚBRICA ACTIVA  │
│  ─────────────────  │
│  Ensayo Argum. -    │
│  Lengua             │
│                     │
│  [📝 Ver detalle]   │
│  [✎ Cambiar]        │
│                     │
│  CRITERIOS:         │
│  ─────────────────  │
│  1. Tesis           │
│  [███████░] 30%     │
│  Pts: 7.5/10        │
│                     │
│  2. Coherencia      │
│  [█████░░░] 20%     │
│  Pts: 8.0/10        │
│                     │
│  3. Referencias     │
│  [██████░░] 25%     │
│  Pts: 6.5/10        │
│                     │
│  4. Ortografía      │
│  [████░░░░] 25%     │
│  Pts: 9.0/10        │
│                     │
│  ─────────────────  │
│  NOTA PARCIAL:      │
│  [🟡 7.75/10]       │
│  (Párrafo 1 de 5)   │
│                     │
│  ─────────────────  │
│                     │
│  📊 PROGRESO        │
│  ─────────────────  │
│  Revisando:         │
│  Párrafo 1          │
│                     │
│  [████████░░]       │
│  80% completado     │
│                     │
│  ─────────────────  │
│                     │
│  🎛️ CONTROLES       │
│  ─────────────────  │
│                     │
│  [✓ Aceptar         │
│   todo verde]       │
│                     │
│  [🔍 Ver detalle    │
│   de correcciones]  │
│                     │
│  [⚙️ Configurar     │
│   modo automático]  │
│                     │
│  ─────────────────  │
│                     │
│  🎯 ACCIONES        │
│  ─────────────────  │
│  [💾 Guardar        │
│   borrador]         │
│                     │
│  [📄 Generar        │
│   informe final]    │
│                     │
│  [🗑️ Descartar     │
│   evaluación]       │
│                     │
└─────────────────────┘
```

### C. Modo Detalle de Correcciones:

```
┌─────────────────────┐
│  📋 CORRECCIONES    │
│  PÁRRAFO ACTUAL     │
│  ─────────────────  │
│  Total: 4           │
│  🟡 2 | 🔴 1 | 🟢 1 │
│                     │
│  ─────────────────  │
│                     │
│  🟡 #1: "cambio"    │
│  → "transformación  │
│     social radical" │
│  [✓] [✗] [ℹ️]       │
│                     │
│  ─────────────────  │
│                     │
│  🔴 #2: "tuvo"      │
│  → "se produjo"     │
│  [✓] [✗] [ℹ️]       │
│                     │
│  ─────────────────  │
│                     │
│  🟢 #3: "marco"     │
│  → "determinó el    │
│     curso de"       │
│  [✓] [✗] [ℹ️]       │
│                     │
│  ─────────────────  │
│                     │
│  [✓ Aceptar todas]  │
│  [✗ Rechazar todas] │
│                     │
│  ─────────────────  │
│                     │
│  🎛️ MODO            │
│  AUTOMÁTICO         │
│  ─────────────────  │
│                     │
│  Aplicar auto:      │
│  ☑️ VERDES          │
│  ☑️ AZULES          │
│  ☐ ROJOS            │
│  ☐ NARANJAS         │
│                     │
│  [⚙️ Guardar como   │
│   predeterminado]   │
│                     │
└─────────────────────┘
```

---

## 💬 EL CHAT DE IA - ESTADOS

### Estado 1: Chat General (Sin documento)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  🤖 EvaluAI                                                         │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  ¡Hola! Soy tu asistente de evaluación. Puedo ayudarte con:         │
│                                                                     │
│  📝 Evaluar trabajos de estudiantes                                │
│  📚 Crear o mejorar rúbricas de evaluación                         │
│  🎓 Preparar material para clases                                  │
│  📊 Analizar patrones en evaluaciones                              │
│                                                                     │
│  ¿Qué necesitas hoy?                                                │
│                                                                     │
│  [🚀 Evaluar un trabajo]  [📋 Crear rúbrica]  [💡 Ideas para clase]│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

--- Usuario escribe ---

👤 Necesito ideas para una clase sobre ecuaciones cuadráticas

--- IA responde ---

🤖 Aquí tienes una propuesta de clase de 45 minutos:

📐 CLASE: ECUACIONES CUADRÁTICAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. INTRODUCCIÓN (10 min)
   • Problema del día: "Un futbolista patea..."
   • Pregunta guía: ¿Cómo calculamos cuándo cae el balón?

2. DESARROLLO (25 min)
   • Fórmula general: x = (-b ± √(b²-4ac)) / 2a
   • Ejemplo resuelto paso a paso
   • Actividad grupal: Resolver 3 problemas

3. CIERRE (10 min)
   • Kahoot de 5 preguntas
   • Tarea: 5 ejercicios

¿Te gustaría que desarrolle alguna parte o que cree los ejercicios?

[📎 Descargar plan] [✏️ Modificar] [🎯 Crear evaluación sobre esto]
```

### Estado 2: Con Documento (Evaluando)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  🤖 EvaluAI está evaluando...                                       │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  He analizado el párrafo 1 de 5:                                    │
│                                                                     │
│  📊 RESULTADO PARCIAL: 🟡 7.5/10                                    │
│                                                                     │
│  CORRECCIONES ENCONTRADAS (3):                                      │
│                                                                     │
│  🟡 Mejora #1:                                                      │
│     "cambio" → "transformación social radical"                      │
│     Razón: Término más académico y preciso                         │
│     [✓ Aplicar]  [✗ Omitir]  [💬 Justificar]                       │
│                                                                     │
│  🔴 Error #2:                                                       │
│     "tuvo" → "se produjo"                                           │
│     Razón: Voz pasiva más apropiada para textos académicos         │
│     [✓ Aplicar]  [✗ Omitir]  [💬 Justificar]                       │
│                                                                     │
│  ¿Quieres revisar el siguiente párrafo?                             │
│  [👁️ Ver siguiente]  [✨ Aplicar todo automático]                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

--- Usuario escribe ---

👤 ¿Por qué sugieres "transformación social radical"? Me parece muy fuerte.

--- IA responde ---

🤖 Buena observación. Aquí te explico:

La palabra "cambio" es válida pero genérica. En el contexto de la 
Revolución Francesa, hablamos de:

• Cambio político: De monarquía a república
• Cambio social: Abolición de privilegios
• Cambio económico: Nuevas estructuras

Alternativas según el énfasis que busques:

🟡 "transformación" → Más académico, neutro
🟡 "reconfiguración social" → Si enfatizas estructuras
🟡 "revolución social" → Si mantienes el término histórico

¿Prefieres alguna de estas o mantienes "cambio"?

[Usar "transformación"]  [Usar "reconfiguración"]  [Mantener "cambio"]
```

---

## 🔘 BOTONES Y ACCIONES PRINCIPALES

### Botones del Panel Izquierdo (Navegación):

| Icono | Texto | Acción |
|-------|-------|--------|
| 🏠 | Dashboard | Pantalla principal con resumen |
| ➕ | Nueva Evaluación | Inicia wizard de evaluación |
| 📁 | Mis Evaluaciones | Lista de evaluaciones pasadas |
| ⏳ | Pendientes | Evaluaciones en proceso de revisión |
| 📋 | Ver Rúbricas | Lista de rúbricas creadas |
| ➕ | Crear Rúbrica | Wizard de creación de rúbrica |
| 📥 | Importar Rúbrica | Subir desde Excel/Word |
| 🌐 | Biblioteca | Plantillas públicas |
| 📄 | Biblioteca de Docs | Todos los trabajos subidos |
| 💬 | Chat General | Consultas sin documento |
| 🤖 | Config. IA | Preferencias del agente |

### Botones del Panel Derecho (Contexto):

| Estado | Botones disponibles |
|--------|---------------------|
| Sin documento | Acciones rápidas, estadísticas, plan |
| Con documento | Rúbrica activa, progreso, controles, acciones |
| Revisando | Lista de correcciones, modo automático |

### Botones del Chat (Input):

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  [📎 Adjuntar archivo]  [🎙️ Dictar]  ┌─────────────────────────┐  │
│                                      │ Escribe tu mensaje...   │  │
│                                      │ o pega texto aquí       │  │
│                                      └─────────────────────────┘  │
│                                                    [➤ Enviar]     │
│                                                                     │
│  💡 Sugerencias rápidas:                                            │
│  [Evaluar este párrafo]  [¿Qué opinas de la tesis?]  [Más...]      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📱 VERSIÓN MÓVIL (Responsive)

En móvil, los 3 paneles se convierten en:

```
┌─────────────────────────┐
│ ≡  [LOGO]  EvaluAI  🔔 👤│  ← Header con menú hamburguesa
├─────────────────────────┤
│                         │
│  [CONTENIDO PRINCIPAL]  │  ← Solo el panel central
│                         │
│  (Chat o Documento)     │
│                         │
├─────────────────────────┤
│                         │
│  💬 Input del chat...   │
│                         │
├─────────────────────────┤
│  🏠  📋  ➕  💬  👤     │  ← Bottom navigation
│ Dash  Rúbricas  Nueva  Chat  Perfil
└─────────────────────────┘
```

**Menú lateral deslizable (izquierda):** Navegación completa
**Menú lateral deslizable (derecha):** Panel de contexto/herramientas

---

## ✅ CHECKLIST PARA APROBACIÓN DEL CLIENTE

### Panel Izquierdo - Navegación
- [ ] ¿Están todos los botones necesarios?
- [ ] ¿El orden de las secciones es lógico?
- [ ] ¿Falta alguna funcionalidad en el menú?

### Panel Central - Contenido
- [ ] ¿La vista del documento con correcciones es clara?
- [ ] ¿El chat integrado abajo funciona para el flujo?
- [ ] ¿Las transiciones entre modos (chat ↔ evaluación) son claras?

### Panel Derecho - Herramientas
- [ ] ¿La información mostrada es útil?
- [ ] ¿Falta algún control o botón importante?
- [ ] ¿El modo automático es intuitivo?

### Flujos Principales
- [ ] ¿Crear rúbrica: el wizard de 3 pasos es adecuado?
- [ ] ¿Evaluar trabajo: el flujo de 3 paneles es cómodo?
- [ ] ¿Revisar correcciones: el sistema de aceptar/rechazar funciona?

### Chat de IA
- [ ] ¿Las respuestas contextuales (con/sin documento) son útiles?
- [ ] ¿Las sugerencias rápidas ayudan al profesor?
- [ ] ¿El chat permite el seguimiento que necesitas?

---

## 🎨 PALETA DE COLORES SUGERIDA

```css
/* Fondos */
--bg-primary: #0f0f23       /* Fondo principal oscuro */
--bg-secondary: #16162a     /* Paneles laterales */
--bg-card: #1e1e3a          /* Tarjetas/contenedores */

/* Acentos */
--accent-primary: #667eea   /* Botones principales */
--accent-secondary: #764ba2 /* Gradientes */
--accent-success: #22c55e   /* Éxito / Verde sistema */
--accent-warning: #fbbf24   /* Advertencia / Amarillo */
--accent-error: #ef4444     /* Error / Rojo sistema */
--accent-info: #3b82f6      /* Info / Azul sistema */

/* Sistema de Colores de Correcciones */
--color-rojo: #ef4444       /* Errores */
--color-azul: #3b82f6       /* Referencias */
--color-verde: #22c55e      /* Mejoras */
--color-naranja: #f97316    /* Estructura */

/* Textos */
--text-primary: #ffffff
--text-secondary: #94a3b8
--text-muted: #64748b
```

---

## 📋 PRÓXIMOS PASOS (Después de Aprobación)

1. **Crear wireframes interactivos** (Figma o similar)
2. **Definir la API** para los nuevos endpoints
3. **Implementar componentes** en orden:
   - Layout de 3 paneles
   - Panel izquierdo (navegación)
   - Panel derecho (contexto)
   - Sistema de chat integrado
   - Wizard de rúbricas
   - Editor de revisiones

---

**¿Aprobamos este diseño? ¿Hay cambios que quieras hacer antes de proceder?**
