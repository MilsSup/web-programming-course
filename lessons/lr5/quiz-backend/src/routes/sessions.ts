import { Context, Hono } from 'hono';
import { z } from 'zod';
import { verify } from 'hono/jwt';
import prisma from '../lib/prisma.js'
import { AnswerSchema, SessionSubmitSchema } from '../utils/validation.js';
import { sessionService } from '../services/sessionService.js';
import { HTTPException } from 'hono/http-exception'

const sessions = new Hono();

// Схема для создания сессии
const createSessionSchema = z.object({
  categoryId: z.string(),
  questionCount: z.number().min(1).max(50).optional().default(10)
});

// Получение пользователя из токена
export const getUserFromToken = async (c: Context) => {
  const authHeader = c.req.header('Authorization');
  
  // 1. Проверка наличия заголовка
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET || 'dev-secret-key';
  
  // 2. Верификация токена
  // Мы не оборачиваем это в try-catch здесь, так как если токен битый, 
  // verify выбросит ошибку, а наш глобальный обработчик превратит её в 401.
  const payload = await verify(token, secret, 'HS256');
  
  // 3. Поиск пользователя в базе
  const user = await prisma.user.findUnique({
    where: { id: payload.sub as string }
  });
  
  if (!user) {
    throw new HTTPException(404, { message: 'User not found' });
  }
  
  return user;
};

// POST /api/sessions
sessions.post('/', async (c) => {
  // 1. Аутентификация через обновленный хелпер (выкинет 401/404 сам)
  const user = await getUserFromToken(c);

  const body = await c.req.json();
  
  // 2. Валидация через Zod
  const validationResult = createSessionSchema.safeParse(body);
  if (!validationResult.success) {
    throw new HTTPException(400, { message: 'Validation failed' });
  }
  
  const { categoryId, questionCount } = validationResult.data;
  
  // 3. Проверка наличия вопросов (Checkpoint 6)
  const totalInCategory = await prisma.question.count({
    where: { categoryId }
  });
  
  if (totalInCategory === 0) {
    throw new HTTPException(404, { message: 'No questions found in this category' });
  }
  
  const actualCount = Math.min(questionCount, totalInCategory);
  
  // 4. Получение действительно случайных вопросов (Checkpoint 6: Optimization)
  // Чтобы вопросы были разными каждый раз, используем orderBy с рандомом (зависит от БД)
  // Для SQLite/PostgreSQL самый простой способ - через необработанный запрос или логику пропусков (skip)
  const questions = await prisma.question.findMany({
    where: { categoryId },
    take: actualCount,
    // Примечание: для полноценного рандома в Prisma часто используют 
    // получение всех ID и выборку случайных, либо raw query 'ORDER BY RANDOM()'
    orderBy: { createdAt: 'desc' },
    include: { answers: true }
  });
  
  // 5. Создание сессии
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);
  
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      expiresAt,
      status: 'in_progress',
      score: 0,
      startedAt: new Date(),
    }
  });
  
  return c.json({ 
    success: true,
    session: {
      id: session.id,
      status: session.status,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
      totalQuestions: actualCount,
      score: session.score,
      questions: questions.map((q: any) => {
        // 1. Сначала объявляем переменную
        const answerData = q.correctAnswer as any; 
        
        // 2. Потом возвращаем объект
        return {
          id: q.id,
          text: q.text,
          title: q.text, 
          type: q.type,
          points: q.points,
          label: q.text,
          // Теперь answerData доступен!
          options: (answerData && answerData.options) ? answerData.options : []
        };
      
      })
    }
  }, 201);
});

// POST /api/sessions/:id/answers
sessions.post('/:id/answers', async (c) => {
  const { id: sessionId } = c.req.param();
  
  // 1. Проверяем пользователя (выбросит 401/404 автоматически)
  const user = await getUserFromToken(c);
  
  // 2. Проверяем владение сессией (Checkpoint 4: Security)
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { userId: true }
  });
  
  if (!session) {
    throw new HTTPException(404, { message: 'Session not found' });
  }
  
  if (session.userId !== user.id) {
    throw new HTTPException(403, { message: 'Forbidden: You do not have access to this session' });
  }

  // 3. Валидация входных данных
  const body = await c.req.json();
  const validation = AnswerSchema.safeParse(body);
  
  if (!validation.success) {
    throw new HTTPException(400, { message: 'Validation failed' });
  }

  const { questionId, userAnswer } = validation.data;

  // 4. Бизнес-логика в сервисе (обрабатываем специфические ошибки)
  try {
    const answer = await sessionService.submitAnswer(sessionId, questionId, userAnswer);
    
    return c.json({ 
      success: true,
      answer: {
        id: answer.id,
        questionId: answer.questionId,
        userAnswer: answer.userAnswer,
        isCorrect: answer.isCorrect,
        score: answer.score,
        createdAt: answer.createdAt
      }
    }, 201);
  } catch (error) {
    // Если сервис выбросил понятную ошибку, превращаем её в 400 Bad Request
    if (error instanceof Error) {
      const msg = error.message;
      const badRequestErrors = [
        'Session has expired', 
        'Session already completed', 
        'Question not found in this session'
      ];
      
      if (badRequestErrors.includes(msg)) {
        throw new HTTPException(400, { message: msg });
      }
    }
    // Всё остальное (500) поймает глобальный обработчик
    throw error;
  }
});

