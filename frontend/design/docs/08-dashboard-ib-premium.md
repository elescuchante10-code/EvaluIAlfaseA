# EvaluAI - Dashboard IB Premium

> Documento de diseno para aprobacion previa a implementacion.
> Este archivo define el rediseño del dashboard y la estructura futura del workspace del profesor IB.
> No implica cambios de codigo por si mismo.

---

## 1. Objetivo

Rediseñar el dashboard de EvaluAI para convertirlo en una herramienta de trabajo premium para profesores del Bachillerato Internacional, sin romper los modulos que hoy ya funcionan.

El objetivo no es "ponerlo mas bonito".

El objetivo es:
- reducir confusion operativa
- ordenar la jerarquia de acciones
- hacer que la plataforma se sienta como un workspace profesional real
- preparar la entrada de memoria contextual IB y RAG sin contaminar el evaluador sano

---

## 2. Diagnostico Del Estado Actual

### Lo que hoy funciona
- el evaluador central
- el visor documental
- el flujo contextual entre seleccion, chat y observaciones
- las exportaciones
- las rubricas
- el batch inicial
- OCR/HTR y capturas manuscritas

### Lo que hoy falla a nivel de experiencia
- demasiados botones de igual peso visual
- falta de jerarquia entre acciones primarias y secundarias
- convivencia poco clara entre chat, rubrica, documento y acciones de exportacion
- panel derecho con graficas que aportan poco valor inmediato al profesor
- interfaz util, pero no intuitiva ni premium
- ausencia de lenguaje de producto IB

### Problema central
La app actual funciona como conjunto de funciones.
Todavia no funciona como sistema de trabajo del profesor IB.

---

## 3. Tesis De Producto

EvaluAI debe dejar de parecer un dashboard tecnico con widgets y empezar a comportarse como un escritorio academico especializado.

La nueva interfaz debe comunicar:
- claridad
- criterio
- sobriedad premium
- enfoque academico
- continuidad del trabajo docente

La referencia conceptual no es un panel de analiticas generico.
La referencia correcta es una combinacion de:
- workspace editorial
- mesa de evaluacion academica
- biblioteca curricular
- asistente experto con memoria institucional

---

## 4. Principios De Diseno

1. Una sola accion principal por pantalla.
2. Las acciones destructivas deben verse claramente secundarias.
3. El documento es el centro del flujo cuando se esta evaluando.
4. El chat es una herramienta contextual, no el protagonista visual permanente.
5. La rubrica debe sentirse estable y siempre disponible.
6. El panel derecho solo debe sobrevivir si aporta contexto real.
7. Las graficas no deben ocupar espacio premium si no ayudan a decidir.
8. La identidad visual debe alinearse con un entorno academico IB: refinado, sereno, editorial y confiable.

---

## 5. Nueva Arquitectura Del Producto

### Navegacion primaria propuesta
1. `Mi Espacio IB`
2. `Evaluar`
3. `Asistente IA`
4. `Configuracion`

### Logica de cada modulo

#### `Mi Espacio IB`
Espacio base del profesor.
Debe concentrar:
- asignatura activa
- cursos o grupos
- documentos curriculares del profesor
- unidades didacticas
- guias
- examenes de referencia
- rubricas base del profesor
- memoria contextual privada por asignatura
- accesos rapidos a trabajo reciente

#### `Evaluar`
Modulo centrado en el flujo que hoy ya funciona.
Debe integrar:
- documento actual
- rubrica activa
- evaluacion
- observaciones
- exportaciones
- lista de rubricas del profesor dentro del mismo modulo
- boton `Crear rubrica`
- boton `Guardar rubrica`
- formulario de contexto evaluativo
- metodologia de evaluacion configurable

Regla clave:
`Evaluar` no debe reinventarse. Debe preservar el esquema actual y mejorar solo su experiencia, claridad y jerarquia visual.

#### `Asistente IA`
Espacio para trabajo generativo y conversacional no necesariamente ligado a un documento abierto.
Debe usar memoria contextual del profesor y su asignatura.

#### `Configuracion`
Preferencias del usuario, perfil, opciones del asistente y ajustes operativos.

---

## 6. Shell De Interfaz Propuesto

### Estructura general
- barra lateral izquierda fija
- header superior liviano
- area central dominante
- panel contextual derecho opcional y colapsable

### Regla visual clave
El centro manda.
La barra lateral organiza.
El panel derecho solo acompaña.

### Distribucion recomendada en desktop
- izquierda: `272px`
- centro: flexible
- derecha: `320px` solo cuando aporte valor

### Distribucion recomendada en tablet
- izquierda colapsable
- derecha colapsable
- centro a pantalla prioritaria

---

## 7. Replanteamiento Del Modulo `Evaluar`

### Objetivo
Conservar la logica actual, pero reorganizar la experiencia.

### Regla de preservacion
No cambiar la logica interna de evaluacion que hoy ya funciona.

Lo que se rediseña es:
- la forma de entrada
- la comodidad de uso
- la jerarquia visual
- la distribucion de paneles

