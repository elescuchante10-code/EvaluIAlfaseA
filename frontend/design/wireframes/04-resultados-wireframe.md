# Wireframe: Pantalla de Resultados

## Vista Desktop: Resultado Exitoso

```
+-----------------------------------------------------------------------------+
|  [LOGO] EvaluAI              Dashboard  Evaluar  Historial  [Perfil ▼]      |
+-----------------------------------------------------------------------------+
|                                                                             |
|  <- Volver a evaluaciones                                                   |
|                                                                             |
|  ✓ ¡Evaluacion completada!                                                  |
|                                                                             |
|  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++   |
|  +                                                                     +   |
|  +                    🟢                                                +   |
|  +                                                                     +   |
|  +                  8.5/10                                             +   |
|  +                                                                     +   |
|  +         EXCELENTE TRABAJO                                           +   |
|  +                                                                     +   |
|  +   El estudiante demostro un dominio sobresaliente de la materia.     +   |
|  +                                                                     +   |
|  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++   |
|                                                                             |
|  [Resumen]  [Detalle por segmento]  [Retroalimentacion]  [Exportar]        |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

## TAB: Resumen

```
+-----------------------------------------------------------------------------+
|                                                                             |
|  Calificacion por criterio                                                  |
|                                                                             |
|  Tesis               ████████████████████░░░░░  85%  [8.5]                  |
|  Coherencia          ██████████████████████░░░  90%  [9.0]                  |
|  Cohesion            ██████████████░░░░░░░░░░░  70%  [7.0]  <- Destacar    |
|  Analisis            █████████████████████████░  95%  [9.5]                  |
|  Ortografia          █████████████████░░░░░░░░  80%  [8.0]                  |
|                                                                             |
|  -------------------------------------------------------------------------  |
|                                                                             |
|  ✓ Fortalezas                                                              |
|                                                                             |
|  ✅ Excelente tesis argumentativa, clara y bien fundamentada               |
|  ✅ Uso adecuado de conectores logicos                                     |
|  ✅ Analisis literario profundo y original                                 |
|                                                                             |
|  -------------------------------------------------------------------------  |
|                                                                             |
|  📌 Areas de mejora                                                        |
|                                                                             |
|  • Mejorar la cohesion entre parrafos 2 y 3                                |
|  • Evitar repeticiones lexicas en la conclusion                            |
|  • Ampliar la bibliografia con fuentes mas recientes                       |
|                                                                             |
|  -------------------------------------------------------------------------  |
|                                                                             |
|  📝 Recomendacion general                                                  |
|                                                                             |
|  El estudiante muestra un excellente dominio de la asignatura. Para        |
|  alcanzar la excelencia total, recomiendo trabajar en la transicion        |
|  entre ideas y diversificar el vocabulario utilizado.                      |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

## TAB: Detalle por Segmento

```
+-----------------------------------------------------------------------------+
|                                                                             |
|  Detalle de evaluacion por segmentos                                        |
|                                                                             |
|  +-------------+--------+-------+----------------------------------------+ |
|  | Segmento    | Tipo   | Nota  | Accion                                 | |
|  +-------------+--------+-------+----------------------------------------+ |
|  | Introduccion| Parrafo| 9.0 🟢 | [Ver detalle]                         | |
|  +-------------+--------+-------+----------------------------------------+ |
|  | Desarrollo 1| Parrafo| 7.5 🟡 | [Ver detalle]  <- Expandido           | |
|  |             |        |       |                                        | |
|  |  [TEXTO DEL PARRAFO...]                                                | |
|  |                                                                        | |
|  |  Puntuacion: 7.5/10                                                    | |
|  |                                                                        | |
|  |  Observaciones:                                                        | |
|  |  - Buena idea central pero falta conexion con el parrafo anterior      | |
|  |  - Usar conector causal para mejorar flujo                             | |
|  |                                                                        | |
|  |  Sugerencia: "Ademas, el autor utiliza..." -> "Por tanto, el autor..." | |
|  +-------------+--------+-------+----------------------------------------+ |
|  | Desarrollo 2| Parrafo| 8.0 🟢 | [Ver detalle]                         | |
|  +-------------+--------+-------+----------------------------------------+ |
|  | Conclusion  | Parrafo| 9.5 🟢 | [Ver detalle]                         | |
|  +-------------+--------+-------+----------------------------------------+ |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

## Sistema de Semaforos (Colores)

```
VERDE (8-10):
+------------------+
| 🟢               |
|                  |
|       8.5        |
|       /10        |
|                  |
|   Excelente      |
+------------------+
Background: #DCFCE7
Text: #166534
Border: #22C55E

