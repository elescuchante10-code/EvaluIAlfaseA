# 📝 Sistema de Rúbricas en Markdown Editable

> Las rúbricas se guardan en formato Markdown para edición directa por el profesor

---

## 📂 ESTRUCTURA DE ARCHIVOS

```
frontend/public/rubricas/
├── usuario-123/
│   ├── ensayo-argumentativo-lengua.md
│   ├── evaluacion-ib-filosofia.md
│   ├── problemas-fisica-mecanica.md
│   └── proyecto-investigacion-historia.md
```

---

## 🎯 FLUJO COMPLETO

```
1. PROFESOR sube imagen/documento al CHAT
   │
   ▼
2. IA EXTRAE contenido y genera MARKDOWN
   │
   ▼
3. Sistema GUARDA archivo .md
   │
   ▼
4. Aparece en PANEL IZQUIERDO → "Mis Rúbricas"
   │
   ▼
5. Profesor puede:
   • [👁️ Ver] - Preview formateado
   • [✏️ Editar] - Editor de Markdown
   • [🗑️ Eliminar] - Borrar archivo
   • [📋 Usar] - Seleccionar para evaluación
```

---

## 📋 FORMATO MARKDOWN ESTÁNDAR

### Ejemplo 1: Rúbrica IB Filosofía (Extraída de imagen)

```markdown
# Rúbrica: Evaluación Ensayo - IB Filosofía

## Información General
- **Asignatura**: Filosofía
- **Nivel**: IB - Bachillerato Internacional
- **Tipo de trabajo**: Ensayo argumentativo
- **Puntuación máxima**: 25
- **Creada**: 2025-04-10
- **Última modificación**: 2025-04-10

---

## Descriptores de Nivel

### Nivel 1: 0-5 puntos
**Trabajo deficiente**

- El trabajo del alumno no alcanza el nivel descrito por ninguno de los descriptores.

### Nivel 2: 6-10 puntos
**Respuesta limitada**

- Se intenta aplicar una estructura apropiada, en el caso de que se reconozca una estructura de ensayo, la respuesta se centra mínimamente en el tema.
- La cuestión filosófica planteada en el material de estímulo está implicada en lugar de identificarse de manera explícita.
- Se ofrece poca justificación de la aplicación de la cuestión en relación con el material de estímulo o se recurre con la pregunta de qué es ser humano.
- Se demuestra poco conocimiento pertinente, y la explicación es superficial. No se utiliza vocabulario filosófico, o se utiliza constantemente de manera inapropiada.
- El lenguaje es descriptivo y carece de análisis. No hay discusión de interpretaciones o puntos de vista alternativos.

### Nivel 3: 11-15 puntos
**Respuesta con desarrollo**

- El trabajo intenta dar seguimiento a una estructura apropiada, aunque no siempre se tiene claro lo que se trata de decir o la respuesta.
- La cuestión filosófica planteada en el material de estímulo está implicada en lugar de explicitarse. Se ofrece una justificación de la aplicación de la cuestión en relación con el material de estímulo o con la pregunta de qué es ser humano.
- Se demuestra conocimiento, pero la precisión y/o pertinencia. Se ofrece una explicación básica de la cuestión. Se utiliza vocabulario filosófico a veces, y de manera apropiada.
- El análisis es limitado, pero se requiere más bien desarrollado que analítico. Hay poca discusión de interpretaciones o puntos de vista alternativos. Algunos de los puntos principales están justificados.

### Nivel 4: 16-20 puntos
**Respuesta bien estructurada**

- La respuesta tiene una estructura, en general está organizada y puede seguirse fácilmente.
- La cuestión filosófica planteada en el material de estímulo está identificada de manera explícita. Se ofrece una buena justificación de la cuestión en relación con el material de estímulo y con la pregunta de qué es ser humano.
- Se demuestra conocimiento preciso y pertinente, y se ofrece una buena explicación de la cuestión. Se utiliza vocabulario filosófico, en general, de manera apropiada.
- Se intenta realizar un análisis crítico. Hay discusión y cierta evaluación de interpretaciones o puntos de vista alternativos. La mayoría de los puntos principales están justificados.

### Nivel 5: 21-25 puntos
**Respuesta excelente**

- La respuesta está bien estructurada, definida y organizada fácilmente.
- La cuestión filosófica planteada en el material de estímulo está identificada de manera explícita. Se ofrece una justificación bien desarrollada de cómo la cuestión se relaciona con el material de estímulo y con la pregunta de qué es ser humano.
- Se demuestra conocimiento preciso, pertinente y detallado, y se ofrece una explicación de la cuestión. Se utiliza vocabulario filosófico de manera apropiada en toda la respuesta.
- La respuesta incluye un análisis crítico bien desarrollado. Hay discusión y evaluación de interpretaciones o puntos de vista alternativos. Todos o casi todos los puntos principales están justificados. Se ofrecen, cuando es apropiado, ejemplos argumentos sobre la cuestión desde una postura adoptada de manera coherente.

---

## Criterios de Evaluación por IA

### Estructura de la respuesta
- **Peso**: 20%
- **Qué buscar**: Organización clara, introducción, desarrollo, conclusión
- **Errores críticos**: Falta de estructura reconocible

### Identificación de la cuestión filosófica
- **Peso**: 20%
- **Qué buscar**: Cuestión explícita, relación con material de estímulo
- **Errores críticos**: Cuestión implicada pero no identificada

### Conocimiento y explicación
- **Peso**: 25%
- **Qué buscar**: Precisión, vocabulario filosófico apropiado, explicación detallada
- **Errores críticos**: Conocimiento superficial, vocabulario inapropiado

### Análisis crítico y evaluación
- **Peso**: 35%
- **Qué buscar**: Discusión de alternativas, argumentos justificados, postura coherente
- **Errores críticos**: Lenguaje descriptivo sin análisis, falta de justificación

---

## Configuración del Semaforo

```yaml
semaforo:
  verde:
    min: 21
    max: 25
    color: "#22c55e"
    label: "Excelente"
    auto_aceptar: true
  amarillo:
    min: 16
    max: 20
    color: "#fbbf24"
    label: "Bien estructurado"
    auto_aceptar: false
  naranja:
    min: 11
    max: 15
    color: "#f97316"
    label: "Desarrollo básico"
    auto_aceptar: false
  rojo:
    min: 0
    max: 10
    color: "#ef4444"
    label: "Necesita revisión"
    auto_aceptar: false
    bloquea_entrega: true
