import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = new Hono()

// CORS middleware
app.use('*', cors())

// Serve static files from web/dist
app.use('/*', serveStatic({ root: './web/dist' }))

// API routes
app.get('/api', (c) => c.json({ message: 'IdeaVerse API', version: '0.1.0' }))

app.get('/api/health', (c) => c.json({ status: 'ok' }))

const port = process.env.PORT || 3000

console.log(`Server running on port ${port}`)

serve({
  fetch: app.fetch,
  port: Number(port)
})