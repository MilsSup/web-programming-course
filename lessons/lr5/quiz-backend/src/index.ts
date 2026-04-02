import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import auth from './routes/auth.js';
import sessions from './routes/sessions.js';
import admin from './routes/admin.js';
import categories from './routes/categories.js'
import { HTTPException } from 'hono/http-exception';
import { swaggerUI } from '@hono/swagger-ui'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const app = new Hono()
// 1. Плеер Swagger (он у тебя уже работает)
app.get('/ui', swaggerUI({ url: '/doc' }))

// 2. Роут, который отдает саму схему (здесь сейчас ошибка 404)
app.get('/doc', (c) => {
  try {
    // Мы используем join и process.cwd(), чтобы найти файл в корне папки quiz-backend
    const schemaPath = join(process.cwd(), 'quiz-api-schema.yaml')
    const schema = readFileSync(schemaPath, 'utf8')
    
    // Важно: возвращаем схему как обычный текст
    return c.text(schema)
  } catch (e) {
    console.error("❌ Не удалось найти файл схемы:", e)
    return c.text('Файл спецификации quiz-api-schema.yaml не найден в корне проекта', 404)
  }
})
// глобальный обработчик ошибок
app.onError((err, c) => {
  // если мы сами выбросили HTTPException (например, 404), возвращаем его как есть
  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  // если произошла системная ошибка (база упала, ошибка в коде)
  console.error(`[SERVER ERROR]: ${err.stack}`);

  // возвращаем красивый JSON, чтобы фронтенд не падал
  return c.json({
    success: false,
    error: 'Internal Server Error',
    message: err.message || 'Что-то пошло не так на сервере'
  }, 500);
});

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
app.route('/api/categories', categories)

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
