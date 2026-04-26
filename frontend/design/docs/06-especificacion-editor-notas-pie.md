# 📄 Especificación Técnica: Editor con Notas al Pie

> Sistema de evaluación donde las correcciones aparecen como notas al pie de cada párrafo

---

## 🎯 CONCEPTO CENTRAL

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TEXTO DEL ESTUDIANTE CON MARCAS DE REFERENCIA                              │
│                                                                             │
│  La Revolución Francesa¹ fue un período de gran transformación             │
│  social que se produjo² en Francia durante el siglo XVIII...                │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  NOTAS AL PIE DEL PÁRRAFO (Editor del Profesor)                             │
│                                                                             │
│  ¹ 🟡 Sugerencia IA: "Revolución Francesa [de 1789-1799]"                  │
│     [✓] [✗] [✎ Editar]                                                     │
│                                                                             │
│  ² 🟢 Cambio aceptado: "tuvo lugar" → "se produjo"                         │
│     Sugerido por IA | Comentario del profesor: "Correcto"                  │
│     [✎ Editar] [🗑️ Eliminar]                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ ESTRUCTURA DE DATOS

### Modelo: Párrafo con Notas al Pie

```typescript
interface ParrafoEvaluado {
  id: string;                    // "p-1", "p-2", etc.
  indice: number;                // 1, 2, 3...
  tipo: "introduccion" | "desarrollo" | "conclusion" | "general";
  
  // Contenido
  texto_original: string;
  texto_corregido: string;       // Con marcas de referencia ¹ ² ³
  
  // Evaluación según rúbrica
  calificacion: number;          // 0 - 10
  semaforo: "VERDE" | "AMARILLO" | "ROJO";
  
  // Notas al pie
  notas_pie: NotaPie[];
  
  // Estado
  estado_revision: "pendiente" | "en_revision" | "completado";
  revisado_por: "ia" | "profesor" | "mixto";
}

interface NotaPie {
  id: string;                    // "nota-p1-1", "nota-p1-2"
  numero: number;                // 1, 2, 3...
  
  // Tipo de corrección
  tipo: "ROJO" | "AZUL" | "VERDE" | "NARANJA";
  categoria: string;             // "ortografia", "gramatica", "estilo", "referencia"
  
  // Ubicación
  posicion_inicio: number;       // Índice en el texto
  posicion_fin: number;
  texto_seleccionado: string;    // Texto original que se marca
  
  // Contenido de la corrección
  sugerencia_ia: {
    texto_original: string;
    texto_sugerido: string;
    explicacion: string;
    criterio_rubrica: string;    // A qué criterio afecta
  };
  
  // Respuesta del profesor
  comentario_profesor: string;
  estado: "pendiente" | "aceptada" | "rechazada" | "modificada";
  
  // Metadatos
  fecha_creacion: Date;
  fecha_decision: Date | null;
  impacto_calificacion: number;  // Cuánto afecta a la nota del párrafo
}

interface EvaluacionDocumento {
  id: string;
  documento_id: string;
  rubrica_id: string;
  
  // Estado global
  estado: "procesando" | "pendiente_revision" | "en_revision" | "completada";
  
  // Contenido
  parrafos: ParrafoEvaluado[];
  
  // Calificación global según rúbrica
  calificacion_global: {
    nota: number;
    semaforo: "VERDE" | "AMARILLO" | "ROJO";
    desglose_por_criterio: {
      criterio_id: string;
      nombre: string;
      peso: number;
      nota: number;
      semaforo: string;
    }[];
  };
  
  // Estadísticas
  estadisticas: {
    total_notas: number;
    notas_por_tipo: {
      ROJO: number;
      AZUL: number;
      VERDE: number;
      NARANJA: number;
    };
    notas_por_estado: {
      pendiente: number;
      aceptada: number;
      rechazada: number;
      modificada: number;
    };
  };
}
```

---

## 🎨 COMPONENTES DEL EDITOR

### 1. EditorNotasPie (Componente Principal)

