# Backend - Configuración de Evaluaciones Académicas

## Endpoint: POST /evaluaciones/procesar

Este documento describe cómo el backend debe procesar las evaluaciones usando el sistema IB configurado.

---

## 🔄 Flujo de Procesamiento

### 1. Recibir Documento
```python
@router.post("/evaluaciones/procesar")
async def procesar_evaluacion(
    documento_id: str,
    asignatura: str,
    nivel_academico: str = "IB",  # IB, AP, Nacional, etc.
    tipo_evaluacion: str = "monografia",  # monografia, ensayo, informe
    rubrica: Optional[dict] = None
):
```

### 2. Extraer Texto
- PDF → OCR/extracción de texto
- DOCX → python-docx
- TXT → Lectura directa

### 3. Preparar Prompt para IA

```python
SYSTEM_PROMPT = """
Eres un evaluador académico experto en el programa [NIVEL_ACADÉMICO].

Tu tarea es evaluar documentos académicos usando el siguiente sistema:

🔴 ROJO - Errores gramaticales: [CORRECCIÓN-ROJO: original → corregido]
🔵 AZUL - Problemas de referencias: [CORRECCIÓN-AZUL: ACCIÓN REQUERIDA]
🟢 VERDE - Mejoras de estilo: [CORRECCIÓN-VERDE: original → mejorado]
🟠 NARANJA - Problemas estructurales: [CORRECCIÓN-NARANJA: DESCRIPCIÓN]

REGLAS:
1. Lee TODO el documento antes de evaluar
2. Compara el índice con el contenido real
3. Identifica secciones faltantes
4. Verifica citas vs bibliografía
5. Al final, genera un RESUMEN DE CORRECCIONES con prioridades

ASIGNATURA: {asignatura}
TIPO: {tipo_evaluacion}
"""
```

### 4. Estructura de Respuesta

```python
{
    "success": True,
    "evaluacion_id": "uuid",
    "documento_id": "uuid",
    "resumen": {
        "titulo": str,
        "asignatura": str,
        "categoria": str,
        "word_count": int | null,
        "estructura_completa": bool,
        "capitulos_faltantes": [str],
        "conclusion_presente": bool,
        "bibliografia_completa": bool
    },
    "correcciones": {
        "rojo": [{"tipo": "gramatica", "original": str, "correccion": str, "contexto": str}],
        "azul": [{"tipo": "referencia", "accion": str, "detalle": str}],
        "verde": [{"tipo": "estilo", "original": str, "sugerencia": str}],
        "naranja": [{"tipo": "estructura", "descripcion": str, "seccion": str}]
    },
    "resumen_profesor": {
        "total_errores_gramaticales": int,
        "total_problemas_referencias": int,
        "total_sugerencias_estilo": int,
        "total_problemas_estructura": int,
        "prioridad_alta": [str],
        "prioridad_media": [str],
        "prioridad_baja": [str]
    },
    "retroalimentacion_general": str,  # Texto completo con formato
    "calificacion_estimada": float | null,  # Opcional
    "texto_evaluado": str  # El texto original con las correcciones insertadas
}
```

---

## 🎨 Formato de Respuesta al Frontend

El backend debe enviar el texto formateado así:

```json
{
    "success": true,
    "evaluacion": {
        "id": "eval-123",
        "calificacion_global": 7.5,
        "semaforo_global": "AMARILLO",
        "texto_formateado": "Título: ...\n\nIntroduction\n[CORRECCIÓN-VERDE: Unlike contemporary practices] nowadays...",
        "segmentos": [
            {
                "id": 1,
                "tipo": "Introducción",
                "calificacion": 7.0,
                "semaforo": "VERDE",
                "retroalimentacion": "...",
                "correcciones": [...]
            }
        ],
        "resumen_profesor": "RESUMEN DE CORRECCIONES..."
    }
}
```

---

## 📊 Rubricas por Asignatura

