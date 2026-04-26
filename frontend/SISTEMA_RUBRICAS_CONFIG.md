# 🎨 Sistema de Rúbricas Personalizables por Profesor

## Objetivo
Cada profesor puede configurar sus propias rúbricas según su asignatura, manteniendo el **sistema de colores** como formato universal de presentación de correcciones.

---

## 📋 Estructura de Rúbrica Personalizable

### 1. CONFIGURACIÓN DE RÚBRICA (Subida por Profesor)

```json
{
  "nombre_rubrica": "Ensayo Argumentativo - Lengua Castellana",
  "asignatura": "lengua_castellana",
  "nivel": "secundaria",
  "criterios_evaluacion": [
    {
      "id": "c1",
      "nombre": "Tesis y Argumentación",
      "descripcion": "Claridad de la tesis y coherencia argumentativa",
      "peso": 30,
      "tipo": "texto"
    },
    {
      "id": "c2", 
      "nombre": "Uso de Conectores",
      "descripcion": "Uso apropiado de conectores lógicos",
      "peso": 20,
      "tipo": "texto"
    },
    {
      "id": "c3",
      "nombre": "Ortografía y Gramática",
      "descripcion": "Correcto uso de normas ortográficas",
      "peso": 25,
      "tipo": "texto"
    },
    {
      "id": "c4",
      "nombre": "Conclusión",
      "descripcion": "Síntesis y cierre del argumento",
      "peso": 25,
      "tipo": "texto"
    }
  ],
  "escala_calificacion": {
    "min": 1,
    "max": 10,
    "aprobado": 6
  },
  "segmentacion": "parrafo",  // parrafo | pagina | seccion
  "requiere_bibliografia": false,
  " elementos_requeridos": ["introduccion", "desarrollo", "conclusion"]
}
```

### 2. EJEMPLO: Rúbrica de Ciencias Naturales (Física)

```json
{
  "nombre_rubrica": "Resolución de Problemas - Física",
  "asignatura": "ciencias_naturales",
  "sub_asignatura": "fisica",
  "nivel": "bachillerato",
  "criterios_evaluacion": [
    {
      "id": "c1",
      "nombre": "Planteamiento del Problema",
      "descripcion": "Identificación correcta de datos y variables",
      "peso": 25,
      "tipo": "mixto"  // texto + formulas
    },
    {
      "id": "c2",
      "nombre": "Aplicación de Fórmulas",
      "descripcion": "Uso correcto de ecuaciones y unidades",
      "peso": 35,
      "tipo": "formula",
      "formulas_esperadas": ["F=ma", "v=d/t"]
    },
    {
      "id": "c3",
      "nombre": "Procedimiento",
      "descripcion": "Desarrollo matemático ordenado y justificado",
      "peso": 25,
      "tipo": "mixto"
    },
    {
      "id": "c4",
      "nombre": "Resultado y Unidades",
      "descripcion": "Respuesta con unidades correctas",
      "peso": 15,
      "tipo": "formula"
    }
  ],
  "soporte_formulas": true,  // LaTeX o MathJax
  "unidades_requeridas": true
}
```

### 3. EJEMPLO: Rúbrica de Matemáticas

```json
{
  "nombre_rubrica": "Demostración Geométrica",
  "asignatura": "matematicas",
  "criterios_evaluacion": [
    {
      "id": "c1",
      "nombre": "Enunciado y Datos",
      "peso": 20,
      "tipo": "texto"
    },
    {
      "id": "c2",
      "nombre": "Desarrollo Lógico",
      "peso": 40,
      "tipo": "mixto"
    },
    {
      "id": "c3",
      "nombre": "Uso de Teoremas",
      "peso": 25,
      "tipo": "referencia",
      "teoremas_referencia": ["Pitágoras", "Thales"]
    },
    {
      "id": "c4",
      "nombre": "Conclusión Formal",
      "peso": 15,
      "tipo": "texto"
    }
  ]
}
```

---

## 🎨 Sistema de Colores Universal

Independientemente de la asignatura, las correcciones usan este sistema:

### Formato de Correcciones en el Texto