```jsx
<EditorNotasPie
  evaluacionId="eval-123"
  modo="revision"  // "revision" | "solo_lectura"
  onNotaAceptada={(notaId, comentario) => {}}
  onNotaRechazada={(notaId, razon) => {}}
  onNotaEditada={(notaId, nuevoComentario) => {}}
  onCalificacionChange={(parrafoId, nuevaCalificacion) => {}}
/>
```

### 2. ParrafoConNotas (Sub-componente)

```jsx
<ParrafoConNotas
  parrafo={parrafoData}
  mostrarNotas={true}
  modoEdicion={true}
  
  // Callbacks
  onNotaAction={(notaId, action, data) => {}}
  onTextoClick={(posicion) => {}}  // Para agregar nota manual
/>
```

**Renderizado:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  PÁRRAFO {indice} - {tipo.toUpperCase()}                          {semaforo} │
│  Calificación: {calificacion}/10                                           │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │   {textoConMarcas.map((segmento, i) => (                          │   │
│  │     segmento.esNota ? (                                            │   │
│  │       <sup className="nota-ref-{segmento.nota.tipo}">              │   │
│  │         {segmento.nota.numero}                                     │   │
│  │       </sup>                                                       │   │
│  │     ) : (                                                          │   │
│  │       <span>{segmento.texto}</span>                                │   │
│  │     )                                                              │   │
│  │   ))}                                                              │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  NOTAS AL PIE ({notas.length}):                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                                             │
│  {notas.map(nota => (                                                       │
│    <NotaPieCard key={nota.id} nota={nota} onAction={...} />                │
│  ))}                                                                        │
│                                                                             │
│  [➕ Agregar nota manual a este párrafo]                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3. NotaPieCard (Card Individual)

```jsx
<NotaPieCard
  nota={notaData}
  onAceptar={(comentario) => {}}
  onRechazar={(razon) => {}}
  onEditar={(nuevoContenido) => {}}
  onEliminar={() => {}}
/>
```

**Estados visuales:**

#### Estado: Pendiente
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ {numero} {icono_tipo} {titulo_tipo}                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Ubicación: "{texto_seleccionado}"                                          │
│                                                                             │
│  Sugerencia de la IA:                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {texto_original} → {texto_sugerido}                                 │   │
│  │                                                                     │   │
│  │ Explicación: {explicacion_ia}                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Comentario del profesor (opcional):                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │ [Textarea editable]                                                 │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [✓ Aceptar con comentario]  [✗ Rechazar]  [✎ Modificar sugerencia]        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Estado: Aceptada
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ {numero} ✓ {titulo_tipo} - ACEPTADA                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Cambio aplicado:                                                           │
│  "{texto_sugerido}"                                                         │
│                                                                             │
│  Comentario del profesor:                                                   │
│  "{comentario_profesor}"                                                    │
│                                                                             │
│  [✎ Editar nota]  [🗑️ Eliminar]  [↩️ Deshacer]                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Estado: Rechazada
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ {numero} ✗ {titulo_tipo} - RECHAZADA                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Sugerencia rechazada:                                                      │
│  "{texto_sugerido}"                                                         │
│                                                                             │
│  Razón del rechazo:                                                         │
│  "{comentario_profesor}"                                                    │
│                                                                             │
│  [✎ Cambiar a aceptada]  [🗑️ Eliminar nota]                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 ALGORITMO: Insertar Marcas en el Texto

```typescript
function insertarMarcasEnTexto(
  textoOriginal: string,
  notas: NotaPie[]
): SegmentoTexto[] {
  
  // Ordenar notas por posición (de atrás hacia adelante)
  const notasOrdenadas = [...notas]
    .filter(n => n.estado !== 'rechazada')  // No mostrar rechazadas
    .sort((a, b) => b.posicion_inicio - a.posicion_inicio);
  
  const segmentos: SegmentoTexto[] = [];
  let posicionActual = textoOriginal.length;
  
  for (const nota of notasOrdenadas) {
    // Texto después de la nota
    if (posicionActual > nota.posicion_fin) {
      segmentos.unshift({
        tipo: 'texto',
        contenido: textoOriginal.slice(nota.posicion_fin, posicionActual)
      });
    }
    
    // La marca de la nota
    segmentos.unshift({
      tipo: 'nota',
      numero: nota.numero,
      tipoNota: nota.tipo,
      notaId: nota.id
    });
    
    // Texto antes de la nota
    posicionActual = nota.posicion_inicio;
  }
  
  // Texto inicial
  if (posicionActual > 0) {
    segmentos.unshift({
      tipo: 'texto',
      contenido: textoOriginal.slice(0, posicionActual)
    });
  }
  
  return segmentos;
}
```

