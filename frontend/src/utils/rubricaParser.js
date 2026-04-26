/**
 * Parser de Markdown para Rúbricas
 * Extrae información estructurada desde archivos Markdown de rúbricas
 */

export const DEFAULT_EVALUATION_METHODOLOGY = 'general_document';

export const EVALUATION_METHODOLOGY_OPTIONS = [
  { value: 'general_document', label: 'General del documento' },
  { value: 'by_paragraph', label: 'Por parrafos' },
  { value: 'line_by_line', label: 'Linea por linea' },
  { value: 'phrase_by_phrase', label: 'Frase por frase' },
  { value: 'custom', label: 'Personalizada' },
];

const EVALUATION_METHODOLOGY_VALUES = new Set(
  EVALUATION_METHODOLOGY_OPTIONS.map((option) => option.value)
);

export function normalizeEvaluationMethodology(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (EVALUATION_METHODOLOGY_VALUES.has(normalized)) {
    return normalized;
  }

  const legacyAliases = {
    general: 'general_document',
    general_del_documento: 'general_document',
    por_parrafos: 'by_paragraph',
    por_párrafos: 'by_paragraph',
    parrafos: 'by_paragraph',
    párrafos: 'by_paragraph',
    linea_por_linea: 'line_by_line',
    línea_por_línea: 'line_by_line',
    linea_por_línea: 'line_by_line',
    línea_por_linea: 'line_by_line',
    frase_por_frase: 'phrase_by_phrase',
    personalizada: 'custom',
  };

  return legacyAliases[normalized] || DEFAULT_EVALUATION_METHODOLOGY;
}

export function getEvaluationMethodologyLabel(value) {
  return (
    EVALUATION_METHODOLOGY_OPTIONS.find((option) => option.value === normalizeEvaluationMethodology(value))?.label
    || EVALUATION_METHODOLOGY_OPTIONS[0].label
  );
}

/**
 * Extrae el frontmatter YAML del markdown
 */
function extractFrontmatter(markdown) {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = markdown.match(frontmatterRegex);
  
  if (!match) return { frontmatter: {}, content: markdown };
  
  const yamlContent = match[1];
  const content = markdown.slice(match[0].length);
  
  // Parseo simple de YAML
  const frontmatter = {};
  yamlContent.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
      frontmatter[key] = value;
    }
  });
  
  return { frontmatter, content };
}

function buildFrontmatter(frontmatter) {
  const lines = Object.entries(frontmatter)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => {
      const stringValue = String(value).replace(/"/g, '\\"');
      return `${key}: "${stringValue}"`;
    });

  return lines.length ? `---\n${lines.join('\n')}\n---\n\n` : '';
}

export function extractEvaluationConfigFromMarkdown(markdown = '') {
  const { frontmatter } = extractFrontmatter(markdown);
  const metodologiaEvaluacion = normalizeEvaluationMethodology(frontmatter.metodologia_evaluacion);
  const instruccionIA = String(frontmatter.instruccion_ia || '').trim();

  return {
    metodologiaEvaluacion,
    instruccionIA: metodologiaEvaluacion === 'custom' ? instruccionIA : '',
  };
}

export function applyEvaluationConfigToMarkdown(markdown = '', config = {}) {
  const { frontmatter, content } = extractFrontmatter(markdown);
  const metodologiaEvaluacion = normalizeEvaluationMethodology(config.metodologiaEvaluacion);
  const instruccionIA = String(config.instruccionIA || '').trim();

  const nextFrontmatter = {
    ...frontmatter,
    metodologia_evaluacion: metodologiaEvaluacion,
  };

  if (metodologiaEvaluacion === 'custom' && instruccionIA) {
    nextFrontmatter.instruccion_ia = instruccionIA;
  } else {
    delete nextFrontmatter.instruccion_ia;
  }

  return `${buildFrontmatter(nextFrontmatter)}${content.trimStart()}`;
}

/**
 * Extrae el título de la rúbrica
 */
