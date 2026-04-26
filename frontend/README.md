# EvaluAI Frontend

React frontend para EvaluAI Profesor - Plataforma SaaS de evaluación académica con IA

## 🚀 Deploy en Vercel (Recomendado)

### Paso 1: Conectar Repositorio

1. Ve a [vercel.com](https://vercel.com) e inicia sesión con GitHub
2. Click **"Add New Project"**
3. Importar desde GitHub: `elescuchante10-code/evaluai-frontend`
4. Selecciona el framework **"Create React App"**

### Paso 2: Configurar Variables de Entorno

En el dashboard de Vercel, agrega:

| Variable | Valor |
|----------|-------|
| `REACT_APP_API_URL` | `https://web-production-83f44.up.railway.app` |

### Paso 3: Verificar Build Settings

| Campo | Valor |
|-------|-------|
| Framework Preset | Create React App |
| Build Command | `npm run build` |
| Output Directory | `build` |
| Install Command | `npm install` |

### Paso 4: Deploy

Click **"Deploy"** y espera a que termine el build.

Tu app estará disponible en: `https://evaluai-frontend.vercel.app`

---

## 🔗 Conexión con Backend

El backend está desplegado en Railway:
- **URL Base:** `https://web-production-83f44.up.railway.app`

### Endpoints utilizados:

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/evaluaciones/asignaturas/lista` | GET | Lista asignaturas disponibles |
| `/evaluaciones/subir` | POST | Subir documento (multipart/form-data) |

### Asignaturas soportadas:
- 📐 Matemáticas
- 📚 Lengua Castellana  
- 🗣️ Inglés
- 🌍 Ciencias Sociales
- 🔬 Ciencias Naturales

---

## ✅ Checklist de Verificación Post-Deploy

Una vez desplegado, verifica:

- [ ] La app carga sin errores 404
- [ ] El selector de asignaturas muestra opciones (hace fetch al backend)
- [ ] Se puede seleccionar un archivo PDF/DOCX/TXT
- [ ] Al enviar, muestra la estimación de costo

**Prueba de conectividad:**
```
https://web-production-83f44.up.railway.app/evaluaciones/asignaturas/lista
```
Debe retornar JSON con lista de asignaturas.

---

## 💻 Desarrollo Local

```bash
cd frontend
npm install
npm start
```

Abre http://localhost:3000

---

## 📁 Estructura del Proyecto

```
frontend/
├── public/
│   └── index.html          # HTML base
├── src/
│   ├── App.js              # Componente principal (486 líneas)
│   └── index.js            # Punto de entrada
├── package.json            # Dependencias
├── vercel.json             # Configuración de Vercel
└── README.md               # Este archivo
```

---

## 🎨 Detalles Técnicos

- **Framework:** React 18.2.0
- **Estilos:** Inline styles (sin CSS modules)
- **Flujo:** 3 pasos (Subir → Estimar → Resultados)
- **Backend:** Python + FastAPI en Railway

---

## 🚨 Troubleshooting

### Error CORS
Si ves errores de CORS, verifica que el backend permita el origen de Vercel.

### Build falla
- Asegúrate que `package.json` está en la raíz del repo
- Node version: 18.x (estándar en Vercel)

### Asignaturas no cargan
- Verifica que `REACT_APP_API_URL` esté configurada en Vercel
- Prueba el endpoint directamente en el navegador
