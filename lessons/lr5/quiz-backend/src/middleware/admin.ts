import type { Context, Next } from 'hono';
import { verify } from 'hono/jwt';
import prisma from '../lib/prisma.js'
import { HTTPException } from 'hono/http-exception';

export const adminAuth = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  
  // 1. Проверка заголовка (Checkpoint 4: Security)
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET || 'dev-secret-key';
  
  // 2. Верификация токена (выбросит ошибку сам, если токен невалиден)
  // Наш глобальный обработчик в index.ts превратит это в красивый JSON 401
  const payload = await verify(token, secret, 'HS256');
  
  // 3. Поиск пользователя в БД
  const user = await prisma.user.findUnique({
    where: { id: payload.sub as string }
  });
  
  if (!user) {
    throw new HTTPException(404, { message: 'User not found' });
  }
  
  // 4. Проверка прав доступа (Checkpoint 4: RBAC)
  if (user.role !== 'admin') {
    throw new HTTPException(403, { message: 'Forbidden: Admin access required' });
  }
  
  // 5. Передаем пользователя дальше по цепочке
  // Теперь в любом админском роуте можно достать юзера через c.get('user')
  c.set('user', user);
  
  await next();
};