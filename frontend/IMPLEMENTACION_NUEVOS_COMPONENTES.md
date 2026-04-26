# 📦 Implementación de Nuevos Componentes

> Resumen de componentes creados para el sistema de evaluación con notas al pie

---

## 📁 Estructura de Archivos Creados

```
frontend/src/
├── components/
│   ├── editor/
│   │   ├── EditorNotasPie.js      # Editor principal de correcciones
│   │   ├── ParrafoConNotas.js     # Visualización de párrafo con marcas
│   │   ├── NotaPieCard.js         # Card individual de cada nota
│   │   ├── editor.css             # Estilos del editor
│   │   └── index.js               # Exportaciones
│   │
│   └── rubricas/
│       ├── PanelRubricas.js       # Panel de gestión de rúbricas
│       ├── EditorMarkdown.js      # Editor de rúbricas Markdown
│       ├── rubricas.css           # Estilos de rúbricas
│       └── index.js               # Exportaciones
│
├── utils/
│   └── rubricaParser.js           # Parser de Markdown para rúbricas
│
├── App.integracion.js             # Ejemplo de integración en App.js
└── IMPLEMENTACION_NUEVOS_COMPONENTES.md  # Este archivo
```

---

## 🎯 Componentes Principales

### 1. EditorNotasPie

**Ubicación:** `src/components/editor/EditorNotasPie.js`

**Función:** Editor principal para revisar correcciones párrafo por párrafo.

**Props:**
```javascript
{
  evaluacionId: string,           // ID de la evaluación
  documento: {
    titulo: string,
    parrafos: [{
      id: string,
      indice: number,
      texto_original: string,
      calificacion: number,
      semaforo: 'VERDE'|'AMARILLO'|'NARANJA'|'ROJO',
      notas_pie: [...]
    }]
  },
  rubrica: object,                // Rúbrica activa
  modo: 'revision' | 'solo_lectura',
  onGuardarBorrador: function,
  onGenerarFinal: function,
  onCancelar: function
}
```

**Vistas:**
- Vista individual: Un párrafo a la vez con sus notas
- Vista completa: Todos los párrafos con resumen

---

### 2. ParrafoConNotas

**Ubicación:** `src/components/editor/ParrafoConNotas.js`

**Función:** Renderiza un párrafo con las marcas de notas al pie [¹], [²], etc.

**Características:**
- Muestra el texto con superíndices coloreados según tipo
- Permite seleccionar texto para agregar notas manuales
- Muestra las notas al pie del párrafo

---

### 3. NotaPieCard

**Ubicación:** `src/components/editor/NotaPieCard.js`

**Función:** Card individual para cada corrección.

**Estados:**
- **Pendiente:** Muestra botones [✓ Aceptar] [✎ Modificar] [✗ Rechazar]
- **Aceptada:** Muestra opción para editar o deshacer
- **Rechazada:** Muestra opción para cambiar a aceptada
- **Modificada:** Muestra la versión modificada por el profesor

**Colores:**
- 🔴 ROJO: Errores críticos
- 🔵 AZUL: Referencias/citas
- 🟢 VERDE: Mejoras sugeridas
- 🟠 NARANJA: Problemas estructurales

---

### 4. PanelRubricas

**Ubicación:** `src/components/rubricas/PanelRubricas.js`

**Función:** Panel del lado izquierdo para gestionar rúbricas.

**Características:**
- Lista de rúbricas en formato Markdown
- Búsqueda y filtrado por asignatura
- Vista de detalle de cada rúbrica
- Acciones: Ver, Editar, Usar, Eliminar

**Vistas:**
- Lista: Todas las rúbricas
- Detalle: Información completa de una rúbrica

---

### 5. EditorMarkdown

**Ubicación:** `src/components/rubricas/EditorMarkdown.js`

**Función:** Editor de rúbricas en formato Markdown con preview.

**Modos de vista:**
- Editor: Solo el código Markdown
- Split: Editor + Preview lado a lado
- Preview: Solo la vista previa renderizada

---

### 6. rubricaParser (Utilidad)

**Ubicación:** `src/utils/rubricaParser.js`

**Funciones:**
- `parseRubricaMarkdown(md)` - Extrae datos estructurados de Markdown
- `generateRubricaMarkdown(datos)` - Genera Markdown desde datos
- `calcularCalificacionParrafo(notas, rubrica)` - Calcula nota según rúbrica

---

## 🎨 Sistema de Colores

### Colores de Correcciones

```css
/* Rojo - Errores críticos */
--color-rojo: #ef4444;
--bg-rojo: rgba(239, 68, 68, 0.1);

/* Azul - Referencias */
--color-azul: #3b82f6;
--bg-azul: rgba(59, 130, 246, 0.1);

/* Verde - Mejoras */
--color-verde: #22c55e;
--bg-verde: rgba(34, 197, 94, 0.1);

/* Naranja - Estructura */
--color-naranja: #f97316;
--bg-naranja: rgba(249, 115, 22, 0.1);
```

### Semáforo

