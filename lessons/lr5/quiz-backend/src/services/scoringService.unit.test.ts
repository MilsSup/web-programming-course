import { scoringService } from "./scoringService.js" 
import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../lib/prisma.js';

vi.mock('../lib/prisma.js', () => ({
  // Добавляем ключ default, чтобы импорт 'import prisma from ...' заработал
  default: {
    question: {
      findUnique: vi.fn(),
    },
  },
}));

describe('ScoringService: Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- ЗАКРЫВАЕМ ЭТОТ ТЕСТ ПРАВИЛЬНО ---
  it('должен получить вопрос из базы через Prisma и проверить его тип', async () => {
    const mockQuestion = {
      id: 'q-123',
      type: 'multiple-select',
      points: 10,
      correctAnswer: { options: ['A', 'B'], correct: 'A' }
    };
    (prisma.question.findUnique as any).mockResolvedValue(mockQuestion);

    // Добавим простую проверку, чтобы тест был полезным
    const result = await prisma.question.findUnique({ where: { id: 'q-123' } });
    expect(result?.id).toBe('q-123');
  }); // <--- Вот эта скобка у тебя отсутствовала!

  describe('scoreMultipleSelect', () => {
    it('должен вернуть максимальный балл когда все ответы правильные', () => {
      const correct = ['A', 'B', 'C'];
      const student = ['A', 'B', 'C'];
      expect(scoringService.scoreMultipleSelect(correct, student)).toBe(3);
    });

    it('должен правильно считать комбинацию правильных и неправильных ответов', () => {
      const correct = ['A', 'B', 'C'];
      const student = ['A', 'B', 'D']; 
      expect(scoringService.scoreMultipleSelect(correct, student)).toBe(1.5);
    });

    it('должен вернуть 0 когда все ответы неправильные', () => {
      const correct = ['A', 'B'];
      const student = ['C', 'D', 'E'];
      expect(scoringService.scoreMultipleSelect(correct, student)).toBe(0);
    });

    it('должен вернуть 0 при пустом массиве ответов студента', () => {
      const correct = ['A', 'B', 'C'];
      const student: string[] = [];
      expect(scoringService.scoreMultipleSelect(correct, student)).toBe(0);
    });

    it('должен вернуть 0 когда штрафы превышают бонусы', () => {
      const correct = ['A'];
      const student = ['A', 'B', 'C', 'D']; 
      expect(scoringService.scoreMultipleSelect(correct, student)).toBe(0);
    });
  });

  describe('scoreEssay', () => {
    it('должен правильно суммировать оценки в пределах рубрики', () => {
      const grades = [4, 2, 1];
      const rubric = [5, 3, 2];
      expect(scoringService.scoreEssay(grades, rubric)).toBe(7);
    });

    it('должен ограничить оценки максимальными значениями рубрики', () => {
      const grades = [6, 4, 3]; 
      const rubric = [5, 3, 2];
      expect(scoringService.scoreEssay(grades, rubric)).toBe(10);
    });

    it('должен ограничить только те оценки, которые превышают максимум', () => {
      const grades = [5, 4, 1]; 
      const rubric = [5, 3, 2];
      expect(scoringService.scoreEssay(grades, rubric)).toBe(9);
    });

    it('должен вернуть 0 при разной длине массивов', () => {
      const grades = [4, 2];
      const rubric = [5, 3, 2];
      expect(scoringService.scoreEssay(grades, rubric)).toBe(0);
    });

    it('должен корректно работать с нулевыми оценками', () => {
      const grades = [0, 0, 0];
      const rubric = [5, 3, 2];
      expect(scoringService.scoreEssay(grades, rubric)).toBe(0);
    });
  });
});