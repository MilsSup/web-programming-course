import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import auth from './middleware/auth.js';
import sessions from './routes/sessions.js';
import admin from './routes/admin.js';

const app = new Hono()

app.use('*', logger());
app.use('*', cors());

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/health', async (c) => {
  return c.json({"status": "ok"})
})

app.route('/api/auth', auth)
app.route('/api/sessions', sessions)
app.route('/api/admin', admin)

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
