import type { Context, Next } from 'hono';
import { verify } from 'hono/jwt';
import prisma from '../lib/prisma.js'


export const adminAuth = async (c: Context, next: Next) => {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ 
        success: false,
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header'
      }, 401);
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'dev-secret-key';
    
    const payload = await verify(token, secret, 'HS256');
    
    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string }
    });
    
    if (!user) {
      return c.json({ 
        success: false,
        error: 'User not found'
      }, 404);
    }
    
    // Проверяем, является ли пользователь администратором
    if (user.role !== 'admin') {
      return c.json({ 
        success: false,
        error: 'Forbidden',
        message: 'Admin access required'
      }, 403);
    }
    
    // Добавляем пользователя в контекст для использования в роутах
    c.set('user', user);
    
    await next();
  } catch (error) {
    return c.json({ 
      success: false,
      error: 'Unauthorized',
      message: 'Invalid token'
    }, 401);
  }
};