No se rediseña desde cero:
- el evaluador
- las footnotes
- el chat pequeno contextual
- la exportacion
- la logica de rubrica activa

### Orden nuevo de lectura visual
1. contexto de evaluacion
2. documento
3. observaciones y acciones
4. exportacion
5. herramientas complementarias

### Lo que debe mantenerse dentro de `Evaluar`
- lista visible de rubricas como hoy
- boton `Crear rubrica`
- boton `Guardar rubrica`
- formulario para crear o editar rubrica
- datos de contexto que la IA debe conocer
- opciones de metodologia evaluativa:
  - por parrafo
  - por frase
  - por imagen
  - general
- activacion clara de la `rubrica activa`
- evaluacion individual
- evaluacion por lote maximo 10

### Flujo correcto dentro de `Evaluar`
1. El profesor entra a `Evaluar`.
2. Ve sus rubricas disponibles en el panel correspondiente.
3. Puede:
   - usar una existente
   - crear una nueva
   - subir contenido en texto o captura
   - organizarla y convertirla a Markdown
4. Completa el formulario de contexto evaluativo.
5. Guarda la rubrica.
6. Esa rubrica queda activa para la sesion actual.
7. Luego sube uno o varios documentos de estudiantes.
8. Ejecuta evaluacion individual o lote maximo 10 con esa rubrica activa.

### Regla de UX
La rubrica no debe sentirse como un paso escondido ni ambiguo.
Debe ser visible, editable y claramente activa dentro del mismo modulo.

### Nueva composicion sugerida

#### Franja superior del workspace
Debe mostrar solo:
- nombre del documento
- rubrica activa
- estado del trabajo
- una accion principal

Accion principal sugerida:
- `Evaluar documento`

Acciones secundarias:
- `Subir otro`
- `Exportar`
- `Lote`
- `Guardar rubrica` cuando el profesor esta construyendo o editando una

Acciones destructivas:
- `Eliminar documento`
- `Nuevo trabajo`

Estas no deben competir visualmente con la accion principal.

### Centro del modulo
El documento debe ocupar la mayor parte del espacio visible.
El visor debe sentirse como una hoja de trabajo premium, no como un bloque atrapado entre widgets.

### Layout funcional recomendado de `Evaluar`
- izquierda: cola de documentos y bloque de rubricas, colapsable
- centro: documento grande y evaluador
- derecha: contexto de sesion, rubrica activa, exportaciones y estado
- chat contextual pequeno: integrado, colapsable, pero no alterado funcionalmente

### Sobre el chat pequeno contextual
No debe cambiar su logica ni sus capacidades.

Debe conservar:
- seleccion contextual
- notas al pie incrementales
- pegado de capturas
- uso tactico durante la evaluacion

Solo debe mejorar:
- tamaño de lectura
- comodidad visual
- ancho util
- comportamiento de colapsado

### Panel contextual derecho en `Evaluar`
Debe dejar de ser un panel de graficas genericas.

Debe convertirse en un panel de contexto util con:
- rubrica activa resumida
- estado de evaluacion
- resumen de observaciones
- accesos a exportacion
- historial corto del trabajo actual

### Graficas
No deben desaparecer del producto.
Pero deben salir del flujo principal de evaluacion.

Se pueden mover a:
- `Mi Espacio IB`
- o un subpanel de analitica secundaria

No deben ocupar el espacio premium del profesor mientras corrige.

---

## 8. Parametros Esteticos Premium

### Direccion visual
Editorial academica premium.
Debe sentirse sobria, nitida y seria.

### Tono general
- fondo profundo pero no agresivo
- superficies claras o ligeramente tintadas para lectura
- contraste alto en el documento
- acentos inspirados en rigor academico, no en dashboard SaaS generico

### Paleta conceptual
- azules profundos institucionales
- marfil o blanco calido para superficies de lectura
- verdes controlados solo para confirmacion
- rojos reservados para acciones destructivas o alertas reales
- dorado o arena suave como acento premium ocasional

### Tipografia
Evitar que todo se vea como UI generica.

Sistema sugerido:
- una sans refinada para interfaz
- una serif editorial o semiserif para titulos o zonas de lectura destacada

### Espaciado
- mas respiracion entre bloques
- menos cajas apretadas
- menos bordes duros compitiendo

### Botones
Debe existir una jerarquia clara de cuatro niveles:
- primario
- secundario
- terciario
- destructivo

### Tarjetas
Solo donde aporten agrupacion real.
Evitar encerrar cada pequeño dato en una tarjeta independiente.

### Iconografia
Discreta, consistente y profesional.
No usar exceso de iconos llamativos en zonas de alta densidad.

---

## 9. Modulos Del Estado Actual Que Deben Conservarse

Estos modulos no deben rediseñarse desde cero en la primera fase:
- `CentralEvaluator`
- `DocumentPreview`
- flujo de seleccion contextual
- chat contextual
- footnotes y su ciclo de aceptacion / edicion / complemento
- exportacion actual
- OCR/HTR base
- capturas manuscritas
- rubricas existentes

