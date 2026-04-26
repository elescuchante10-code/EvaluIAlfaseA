# 🚀 Guía de Deploy en Vercel - EvaluAI Frontend

## 📋 Requisitos Previos

- Cuenta en [Vercel](https://vercel.com) (puedes usar tu cuenta de GitHub)
- Repositorio en GitHub con el código del frontend
- Backend desplegado y funcionando en Railway

---

## 🔧 Configuración del Proyecto

### 1. Estructura del Proyecto

El proyecto debe tener esta estructura en la raíz del repositorio:

```
evaluai-frontend/
├── frontend/                 # ← Carpeta raíz del proyecto React
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   ├── App.js
│   │   └── index.js
│   ├── package.json
│   ├── .env.production      # ← Variables de entorno producción
│   ├── .gitignore
│   └── vercel.json          # ← Configuración de Vercel
└── README.md
```

> ⚠️ **IMPORTANTE**: En Vercel, el **Root Directory** debe apuntar a la carpeta `frontend/`.

---

## 🚀 Pasos para Deploy

### Paso 1: Subir código a GitHub

```bash
# Desde la carpeta frontend/
cd frontend

# Inicializar git (si no está inicializado)
git init

# Agregar todos los archivos
git add .

# Commit
git commit -m "Preparado para deploy en Vercel"

# Conectar con tu repositorio de GitHub
git remote add origin https://github.com/TU_USUARIO/evaluai-frontend.git

# Push
git push -u origin main
```

### Paso 2: Crear Proyecto en Vercel

1. Ve a [vercel.com](https://vercel.com) e inicia sesión
2. Click en **"Add New Project"**
3. Importa tu repositorio de GitHub: `TU_USUARIO/evaluai-frontend`
4. Configura el proyecto:

| Campo | Valor |
|-------|-------|
| **Framework Preset** | Create React App |
| **Root Directory** | `frontend` ⚠️ Importante |
| **Build Command** | `npm run build` |
| **Output Directory** | `build` |

### Paso 3: Configurar Variables de Entorno

En el dashboard de Vercel, ve a **Settings** → **Environment Variables** y agrega:

| Variable | Valor | Environment |
|----------|-------|-------------|
| `REACT_APP_API_URL` | `https://evaluadorib-production.up.railway.app` | Production |
| `REACT_APP_API_URL` | `https://evaluadorib-production.up.railway.app` | Preview |

> 💡 Opcional: archivo `.env.production` en `frontend/` con la misma variable; en Vercel, **Settings → Environment Variables** tienen prioridad o equivalencia según el flujo de build.

### Paso 4: Deploy

1. Click en **"Deploy"**
2. Espera a que termine el build (2-3 minutos)
3. Tu app estará disponible en: `https://evaluai-frontend.vercel.app`

---

## ✅ Checklist de Verificación Post-Deploy

Una vez desplegado, verifica:

### Funcionalidad Core
- [ ] La app carga sin errores 404
- [ ] La landing page se muestra correctamente
- [ ] El login funciona (usa una cuenta de prueba)
- [ ] El registro funciona
- [ ] El selector de asignaturas muestra opciones
- [ ] Se puede subir un archivo PDF/DOCX/TXT
- [ ] El agente responde en el chat

### Conectividad Backend
```bash
curl -sS https://evaluadorib-production.up.railway.app/health
```
Debe devolver JSON con al menos `"status": "healthy"` (HTTP 200).

### Consola del Navegador
- Abre la app en el navegador (F12 → Console)
- Verifica que no haya errores de CORS
- Verifica que `🔌 API_URL` muestre la URL correcta

---

## 🔧 Configuración de Archivos

### vercel.json

El archivo `vercel.json` ya está configurado para:

- Usar `@vercel/static-build` para proyectos React
- Configurar cache para archivos estáticos
- Redirigir todas las rutas a `index.html` (SPA)

```json
{
  "version": 2,
  "name": "evaluai-frontend",
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "build"
      }
    }
  ],
  "routes": [
    {
      "src": "/static/(.*)",
      "headers": {
        "cache-control": "s-maxage=31536000,immutable"
      }
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### .env.production

```
REACT_APP_API_URL=https://evaluadorib-production.up.railway.app
```

### src/services/api.js

La configuración de la API usa la variable de entorno:

```javascript
const API_URL = process.env.REACT_APP_API_URL || 'https://evaluadorib-production.up.railway.app';
```

---

## 🐛 Troubleshooting

### Error: "404 Not Found" al recargar página

**Solución**: El archivo `vercel.json` ya está configurado con la redirección SPA. Si persiste:

1. Ve a Vercel Dashboard → Tu proyecto → Settings
2. En "Build & Development Settings", verifica:
   - Framework Preset: Create React App
   - Output Directory: build

### Error CORS

**Síntoma**: Error en consola: `Access-Control-Allow-Origin`

**Solución**: El backend debe tener CORS configurado para permitir el dominio de Vercel:

```python
# En el backend (main.py)
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://evaluai-frontend.vercel.app",  # Tu dominio de Vercel
        "http://localhost:3000",                 # Desarrollo local
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Error: "Invalid Build"

**Solución**: Verifica que:
1. El `package.json` está en la carpeta raíz del proyecto (dentro de `frontend/`)
2. El Root Directory en Vercel está configurado como `frontend`

### Variables de entorno no funcionan

**Solución**: 
1. Ve a Vercel Dashboard → Settings → Environment Variables
2. Agrega las variables manualmente
3. Re-deploy el proyecto

---

## 🔄 Deploys Automáticos

Cada vez que hagas push a la rama `main` de GitHub, Vercel automáticamente hará un nuevo deploy.

```bash
# Hacer cambios y deploy automático
git add .
git commit -m "Nuevos cambios"
git push origin main
# Vercel detectará el push y hará deploy automáticamente
```

---

## 📞 Links Útiles

- **Frontend en Vercel**: `https://evaluai-frontend.vercel.app`
- **Backend Railway**: `https://evaluadorib-production.up.railway.app`
- **Docs Backend**: `https://evaluadorib-production.up.railway.app/docs`
- **GitHub Repo**: `https://github.com/TU_USUARIO/evaluai-frontend`

---

## 📝 Notas Importantes

1. **Dominio personalizado**: Puedes configurar un dominio propio en Vercel Settings → Domains

2. **HTTPS**: Vercel proporciona HTTPS automáticamente

3. **MODO_DEMO**: Si necesitas probar sin backend, cambia `MODO_DEMO = true` en `src/services/api.js`

4. **Logs**: Para ver logs en tiempo real: Vercel Dashboard → Tu proyecto → View Function Logs

---

**¡Listo para deploy!** 🚀

*Última actualización: 2026-04-24 (URL Railway: EvaluadorIB producción)*
