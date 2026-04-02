import { Hono } from 'hono'
import { sign, verify } from 'hono/jwt'
import { HTTPException } from 'hono/http-exception'
import prisma from '../lib/prisma.js'
import { authCallbackSchema } from '../utils/validation.js'
import { getGitHubUserByCode } from '../services/github.js'

const auth = new Hono()

// Mock данные для тестирования
const MOCK_USERS: Record<string, { id: string; email: string; name: string }> = {
  'test_code': { id: '12345', email: 'test@example.com', name: 'Test User' },
  'test_code_2': { id: '67890', email: 'test2@example.com', name: 'Test User 2' }
}

// POST /api/auth/github/callback
auth.post('/github/callback', async (c) => {
  const body = await c.req.json()
  
  // валидация входных данных
  const validation = authCallbackSchema.safeParse(body)
  if (!validation.success) {
    throw new HTTPException(400, { message: 'Validation failed' })
  }

  const { code } = validation.data
  let githubUser

// Mock режим (Checkpoint 2)
if (code.startsWith('test_')) {
  githubUser = MOCK_USERS[code] || {
    id: `mock_static_${code}`, 
    email: `user_${code}@example.com`,
    name: `User ${code}`
  };
} else {
  try {
    const realGitHubData = await getGitHubUserByCode(code);

    githubUser = {
      id: String(realGitHubData.id), 
      // GitHub может не отдать email (если он скрыт юзером), делаем fallback
      email: realGitHubData.email || `github_${realGitHubData.id}@example.com`,
      name: realGitHubData.name || 'GitHub User'
    };
  } catch (error) {
    // Если GitHub послал нас подальше (неверный код, нет ключей в .env)
    console.error("Детали от GitHub:", (error as any).response?.data || (error as any).message);
    throw new HTTPException(400, { message: 'Не удалось авторизоваться через GitHub' });
  }
}

  // 3. Сохранение/обновление пользователя в БД
  const user = await prisma.user.upsert({
    where: { githubId: githubUser.id },
    update: { 
      // УБИРАЕМ name отсюда, чтобы GitHub не затирал твои правки профиля!
      email: githubUser.email 
    },
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

auth.put('/profile', async (c) => {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.split(' ')[1]
  const secret = process.env.JWT_SECRET || 'dev-secret-key'
  
  try {
    const payload = await verify(token!, secret, 'HS256')
    const userId = payload.sub as string
    
    // 1. Достаем всё, что прислал фронтенд
    const body = await c.req.json()
    console.log("📦 Фронтенд прислал в профиль:", body) // СМОТРИ ЭТО В ТЕРМИНАЛЕ!

    // 2. Пытаемся найти имя в разных полях (библиотеки бывают капризными)
    const name = body.name || body.firstName || '';
    const surname = body.surname || body.lastName || '';
    
    const fullName = `${name} ${surname}`.trim() || "User";

    // 3. Обновляем в базе
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { 
        name: fullName // Записываем в то самое поле, которое читает роут /me
      }
    })

    console.log("✅ Юзер в базе обновлен:", updatedUser.name)

    return c.json({ success: true, user: updatedUser })
  } catch (e) {
    console.error("❌ Ошибка обновления:", e)
    throw new HTTPException(401, { message: 'Ошибка авторизации' })
  }
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