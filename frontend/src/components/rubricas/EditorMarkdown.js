import React, { useState, useEffect, useCallback } from 'react';
import {
  applyEvaluationConfigToMarkdown,
  DEFAULT_EVALUATION_METHODOLOGY,
  EVALUATION_METHODOLOGY_OPTIONS,
  extractEvaluationConfigFromMarkdown,
  parseRubricaMarkdown,
} from '../../utils/rubricaParser';
import './rubricas.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * Editor de Markdown para rúbricas.
 * Estado inicial limpio al crear rúbrica nueva.
 * Incluye campo de "Criterios en Bruto" + botón "Generar Matriz" con IA.
 */
function EditorMarkdown({
  rubrica,
  onGuardar,
  onCancelar,
  onPreview
}) {
  const [contenido, setContenido] = useState('');
  const [preview, setPreview] = useState(null);
  const [vista, setVista] = useState('split');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [ultimoGuardado, setUltimoGuardado] = useState(null);

  const [nombreFijo, setNombreFijo] = useState('');
  const [asignaturaFija, setAsignaturaFija] = useState('');
  const [cursoFijo, setCursoFijo] = useState('');
  const [añoFijo, setAñoFijo] = useState(new Date().getFullYear().toString());
  const [metodologiaEvaluacion, setMetodologiaEvaluacion] = useState(DEFAULT_EVALUATION_METHODOLOGY);
  const [instruccionIA, setInstruccionIA] = useState('');

  // "Criterios en Bruto" — texto libre que la IA organizará
  const [criteriosEnBruto, setCriteriosEnBruto] = useState('');
  const [generandoMatriz, setGenerandoMatriz] = useState(false);
  const [errorIA, setErrorIA] = useState(null);

  // Inicializar contenido
  useEffect(() => {
    const markdownFuente = rubrica?.markdownOriginal || rubrica?.markdown || '';

    if (markdownFuente) {
      const config = extractEvaluationConfigFromMarkdown(markdownFuente);
      setContenido(markdownFuente);
      setNombreFijo(rubrica.nombre || '');
      setAsignaturaFija(rubrica.asignatura || '');
      setMetodologiaEvaluacion(config.metodologiaEvaluacion);
      setInstruccionIA(config.instruccionIA);
    } else {
      // Estado inicial limpio para nueva rúbrica
      setContenido('');
      setNombreFijo('');
      setAsignaturaFija('');
      setMetodologiaEvaluacion(DEFAULT_EVALUATION_METHODOLOGY);
      setInstruccionIA('');
    }
  }, [rubrica]);

  // Actualizar preview cuando cambia el contenido
  useEffect(() => {
    try {
      const parsed = parseRubricaMarkdown(contenido);
      setPreview(parsed);
      setError(null);

      // Sincronizar inputs visuales
      const nMatch = contenido.match(/nombre:\s*"(.*?)"/);
      if (nMatch) setNombreFijo(nMatch[1]);

      const aMatch = contenido.match(/asignatura:\s*"(.*?)"/);
      if (aMatch) setAsignaturaFija(aMatch[1]);

    } catch (err) {
      setError('Error al parsear el Markdown: ' + err.message);
    }
  }, [contenido]);

  // Manejar cambios en el editor manual
  const handleChange = useCallback((e) => {
    setContenido(e.target.value);
  }, []);

  // Manejar cambios desde los inputs rápidos
  const handleInputRapido = (campo, valor) => {
    if (campo === 'nombre') {
      setNombreFijo(valor);
      if (contenido.includes('nombre:')) {
        setContenido(prev => prev.replace(/nombre:\s*".*?"/, `nombre: "${valor}"`));
      }
    } else if (campo === 'asignatura') {
      setAsignaturaFija(valor);
      if (contenido.includes('asignatura:')) {
        setContenido(prev => prev.replace(/asignatura:\s*".*?"/, `asignatura: "${valor}"`));
      }
    }
  };

  // Generar matriz con IA a partir de criterios en bruto
  const handleGenerarMatriz = async () => {
    if (!criteriosEnBruto.trim()) {
      setErrorIA('Escribe algunos criterios en bruto antes de generar.');
      return;
    }
    setGenerandoMatriz(true);
    setErrorIA(null);

    const nombreRubrica = nombreFijo || 'Nueva Rúbrica';
    const asignatura = asignaturaFija || 'General';
    const curso = cursoFijo || '';
    const año = añoFijo || new Date().getFullYear();

    const prompt = `Actúa como experto en pedagogía y diseño curricular.
Tengo los siguientes criterios/ideas en bruto para una rúbrica de evaluación:

"${criteriosEnBruto}"

Convierte estos criterios en una rúbrica estructurada en Markdown usando EXACTAMENTE este formato:

---
id: "rubrica-${Date.now()}"
nombre: "${nombreRubrica}"
asignatura: "${asignatura}"
nivel: "${curso}"
fecha_creacion: "${new Date().toISOString()}"
metodologia_evaluacion: "${metodologiaEvaluacion}"
---

# ${nombreRubrica}

## Información General
- **Asignatura**: ${asignatura}
- **Nivel**: ${curso}
- **Año**: ${año}
- **Tipo de trabajo**: (inferir del contexto)
- **Puntuación máxima**: 100

---

## Criterios de Evaluación

| Criterio | Peso | Descripción |
|----------|------|-------------|
(completa con los criterios, distribuyendo el 100% entre ellos)

---

## Niveles de Desempeño

### Nivel 4: Excelente (90-100 pts)
- (descripción)

### Nivel 3: Bueno (70-89 pts)
- (descripción)

### Nivel 2: Regular (50-69 pts)
- (descripción)

### Nivel 1: Deficiente (0-49 pts)
- (descripción)

---

## Instrucciones para la IA

Al evaluar según esta rúbrica:
1. Identificar el nivel del estudiante para cada criterio
2. Asignar puntuación ponderada
3. Justificar cada decisión con citas del texto
4. Usar notas al pie para correcciones específicas

Metodología obligatoria:
- Modalidad: ${EVALUATION_METHODOLOGY_OPTIONS.find((option) => option.value === metodologiaEvaluacion)?.label || 'General del documento'}
${metodologiaEvaluacion === 'custom' && instruccionIA.trim() ? `- Instrucción personalizada: ${instruccionIA.trim()}` : ''}

Responde SOLO con el Markdown de la rúbrica, sin explicaciones adicionales.`;

    try {
      const token = localStorage.getItem('token') || '';
      const resp = await fetch(`${API_BASE}/api/evaluate/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mensaje: prompt, contexto: {}, historial: [] }),
      });

      if (!resp.ok) throw new Error('Error en el servidor');
      const data = await resp.json();

      if (data.success && data.respuesta) {
        // Limpiar posibles bloques de código Markdown
        let markdownGenerado = data.respuesta.trim();
        if (markdownGenerado.startsWith('```')) {
          markdownGenerado = markdownGenerado.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
        }
        setContenido(applyEvaluationConfigToMarkdown(markdownGenerado, { metodologiaEvaluacion, instruccionIA }));
        setVista('split');
      } else {
        setErrorIA('La IA no pudo generar la rúbrica. Intenta con más detalle.');
      }
    } catch (err) {
      setErrorIA('Error al contactar el servidor: ' + err.message);
    } finally {
      setGenerandoMatriz(false);
    }
  };

  // Guardar cambios
  const handleGuardar = async () => {
    setGuardando(true);
    try {
      const markdownConConfiguracion = applyEvaluationConfigToMarkdown(contenido, {
        metodologiaEvaluacion,
        instruccionIA,
      });

      await onGuardar({
        ...rubrica,
        nombre: nombreFijo,
        asignatura: asignaturaFija,
        curso: cursoFijo,
        año: añoFijo,
        metodologiaEvaluacion,
        instruccionIA: metodologiaEvaluacion === 'custom' ? instruccionIA.trim() : '',
        markdown: markdownConConfiguracion,
        markdownOriginal: markdownConConfiguracion,
        ...preview
      });
      setUltimoGuardado(new Date());
    } catch (err) {
      setError('Error al guardar: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  // Renderizar preview simple
  const renderPreview = () => {
    if (!preview) return <div className="preview-error">Error en el formato</div>;

    return (
      <div className="markdown-preview">
        <h1>{preview.titulo}</h1>

        <div className="preview-info">
          <p><strong>Asignatura:</strong> {preview.infoGeneral?.asignatura}</p>
          <p><strong>Nivel:</strong> {preview.infoGeneral?.nivel}</p>
          <p><strong>Puntuación máxima:</strong> {preview.infoGeneral?.puntuacionMaxima}</p>
        </div>

        {preview.criterios && preview.criterios.length > 0 && (
          <>
            <h3>Criterios</h3>
            <ul>
              {preview.criterios.map((c, i) => (
                <li key={i}>
                  <strong>{c.nombre}</strong> ({c.peso}%)
                  {c.descripcion && <p>{c.descripcion}</p>}
                </li>
              ))}
            </ul>
          </>
        )}

        {preview.niveles && preview.niveles.length > 0 && (
          <>
            <h3>Niveles</h3>
            {preview.niveles.map((n, i) => (
              <div key={i} className="preview-nivel">
                <h4>{n.min}-{n.max} pts: {n.label}</h4>
                {n.bullets && (
                  <ul>
                    {n.bullets.map((b, j) => <li key={j}>{b}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="editor-markdown-container">
      {/* Header */}
      <div className="editor-markdown-header">
        <div className="header-titulo">
          <h2>✏️ Editor de Rúbrica</h2>
          {rubrica && <span className="nombre-archivo">{rubrica.nombreArchivo}</span>}
        </div>
        <div className="header-acciones">
          <div className="vista-selector">
            <button
              className={vista === 'editor' ? 'activo' : ''}
              onClick={() => setVista('editor')}
            >
              Editor
            </button>
            <button
              className={vista === 'split' ? 'activo' : ''}
              onClick={() => setVista('split')}
            >
              Split
            </button>
            <button
              className={vista === 'preview' ? 'activo' : ''}
              onClick={() => setVista('preview')}
            >
              Preview
            </button>
          </div>
          <button
            className="btn-guardar"
            onClick={handleGuardar}
            disabled={guardando || error}
          >
            {guardando ? 'Guardando...' : '💾 Guardar'}
          </button>
          <button className="btn-cancelar" onClick={onCancelar}>
            ✖
          </button>
        </div>
      </div>

      {/* Toolbar — 4 campos estructurados */}
      <div className="editor-markdown-toolbar" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>

        {/* Fila 1: Nombre + Asignatura */}
        <div style={{ display: 'flex', gap: '16px', width: '100%', marginBottom: '10px' }}>
          <div style={{ flex: 2 }}>
            <label style={lblStyle}>Nombre de la Rúbrica</label>
            <input
              type="text"
              value={nombreFijo}
              onChange={(e) => handleInputRapido('nombre', e.target.value)}
              placeholder="Ej. Rúbrica de Ensayo — Teoría del Conocimiento"
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 2 }}>
            <label style={lblStyle}>Asignatura</label>
            <input
              type="text"
              value={asignaturaFija}
              onChange={(e) => handleInputRapido('asignatura', e.target.value)}
              placeholder="Ej. Filosofía / Biología"
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lblStyle}>Curso / Grado</label>
            <input
              type="text"
              value={cursoFijo}
              onChange={(e) => setCursoFijo(e.target.value)}
              placeholder="Ej. 11°"
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lblStyle}>Año</label>
            <input
              type="text"
              value={añoFijo}
              onChange={(e) => setAñoFijo(e.target.value)}
              placeholder={new Date().getFullYear().toString()}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', width: '100%', marginBottom: '10px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <label style={lblStyle}>Metodologia de evaluacion</label>
            <select
              value={metodologiaEvaluacion}
              onChange={(e) => setMetodologiaEvaluacion(e.target.value)}
              style={inputStyle}
            >
              {EVALUATION_METHODOLOGY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          {metodologiaEvaluacion === 'custom' && (
            <div style={{ flex: 2 }}>
              <label style={lblStyle}>Instruccion personalizada para la IA</label>
              <textarea
                value={instruccionIA}
                onChange={(e) => setInstruccionIA(e.target.value)}
                placeholder='Ej. Evalua con foco en argumentacion filosofica y rigor conceptual.'
                style={{ ...inputStyle, minHeight: '64px', resize: 'vertical', lineHeight: '1.5' }}
                rows={3}
              />
            </div>
          )}
        </div>

        {/* Fila 2: Criterios en Bruto + Botón Generar */}
        <div style={{ width: '100%', marginBottom: '10px' }}>
          <label style={lblStyle}>
            Criterios en Bruto — pega aquí tus ideas, listas, o criterios en desorden
          </label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <textarea
              value={criteriosEnBruto}
              onChange={(e) => setCriteriosEnBruto(e.target.value)}
              placeholder="Ej: Coherencia argumentativa, ortografía, uso de fuentes, estructura del ensayo, conclusión sólida, 10 pts cada criterio..."
              style={{ ...inputStyle, flex: 1, resize: 'vertical', minHeight: '64px', lineHeight: '1.5' }}
              rows={3}
            />
            <button
              onClick={handleGenerarMatriz}
              disabled={generandoMatriz || !criteriosEnBruto.trim()}
              style={{
                padding: '10px 16px',
                background: generandoMatriz ? 'rgba(79,70,229,0.4)' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: generandoMatriz || !criteriosEnBruto.trim() ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '700',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                minWidth: '140px',
              }}
              title="La IA convertirá tus criterios en una rúbrica estructurada y editable"
            >
              {generandoMatriz ? '⏳ Generando...' : '🤖 Generar Matriz'}
            </button>
          </div>
          {errorIA && (
            <div style={{ marginTop: '6px', fontSize: '12px', color: '#ef4444' }}>⚠️ {errorIA}</div>
          )}
        </div>

        {/* Fila 3: Info + ayuda */}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <span className="toolbar-info">
            {contenido.length > 0 ? `${contenido.length} caracteres` : 'Editor vacío — pega Markdown o usa "Generar Matriz"'}
            {ultimoGuardado && ` | Guardado: ${ultimoGuardado.toLocaleTimeString()}`}
          </span>
          <a
            href="https://www.markdownguide.org/basic-syntax/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ayuda"
          >
            ❓ Ayuda Markdown
          </a>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="editor-error">
          ⚠️ {error}
        </div>
      )}

      {/* Contenido */}
      <div className={`editor-markdown-content vista-${vista}`}>
        {/* Editor */}
        {(vista === 'editor' || vista === 'split') && (
          <div className="editor-pane">
            <textarea
              value={contenido}
              onChange={handleChange}
              placeholder="Escribe tu rúbrica en formato Markdown..."
              spellCheck={false}
            />
          </div>
        )}

        {/* Preview */}
        {(vista === 'preview' || vista === 'split') && (
          <div className="preview-pane">
            <div className="preview-header">
              <span>Vista Previa</span>
            </div>
            {renderPreview()}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="editor-markdown-footer">
        <div className="footer-tips">
          <span>💡 Tips:</span>
          <code># Título</code> para el título,
          <code>## Subtítulo</code> para secciones,
          <code>| Tabla |</code> para criterios
        </div>
      </div>
    </div>
  );
}

// Estilos locales del toolbar estructurado
const lblStyle = {
  display: 'block',
  fontSize: '11px',
  fontWeight: '700',
  color: '#475569',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  fontSize: '13px',
  color: '#0f172a',
  background: '#fff',
  boxSizing: 'border-box',
};

export default EditorMarkdown;
