import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import prisma from '../lib/prisma.js'
import { adminAuth } from '../middleware/admin.js';
import { QuestionSchema, GradeSchema } from '../utils/validation.js';
import { HTTPException } from 'hono/http-exception';

type Variables = { user: any };
const admin = new Hono<{ Variables: Variables }>();

// Применяем middleware ко всем admin роутам
admin.use('*', adminAuth);

// GET /api/admin/questions - Получить все вопросы с информацией (с пагинацией)
admin.get('/questions', async (c: Context) => {
  // 1. Параметры пагинации (Checkpoint 6: Pagination)
  const page = Number(c.req.query('page')) || 1;
  const limit = Number(c.req.query('limit')) || 20;
  const skip = (page - 1) * limit;
  
  // 2. Получаем данные (Prisma сама выбросит ошибку, если что-то не так, и её поймает index.ts)
  const [totalCount, questions] = await Promise.all([
    prisma.question.count(),
    prisma.question.findMany({
      select: {
        id: true,
        text: true,
        type: true,
        points: true,
        correctAnswer: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: { id: true, name: true, slug: true }
        },
        _count: {
          select: { answers: true }
        },
        answers: {
          select: { score: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    })
  ]);

  // 3. Форматируем ответ (Логика остается прежней)
  const formattedQuestions = questions.map((question: any) => {
    const totalAnswers = question.answers.length;

    const answeredCount = question.answers.filter((a: any) => a.score !== null).length;

    const averageScore = totalAnswers > 0
      ? question.answers.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / totalAnswers
      : 0;

    return {
      id: question.id,
      text: question.text,
      type: question.type,
      points: question.points,
      category: question.category,
      correctAnswer: question.correctAnswer, // Prisma вернет объект, парсить не нужно
      totalAnswers: question._count.answers,
      stats: {
        answeredCount,
        averageScore: Number(averageScore.toFixed(2)),
        completionRate: totalAnswers > 0 
          ? Number(((answeredCount / totalAnswers) * 100).toFixed(2))
          : 0
      },
      createdAt: question.createdAt,
      updatedAt: question.updatedAt
    };
  });

  // 4. Возвращаем результат с мета-данными пагинации
  return c.json({
    success: true,
    questions: formattedQuestions,
    pagination: {
      page,
      limit,
      total: totalCount,
      pages: Math.ceil(totalCount / limit)
    }
  });
});

// POST /api/admin/questions - Создать новый вопрос
admin.post('/questions', async (c: Context) => {
  // 1. Парсим тело напрямую
  const body = await c.req.json();
  
  // 2. Валидируем данные (Zod)
  const validationResult = QuestionSchema.safeParse(body);
  if (!validationResult.success) {
    return c.json({
      success: false,
      error: 'Validation failed',
      details: validationResult.error.issues
    }, 400);
  }

  const { text, type, points, categoryId, correctAnswer } = validationResult.data;

  const category = await prisma.category.findUnique({
    where: { id: categoryId }
  });

  if (!category) {
    return c.json({
      success: false,
      error: 'Category not found',
      message: 'Category with provided ID does not exist'
    }, 404);
  }

  // 4. Создаем вопрос (Prisma сама понимает тип Json, stringify не обязателен)
  const question = await prisma.question.create({
    data: {
      text,
      type,
      points,
      categoryId,
      correctAnswer // Если в схеме это Json, можно передавать объект напрямую
    },
    include: {
      category: {
        select: { id: true, name: true, slug: true }
      }
    }
  });

  // 5. Возвращаем результат
  return c.json({
    success: true,
    question
  }, 201);
});

// PUT /api/admin/questions/:id - Обновить вопрос
admin.put('/questions/:id', async (c: Context) => {
  const { id } = c.req.param();
  const body = await c.req.json();

  // 1. Валидация (используем .partial(), чтобы можно было обновлять только нужные поля)
  const validationResult = QuestionSchema.partial().safeParse(body);
  
  if (!validationResult.success) {
    return c.json({
      success: false,
      error: 'Validation failed',
      details: validationResult.error.issues
    }, 400);
  }

  // 2. Проверка существования вопроса через HTTPException
  const existingQuestion = await prisma.question.findUnique({
    where: { id }
  });

  if (!existingQuestion) {
    throw new HTTPException(404, { message: 'Question not found' });
  }

  // 3. Если в теле есть categoryId, проверяем существование категории
  if (validationResult.data.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: validationResult.data.categoryId }
    });

    if (!category) {
      throw new HTTPException(404, { message: 'Category not found' });
    }
  }

  // 4. Обновление вопроса
  // Мы можем передать validationResult.data напрямую в Prisma.
  // Prisma проигнорирует поля со значением undefined и обновит только присланные данные.
  const updatedQuestion = await prisma.question.update({
    where: { id },
    data: validationResult.data,
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    }
  });

  // 5. Возврат результата (Prisma сама вернет объект для поля Json)
  return c.json({
    success: true,
    question: updatedQuestion
  });
});

