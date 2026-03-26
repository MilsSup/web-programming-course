import prisma from '../lib/prisma.js'
import { scoringService } from "./scoringService.js";
import { Prisma } from '@prisma/client';


export class SessionService {
  async submitAnswer(
    sessionId: string,
    questionId: string,
    userAnswer: string | string[]
  ) {
    const question = await prisma.question.findUnique({
      where: { id: questionId }
    });

    if (!question) throw new Error('Question not found');

    let score: number | null = null;

    if (question.type === 'multiple-select') {
      score = scoringService.scoreMultipleSelect(
        question.correctAnswer as string[],
        userAnswer as string[]
      );
    }

    return await prisma.answer.create({
      data: {
        sessionId,
        questionId,
        userAnswer: JSON.stringify(userAnswer),
        score
      }
    });
  }

  async submitSession(sessionId: string) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const session = await tx.session.findUnique({
        where: { id: sessionId },
        include: { answers: true }
      });

      if (!session) throw new Error('Session not found');
      if (session.expiresAt < new Date()) throw new Error('Expired');

      const totalScore = session.answers
      // 1. Добавляем : any (или тип из Prisma) перед Type Guard
      .filter((a: any): a is { score: number } => a.score !== null)
      // 2. В reduce тоже указываем типы для аккумулятора и текущего элемента
      .reduce((sum: number, a: { score: number }) => sum + a.score, 0);

      return await tx.session.update({
        where: { id: sessionId },
        data: { status: 'completed', score: totalScore }
      });
    });
  }
}

export const sessionService = new SessionService();