import { z } from 'zod';

export const authCallbackSchema = z.object({
  code: z.string().min(1),
});

// Answer validation
export const AnswerSchema = z.object({
  questionId: z.string().min(1, { message: "Question ID is required" }),
  userAnswer: z.union([
    z.array(z.string()),  // multiple-select
    z.string()             // essay
  ]),
  sessionId: z.string().min(1, { message: "Session ID is required" })
});

// Scoring rules validation
export const ScoringRulesSchema = z.object({
  pointsPerCorrect: z.number().min(0).max(10),
  pointsPerIncorrect: z.number().min(-5).max(0),
  minScore: z.number().min(0),
  maxScore: z.number().positive()
});

// Grade validation (for essay)
export const GradeSchema = z.object({
  criterion: z.string().min(1, { message: "Criterion is required" }),
  points: z.number().min(0).max(10, { message: "Points must be between 0 and 10" }),
  feedback: z.string().optional()
});

// Question validation (for creating questions)
export const QuestionSchema = z.object({
  text: z.string().min(3, { message: "Question text must be at least 3 characters" }),
  type: z.enum(['multiple-select', 'essay'], { 
    message: "Question type must be either 'multiple-select' or 'essay'" 
  }),
  points: z.number().min(1).max(100, { message: "Points must be between 1 and 100" }),
  options: z.array(z.string()).min(2, "Минимум 2 варианта ответа").optional(),
  categoryId: z.string().min(1, { message: "Category ID is required" }),
  correctAnswer: z.any().optional(),
}).refine((data) => {
  if (data.type === 'multiple-select') {
    // Проверяем, что ответ вообще есть (неважно, массив это или объект)
    return data.correctAnswer !== undefined && data.correctAnswer !== null;
  }
  return true;
}, {
  message: "Для этого типа вопроса необходим правильный ответ",
  path: ["correctAnswer"]
});

// Session submission validation (optional body if needed)
export const SessionSubmitSchema = z.object({}).optional();