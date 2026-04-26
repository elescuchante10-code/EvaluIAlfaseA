/**
 * PÁGINA DE DEMO - Visualizar componentes nuevos
 * Accesible en: http://localhost:3000/demo
 * 
 * NO INTEGRAR EN PRODUCCIÓN
 * Solo para revisión visual y ajustes de UX/UI
 */

import React, { useState } from 'react';
import { EditorNotasPie, ParrafoConNotas, NotaPieCard } from './components/editor';
import { PanelRubricas, EditorMarkdown } from './components/rubricas';
import { parseRubricaMarkdown, generateRubricaMarkdown } from './utils/rubricaParser';

// Datos de ejemplo para el demo
const RUBRICA_EJEMPLO = parseRubricaMarkdown(`---
id: "rubrica-ib-filosofia"
nombre: "Evaluación Ensayo - IB Filosofía"
asignatura: "Filosofía"
nivel: "IB"
---

# Evaluación Ensayo - IB Filosofía

## Información General
- **Asignatura**: Filosofía
- **Nivel**: IB
- **Puntuación máxima**: 25

---

## Criterios de Evaluación

| Criterio | Peso | Descripción |
|----------|------|-------------|
| Estructura | 20% | Organización del texto |
| Comprensión | 20% | Identificación de la cuestión |
| Conocimiento | 25% | Precisión y vocabulario |
| Análisis | 35% | Discusión crítica |

---

## Niveles de Desempeño

### Nivel 1: 0-5 puntos
**Deficiente**

- No alcanza el nivel descrito

### Nivel 2: 6-10 puntos
**Limitado**

- Respuesta limitada

### Nivel 3: 11-15 puntos
**Desarrollo**

- Respuesta con desarrollo

### Nivel 4: 16-20 puntos
**Bien estructurado**

- Respuesta organizada

### Nivel 5: 21-25 puntos
**Excelente**

- Respuesta sobresaliente

---

## Configuración del Semaforo

\`\`\`yaml
semaforo:
  verde:
    min: 21
    max: 25
    color: "#22c55e"
  amarillo:
    min: 16
    max: 20
    color: "#fbbf24"
  naranja:
    min: 11
    max: 15
    color: "#f97316"
  rojo:
    min: 0
    max: 10
    color: "#ef4444"
\`\`\`
`);

const PARRAFO_EJEMPLO = {
  id: 'p-1',
  indice: 1,
  tipo: 'Introducción',
  texto_original: 'La Revolución Francesa fue un período de gran cambio social que tuvo lugar en Francia durante el siglo XVIII. Este evento histórico marcó el inicio de una nueva era para Europa.',
  calificacion: 5.5,
  semaforo: 'ROJO',
  notas_pie: [
    {
      id: 'nota-1',
      numero: 1,
      tipo: 'VERDE',
      posicion_inicio: 55,
      posicion_fin: 60,
      texto_seleccionado: 'cambio',
      sugerencia_ia: {
        texto_original: 'cambio',
        texto_sugerido: 'transformación social radical',
        explicacion: 'Término más académico y preciso para describir la magnitud del evento'
      },
      estado: 'pendiente'
    },
    {
      id: 'nota-2',
      numero: 2,
      tipo: 'AZUL',
      posicion_inicio: 12,
      posicion_fin: 32,
      texto_seleccionado: 'Revolución Francesa',
      sugerencia_ia: {
        texto_original: 'Revolución Francesa',
        texto_sugerido: 'Revolución Francesa (1789-1799)',
        explicacion: 'Añadir fechas para precisión histórica'
      },
      estado: 'pendiente'
    },
    {
      id: 'nota-3',
      numero: 3,
      tipo: 'ROJO',
      posicion_inicio: 81,
      posicion_fin: 92,
      texto_seleccionado: 'tuvo lugar',
      sugerencia_ia: {
        texto_original: 'tuvo lugar',
        texto_sugerido: 'se produjo',
        explicacion: 'Verbo más formal para contexto académico'
      },
      estado: 'pendiente'
    }
  ]
};

