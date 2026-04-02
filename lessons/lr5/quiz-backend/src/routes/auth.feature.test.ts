import { describe, it, expect } from 'vitest';
import { app } from '../index.js'; // Убедись, что путь к основному файлу Hono верный

describe('Feature: Auth API', () => {
  // Checkpoint 3: Security Negative Cases
  it('GET /api/auth/me должен вернуть 401 без токена', async () => {
    const res = await app.request('/api/auth/me');
    
    expect(res.status).toBe(401); // Ожидаем ошибку авторизации
  });

  it('GET /api/auth/me должен вернуть 500 с кривым токеном', async () => {
    const res = await app.request('/api/auth/me', {
      headers: {
        Authorization: 'Bearer invalid_token_123',
      },
    });
    
    expect(res.status).toBe(500); //
  });

  // Checkpoint 2: Базовый сценарий
  it('POST /api/auth/callback должен вернуть 400 при пустом payload', async () => {
    const res = await app.request('/api/auth/github/callback', {
      method: 'POST', // Возвращаем POST
      headers: {
        'Content-Type': 'application/json' // Обязательно говорим серверу, что шлем JSON
      },
      body: JSON.stringify({}), // Отправляем пустой объект, чтобы завалить валидацию Zod
    });
    
    expect(res.status).toBe(400); // Теперь сервер найдет роут и ответит 400
  });
});