```

---

## Instrucciones para la IA

Al evaluar según esta rúbrica:

1. **Identificar el nivel** del estudiante comparando con los descriptores
2. **Asignar puntuación** dentro del rango del nivel identificado
3. **Justificar** cada decisión con referencia específica a los descriptores
4. **Notas al pie**: Usar el formato [¹], [²], etc. para marcar correcciones
5. **Colores**:
   - 🔴 ROJO: Errores que impiden alcanzar el nivel siguiente
   - 🟡 AMARILLO: Aspectos a mejorar para subir de nivel
   - 🟢 VERDE: Fortalezas que sostienen el nivel actual
   - 🔵 AZUL: Sugerencias de vocabulario filosófico

---

## Notas del Profesor

<!-- Espacio para que el profesor agregue comentarios personales -->

- Última actualización: Ajusté los pesos de los criterios según el nuevo programa IB 2025
- Nota: Prestar especial atención al vocabulario técnico en el criterio 3
```

---

## Ejemplo 2: Rúbrica Simplificada (Creada desde cero)

```markdown
# Rúbrica: Ensayo Argumentativo - Lengua Castellana

## Información General
- **Asignatura**: Lengua Castellana
- **Nivel**: Secundaria (10° grado)
- **Tipo**: Ensayo argumentativo
- **Escala**: 1-10
- **Segmentación**: Párrafo por párrafo

---

## Criterios y Ponderación

| Criterio | Peso | Descripción |
|----------|------|-------------|
| Tesis y argumentación | 30% | Claridad de la tesis central y coherencia argumentativa |
| Organización textual | 25% | Estructura: introducción, desarrollo, conclusión |
| Uso de referencias | 25% | Citas bibliográficas correctas y referencias académicas |
| Ortografía y gramática | 20% | Correcto uso de normas ortográficas y gramaticales |

---

## Escala de Calificación

### 9-10: Excelente
- Tesis clara, original y bien fundamentada
- Argumentos sólidos con evidencia de calidad
- Estructura impecable
- Sin errores ortográficos

### 7-8: Bueno
- Tesis clara pero poco original
- Argumentos coherentes con alguna debilidad menor
- Buena estructura
- Máximo 2 errores ortográficos leves

### 5-6: Satisfactorio
- Tesis presente pero confusa o poco desarrollada
- Argumentos presentes pero con falta de evidencia
- Estructura básica presente
- Algunos errores ortográficos que no impiden comprensión

### 3-4: Insuficiente
- Tesis ausente o incomprensible
- Argumentos confusos o contradictorios
- Estructura deficiente
- Errores ortográficos frecuentes

### 1-2: Deficiente
- No cumple con el formato de ensayo
- Carece totalmente de argumentación
- Texto incomprensible
- Errores ortográficos graves en todo el texto

---

## Configuración del Semaforo

```yaml
semaforo:
  verde:
    min: 7
    max: 10
    color: "#22c55e"
    auto_aceptar_correcciones_verdes: true
  amarillo:
    min: 5
    max: 6.9
    color: "#fbbf24"
  rojo:
    min: 0
    max: 4.9
    color: "#ef4444"
    requiere_revision: true