AMARILLO (6-7.9):
+------------------+
| 🟡               |
|                  |
|       7.2        |
|       /10        |
|                  |
|   Aceptable      |
+------------------+
Background: #FEF9C3
Text: #A16207
Border: #EAB308

ROJO (<6):
+------------------+
| 🔴               |
|                  |
|       4.5        |
|       /10        |
|                  |
|   Necesita       |
|   mejorar        |
+------------------+
Background: #FEE2E2
Text: #991B1B
Border: #EF4444
```

---

## Acciones Finales

```
+-----------------------------------------------------------------------------+
|                                                                             |
|  +--------------------------------+  +--------------------------------+    |
|  |     📥 Descargar Reporte       |  |     📋 Copiar al portapapeles  |    |
|  |        (PDF)                   |  |                                |    |
|  +--------------------------------+  +--------------------------------+    |
|                                                                             |
|  +--------------------------------+  +--------------------------------+    |
|  |     ✏️  Editar evaluacion      |  |     🔄 Evaluar otro documento  |    |
|  |                                |  |                                |    |
|  +--------------------------------+  +--------------------------------+    |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

## Mobile Adaptation

```
+---------------+
| ≡      🔔 👤  |
+---------------+
|               |
| <- Resultado  |
|               |
| +-----------+ |
| |           | |
| |    🟢     | |
| |           | |
| |   8.5/10  | |
| |           | |
| | Excelente | |
| |           | |
| +-----------+ |
|               |
| [Resumen]     |
| [Detalle]  [▼]|
| [Retro]       |
|               |
| Criterios     |
|               |
| Tesis         |
| ████████░░ 8.5|
|               |
| Coherencia    |
| █████████░ 9.0|
|               |
| ...           |
|               |
| ✓ Fortalezas  |
|               |
| ✅ Buena...   |
| ✅ Excelente..|
|               |
| 📌 A mejorar  |
|               |
| • Cohesion    |
| • Vocabulario |
|               |
| [📥 PDF]      |
| [📋 Copiar]   |
| [🔄 Nuevo]    |
|               |
+---------------+
```

---

## Estados Alternativos

### Resultado con Alertas

```
+-----------------------------------------------------------------------------+
|                                                                             |
|  ⚠️ ADVERTENCIA: Costo excedio estimacion                                  |
|                                                                             |
|  El documento tenia mas segmentos de lo esperado.                          |
|  Costo final: $320 COP (estimado: $180 COP)                                |
|                                                                             |
|  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++   |
|  +                                                                     +   |
|  +                    🟡                                                +   |
|  +                                                                     +   |
|  +                  7.2/10                                             +   |
|  +                                                                     +   |
|  +         ACEPTABLE CON OBSERVACIONES                                 +   |
|  +                                                                     +   |
|  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++   |
|                                                                             |
+-----------------------------------------------------------------------------+
```

### Error en Evaluacion

```
+-----------------------------------------------------------------------------+
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |                                                                     |   |
|  |                              ❌                                     |   |
|  |                                                                     |   |
|  |              Error al procesar el documento                         |   |
|  |                                                                     |   |
|  |   No pudimos evaluar este archivo. Posibles causas:                 |   |
|  |                                                                     |   |
|  |   • El archivo esta danado o protegido con contrasena               |   |
|  |   • El formato no es compatible                                     |   |
|  |   • El texto no es legible (imagen escaneada sin OCR)               |   |
|  |                                                                     |   |
|  |   [Intentar de nuevo]    [Subir otro archivo]                       |   |
|  |                                                                     |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
+-----------------------------------------------------------------------------+
```
