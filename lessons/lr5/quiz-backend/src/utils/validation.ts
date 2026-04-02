import { z } from 'zod';

// Схема для авторизации через GitHub
export const authCallbackSchema = z.object({
  code: z.string().min(1, { message: "Code is required" }),
});

// Схема ответа (универсальная для тестов и эссе)
export const AnswerSchema = z.object({
  questionId: z.string().min(1, { message: "Question ID is required" }),
  userAnswer: z.union([
    z.array(z.string()), // Для multiple-select (массив строк)
    z.string()           // Для эссе (строка)
  ]),
  sessionId: z.string().min(1, { message: "Session ID is required" })
});

// Настройки правил начисления баллов
export const ScoringRulesSchema = z.object({
  pointsPerCorrect: z.number().min(0).max(10),
  pointsPerIncorrect: z.number().min(-5).max(0),
  minScore: z.number().min(0),
  maxScore: z.number().positive()
});

// Оценка эссе по критериям
export const GradeSchema = z.object({
  criterion: z.string().min(1, { message: "Criterion is required" }),
  points: z.number().min(0).max(10, { message: "Points must be between 0 and 10" }),
  feedback: z.string().optional()
});

// --- ГЛАВНОЕ ИСПРАВЛЕНИЕ: QuestionSchema ---
export const QuestionSchema = z.object({
  text: z.string().min(3, { message: "Текст вопроса слишком короткий" }), // Исправляет тест "too short"
  type: z.enum(['multiple-select', 'essay', 'test']), // Строго ограничиваем типы
  points: z.number()
    .min(1, { message: "Минимум 1 балл" })
    .max(100, { message: "Максимум 100 баллов" }), // ИСПРАВЛЯЕТ ТВОЙ ПАДАЮЩИЙ ТЕСТ
  categoryId: z.string().min(1, { message: "Category ID is required" }),
  options: z.array(z.string()).optional(),
  correctAnswer: z.any().optional(), // Позволяем хранить объект для фронтенда
}).refine((data) => {
  // Логика для тестов с выбором вариантов
  if (data.type === 'multiple-select' || data.type === 'test') {
    // 1. Проверяем наличие вариантов ответа
    const hasOptions = Array.isArray(data.options) && data.options.length > 0;
    // 2. Проверяем наличие правильного ответа (в любом формате: массив или объект)
    const hasCorrect = data.correctAnswer !== undefined && data.correctAnswer !== null;
    
    return hasOptions && hasCorrect;
  }
  return true;
}, {
  message: "Для этого типа вопроса необходимы варианты ответов (options) и правильный ответ",
  path: ["options"] 
});

// Валидация завершения сессии
export const SessionSubmitSchema = z.object({}).optional();