const RUBRICAS_EJEMPLO = [
  RUBRICA_EJEMPLO,
  parseRubricaMarkdown(`---
id: "rubrica-lengua-10"
nombre: "Ensayo Argumentativo"
asignatura: "Lengua Castellana"
---

# Ensayo Argumentativo

## Información General
- **Asignatura**: Lengua Castellana
- **Nivel**: Secundaria
- **Puntuación máxima**: 10

---

## Criterios de Evaluación

| Criterio | Peso |
|----------|------|
| Tesis | 30% |
| Argumentación | 30% |
| Organización | 20% |
| Lenguaje | 20% |
`)
];

function DemoComponentes() {
  const [vista, setVista] = useState('menu'); // 'menu' | 'editor-notas' | 'panel-rubricas' | 'editor-markdown' | 'nota-card' | 'parrafo'

  const renderMenu = () => (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '2rem'
    }}>
      <h1 style={{ marginBottom: '0.5rem' }}>🎨 Demo de Componentes</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Selecciona un componente para visualizar y ajustar:
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1rem'
      }}>
        <DemoCard
          titulo="📄 EditorNotasPie"
          descripcion="Editor principal con notas al pie, panel lateral y chat"
          onClick={() => setVista('editor-notas')}
        />
        <DemoCard
          titulo="📋 PanelRubricas"
          descripcion="Panel izquierdo de gestión de rúbricas"
          onClick={() => setVista('panel-rubricas')}
        />
        <DemoCard
          titulo="✏️ EditorMarkdown"
          descripcion="Editor de rúbricas en Markdown con preview"
          onClick={() => setVista('editor-markdown')}
        />
        <DemoCard
          titulo="📝 NotaPieCard"
          descripcion="Card individual de cada nota al pie"
          onClick={() => setVista('nota-card')}
        />
        <DemoCard
          titulo="📖 ParrafoConNotas"
          descripcion="Visualización de párrafo con marcas [¹] [²]"
          onClick={() => setVista('parrafo')}
        />
        <DemoCard
          titulo="🎯 Todos los colores"
          descripcion="Muestra de semáforos y tipos de notas"
          onClick={() => setVista('colores')}
        />
      </div>
    </div>
  );

  const renderEditorNotas = () => (
    <div style={{ height: '100vh' }}>
      <div style={{
        padding: '1rem',
        background: '#f3f4f6',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ margin: 0 }}>📄 EditorNotasPie</h2>
        <button 
          onClick={() => setVista('menu')}
          style={{
            padding: '0.5rem 1rem',
            background: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          ← Volver al menú
        </button>
      </div>
      <EditorNotasPie
        evaluacionId="demo-001"
        documento={{
          titulo: 'Ensayo sobre la Revolución Francesa',
          parrafos: [
            PARRAFO_EJEMPLO,
            {
              ...PARRAFO_EJEMPLO,
              id: 'p-2',
              indice: 2,
              tipo: 'Desarrollo',
              texto_original: 'Las causas de la revolución fueron múltiples. Entre ellas se destacan la crisis económica, la desigualdad social y las ideas ilustradas.',
              calificacion: 8.5,
              semaforo: 'VERDE',
              notas_pie: [
                {
                  ...PARRAFO_EJEMPLO.notas_pie[0],
                  id: 'nota-4',
                  estado: 'aceptada'
                }
              ]
            }
          ]
        }}
        rubrica={RUBRICA_EJEMPLO}
        modo="revision"
        onGuardarBorrador={() => alert('Borrador guardado')}
        onGenerarFinal={() => alert('Generando informe...')}
        onCancelar={() => setVista('menu')}
      />
    </div>
  );

  const renderPanelRubricas = () => (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: '#f9fafb'
    }}>
      <div style={{ width: '320px', height: '100%' }}>
        <PanelRubricas
          rubricas={RUBRICAS_EJEMPLO}
          rubricaActiva={RUBRICA_EJEMPLO}
          onSeleccionarRubrica={(r) => alert(`Seleccionada: ${r.titulo}`)}
          onCrearRubrica={() => alert('Crear nueva')}
          onEditarRubrica={(r) => alert(`Editar: ${r.titulo}`)}
          onEliminarRubrica={(id) => alert(`Eliminar: ${id}`)}
          onImportarRubrica={() => alert('Importar')}
        />
      </div>
      <div style={{
        flex: 1,
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <button 
          onClick={() => setVista('menu')}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#111827',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          ← Volver al menú
        </button>
        <p style={{ marginTop: '1rem', color: '#666' }}>
          PanelRubricas renderizado en un contenedor de 320px (ancho típico de sidebar)
        </p>
      </div>
    </div>
  );

  const renderEditorMarkdown = () => (
    <div style={{ height: '100vh' }}>
      <EditorMarkdown
        rubrica={RUBRICA_EJEMPLO}
        onGuardar={(r) => {
          alert('Rúbrica guardada: ' + r.titulo);
          setVista('menu');
        }}
        onCancelar={() => setVista('menu')}
      />
    </div>
  );

  const renderNotaCard = () => (
    <div style={{
      maxWidth: '600px',
      margin: '0 auto',
      padding: '2rem'
    }}>
      <button 
        onClick={() => setVista('menu')}
        style={{
          marginBottom: '1rem',
          padding: '0.5rem 1rem',
          background: 'white',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          cursor: 'pointer'
        }}
      >
        ← Volver
      </button>

      <h2 style={{ marginBottom: '1rem' }}>NotaPieCard - Estados</h2>

      <h3 style={{ color: '#666', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
        Estado: Pendiente
      </h3>
      <NotaPieCard
        nota={{
          ...PARRAFO_EJEMPLO.notas_pie[0],
          estado: 'pendiente'
        }}
        onAceptar={(id, c) => alert(`Aceptar ${id}: ${c}`)}
        onRechazar={(id, c) => alert(`Rechazar ${id}: ${c}`)}
        onEditar={(id, d) => alert(`Editar ${id}`)}
      />

      <h3 style={{ color: '#666', fontSize: '0.875rem', margin: '1.5rem 0 0.5rem' }}>
        Estado: Aceptada
      </h3>
      <NotaPieCard
        nota={{
          ...PARRAFO_EJEMPLO.notas_pie[0],
          estado: 'aceptada',
          comentario_profesor: 'Buena sugerencia, la aplicaré'
        }}
        onAceptar={() => {}}
        onRechazar={() => {}}
      />

      <h3 style={{ color: '#666', fontSize: '0.875rem', margin: '1.5rem 0 0.5rem' }}>
        Estado: Rechazada
      </h3>
      <NotaPieCard
        nota={{
          ...PARRAFO_EJEMPLO.notas_pie[0],
          estado: 'rechazada',
          comentario_profesor: 'Prefiero mantener el texto original'
        }}
        onAceptar={() => {}}
        onRechazar={() => {}}
      />

      <h3 style={{ color: '#666', fontSize: '0.875rem', margin: '1.5rem 0 0.5rem' }}>
        Tipo: ROJO (Error crítico)
      </h3>
      <NotaPieCard
        nota={{
          ...PARRAFO_EJEMPLO.notas_pie[2],
          estado: 'pendiente'
        }}
        onAceptar={() => {}}
        onRechazar={() => {}}
      />
    </div>
  );

  const renderParrafo = () => (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '2rem'
    }}>
      <button 
        onClick={() => setVista('menu')}
        style={{
          marginBottom: '1rem',
          padding: '0.5rem 1rem',
          background: 'white',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          cursor: 'pointer'
        }}
      >
        ← Volver
      </button>

      <h2 style={{ marginBottom: '1rem' }}>ParrafoConNotas</h2>

      <h3 style={{ color: '#666', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
        Semaforo ROJO
      </h3>
      <ParrafoConNotas
        parrafo={PARRAFO_EJEMPLO}
        onNotaClick={(id) => alert(`Clic en nota: ${id}`)}
      />

      <h3 style={{ color: '#666', fontSize: '0.875rem', margin: '2rem 0 0.5rem' }}>
        Semaforo VERDE
      </h3>
      <ParrafoConNotas
        parrafo={{
          ...PARRAFO_EJEMPLO,
          semaforo: 'VERDE',
          calificacion: 9.0,
          notas_pie: [
            { ...PARRAFO_EJEMPLO.notas_pie[0], estado: 'aceptada' }
          ]
        }}
      />
    </div>
  );

  const renderColores = () => (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '2rem'
    }}>
      <button 
        onClick={() => setVista('menu')}
        style={{
          marginBottom: '1rem',
          padding: '0.5rem 1rem',
          background: 'white',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          cursor: 'pointer'
        }}
      >
        ← Volver
      </button>

      <h2 style={{ marginBottom: '2rem' }}>🎨 Guía de Colores</h2>

      <section style={{ marginBottom: '2rem' }}>
        <h3>Sistema de Semáforo</h3>
        <div style={{ display: 'grid', gap: '0.5rem', marginTop: '1rem' }}>
          <ColorBox color="#22c55e" label="VERDE (8-10)" text="Excelente" />
          <ColorBox color="#fbbf24" label="AMARILLO (6-7.9)" text="Aceptable" />
          <ColorBox color="#f97316" label="NARANJA (4-5.9)" text="Necesita mejorar" />
          <ColorBox color="#ef4444" label="ROJO (0-3.9)" text="Deficiente" />
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3>Tipos de Notas</h3>
        <div style={{ display: 'grid', gap: '0.5rem', marginTop: '1rem' }}>
          <ColorBox color="#ef4444" label="🔴 ROJO" text="Error crítico - debe corregirse" />
          <ColorBox color="#3b82f6" label="🔵 AZUL" text="Falta referencia o cita" />
          <ColorBox color="#22c55e" label="🟢 VERDE" text="Mejora sugerida - opcional" />
          <ColorBox color="#f97316" label="🟠 NARANJA" text="Problema estructural" />
        </div>
      </section>

      <section>
        <h3>Estados de Notas</h3>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <EstadoBadge estado="pendiente" />
          <EstadoBadge estado="aceptada" />
          <EstadoBadge estado="rechazada" />
          <EstadoBadge estado="modificada" />
        </div>
      </section>
    </div>
  );

  switch (vista) {
    case 'editor-notas':
      return renderEditorNotas();
    case 'panel-rubricas':
      return renderPanelRubricas();
    case 'editor-markdown':
      return renderEditorMarkdown();
    case 'nota-card':
      return renderNotaCard();
    case 'parrafo':
      return renderParrafo();
    case 'colores':
      return renderColores();
    default:
      return renderMenu();
  }
}

// Componentes auxiliares para el demo
function DemoCard({ titulo, descripcion, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '1.5rem',
        background: 'white',
        border: '2px solid #e5e7eb',
        borderRadius: '12px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.2s',
        ':hover': {
          borderColor: '#3b82f6',
          transform: 'translateY(-2px)'
        }
      }}
    >
      <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>{titulo}</h3>
      <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>{descripcion}</p>
    </button>
  );
}

function ColorBox({ color, label, text }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      padding: '1rem',
      background: `${color}15`,
      borderLeft: `4px solid ${color}`,
      borderRadius: '0 8px 8px 0'
    }}>
      <div style={{
        width: '24px',
        height: '24px',
        background: color,
        borderRadius: '50%'
      }} />
      <div>
        <strong style={{ color }}>{label}</strong>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>{text}</p>
      </div>
    </div>
  );
}

function EstadoBadge({ estado }) {
  const colors = {
    pendiente: { bg: '#fef3c7', text: '#92400e', label: '⏳ Pendiente' },
    aceptada: { bg: '#dcfce7', text: '#166534', label: '✓ Aceptada' },
    rechazada: { bg: '#fee2e2', text: '#991b1b', label: '✗ Rechazada' },
    modificada: { bg: '#dbeafe', text: '#1e40af', label: '✎ Modificada' }
  };
  const c = colors[estado];
  return (
    <span style={{
      padding: '0.5rem 1rem',
      background: c.bg,
      color: c.text,
      borderRadius: '6px',
      fontSize: '0.875rem',
      fontWeight: 500
    }}>
      {c.label}
    </span>
  );
}

export default DemoComponentes;