- 🟢 **VERDE:** 8-10 pts - Excelente
- 🟡 **AMARILLO:** 6-7.9 pts - Aceptable
- 🟠 **NARANJA:** 4-5.9 pts - Necesita mejorar
- 🔴 **ROJO:** 0-3.9 pts - Deficiente

---

## 📋 Formato Markdown de Rúbrica

```markdown
---
id: "rubrica-001"
nombre: "Evaluación Ensayo"
asignatura: "Lengua Castellana"
nivel: "Secundaria"
---

# Evaluación de Ensayo Argumentativo

## Información General
- **Asignatura**: Lengua Castellana
- **Nivel**: Secundaria
- **Puntuación máxima**: 10

---

## Criterios de Evaluación

| Criterio | Peso | Descripción |
|----------|------|-------------|
| Tesis | 30% | Claridad de la tesis central |
| Argumentación | 30% | Coherencia de argumentos |
| Organización | 20% | Estructura del texto |
| Lenguaje | 20% | Uso correcto del lenguaje |

---

## Niveles de Desempeño

### Nivel 1: 0-3 puntos
**Deficiente**

- No presenta tesis clara
- Argumentos confusos

### Nivel 2: 4-6 puntos
**Básico**

- Tesis presente pero débil
- Argumentos con falta de evidencia

### Nivel 3: 7-8 puntos
**Satisfactorio**

- Tesis clara
- Buenos argumentos

### Nivel 4: 9-10 puntos
**Excelente**

- Tesis original y bien fundamentada
- Argumentos sólidos con evidencia

---

## Configuración del Semaforo

```yaml
semaforo:
  verde:
    min: 9
    max: 10
  amarillo:
    min: 7
    max: 8
  rojo:
    min: 0
    max: 6
```
```

---

## 🔧 Integración en App.js

Ver archivo `App.integracion.js` para ejemplos completos.

### Pasos para integrar:

1. **Importar componentes:**
```javascript
import { EditorNotasPie } from './components/editor';
import { PanelRubricas, EditorMarkdown } from './components/rubricas';
import { parseRubricaMarkdown } from './utils/rubricaParser';
```

2. **Agregar estados:**
```javascript
const [rubricas, setRubricas] = useState([]);
const [rubricaActiva, setRubricaActiva] = useState(null);
const [mostrarEditorNotas, setMostrarEditorNotas] = useState(false);
const [mostrarEditorRubrica, setMostrarEditorRubrica] = useState(false);
```

3. **Integrar PanelRubricas en el sidebar:**
```javascript
<PanelRubricas
  rubricas={rubricas}
  rubricaActiva={rubricaActiva}
  onSeleccionarRubrica={setRubricaActiva}
  onCrearRubrica={() => setMostrarEditorRubrica(true)}
  onEditarRubrica={...}
  onEliminarRubrica={...}
/>
```

---

## 📝 Flujo de Uso

### 1. Crear Rúbrica

```
Panel Izquierdo → Mis Rúbricas → ➕ Nueva
↓
Editor Markdown → Escribir/Pegar contenido
↓
💾 Guardar
↓
Aparece en la lista
```

### 2. Evaluar Documento

```
Chat → "Evaluar documento" → Subir archivo
↓
IA procesa según rúbrica activa
↓
Abre EditorNotasPie
↓
Revisar cada párrafo:
  - Ver notas al pie [¹] [²] [³]
  - Aceptar/Rechazar/Modificar cada una
  - Chat integrado para consultas
↓
📄 Generar informe final
```

### 3. Modo Automático

```
En Panel Derecho:
☑️ Aplicar VERDES automáticamente
☑️ Aplicar AZULES automáticamente
☐ ROJOS requieren aprobación manual
↓
Todas las correcciones VERDES se aceptan automáticamente
```

---

## 🚀 Próximos Pasos

1. **Integrar con backend:**
   - Endpoints para guardar/cargar rúbricas
   - Endpoints para evaluaciones con notas al pie
   - Sistema de archivos para Markdown

2. **Mejoras UX:**
   - Animaciones de transición
   - Atajos de teclado
   - Tooltips informativos

3. **Funcionalidades adicionales:**
   - Exportar a PDF con notas al pie
   - Comparación de versiones
   - Historial de cambios

---

## 📚 Documentación Adicional

- `frontend/design/docs/05-diseno-completo-interfaz-v2.md` - Diseño de interfaz
- `frontend/design/docs/06-especificacion-editor-notas-pie.md` - Especificación técnica
- `frontend/design/docs/07-rubricas-formato-markdown.md` - Formato de rúbricas
- `frontend/src/App.integracion.js` - Ejemplo de integración

---

## ✅ Checklist de Implementación

- [x] Parser de Markdown para rúbricas
- [x] Componente EditorNotasPie
- [x] Componente ParrafoConNotas
- [x] Componente NotaPieCard
- [x] Componente PanelRubricas
- [x] Componente EditorMarkdown
- [x] Estilos CSS completos
- [x] Ejemplo de integración
- [ ] Integración final en App.js
- [ ] Conexión con backend real
- [ ] Testing de componentes

---

*Versión: 1.0.0*
*Fecha: 10 de abril, 2025*
