# Desactivar GitHub Pages - Instrucciones

## Pasos para desactivar

### 1. Ir a GitHub
- Abre: https://github.com/elescuchante10-code/evaluai-frontend

### 2. Acceder a Settings
- Click en la pestaña **"Settings"** (arriba, junto a Insights)

### 3. Ir a Pages
- En el menú lateral izquierdo, busca **"Pages"** (en la sección Code and automation)

### 4. Desactivar
- En **"Source"**, cambia de "Deploy from a branch" a **"None"**
- Click en **"Save"**

### 5. Verificar
- Espera 1-2 minutos
- La URL https://elescuchante10-code.github.io/evaluai-frontend dejará de funcionar

---

## Desarrollo local (flujo de trabajo)

```bash
# Cada vez que trabajes:
cd frontend
npm start

# Abrir en navegador: http://localhost:3000
```

---

## Cuándo volver a activar (futuro)

Cuando el diseño esté listo y quieran mostrarlo públicamente:

1. Settings → Pages
2. Source: "Deploy from a branch"
3. Branch: "gh-pages" / folder: "/ (root)"
4. Click Save
5. Ejecutar: `npm run deploy`

---

*Nota: El repo sigue en GitHub, solo se desactiva la página web pública.*
