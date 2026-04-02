import { describe, it, expect } from 'vitest';
import { app } from '../index.js'; // Убедись, что путь к основному файлу Hono верный

describe('Feature: Auth API', () => {
  // Checkpoint 3: Security Negative Cases
  it('GET /api/auth/me должен вернуть 401 без токена', async () => {
    const res = await app.request('/api/auth/me');
    
    expect(res.status).toBe(401); // Ожидаем ошибку авторизации
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('GET /api/auth/me должен вернуть 401 с кривым токеном', async () => {
    const res = await app.request('/api/auth/me', {
      headers: {
        Authorization: 'Bearer invalid_token_123',
      },
    });
    
    expect(res.status).toBe(401); //
  });

  // Checkpoint 2: Базовый сценарий
  it('POST /api/auth/callback должен вернуть 400 при пустом payload', async () => {
    const res = await app.request('/api/auth/callback', {
      method: 'POST',
      body: JSON.stringify({}), // Пустой объект нарушает схему Zod
      headers: { 'Content-Type': 'application/json' },
    });
    
    expect(res.status).toBe(400); // Ошибка валидации
  });
});