```

---

## Reglas Especiales

1. **Más de 5 errores ortográficos** = Máximo nota 6 automáticamente
2. **Sin tesis identificable** = Máximo nota 4
3. **Sin conclusión** = Penalización de -1 punto
4. **Plagio detectado** = Nota 0, reportar al profesor

---

## Comentarios del Profesor

<!-- Agregar notas personales aquí -->
```

---

## 🖥️ INTERFAZ: Panel "Mis Rúbricas"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📋 MIS RÚBRICAS                                                [➕ Nueva]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📄 evaluacion-ib-filosofia.md                                       │   │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │   │
│  │ 📚 Filosofía | IB | 25 pts | 4 criterios                           │   │
│  │                                                                     │   │
│  │ Creada: 10 abr 2025 | Usada: 3 veces                               │   │
│  │                                                                     │   │
│  │ [👁️ Ver preview]  [✏️ Editar MD]  [📋 Usar]  [🗑️]                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📄 ensayo-argumentativo-lengua.md                                   │   │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │   │
│  │ 📚 Lengua Castellana | 10° grado | 10 pts | 4 criterios            │   │
│  │                                                                     │   │
│  │ Creada: 8 abr 2025 | Usada: 12 veces                               │   │
│  │                                                                     │   │
│  │ [👁️ Ver preview]  [✏️ Editar MD]  [📋 Usar]  [🗑️]                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📄 problemas-fisica-mecanica.md  [🟡 Sin completar]                 │   │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │   │
│  │ 🔬 Física | Pendiente de configurar escala de puntuación           │   │
│  │                                                                     │   │
│  │ [✏️ Completar configuración]  [🗑️]                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🖊️ INTERFAZ: Editor de Markdown

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ✏️ EDITANDO: evaluacion-ib-filosofia.md                        [💾] [✖]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────┬─────────────────────────────────────┐ │
│  │        EDITOR MARKDOWN          │           PREVIEW                  │ │
│  │        (Editable)               │           (Renderizado)            │ │
│  ├─────────────────────────────────┼─────────────────────────────────────┤ │
│  │                                 │                                     │ │
│  │ # Rúbrica: Evaluación Ensayo   │  # Rúbrica: Evaluación Ensayo      │ │
│  │                                │                                     │ │
│  │ ## Información General         │  ## Información General            │ │
│  │ - **Asignatura**: Filosofía    │  • Asignatura: Filosofía           │ │
│  │ - **Nivel**: IB                │  • Nivel: IB                       │ │
│  │ - **Puntuación máxima**: 25    │  • Puntuación máxima: 25           │ │
│  │                                │                                     │ │
│  │ ---                            │  ---                               │ │
│  │                                │                                     │ │
│  │ ## Descriptores de Nivel       │  ## Descriptores de Nivel          │ │
│  │                                │                                     │ │
│  │ ### Nivel 1: 0-5 puntos        │  ### Nivel 1: 0-5 puntos           │ │
│  │ **Trabajo deficiente**         │  **Trabajo deficiente**            │ │
│  │                                │                                     │ │
│  │ - El trabajo del alumno no...  │  • El trabajo del alumno no...     │ │
│  │                                │                                     │ │
│  │ ### Nivel 2: 6-10 puntos       │  ### Nivel 2: 6-10 puntos          │ │
│  │ [CURSOR AQUÍ]                  │                                     │ │
│  │                                │                                     │ │
│  │                                │                                     │ │
│  │                                │                                     │ │
│  │                                │                                     │ │
│  │                                │                                     │ │
│  │                                │                                     │ │
│  └─────────────────────────────────┴─────────────────────────────────────┘ │
│                                                                             │
│  [↩️ Deshacer]  [↪️ Rehacer]  [📋 Formato]  [❓ Ayuda Markdown]            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 FLUJO CHAT → MARKDOWN