function extractTitle(content) {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  return titleMatch ? titleMatch[1] : 'Rúbrica sin título';
}

/**
 * Extrae la información general
 */
function extractInfoGeneral(content) {
  const infoSection = content.match(/##\s+Información General\s*\n([\s\S]*?)(?=\n##|$)/);
  if (!infoSection) return {};
  
  const info = {};
  const lines = infoSection[1].split('\n');
  
  lines.forEach(line => {
    const match = line.match(/^-\s+\*\*(.+?)\*\*:\s*(.+)$/);
    if (match) {
      info[match[1].toLowerCase().replace(/\s+/g, '_')] = match[2];
    }
  });
  
  return info;
}

/**
 * Extrae los criterios de evaluación
 */
function extractCriterios(content) {
  const criteriosSection = content.match(/##\s+Criterios[\s\S]*?(?=\n##|$)/);
  if (!criteriosSection) return [];
  
  const criterios = [];
  // Si hay tabla markdown
  const tableMatch = criteriosSection[0].match(/\|([^|]+)\|([^|]+)\|([^|]+)\|/g);
  if (tableMatch && tableMatch.length > 2) {
    // Saltar header y separador
    for (let i = 2; i < tableMatch.length; i++) {
      const cells = tableMatch[i].split('|').map(c => c.trim()).filter(c => c);
      if (cells.length >= 2) {
        criterios.push({
          nombre: cells[0],
          peso: parseInt(cells[1]) || 0,
          descripcion: cells[2] || ''
        });
      }
    }
  }
  
  // Busca criterios en formato de lista con peso
  const criterioRegex = /###?\s+(.+?)\s*\n[-*]\s*\*?Peso\*?[:\s]+(\d+)%?/gi;
  let match;
  while ((match = criterioRegex.exec(criteriosSection[0])) !== null) {
    criterios.push({
      nombre: match[1].trim(),
      peso: parseInt(match[2]),
      descripcion: ''
    });
  }
  
  return criterios;
}

/**
 * Extrae los niveles/descriptores
 */
function extractNiveles(content) {
  const niveles = [];
  
  // Busca patrones como "### Nivel X: min-max" o "### X-Y puntos"
  const nivelRegex = /###\s+(?:Nivel\s+)?(\d+)[:\s]+(\d+)\s*-\s*(\d+)\s+(?:puntos?)?\s*\n+\*\*(.+?)\*\*\s*\n+([\s\S]*?)(?=###|\n##|$)/gi;
  
  let match;
  while ((match = nivelRegex.exec(content)) !== null) {
    niveles.push({
      numero: parseInt(match[1]),
      min: parseInt(match[2]),
      max: parseInt(match[3]),
      label: match[4].trim(),
      descripcion: match[5].trim(),
      bullets: match[5].trim().split('\n').filter(l => l.trim().startsWith('-')).map(l => l.trim().slice(1).trim())
    });
  }
  
  return niveles;
}

/**
 * Extrae la configuración del semáforo
 */
function extractSemaforoConfig(content) {
  const semaforoSection = content.match(/##?\s+Configuración del Semaforo\s*\n([\s\S]*?)(?=\n##|$)/);
  if (!semaforoSection) return null;
  
  const config = {
    niveles: {}
  };
  
  // Busca bloques de código YAML
  const yamlMatch = semaforoSection[1].match(/```ya?ml\s*\n([\s\S]*?)```/);
  if (yamlMatch) {
    const yaml = yamlMatch[1];
    // Parseo simple de YAML
    let currentLevel = null;
    yaml.split('\n').forEach(line => {
      const levelMatch = line.match(/^(\w+):\s*$/);
      if (levelMatch && ['verde', 'amarillo', 'naranja', 'rojo'].includes(levelMatch[1])) {
        currentLevel = levelMatch[1];
        config.niveles[currentLevel] = {};
      }
      
      if (currentLevel) {
        const propMatch = line.match(/^\s+(\w+):\s*(.+)$/);
        if (propMatch) {
          let value = propMatch[2].trim();
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          }
          if (!isNaN(value)) value = Number(value);
          if (value === 'true') value = true;
          if (value === 'false') value = false;
          config.niveles[currentLevel][propMatch[1]] = value;
        }
      }
    });
  }
  
  return config;
}

/**
 * Parsea un archivo markdown completo de rúbrica
 */
export function parseRubricaMarkdown(markdown) {
  const { frontmatter, content } = extractFrontmatter(markdown);
  const metodologiaEvaluacion = normalizeEvaluationMethodology(frontmatter.metodologia_evaluacion);
  const instruccionIA = metodologiaEvaluacion === 'custom'
    ? String(frontmatter.instruccion_ia || '').trim()
    : '';
  
  return {
    // Metadatos
    id: frontmatter.id || `rubrica-${Date.now()}`,
    nombreArchivo: frontmatter.nombre_archivo || 'rubrica.md',
    fechaCreacion: frontmatter.fecha_creacion || new Date().toISOString(),
    fechaModificacion: frontmatter.fecha_modificacion || new Date().toISOString(),
    usadaVeces: parseInt(frontmatter.usada_veces) || 0,
    
    // Contenido extraído
    titulo: extractTitle(content),
    infoGeneral: {
      asignatura: frontmatter.asignatura || 'General',
      nivel: frontmatter.nivel || 'General',
      tipoTrabajo: frontmatter.tipo_trabajo || 'Ensayo',
      puntuacionMaxima: parseInt(frontmatter.puntuacion_maxima) || 10,
      ...extractInfoGeneral(content)
    },
    
    // Estructura de evaluación
    criterios: extractCriterios(content),
    niveles: extractNiveles(content),
    semaforoConfig: extractSemaforoConfig(content),
    metodologiaEvaluacion,
    instruccionIA,
    metodologiaEvaluacionLabel: getEvaluationMethodologyLabel(metodologiaEvaluacion),
    
    // Contenido original
    markdownOriginal: markdown,
    contenido: content
  };
}

/**
 * Genera un archivo markdown de rúbrica desde datos estructurados
 */
export function generateRubricaMarkdown(datos) {
  const {
    titulo = 'Nueva Rúbrica',
    asignatura = 'General',
    nivel = 'Secundaria',
    tipoTrabajo = 'Ensayo',
    puntuacionMaxima = 10,
    criterios = [],
    niveles: nivelesData = [],
    semaforo = {}
  } = datos;
  
  return `---
id: "rubrica-${Date.now()}"
nombre: "${titulo}"
asignatura: "${asignatura}"
nivel: "${nivel}"
tipo_trabajo: "${tipoTrabajo}"
puntuacion_maxima: ${puntuacionMaxima}
fecha_creacion: "${new Date().toISOString()}"
fecha_modificacion: "${new Date().toISOString()}"
usada_veces: 0
estado: "activa"
metodologia_evaluacion: "${DEFAULT_EVALUATION_METHODOLOGY}"
---

# ${titulo}

## Información General
- **Asignatura**: ${asignatura}
- **Nivel**: ${nivel}
- **Tipo de trabajo**: ${tipoTrabajo}
- **Puntuación máxima**: ${puntuacionMaxima}

---

## Criterios de Evaluación

| Criterio | Peso | Descripción |
|----------|------|-------------|
${criterios.map(c => `| ${c.nombre} | ${c.peso}% | ${c.descripcion || ''} |`).join('\n')}

---

## Niveles de Desempeño

${nivelesData.map(n => `### Nivel ${n.numero}: ${n.min}-${n.max} puntos
**${n.label}**

${n.bullets ? n.bullets.map(b => `- ${b}`).join('\n') : n.descripcion}
`).join('\n---\n\n')}

---

## Configuración del Semaforo

${semaforo ? '```yaml\n' + Object.entries(semaforo).map(([key, val]) => `${key}:\n  min: ${val.min}\n  max: ${val.max}\n  color: "${val.color}"\n  label: "${val.label}"`).join('\n') + '\n```' : ''}

---

## Instrucciones para la IA

Al evaluar según esta rúbrica:

1. Identificar el nivel del estudiante comparando con los descriptores
2. Asignar puntuación dentro del rango del nivel identificado
3. Justificar cada decisión con referencia específica a los descriptores
4. Usar el formato [¹], [²], etc. para marcar correcciones en notas al pie
5. Colores:
   - 🔴 ROJO: Errores críticos
   - 🟡 AMARILLO: Aspectos a mejorar
   - 🟢 VERDE: Fortalezas
   - 🔵 AZUL: Sugerencias de vocabulario

---

## Notas del Profesor

<!-- Espacio para agregar comentarios personales -->
`;
}

/**
 * Calcula la calificación de un párrafo según la rúbrica
 */
export function calcularCalificacionParrafo(notaPie, rubrica) {
  if (!rubrica.criterios || rubrica.criterios.length === 0) {
    return { nota: 0, semaforo: 'GRIS' };
  }
  
  // Inicializar calificación por criterio
  const calificaciones = {};
  rubrica.criterios.forEach(c => {
    calificaciones[c.nombre] = {
      peso: c.peso,
      nota: 10, // Empieza en 10 y descuenta
      penalizacion: 0
    };
  });
  
  // Aplicar penalizaciones según notas al pie
  notaPie.forEach(nota => {
    const criterio = nota.criterio || 'General';
    
    if (!calificaciones[criterio]) {
      calificaciones[criterio] = { peso: 100 / rubrica.criterios.length, nota: 10, penalizacion: 0 };
    }
    
    if (nota.estado === 'aceptada' || nota.estado === 'pendiente') {
      switch (nota.tipo) {
        case 'ROJO':
          calificaciones[criterio].penalizacion += 3;
          break;
        case 'AMARILLO':
        case 'NARANJA':
          calificaciones[criterio].penalizacion += 1.5;
          break;
        case 'VERDE':
          calificaciones[criterio].penalizacion += 0.5;
          break;
        default:
          calificaciones[criterio].penalizacion += 0.5;
      }
    }
  });
  
  // Calcular nota por criterio
  let notaPonderada = 0;
  let pesoTotal = 0;
  
  Object.values(calificaciones).forEach(c => {
    c.nota = Math.max(0, 10 - c.penalizacion);
    notaPonderada += c.nota * (c.peso / 100);
    pesoTotal += c.peso;
  });
  
  // Normalizar si los pesos no suman 100
  const notaFinal = pesoTotal > 0 ? (notaPonderada / (pesoTotal / 100)) : 0;
  
  // Determinar semáforo
  let semaforo = 'GRIS';
  if (rubrica.semaforoConfig && rubrica.semaforoConfig.niveles) {
    const niveles = rubrica.semaforoConfig.niveles;
    
    if (niveles.verde && notaFinal >= niveles.verde.min) {
      semaforo = 'VERDE';
    } else if (niveles.amarillo && notaFinal >= niveles.amarillo.min) {
      semaforo = 'AMARILLO';
    } else if (niveles.naranja && notaFinal >= niveles.naranja.min) {
      semaforo = 'NARANJA';
    } else if (niveles.rojo) {
      semaforo = 'ROJO';
    }
  } else {
    // Configuración por defecto
    if (notaFinal >= 7) semaforo = 'VERDE';
    else if (notaFinal >= 5) semaforo = 'AMARILLO';
    else semaforo = 'ROJO';
  }
  
  return {
    nota: Math.round(notaFinal * 10) / 10,
    semaforo,
    detalleCriterios: calificaciones
  };
}

const rubricaParser = {
  parseRubricaMarkdown,
  generateRubricaMarkdown,
  calcularCalificacionParrafo
};

export default rubricaParser;