/// GET /api/admin/answers/pending - Получить непроверенные essay ответы (с пагинацией)
admin.get('/answers/pending', async (c: Context) => {
  // 1. Параметры пагинации (Checkpoint 6: Pagination)
  const page = Number(c.req.query('page')) || 1;
  const limit = Number(c.req.query('limit')) || 20;
  const skip = (page - 1) * limit;
  
  // 2. Параллельный запрос данных (ускоряет ответ сервера)
  const [totalCount, pendingAnswers] = await Promise.all([
    prisma.answer.count({
      where: {
        score: null,
        question: { type: 'essay' }
      }
    }),
    prisma.answer.findMany({
      where: {
        score: null,
        question: { type: 'essay' }
      },
      select: {
        id: true,
        userAnswer: true,
        createdAt: true,
        session: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            user: { select: { id: true, name: true, email: true } }
          }
        },
        question: {
          select: { id: true, text: true, points: true, correctAnswer: true }
        }
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit
    })
  ]);

  // 3. Форматирование ответа (убираем лишние парсинги)
  const formattedAnswers = pendingAnswers.map((answer: any) => ({
    id: answer.id,
    // Prisma автоматически возвращает Json как объект, JSON.parse больше не нужен
    userAnswer: answer.userAnswer, 
    session: answer.session,
    question: answer.question,
    submittedAt: answer.createdAt
  }));

  // 4. Возвращаем результат (ошибки перехватит app.onError в index.ts)
  return c.json({
    success: true,
    pendingAnswers: formattedAnswers,
    pagination: {
      page,
      limit,
      total: totalCount,
      pages: Math.ceil(totalCount / limit)
    }
  });
});

// POST /api/admin/answers/:id/grade - Выставить оценку за essay
admin.post('/answers/:id/grade', async (c: Context) => {
  const { id } = c.req.param();
  const body = await c.req.json();

  // 1. Валидация входных данных через Zod
  const validationResult = GradeSchema.safeParse(body);
  if (!validationResult.success) {
    return c.json({
      success: false,
      error: 'Validation failed',
      details: validationResult.error.issues
    }, 400);
  }

  const { points } = validationResult.data;

  // 2. Транзакция: обновляем ответ и пересчитываем сессию
  // Если внутри транзакции случится ошибка, index.ts поймает её и вернет 500
  const result = await prisma.$transaction(async (tx: any) => {
    const answer = await tx.answer.findUnique({
      where: { id },
      include: { 
        session: true,
        question: true 
      }
    });

    // Вместо сложного catch используем HTTPException
    if (!answer) {
      throw new HTTPException(404, { message: 'Answer not found' });
    }
    if (answer.score !== null) {
      throw new HTTPException(400, { message: 'Answer already graded' });
    }
    if (answer.question.type !== 'essay') {
      throw new HTTPException(400, { message: 'Can only grade essay answers' });
    }

    // Обновляем баллы за конкретный ответ
    const updatedAnswer = await tx.answer.update({
      where: { id },
      data: { score: points }
    });

    // Проверяем все essay-ответы в этой сессии
    const sessionAnswers = await tx.answer.findMany({
      where: {
        sessionId: answer.sessionId,
        question: { type: 'essay' }
      }
    });

    const allEssaysGraded = sessionAnswers.every((a: any) => a.score !== null);

    // Если всё проверено, обновляем статус и финальный счет сессии
    if (allEssaysGraded) {
      const allSessionAnswers = await tx.answer.findMany({
        where: { sessionId: answer.sessionId }
      });

      const totalScore = allSessionAnswers.reduce((sum: number, a: any) => sum + (a.score || 0), 0);

      await tx.session.update({
        where: { id: answer.sessionId },
        data: { 
          score: totalScore,
          status: 'completed',
          completedAt: new Date()
        }
      });
    }

    return updatedAnswer;
  });

  return c.json({
    success: true,
    message: 'Answer graded successfully',
    answer: {
      id: result.id,
      score: result.score,
      gradedAt: result.updatedAt
    }
  });
});

