# maxisantibanez.github.io

Portfolio personal de [Maximiliano Santibáñez](https://maxisantibanez.github.io/) — desarrollador backend especializado en integraciones, ERPs y automatización.

## Stack

Vanilla HTML + CSS + JavaScript. Sin frameworks ni bundlers: una sola página que carga dos JSON (`data/i18n.json`, `data/projects.json`) y los renderiza en el cliente.

| Decisión | Razón |
|---|---|
| Sin framework | Tiempo de carga instantáneo, sin dependencias que romper |
| Data en JSON | Actualizar contenido sin tocar código; i18n trivial |
| SVG inline | Diagramas de arquitectura sin librerías externas |
| GitHub Pages | Deploy automático en cada push a `main` |

## Estructura

```
.
├── index.html          # Markup estático + shell de la app
├── main.js             # Toda la lógica: render, i18n, scrollspy, reloj, visor CV
├── styles.css          # Diseño completo (custom properties, responsive, animaciones)
├── cv.pdf              # CV descargable
└── data/
    ├── i18n.json       # Textos en ES / EN (hero, nav, labels)
    └── projects.json   # Proyectos: work, internship, openSource, otherJobs
```

## Desarrollo local

```bash
# Con Python (sin instalar nada):
python -m http.server 8080

# Con Node:
npx serve .
```

Abre `http://localhost:8080`.

> Los fetch de JSON fallan en file:// por CORS. Sirve siempre desde un servidor local.

## Agregar o editar proyectos

Edita `data/projects.json`. Cada proyecto de trabajo (`work` / `internship`) acepta:

```jsonc
{
  "id": "slug-unico",
  "title":   { "es": "...", "en": "..." },
  "context": { "es": "...", "en": "..." },
  "problem": { "es": "...", "en": "..." },
  "role":    { "es": "...", "en": "..." },
  "impact":  { "es": "...", "en": "..." },
  "stack":   ["Tech A", "Tech B"],
  "year":    { "es": "Ene 2026 – presente", "en": "Jan 2026 – present" },

  // Diagrama de arquitectura (nodos + aristas en grilla 4×3):
  "arch": {
    "nodes": [
      { "id": "ui", "label": { "es": "React UI", "en": "React UI" }, "x": 0, "y": 1, "layer": "frontend" }
    ],
    "edges": [{ "from": "ui", "to": "api" }]
  }
}
```

**Capas disponibles** (`layer`): `frontend` · `api` · `db` · `ext`

**Grilla**: `x` 0–3 (columnas izq→der), `y` 0–2 (filas top→bottom).

Para ocultar un proyecto sin borrarlo agrega `"hidden": true`.

## Deploy

Push a `main` → GitHub Actions ejecuta el workflow en `.github/workflows/deploy.yml` → GitHub Pages publica en [`https://maxisantibanez.github.io/`](https://maxisantibanez.github.io/).

No hay paso de build; el repositorio es el artefacto desplegado directamente.

## Licencia

Código bajo [MIT](LICENSE). El contenido (textos, CV, proyectos) es de Maximiliano Santibáñez.
