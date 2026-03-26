import { Hono } from 'hono'
import { sign, verify } from 'hono/jwt'
import { HTTPException } from 'hono/http-exception' // Импортируем для обработки ошибок
import prisma from '../lib/prisma.js'
import { authCallbackSchema } from '../utils/validation.js'

const auth = new Hono()

// Mock данные для тестирования
const MOCK_USERS: Record<string, { id: string; email: string; name: string }> = {
  'test_code': { id: '12345', email: 'test@example.com', name: 'Test User' },
  'test_code_2': { id: '67890', email: 'test2@example.com', name: 'Test User 2' }
}

// POST /api/auth/github/callback
auth.post('/github/callback', async (c) => {
  const body = await c.req.json()
  
  // 1. Валидация входных данных
  const validation = authCallbackSchema.safeParse(body)
  if (!validation.success) {
    throw new HTTPException(400, { message: 'Validation failed' })
  }

  const { code } = validation.data
  let githubUser

  // 2. Mock режим (Checkpoint 2)
  if (code.startsWith('test_')) {
    githubUser = MOCK_USERS[code] || {
      id: `mock_static_${code}`, 
      email: `user_${code}@example.com`,
      name: `User ${code}`
    }
  } else {
    // Если код не тестовый, а реальный OAuth не настроен
    throw new HTTPException(501, { message: 'Real GitHub OAuth not implemented' })
  }

  // 3. Сохранение/обновление пользователя в БД
  const user = await prisma.user.upsert({
    where: { githubId: githubUser.id },
    update: { name: githubUser.name, email: githubUser.email },
    create: {
      githubId: githubUser.id,
      name: githubUser.name,
      email: githubUser.email
    }
  })

  // 4. Создание JWT токена
  const secret = process.env.JWT_SECRET || 'dev-secret-key'
  const payload = {
    sub: user.id,
    githubId: user.githubId,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 дней
  }
  
  const token = await sign(payload, secret)

  return c.json({
    success: true,
    token,
    user: { id: user.id, email: user.email, name: user.name, githubId: user.githubId }
  })
})

// GET /api/auth/me - Получение текущего пользователя
auth.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing or invalid Authorization header' })
  }

  const token = authHeader.split(' ')[1]
  const secret = process.env.JWT_SECRET || 'dev-secret-key'
  
  // Верификация токена
  // Если токен невалиден, verify сам выбросит ошибку, которую поймает index.ts
  const payload = await verify(token, secret, 'HS256')

  const user = await prisma.user.findUnique({
    where: { id: payload.sub as string }
  })

  if (!user) {
    throw new HTTPException(404, { message: 'User not found' })
  }

  return c.json({
    success: true,
    user: { id: user.id, email: user.email, name: user.name, githubId: user.githubId }
  })
})

export default auth