# EvaluAI - User Journey del Profesor

## 👤 User Persona: Profesora María

**Datos demográficos:**
- Edad: 42 años
- Profesión: Profesora de Lengua Castellana
- Institución: Colegio público en Bogotá
- Experiencia: 15 años docentes
- Nivel tecnológico: Intermedio (usa email, Google Classroom básico)

**Contexto:**
- Tiene 35 estudiantes
- Debe calificar 35 ensayos semanales
- Tarda ~20 minutos por ensayo (11+ horas totales)
- Quiere dar retroalimentación detallada pero no tiene tiempo

---

## 🛤️ Flujo Principal (Happy Path)

### Fase 1: Acceso y Preparación
```
Entra a EvaluAI → Login → Dashboard
```

**Objetivo:** Acceder rápidamente a la herramienta
- **Tiempo esperado:** < 10 segundos
- **Frustraciones a evitar:** Login complicado, cargas lentas

### Fase 2: Configuración de Evaluación
```
Selecciona Asignatura → Selecciona/Configura Rúbrica → Confirma
```

**Objetivo:** Preparar el tipo de evaluación
- **Tiempo esperado:** 30 segundos
- **Decisiones:** Elegir asignatura, tipo de trabajo, rúbrica

### Fase 3: Carga de Trabajos
```
Sube archivo(s) → Revisa preview → Confirma envío
```

**Objetivo:** Subir los documentos de estudiantes
- **Tiempo esperado:** 1-2 minutos
- **Formatos:** PDF, DOCX, TXT (posiblemente múltiples archivos)

### Fase 4: Revisión de Estimación
```
Ve estimación (palabras/costo) → Decide evaluar → Click "Evaluar"
```

**Objetivo:** Entender el costo antes de proceder
- **Tiempo esperado:** 30 segundos
- **Elementos clave:** Palabras totales, segmentos, costo COP, alerta de saldo

### Fase 5: Procesamiento
```
Espera barra de progreso → Resultado listo
```

**Objetivo:** Espera tolerable con feedback visual
- **Tiempo esperado:** 10-30 segundos
- **Feedback:** Barra de progreso, mensajes informativos

### Fase 6: Revisión de Resultados
```
Ve calificación global → Explora segmentos → Lee retroalimentación → Exporta
```

**Objetivo:** Entender el resultado y usarlo para calificar
- **Tiempo esperado:** 3-5 minutos por trabajo
- **Acciones:** Ver semáforos, leer feedback por sección, exportar PDF

---

## 📊 Mapa de Emociones

| Paso | Emoción | Nivel | Solución si negativo |
|------|---------|-------|---------------------|
| Login | 😐 Neutral | 5/10 | Recordar credenciales, login social |
| Selección | 🙂 Interesado | 7/10 | UI clara, iconos intuitivos |
| Carga | 🤔 Concentrado | 6/10 | Drag & drop, validación clara |
| Estimación | 😰 Ansioso | 4/10 | Mostrar saldo disponible, costo claro |
| Procesando | ⏳ Esperando | 5/10 | Barra de progreso, estimación de tiempo |
| Resultados | 🤩 Satisfecho | 8/10 | Información organizada, acciones claras |
| Exportar | 😊 Productivo | 9/10 | Múltiples formatos, copiar al portapapeles |

---

## 🔄 Flujos Secundarios

### Flujo A: Sin saldo suficiente
```
Estimación muestra alerta → Click "Comprar bloque extra" → Checkout PayU → Vuelve a evaluación
```

### Flujo B: Rúbrica personalizada
```
Click "Nueva rúbrica" → Agrega criterios → Define pesos → Guarda → Usa en evaluación
```

### Flujo C: Evaluación masiva (batch)
```
Selecciona múltiples archivos → Estimación agregada → Evalúa todos → Recibe reporte consolidado
```

### Flujo D: Revisión histórica
```
Dashboard → Historial → Filtra por fecha/asignatura → Ve evaluación anterior
```

---

## 🎯 Pain Points a Resolver

1. **Sobrecarga de trabajo:** Reducir tiempo de calificación de 20 min a 5 min por trabajo
2. **Falta de retroalimentación detallada:** Proveer feedback específico por segmento
3. **Incertidumbre de costos:** Mostrar estimación clara antes de evaluar
4. **Complejidad técnica:** Interfaz simple, sin tecnicismos de IA

---

## ✅ Éxito del Usuario

María entra a EvaluAI, sube 5 ensayos de sus estudiantes, en 15 minutos tiene:
- Calificaciones sugeridas con justificación
- Feedback específico por párrafo para cada estudiante
- Reporte PDF para entregar a estudiantes
- Reducción de 1.5 horas a 15 minutos de trabajo