```
PÁRRAFO ORIGINAL:
"El objeto cae a una velocidad de 9.8 m/s2 debido a la gravedad"

EVALUACIÓN CON COLORES:
"El objeto cae a una velocidad de 9.8 [CORRECCIÓN-ROJO: m/s2 → m/s²] debido a la gravedad [CORRECCIÓN-AZUL: AÑADIR REFERENCIA: Ley de gravitación universal - Newton]"
```

### Significado de los Colores

| Color | Código | Uso | Ejemplo |
|-------|--------|-----|---------|
| 🔴 **ROJO** | `[CORRECCIÓN-ROJO: X → Y]` | **Error factual/matemático** | `[CORRECCIÓN-ROJO: 2+2=5 → 2+2=4]` |
| 🔵 **AZUL** | `[CORRECCIÓN-AZUL: ACCIÓN]` | **Falta referencia/cita** | `[CORRECCIÓN-AZUL: CITAR: Teorema de Pitágoras]` |
| 🟢 **VERDE** | `[CORRECCIÓN-VERDE: X → Y]` | **Mejora de redacción/claridad** | `[CORRECCIÓN-VERDE: cae → desciende con aceleración]` |
| 🟠 **NARANJA** | `[CORRECCIÓN-NARANJA: DESCRIPCIÓN]` | **Problema estructural** | `[CORRECCIÓN-NARANJA: PASO FALTANTE: Justificar el cambio de variable]` |

---

## 🧪 Adaptación por Tipo de Asignatura

### Asignaturas de TEXTO (Lengua, Historia, Filosofía)

```javascript
configEvaluacion = {
  modo: 'texto',
  segmentacion: 'parrafo',
  detectar: ['gramatica', 'ortografia', 'estilo', 'referencias'],
  prompt_adicional: `
    Evalúa este texto académico párrafo por párrafo:
    - Identifica errores gramaticales (ROJO)
    - Señala citas faltantes (AZUL)
    - Sugiere mejoras de estilo académico (VERDE)
    - Señala estructuras argumentativas débiles (NARANJA)
  `
}
```

### Asignaturas de CIENCIAS con FÓRMULAS (Física, Química, Matemáticas)

```javascript
configEvaluacion = {
  modo: 'mixto',
  segmentacion: 'paso',  // Paso a paso de la resolución
  soporte_latex: true,
  detectar: ['calculos', 'unidades', 'formulas', 'teoremas'],
  prompt_adicional: `
    Evalúa este ejercicio de física paso a paso:
    - Verifica cálculos numéricos (ROJO si hay error)
    - Verifica unidades (ROJO si son incorrectas)
    - Señala fórmulas aplicadas sin mencionar (AZUL)
    - Sugiere redacción más clara (VERDE)
    - Señala pasos de desarrollo faltantes (NARANJA)
    
    FORMATO ESPECIAL PARA FÓRMULAS:
    - Las fórmulas en LaTeX deben renderizarse
    - Indicar el nombre de la fórmula/teorema usado
    - Verificar dimensionalidad de unidades
  `
}
```

### Asignaturas de GRÁFICOS/DIAGRAMAS (Biología, Geografía)

```javascript
configEvaluacion = {
  modo: 'visual',
  segmentacion: 'figura',
  detectar: ['etiquetas', 'escalas', 'leyendas', 'interpretacion'],
  prompt_adicional: `
    Evalúa los gráficos/diagramas incluidos:
    - Verifica que estén correctamente etiquetados (ROJO)
    - Señala fuentes de datos faltantes (AZUL)
    - Sugiere mejoras en presentación (VERDE)
    - Señala interpretaciones incorrectas (NARANJA)
  `
}
```

---

## 🔧 Implementación en el Backend

### Prompt Dinámico según Rúbrica