### English B HL
```python
RUBRICA_ENGLISH_B = {
    "criterios": [
        {"nombre": "Análisis lingüístico", "peso": 0.25},
        {"nombre": "Uso de marco teórico", "peso": 0.25},
        {"nombre": "Estructura académica", "peso": 0.25},
        {"nombre": "Referencias y citas", "peso": 0.25}
    ],
    "word_count_min": 3500,
    "word_count_max": 4000,
    "secciones_requeridas": ["Introduction", "Body", "Conclusion", "Bibliography"]
}
```

### Lengua Castellana
```python
RUBRICA_LENGUA = {
    "criterios": [
        {"nombre": "Análisis textual", "peso": 0.30},
        {"nombre": "Argumentación", "peso": 0.25},
        {"nombre": "Contextualización", "peso": 0.25},
        {"nombre": "Expresión escrita", "peso": 0.20}
    ],
    "estructura": ["Introducción", "Desarrollo", "Conclusión", "Referencias"]
}
```

---

## 🤖 Integración con IA

### Configuración del Modelo

```python
import openai

def evaluar_con_ia(texto: str, asignatura: str, config: dict):
    response = openai.ChatCompletion.create(
        model="deepseek-chat",  # o gpt-4, etc.
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"""
                Asignatura: {asignatura}
                Nivel: {config['nivel']}
                Tipo: {config['tipo']}
                
                Documento a evaluar:
                {texto}
                
                Por favor evalúa este documento usando el sistema de colores especificado.
                Al final incluye el RESUMEN DE CORRECCIONES completo.
            """}
        ],
        temperature=0.3,  # Bajo para consistencia
        max_tokens=4000
    )
    
    return parsear_respuesta_ia(response.choices[0].message.content)
```

### Parseo de Respuesta

```python
def parsear_respuesta_ia(texto_respuesta: str) -> dict:
    """
    Extrae las correcciones del texto formateado por la IA
    """
    import re
    
    correcciones = {
        "rojo": [],
        "azul": [],
        "verde": [],
        "naranja": []
    }
    
    # Patrones regex para cada color
    patrones = {
        "rojo": r'\[CORRECCIÓN-ROJO:\s*([^→]+)\s*→\s*([^\]]+)\]',
        "azul": r'\[CORRECCIÓN-AZUL:\s*([^\]]+)\]',
        "verde": r'\[CORRECCIÓN-VERDE:\s*([^→]+)\s*→\s*([^\]]+)\]',
        "naranja": r'\[CORRECCIÓN-NARANJA:\s*([^\]]+)\]'
    }
    
    for color, patron in patrones.items():
        matches = re.findall(patron, texto_respuesta)
        for match in matches:
            if color in ["rojo", "verde"]:
                correcciones[color].append({
                    "original": match[0].strip(),
                    "correccion": match[1].strip()
                })
            else:
                correcciones[color].append({
                    "descripcion": match.strip() if isinstance(match, str) else match[0].strip()
                })
    
    return correcciones
```

---

## ✅ Checklist de Implementación Backend

- [ ] Endpoint `/evaluaciones/procesar` implementado
- [ ] Extracción de texto de PDF/DOCX/TXT funcionando
- [ ] Prompt del sistema configurado con formato IB
- [ ] Parseo de respuestas de IA implementado
- [ ] Estructura de respuesta JSON definida
- [ ] Rubricas por asignatura configuradas
- [ ] Almacenamiento de evaluaciones en base de datos
- [ ] Rate limiting para evaluaciones (control de costos)

---

## 📞 Notas para el Desarrollador del Backend

1. **Costos**: Las evaluaciones con IA consumen tokens. Implementar límites por usuario.
2. **Caching**: Guardar evaluaciones para no reprocesar documentos idénticos.
3. **Colas**: Usar Redis/Celery para procesar evaluaciones largas asíncronamente.
4. **Feedback**: Permitir que profesores editen las correcciones de la IA.

---

*Configuración creada: Marzo 2025*
*Versión: 1.0*