---

## 🚦 SISTEMA DE SEMÁFORO SEGÚN RÚBRICA

### Configuración de Umbrales

```typescript
interface ConfiguracionSemaforo {
  niveles: {
    VERDE: {
      min: number;      // 8.0
      max: number;      // 10
      color: string;    // "#22c55e"
      icono: string;    // 🟢
      label: string;    // "Excelente"
    };
    AMARILLO: {
      min: number;      // 6.0
      max: number;      // 7.9
      color: string;    // "#fbbf24"
      icono: string;    // 🟡
      label: string;    // "Aceptable"
    };
    ROJO: {
      min: number;      // 0
      max: number;      // 5.9
      color: string;    // "#ef4444"
      icono: string;    // 🔴
      label: string;    // "Necesita revisión"
    };
  };
  
  // Reglas de decisión
  reglas: {
    error_critico: {     // Si hay nota ROJA no resuelta
      semaforo_forzado: "ROJO";
      bloquea_entrega: true;
    };
    max_notas_amarillas: {  // Si hay más de X notas AMARILLAS
      cantidad: 3;
      semaforo_forzado: "AMARILLO";
    };
  };
}
```

### Cálculo de Calificación por Párrafo

```typescript
function calcularCalificacionParrafo(
  parrafo: ParrafoEvaluado,
  rubrica: Rubrica
): { nota: number; semaforo: string } {
  
  // Calificar cada criterio
  const calificacionesCriterios = rubrica.criterios.map(criterio => {
    const notasCriterio = parrafo.notas_pie.filter(
      n => n.sugerencia_ia.criterio_rubrica === criterio.id
    );
    
    // Penalizaciones según tipo de nota
    const penalizacion = notasCriterio.reduce((acc, nota) => {
      if (nota.estado === 'pendiente' || nota.estado === 'aceptada') {
        switch (nota.tipo) {
          case 'ROJO': return acc + criterio.penalizacion_rojo;
          case 'AMARILLO': return acc + criterio.penalizacion_amarillo;
          case 'VERDE': return acc + criterio.penalizacion_verde;
          default: return acc;
        }
      }
      return acc;
    }, 0);
    
    const notaCriterio = Math.max(0, 10 - penalizacion);
    
    return {
      criterioId: criterio.id,
      nota: notaCriterio,
      peso: criterio.peso
    };
  });
  
  // Calificación ponderada
  const notaFinal = calificacionesCriterios.reduce(
    (acc, c) => acc + (c.nota * c.peso / 100),
    0
  );
  
  // Determinar semáforo
  const semaforo = determinarSemaforo(notaFinal, parrafo.notas_pie, rubrica);
  
  return { nota: notaFinal, semaforo };
}
```

---

## 📱 NAVEGACIÓN ENTRE PÁRRAFOS

### Vista Individual (Un párrafo a la vez)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  [◀ Párrafo anterior]           PÁRRAFO 3 DE 8           [Siguiente ▶]     │
│                                                                             │
│  [Ir al párrafo: __________]  [🔍]  [Filtros: 🔴 Pendientes]               │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  [CONTENIDO DEL PÁRRAFO 3 CON NOTAS AL PIE]                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Vista Completa (Todos los párrafos)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  PÁRRAFO 1                                            🟢 8.5/10             │
│  "Texto...¹...²"                                        [Ver detalle]      │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  PÁRRAFO 2                                            🟡 7.2/10             │
│  "Texto...³...⁴"                                        [Ver detalle]      │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  PÁRRAFO 3  [EDITANDO]                                🔴 3.5/10             │
│  "Texto...⁵...⁶"                                        [🔽 Ocultar detalle]│
│                                                                             │
│  NOTAS AL PIE DEL PÁRRAFO 3:                                               │
│  [Cards de notas expandidas]                                               │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  PÁRRAFO 4                                            🟢 9.0/10             │
│  "Texto..."                                             [Ver detalle]      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔌 API ENDPOINTS