```python
def generar_prompt_evaluacion(rubrica, texto_documento):
    """
    Genera el prompt para la IA basado en la rúbrica del profesor
    """
    
    criterios_texto = "\n".join([
        f"{i+1}. {c['nombre']} ({c['peso']}%): {c['descripcion']}"
        for i, c in enumerate(rubrica['criterios_evaluacion'])
    ])
    
    tipo_contenido = rubrica.get('tipo_contenido', 'texto')
    
    prompt = f"""
    # RÚBRICA DEL PROFESOR
    
    Asignatura: {rubrica['asignatura']}
    Tipo de contenido: {tipo_contenido}
    
    ## CRITERIOS DE EVALUACIÓN:
    {criterios_texto}
    
    ## MODO DE EVALUACIÓN:
    - Evaluar {rubrica.get('segmentacion', 'parrafo')} por {rubrica.get('segmentacion', 'parrafo')}
    - Calificación en escala {rubrica['escala_calificacion']['min']}-{rubrica['escala_calificacion']['max']}
    
    ## SISTEMA DE COLORES (USAR EXACTAMENTE ASÍ):
    
    🔴 ROJO - Errores objetivos/factuales:
       [CORRECCIÓN-ROJO: incorrecto → correcto]
       
    🔵 AZUL - Faltantes de referencias/citas:
       [CORRECCIÓN-AZUL: AÑADIR/CITAR/VERIFICAR: descripción]
       
    🟢 VERDE - Mejoras de expresión/redacción:
       [CORRECCIÓN-VERDE: original → mejorado]
       
    🟠 NARANJA - Problemas estructurales:
       [CORRECCIÓN-NARANJA: DESCRIPCIÓN DEL PROBLEMA]
    
    {"## INSTRUCCIONES ESPECIALES PARA FÓRMULAS:" if tipo_contenido == 'mixto' else ""}
    {"- Verificar unidades de medida" if rubrica.get('unidades_requeridas') else ""}
    {"- Validar aplicación de teoremas" if 'teoremas_referencia' in str(rubrica) else ""}
    
    ## DOCUMENTO A EVALUAR:
    
    {texto_documento}
    
    ## FORMATO DE RESPUESTA REQUERIDO:
    
    1. EVALUACIÓN DETALLADA (con colores insertados en el texto)
    2. RESUMEN POR CRITERIOS (calificación por cada criterio)
    3. CALIFICACIÓN GLOBAL
    4. RECOMENDACIONES PRIORITARIAS
    
    IMPORTANTE: Mantén el texto original y SOLO añade las correcciones entre corchetes.
    """
    
    return prompt
```

---

## 📱 Interfaz para el Profesor (Configuración de Rúbrica)

```javascript
// Componente: ConfiguradorRubrica.js
const tiposCriterio = [
  { id: 'texto', nombre: 'Texto/Redacción', icono: '📝' },
  { id: 'formula', nombre: 'Fórmula/Matemática', icono: '🔢' },
  { id: 'mixto', nombre: 'Mixto (Texto + Fórmulas)', icono: '📐' },
  { id: 'referencia', nombre: 'Referencias/Citas', icono: '📚' },
  { id: 'visual', nombre: 'Gráficos/Diagramas', icono: '📊' }
];

const segmentacionOptions = [
  { id: 'parrafo', nombre: 'Párrafo por párrafo', desc: 'Ideal para ensayos' },
  { id: 'pagina', nombre: 'Página por página', desc: 'Para documentos largos' },
  { id: 'seccion', nombre: 'Por secciones', desc: 'Por títulos/capítulos' },
  { id: 'paso', nombre: 'Paso a paso', desc: 'Para ejercicios resueltos' }
];
```

---

## ✅ Checklist de Implementación

### Backend:
- [ ] Endpoint para guardar rúbricas personalizadas por profesor
- [ ] Endpoint para listar rúbricas del profesor
- [ ] Generador de prompts dinámico según rúbrica
- [ ] Parser de respuestas con sistema de colores
- [ ] Soporte para renderizado de fórmulas LaTeX

### Frontend:
- [ ] Pantalla de configuración de rúbricas
- [ ] Selector de tipo de contenido (texto/mixto/fórmulas)
- [ ] Constructor visual de criterios
- [ ] Preview de cómo se verá la evaluación
- [ ] Renderizado de fórmulas matemáticas

---

**¿Este sistema cumple con lo que necesitas? ¿Hay algún ajuste para alguna asignatura específica?**
