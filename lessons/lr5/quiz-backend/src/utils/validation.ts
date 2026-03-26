import { z } from 'zod';

export const authCallbackSchema = z.object({
  code: z.string().min(1),
});

// Answer validation
export const AnswerSchema = z.object({
  questionId: z.string().uuid({ message: "Invalid question ID format" }),
  userAnswer: z.union([
    z.array(z.string()),  // multiple-select
    z.string()             // essay
  ]),
  sessionId: z.string().uuid({ message: "Invalid session ID format" })
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
  categoryId: z.string().uuid({ message: "Invalid category ID format" }),
  correctAnswer: z.union([
    z.array(z.string()),  // for multiple-select
    z.string()             // for essay
  ]).optional(),
}).refine((data) => {
  // If type is multiple-select, correctAnswer should be an array and options should be provided
  if (data.type === 'multiple-select') {
    return Array.isArray(data.correctAnswer) && data.correctAnswer.length > 0;
  }
  // If type is essay, correctAnswer should be a string (optional for essay)
  return true;
}, {
  message: "Multiple-select questions require correctAnswer as array and options array",
  path: ["correctAnswer"]
});

// Session submission validation (optional body if needed)
export const SessionSubmitSchema = z.object({}).optional();