La regla es:
reubicar antes de reescribir.

---

## 10. Elementos Que Deben Salir Del Flujo Principal

### Del panel derecho actual
- donut de distribucion
- evolucion historica
- barras de ultimas evaluaciones
- metricas genericas de impacto bajo

### Motivo
Mientras el profesor esta corrigiendo, esas piezas no ayudan a tomar mejores decisiones.
Solo consumen foco y fragmentan la lectura.

---

## 11. Como Conectar La Memoria Contextual IB Sin Romper El Sistema

### Tesis tecnica
La memoria contextual IB no debe nacer embebida dentro del evaluador principal.
Debe construirse como una capa separada, privada por profesor y basada en documentos convertidos a Markdown.

### Ruta de contexto informada por el usuario
La carpeta base propuesta para memoria y contexto IB es:

`C:\Users\User\Desktop\Nueva carpeta\Documents\Backup de julio Windosws\GCB\2025-2026 (IB)\UNIDAD DIDACTICA\memoria de contexto IB`

### Uso propuesto
Esa carpeta debe servir como base documental para:
- memoria por asignatura
- memoria por profesor
- conocimiento institucional IB
- retrieval para el asistente IA
- pack contextual privado del profesor

### Principio de integracion
Primero ingestion limpia a Markdown, luego organizacion del pack contextual, luego retrieval para el asistente.
No al reves.

### Fases recomendadas

#### Fase A
Definir la estructura del `Context Pack` por profesor y asignatura.

#### Fase B
Convertir documentos subidos a Markdown limpio.

#### Fase C
Construir manifiesto, indices y archivos de organizacion del pack.

#### Fase D
Conectar retrieval simple al `Asistente IA` segun profesor y asignatura.

#### Fase E
Solo despues evaluar si parte de ese contexto alimenta el evaluador.

### Referencia conceptual
Metodo Karpathy aplicado de forma practica:
- documentos del profesor
- conversion a Markdown limpio
- organizacion por manifiestos y archivos indice
- lectura selectiva del pack contextual
- respuesta con grounding segun profesor y asignatura

### Regla de complejidad
No introducir vector DB ni infraestructura pesada en esta fase.
La memoria contextual debe ser limpia, interpretable y operable con costo bajo.

### Riesgo a evitar
No contaminar el evaluador con demasiado contexto externo antes de tener una capa RAG confiable y controlada.

---

## 12. Fases De Implementacion Recomendadas

### Fase 1. Diseno aprobado
Salida:
- especificacion del dashboard
- mapa de navegacion
- jerarquia visual
- lista de componentes conservados

### Fase 2. Shell visual
Alcance:
- layout
- menu lateral
- header
- redistribucion de paneles

Prohibido tocar:
- logica de evaluacion
- footnotes
- exportacion
- OCR/HTR

### Fase 3. Reubicacion funcional
Alcance:
- mover modulos existentes al nuevo shell
- reorganizar botones
- limpiar panel derecho

### Fase 4. `Mi Espacio IB`
Alcance:
- home del profesor
- asignatura editable
- carga de documentos de contexto
- organizacion automatica confirmable
- memoria contextual por profesor
- trabajo reciente

### Fase 5. Memoria contextual
Alcance:
- conversion a Markdown
- manifiestos
- estructura documental por profesor
- retrieval simple

### Fase 6. Asistente IA con memoria
Alcance:
- asistente informado por asignatura y profesor
- uso de contexto IB

---

## 13. Checklist De Aprobacion Antes De Implementar

Debe aprobarse explicitamente:
- la nueva navegacion primaria
- la eliminacion de graficas del flujo principal
- la nueva jerarquia de acciones
- la identidad premium editorial
- la existencia de `Mi Espacio IB`
- la separacion entre evaluador y memoria contextual
- la preservacion del modulo actual de rubricas dentro de `Evaluar`

---

## 14. Resumen Ejecutivo Final

La prioridad correcta ahora si puede ser el dashboard premium IB.

Pero debe hacerse con esta secuencia:
- primero rediseño estructural
- luego shell visual
- luego reubicacion de funciones existentes
- despues memoria contextual y RAG

No conviene mezclar desde el inicio:
- rediseño visual
- reescritura del evaluador
- memoria contextual
- retrieval

La estrategia correcta es:
1. convertir EvaluAI en un workspace premium para profesor IB
2. preservar el core funcional actual
3. construir despues la capa de memoria contextual como sistema separado y aditivo

---

## 15. Decisiones Solicitadas Al Usuario Para Pasar A Implementacion

1. Confirmar si la navegacion primaria final sera:
   - `Mi Espacio IB`
   - `Evaluar`
   - `Asistente IA`
   - `Configuracion`

2. Confirmar si el panel derecho actual de analiticas debe salir del flujo principal de `Evaluar`.

3. Confirmar si la primera implementacion debe limitarse al `shell visual` sin tocar logica.

4. Confirmar si la memoria contextual IB debe implementarse sin vectores, usando conversion a Markdown y `Context Pack` privado por profesor.
