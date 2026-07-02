import { Hono } from 'hono'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The committed openapi.yaml is the single source of truth. Read it once,
// resolved relative to this module so the path holds under both tsx (src/) and
// the compiled build (dist/) — its parent dir is the repo root / the image's
// /app, where openapi.yaml lives (the Dockerfile copies it there).
let spec = ''
try {
  spec = readFileSync(fileURLToPath(new URL('../openapi.yaml', import.meta.url)), 'utf8')
} catch {
  // Spec not bundled alongside the build; /openapi.yaml will 404.
}

// Swagger UI, with its assets pulled from a CDN so the app takes on no runtime
// dependency. It fetches and renders /openapi.yaml.
const SWAGGER_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>fishing-planet-api — API docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.ui = SwaggerUIBundle({ url: '/openapi.yaml', dom_id: '#swagger-ui' })
  </script>
</body>
</html>`

export const docs = new Hono()

docs.get('/docs', (c) => c.html(SWAGGER_HTML))

docs.get('/openapi.yaml', (c) => {
  if (!spec) return c.json({ error: 'Spec not available' }, 404)
  return c.body(spec, 200, { 'content-type': 'application/yaml; charset=utf-8' })
})