### GET /evaluaciones/{id}/parrafos
```json
{
  "success": true,
  "evaluacion_id": "eval-123",
  "parrafos": [
    {
      "id": "p-1",
      "indice": 1,
      "tipo": "introduccion",
      "texto_original": "La Revolución Francesa fue...",
      "texto_corregido": "La Revolución Francesa¹ fue...",
      "calificacion": 8.5,
      "semaforo": "VERDE",
      "notas_pie": [
        {
          "id": "nota-p1-1",
          "numero": 1,
          "tipo": "VERDE",
          "posicion_inicio": 23,
          "posicion_fin": 31,
          "sugerencia_ia": {
            "texto_original": "Fue",
            "texto_sugerido": "representó",
            "explicacion": "Verbo más descriptivo"
          },
          "estado": "aceptada",
          "comentario_profesor": "Buena sugerencia"
        }
      ]
    }
  ]
}
```

### POST /evaluaciones/{id}/notas/{nota_id}/decision
```json
// Request
{
  "decision": "aceptada" | "rechazada" | "modificada",
  "comentario_profesor": "Texto opcional",
  "modificacion_sugerencia": "Nuevo texto sugerido (si aplica)"
}

// Response
{
  "success": true,
  "nota_actualizada": { ... },
  "calificacion_parrafo_actualizada": {
    "nueva_nota": 9.0,
    "nuevo_semaforo": "VERDE"
  }
}
```

### POST /evaluaciones/{id}/notas
```json
// Crear nota manual
{
  "parrafo_id": "p-1",
  "posicion_inicio": 45,
  "posicion_fin": 50,
  "texto_seleccionado": "texto",
  "comentario_profesor": "Nota manual del profesor",
  "tipo": "AZUL"
}
```

---

## 🎨 ESTILOS CSS

```css
/* Marcas en el texto */
.nota-ref {
  font-size: 0.75em;
  vertical-align: super;
  cursor: pointer;
  padding: 0 2px;
  border-radius: 3px;
  font-weight: bold;
}

.nota-ref-ROJO {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.nota-ref-AZUL {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.nota-ref-VERDE {
  color: #22c55e;
  background: rgba(34, 197, 94, 0.1);
}

.nota-ref-NARANJA {
  color: #f97316;
  background: rgba(249, 115, 22, 0.1);
}

/* Separador de notas al pie */
.notas-pie-separador {
  border-top: 2px solid #e5e7eb;
  margin: 1.5rem 0 1rem 0;
  padding-top: 1rem;
}

/* Card de nota */
.nota-pie-card {
  border-left: 4px solid;
  padding: 1rem;
  margin-bottom: 1rem;
  background: #f9fafb;
  border-radius: 0 8px 8px 0;
}

.nota-pie-card.ROJO { border-color: #ef4444; }
.nota-pie-card.AZUL { border-color: #3b82f6; }
.nota-pie-card.VERDE { border-color: #22c55e; }
.nota-pie-card.NARANJA { border-color: #f97316; }

.nota-pie-card.aceptada {
  background: rgba(34, 197, 94, 0.05);
}

.nota-pie-card.rechazada {
  opacity: 0.6;
  background: rgba(239, 68, 68, 0.05);
}
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Backend
- [ ] Endpoint para obtener párrafos con notas
- [ ] Endpoint para actualizar estado de nota
- [ ] Endpoint para crear nota manual
- [ ] Lógica de recálculo de calificación
- [ ] Parser de texto para insertar marcas

### Frontend
- [ ] Componente EditorNotasPie
- [ ] Componente ParrafoConNotas
- [ ] Componente NotaPieCard
- [ ] Sistema de renderizado de texto con marcas
- [ ] Navegación entre párrafos
- [ ] Vista completa vs individual

### Integración
- [ ] Conectar con sistema de rúbricas
- [ ] Sincronizar estado de notas con calificación
- [ ] Exportar documento final con notas

---

*Especificación v1.0 - Editor con Notas al Pie*
