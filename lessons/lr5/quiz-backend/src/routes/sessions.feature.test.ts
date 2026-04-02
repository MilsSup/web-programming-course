import { describe, it, expect } from 'vitest';
import { app } from '../index.js';

describe('Feature: Sessions API', () => {
  // Checkpoint 3: Security & Roles
  it('POST /api/sessions должен запретить создание сессии без авторизации', async () => {
    const res = await app.request('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ categoryId: 'some-cat-id' }),
      headers: { 'Content-Type': 'application/json' },
    });
    
    expect(res.status).toBe(401); //
  });

  // Checkpoint 2: Проверка логики ответов
  it('POST /api/sessions/:id/answers должен вернуть 400 при невалидном ответе', async () => {
    // Имитируем запрос к существующей (якобы) сессии с плохими данными
    const res = await app.request('/api/sessions/cmh.../answers', {
      method: 'POST',
      body: JSON.stringify({
        questionId: '', // Пустой ID завалит Zod-схему AnswerSchema
        userAnswer: []
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    
    expect(res.status).toBe(400); //
  });

  // Checkpoint 3: Authorization (Admin endpoints)
  it('GET /api/admin/questions должен вернуть 403 для обычного студента', async () => {
    // В реальном тесте здесь нужно передать токен пользователя с ролью STUDENT
    const res = await app.request('/api/admin/questions', {
      headers: {
        Authorization: 'Bearer student_token_here',
      },
    });
    
    expect(res.status).toBe(403); //
  });
});