sessions.get('/:id', async (c) => {
  const { id } = c.req.param();
  
  // 1. Аутентификация (автоматически выбросит 401/404 при проблемах)
  const user = await getUserFromToken(c);
  
  // 2. Загрузка сессии с вложенными ответами и вопросами
  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      answers: {
        include: { question: true },
        orderBy: { createdAt: 'asc' }
      }
    }
  });
  
  // 3. Авторизация (Checkpoint 4: Security)
  if (!session) {
    throw new HTTPException(404, { message: 'Session not found' });
  }
  
  if (session.userId !== user.id) {
    throw new HTTPException(403, { message: 'Forbidden: Access denied' });
  }
  
  // 4. Расчет статистики ответов (используем фильтр)
  const answeredCount = session.answers.filter((a: any) => 
    a.userAnswer !== null && 
    (Array.isArray(a.userAnswer) ? a.userAnswer.length > 0 : a.userAnswer !== '')
  ).length;

  // 5. Форматируем ответ
  return c.json({ 
    success: true,
    session: {
      id: session.id,
      status: session.status,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      expiresAt: session.expiresAt,
      score: session.score,
      totalQuestions: session.answers.length,
      answeredQuestions: answeredCount,
      answers: session.answers.map((answer: any) => ({
        id: answer.id,
        question: {
          id: answer.question.id,
          text: answer.question.text,
          type: answer.question.type,
          points: answer.question.points,
          // Скрываем правильный ответ, если сессия еще в процессе (Security)
          ...(session.status === 'completed' && { 
            correctAnswer: answer.question.correctAnswer 
          })
        },
        userAnswer: answer.userAnswer,
        isCorrect: answer.isCorrect,
        score: answer.score,
        createdAt: answer.createdAt
      }))
    }
  });
});

// POST /api/sessions/:id/submit
sessions.post('/:id/submit', async (c) => {
  const { id: sessionId } = c.req.param();
  
  // 1. Аутентификация (автоматически выбросит 401/404)
  const user = await getUserFromToken(c);
  
  // 2. Проверка существования и доступа (Checkpoint 4)
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { userId: true, status: true }
  });
  
  if (!session) {
    throw new HTTPException(404, { message: 'Session not found' });
  }
  
  if (session.userId !== user.id) {
    throw new HTTPException(403, { message: 'Forbidden: Access denied' });
  }
  
  if (session.status === 'completed') {
    throw new HTTPException(400, { message: 'Session already completed' });
  }

  // 3. Обработка тела запроса (опционально)
  const body = await c.req.json().catch(() => ({})); 
  const validation = SessionSubmitSchema.safeParse(body);
  
  if (!validation.success) {
    throw new HTTPException(400, { message: 'Validation failed' });
  }

  // 4. Финализация через сервис (Checkpoint 5: Transactions)
  try {
    const completedSession = await sessionService.submitSession(sessionId);
    
    // 5. Загружаем полные данные для итогового отчета
    const fullSession = await prisma.session.findUnique({
      where: { id: completedSession.id },
      include: {
        answers: { include: { question: true } }
      }
    });

    if (!fullSession) throw new Error('Internal error: Session lost');

    // 6. Формируем красивый ответ с итогами
    const answers = fullSession.answers;
    const stats = {
      total: answers.length,
      correct: answers.filter((a: any) => a.isCorrect === true).length,
      incorrect: answers.filter((a: any) => a.isCorrect === false).length,
      unanswered: answers.filter((a: any) => !a.userAnswer || (Array.isArray(a.userAnswer) && a.userAnswer.length === 0)).length
    };

    return c.json({ 
      success: true,
      session: {
        id: fullSession.id,
        status: fullSession.status,
        score: fullSession.score,
        startedAt: fullSession.startedAt,
        completedAt: fullSession.completedAt,
        summary: stats,
        answers: answers.map((a: any) => ({
          id: a.id,
          question: {
            text: a.question.text,
            type: a.question.type,
            correctAnswer: a.question.correctAnswer
          },
          userAnswer: a.userAnswer,
          isCorrect: a.isCorrect,
          score: a.score
        }))
      }
    });

  } catch (error: any) {
    // Перехватываем бизнес-ошибки из сервиса
    if (error.message === 'Session already completed') {
      throw new HTTPException(400, { message: error.message });
    }
    throw error; // Остальное уйдет в 500
  }
});

export default sessions;