### Paso 1: Profesor sube imagen

```
👤 [Sube imagen de rúbrica IB]
```

### Paso 2: IA extrae y confirma

```
🤖 He analizado la imagen y extraído la rúbrica. 

Vista previa de lo detectado:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 Asignatura: Filosofía IB
📊 Escala: 0-25 puntos
📋 Niveles: 5 (0-5, 6-10, 11-15, 16-20, 21-25)

¿Deseas:
[✓ Guardar como está]  
[✏️ Editar antes de guardar]  
[🔄 Extraer de nuevo]
```

### Paso 3: Guardado y confirmación

```
🤖 ✓ Rúbrica guardada exitosamente

Archivo: evaluacion-ib-filosofia.md
Ubicación: Mis Rúbricas

Puedes:
• Verla en el panel izquierdo
• Editarla en cualquier momento
• Usarla para evaluar ahora

[📋 Usar esta rúbrica ahora]  [👁️ Ver en panel de rúbricas]
```

---

## 📊 ESTRUCTURA DE METADATOS YAML

Cada archivo Markdown incluye metadatos YAML frontmatter:

```markdown
---
id: "rubrica-filosofia-ib-001"
nombre: "Evaluación Ensayo - IB Filosofía"
asignatura: "Filosofía"
nivel: "IB"
tipo_trabajo: "Ensayo argumentativo"
puntuacion_maxima: 25
cantidad_niveles: 5
criterios_count: 4
formato: "IB"
fecha_creacion: "2025-04-10"
fecha_modificacion: "2025-04-10"
usada_veces: 3
estado: "activa"
archivo_original: "rubrica_ib_foto.jpg"
hash_contenido: "a1b2c3d4"
---

# Rúbrica: Evaluación Ensayo - IB Filosofía
...
```

---

## 🔌 API ENDPOINTS

### POST /rubricas/extraer-desde-imagen
```json
// Request
{
  "imagen_base64": "data:image/jpeg;base64,/9j/4AAQ...",
  "nombre_sugerido": "rubrica-ib-filosofia"
}

// Response
{
  "success": true,
  "markdown_generado": "# Rúbrica...",
  "metadatos_extraidos": {
    "asignatura": "Filosofía",
    "nivel": "IB",
    "escala": "0-25"
  },
  "confianza_extraccion": 0.94,
  "preview_url": "/temp/rubrica-preview-123.md"
}
```

### POST /rubricas/guardar
```json
// Request
{
  "nombre_archivo": "evaluacion-ib-filosofia.md",
  "contenido_markdown": "# Rúbrica...",
  "confirmar": true
}

// Response
{
  "success": true,
  "rubrica_id": "rubrica-filosofia-ib-001",
  "ruta_archivo": "/rubricas/usuario-123/evaluacion-ib-filosofia.md",
  "url_edicion": "/rubricas/editar/evaluacion-ib-filosofia"
}
```

### GET /rubricas/{id}
```json
// Response
{
  "success": true,
  "rubrica": {
    "id": "rubrica-filosofia-ib-001",
    "nombre_archivo": "evaluacion-ib-filosofia.md",
    "contenido_markdown": "# Rúbrica...",
    "contenido_html": "<h1>Rúbrica...</h1>",
    "metadatos": { ... },
    "estadisticas_uso": {
      "veces_usada": 3,
      "ultima_vez": "2025-04-10"
    }
  }
}
```

### PUT /rubricas/{id}
```json
// Request
{
  "contenido_markdown": "# Rúbrica modificada...",
  "mensaje_commit": "Ajusté ponderación de criterios"
}
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Backend
- [ ] Endpoint extracción OCR desde imagen
- [ ] Endpoint extracción desde documento (PDF/DOCX)
- [ ] Generador de Markdown estructurado
- [ ] Sistema de archivos para guardar .md
- [ ] Parser de YAML frontmatter
- [ ] Conversor Markdown → JSON (para evaluación)

### Frontend
- [ ] Componente upload imagen/documento en chat
- [ ] Componente preview antes de guardar
- [ ] Panel "Mis Rúbricas" con listado de archivos
- [ ] Editor Markdown con split view (editor + preview)
- [ ] Visualizador de rúbrica en evaluación
- [ ] Selector de rúbrica al iniciar evaluación

### Integración
- [ ] Chat reconoce intención de crear rúbrica
- [ ] IA genera Markdown válido
- [ ] Sistema evalúa usando rúbrica Markdown parseada

---

*Especificación: Sistema de Rúbricas en Markdown v1.0*