// GET /api/admin/students - Получить список студентов (с пагинацией)
admin.get('/students', async (c: Context) => {
  // 1. Извлекаем параметры запроса
  const page = Number(c.req.query('page')) || 1;
  const limit = Number(c.req.query('limit')) || 20;
  const skip = (page - 1) * limit;
  const search = c.req.query('search') || '';
  
  // 2. Формируем фильтр (Checkpoint 6: Optimization)
  const where = search ? {
    OR: [
      { email: { contains: search } },
      { name: { contains: search } }
    ]
  } : {};
  
  // 3. Параллельное выполнение запросов (ускоряет ответ)
  const [totalCount, students] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        githubId: true,
        role: true,
        createdAt: true,
        // Агрегация на уровне БД (Checkpoint 6)
        _count: {
          select: {
            sessions: { where: { status: 'completed' } }
          }
        },
        // Загружаем только баллы завершенных сессий для расчета среднего
        sessions: {
          where: { status: 'completed' },
          select: { score: true }
          // Убрал take: 1, чтобы средний балл считался по всем сессиям, а не по одной
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    })
  ]);

  // 4. Форматируем статистику (Бизнес-логика)
  const formattedStudents = students.map((student: any) => {
    const scores = student.sessions
      .map((s: any) => s.score || 0) // Указываем : any для сессии
      .filter((s: number) => s > 0);   // Указываем : number, так как после map это массив чисел
  
    const averageScore = scores.length > 0
      // Указываем : number для аккумулятора и текущего значения
      ? scores.reduce((sum: number, s: number) => sum + s, 0) / scores.length
      : 0;

    return {
      id: student.id,
      email: student.email,
      name: student.name,
      githubId: student.githubId,
      role: student.role,
      createdAt: student.createdAt,
      stats: {
        totalSessions: student._count.sessions,
        averageScore: Number(averageScore.toFixed(2))
      }
    };
  });

  // 5. Возвращаем результат (ошибки перехватит app.onError в index.ts)
  return c.json({
    success: true,
    students: formattedStudents,
    pagination: {
      page,
      limit,
      total: totalCount,
      pages: Math.ceil(totalCount / limit)
    }
  });
});

// POST /api/admin/questions/batch - Создать несколько вопросов за раз
admin.post('/questions/batch', async (c: Context) => {
  // 1. Получаем данные (типизируем для удобства)
  const body = await c.req.json() as { questions: any[] };
  
  if (!Array.isArray(body.questions)) {
    throw new HTTPException(400, { message: 'Expected array of questions' });
  }

  // 2. Валидируем все вопросы через Zod
  const validationResults = body.questions.map((q) => QuestionSchema.safeParse(q));
  
  const errors = validationResults
    .map((result, index) => (!result.success ? { index, errors: result.error.issues } : null))
    .filter(Boolean);
  
  if (errors.length > 0) {
    return c.json({ success: false, error: 'Validation failed', details: errors }, 400);
  }

  // 3. Проверяем категории (бизнес-логика)
  const validData = validationResults.map(r => r.data!);
  const categoryIds = [...new Set(validData.map(q => q.categoryId))];
  
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true }
  });
  
  const foundCategoryIds = new Set(categories.map((cat: { id: string }) => cat.id));
  const missingCategories = categoryIds.filter((id: string) => !foundCategoryIds.has(id));
  
  if (missingCategories.length > 0) {
    throw new HTTPException(404, { 
      message: `Categories not found: ${missingCategories.join(', ')}` 
    });
  }

  // 4. Подготавливаем данные (упрощаем обработку JSON)
  const questionsData = validData.map((q) => ({
    text: q.text,
    type: q.type,
    points: q.points,
    categoryId: q.categoryId,
    // Prisma сама съест объект/массив для поля Json, stringify не нужен
    correctAnswer: q.correctAnswer ?? null 
  }));

  // 5. Массовая вставка (Checkpoint 6: Performance)
  const result = await prisma.question.createMany({
    data: questionsData,
  });

  return c.json({
    success: true,
    message: `Successfully created ${result.count} questions`,
    count: result.count
  }, 201);
});

export default admin;