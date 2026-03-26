import { Hono } from 'hono';
import { z } from 'zod';
import { verify } from 'hono/jwt';
import prisma from '../lib/prisma.js'
import { AnswerSchema, SessionSubmitSchema } from '../utils/validation.js';
import { sessionService } from '../services/sessionService.js';

const sessions = new Hono();

// Схема для создания сессии
const createSessionSchema = z.object({
  categoryId: z.string(),
  questionCount: z.number().min(1).max(50).optional().default(10)
});

// Получение пользователя из токена
const getUserFromToken = async (c: any) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized', message: 'Missing or invalid Authorization header' };
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET || 'dev-secret-key';
  
  try {
    const payload = await verify(token, secret, 'HS256');
    
    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string }
    });
    
    if (!user) {
      return { error: 'User not found', message: 'User not found' };
    }
    
    return { user };
  } catch (error) {
    return { error: 'Unauthorized', message: 'Invalid token' };
  }
};

// POST /api/sessions
sessions.post('/', async (c) => {
  try {
    // Проверяем аутентификацию
    const auth = await getUserFromToken(c);
    if (auth.error) {
      return c.json({ 
        success: false,
        error: auth.error,
        message: auth.message
      }, 401);
    }

    if (!auth.user) {
      return c.json({ 
        success: false,
        error: 'User not found',
        message: 'User not found'
      }, 401);
    }
    
    const body = await c.req.json();
    
    // Валидация входных данных
    const validationResult = createSessionSchema.safeParse(body);
    
    if (!validationResult.success) {
      return c.json({ 
        success: false,
        error: 'Validation failed',
        details: validationResult.error.issues  
      }, 400);
    }
    
    const { categoryId, questionCount } = validationResult.data;
    
    // Получаем количество вопросов в категории
    const questionsCount = await prisma.question.count({
      where: { categoryId }
    });
    
    if (questionsCount === 0) {
      return c.json({ 
        success: false,
        error: 'No questions found in this category' 
      }, 404);
    }
    
    // Определяем реальное количество вопросов (не больше, чем есть в категории)
    const actualQuestionCount = Math.min(questionCount, questionsCount);
    
    // Получаем случайные вопросы из категории
    const questions = await prisma.question.findMany({
      where: { categoryId },
      take: actualQuestionCount
    });
    
    // Создаем сессию с expiresAt (1 час от текущего времени)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    
    // Создаем сессию
    const session = await prisma.session.create({
      data: {
        userId: auth.user.id,
        expiresAt,
        status: 'in_progress',
        score: 0,
        startedAt: new Date(),
      }
    });
    
    // Возвращаем информацию о сессии
    return c.json({ 
      success: true,
      session: {
        id: session.id,
        status: session.status,
        startedAt: session.startedAt,
        expiresAt: session.expiresAt,
        totalQuestions: actualQuestionCount,
        answeredQuestions: 0,
        score: session.score,
        questions: questions.map(question => ({
          id: question.id,
          text: question.text,
          type: question.type,
          points: question.points,
        }))
      }
    }, 201);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        success: false,
        error: 'Validation failed',
        details: error.issues  
      }, 400);
    }
    
    console.error('Create session error:', error);
    return c.json({ 
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// POST /api/sessions/:id/answers
sessions.post('/:id/answers', async (c) => {
  try {
    const { id } = c.req.param();
    
    // Проверяем аутентификацию
    const auth = await getUserFromToken(c);
    if (auth.error) {
      return c.json({ 
        success: false,
        error: auth.error,
        message: auth.message
      }, 401);
    }
    
    // Проверяем, что сессия принадлежит пользователю
    const session = await prisma.session.findUnique({
      where: { id },
      select: { userId: true }
    });
    
    if (!session) {
      return c.json({ 
        success: false,
        error: 'Not Found',
        message: 'Session not found'
      }, 404);
    }
    
    if (session.userId !== auth.user!.id) {
      return c.json({ 
        success: false,
        error: 'Forbidden',
        message: 'You do not have access to this session'
      }, 403);
    }
    
    const body = await c.req.json();
    
    // Валидация входных данных
    const validationResult = AnswerSchema.safeParse(body);
    
    if (!validationResult.success) {
      return c.json({ 
        success: false,
        error: 'Validation failed',
        details: validationResult.error.issues  
      }, 400);
    }
    
    const { questionId, userAnswer } = validationResult.data;
    
    // Отправляем ответ через сервис
    const answer = await sessionService.submitAnswer(id, questionId, userAnswer);
    
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
    console.error('Submit answer error:', error);
    
    // Обрабатываем специфические ошибки
    if (error instanceof Error) {
      if (error.message === 'Session not found') {
        return c.json({ 
          success: false,
          error: 'Not Found',
          message: 'Session not found'
        }, 404);
      }
      
      if (error.message === 'Question not found in this session') {
        return c.json({ 
          success: false,
          error: 'Bad Request',
          message: 'Question not found in this session'
        }, 400);
      }
      
      if (error.message === 'Session has expired' || error.message === 'Session already completed') {
        return c.json({ 
          success: false,
          error: 'Bad Request',
          message: error.message
        }, 400);
      }
    }
    
    return c.json({ 
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// GET /api/sessions/:id
sessions.get('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    
    // Проверяем аутентификацию
    const auth = await getUserFromToken(c);
    if (auth.error) {
      return c.json({ 
        success: false,
        error: auth.error,
        message: auth.message
      }, 401);
    }
    
    // Загружаем сессию с ответами
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        answers: {
          include: {
            question: true
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });
    
    if (!session) {
      return c.json({ 
        success: false,
        error: 'Not Found',
        message: 'Session not found'
      }, 404);
    }
    
    // Проверяем авторизацию
    if (session.userId !== auth.user!.id) {
      return c.json({ 
        success: false,
        error: 'Forbidden',
        message: 'You do not have access to this session'
      }, 403);
    }
    
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
        answeredQuestions: session.answers.filter(a => 
          a.userAnswer !== null && 
          (Array.isArray(a.userAnswer) ? a.userAnswer.length > 0 : a.userAnswer !== '')
        ).length,
        answers: session.answers.map(answer => ({
          id: answer.id,
          question: {
            id: answer.question.id,
            text: answer.question.text,
            type: answer.question.type,
            points: answer.question.points,
            correctAnswer: answer.question.correctAnswer
          },
          userAnswer: answer.userAnswer,
          isCorrect: answer.isCorrect,
          score: answer.score,
          createdAt: answer.createdAt
        }))
      }
    });
    
  } catch (error) {
    console.error('Get session error:', error);
    return c.json({ 
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// POST /api/sessions/:id/submit
sessions.post('/:id/submit', async (c) => {
  try {
    const { id } = c.req.param();
    
    // Проверяем аутентификацию
    const auth = await getUserFromToken(c);
    if (auth.error) {
      return c.json({ 
        success: false,
        error: auth.error,
        message: auth.message
      }, 401);
    }
    
    // Проверяем, что сессия принадлежит пользователю
    const session = await prisma.session.findUnique({
      where: { id },
      select: { userId: true, status: true }
    });
    
    if (!session) {
      return c.json({ 
        success: false,
        error: 'Not Found',
        message: 'Session not found'
      }, 404);
    }
    
    if (session.userId !== auth.user!.id) {
      return c.json({ 
        success: false,
        error: 'Forbidden',
        message: 'You do not have access to this session'
      }, 403);
    }
    
    if (session.status === 'completed') {
      return c.json({ 
        success: false,
        error: 'Bad Request',
        message: 'Session already completed'
      }, 400);
    }
    
    // Пытаемся получить тело запроса (если есть)
    let body = {};
    try {
      body = await c.req.json();
    } catch {
      // Если тело не является JSON, игнорируем
    }
    
    // Валидация тела запроса (если есть)
    const validationResult = SessionSubmitSchema.safeParse(body);
    
    if (!validationResult.success) {
      return c.json({ 
        success: false,
        error: 'Validation failed',
        details: validationResult.error.issues
      }, 400);
    }
    
    // Отправляем сессию на завершение через сервис
    const completedSession = await sessionService.submitSession(id);
    
    // Загружаем полную информацию о завершенной сессии
    const fullSession = await prisma.session.findUnique({
      where: { id: completedSession.id },
      include: {
        answers: {
          include: {
            question: true
          }
        }
      }
    });
    
    if (!fullSession) {
      throw new Error('Completed session not found');
    }
    
    // Форматируем ответ
    return c.json({ 
      success: true,
      session: {
        id: fullSession.id,
        status: fullSession.status,
        startedAt: fullSession.startedAt,
        completedAt: fullSession.completedAt,
        score: fullSession.score,
        totalQuestions: fullSession.answers.length,
        answeredQuestions: fullSession.answers.filter(a => 
          a.userAnswer !== null && 
          (Array.isArray(a.userAnswer) ? a.userAnswer.length > 0 : a.userAnswer !== '')
        ).length,
        summary: {
          totalScore: fullSession.score,
          correctAnswers: fullSession.answers.filter(a => a.isCorrect === true).length,
          incorrectAnswers: fullSession.answers.filter(a => a.isCorrect === false).length,
          unanswered: fullSession.answers.filter(a => 
            a.userAnswer === null || 
            (Array.isArray(a.userAnswer) && a.userAnswer.length === 0) ||
            a.userAnswer === ''
          ).length
        },
        answers: fullSession.answers.map(answer => ({
          id: answer.id,
          question: {
            id: answer.question.id,
            text: answer.question.text,
            type: answer.question.type,
            points: answer.question.points,
            correctAnswer: answer.question.correctAnswer
          },
          userAnswer: answer.userAnswer,
          isCorrect: answer.isCorrect,
          score: answer.score
        }))
      }
    });
    
  } catch (error) {
    console.error('Submit session error:', error);
    
    // Обрабатываем специфические ошибки
    if (error instanceof Error) {
      if (error.message === 'Session not found') {
        return c.json({ 
          success: false,
          error: 'Not Found',
          message: 'Session not found'
        }, 404);
      }
      
      if (error.message === 'Session already completed') {
        return c.json({ 
          success: false,
          error: 'Bad Request',
          message: 'Session already completed'
        }, 400);
      }
    }
    
    return c.json({ 
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default sessions;