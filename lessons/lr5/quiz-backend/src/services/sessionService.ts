import prisma from '../lib/prisma.js'
import { scoringService } from "./scoringService.js";


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
    return await prisma.$transaction(async (tx) => {
      const session = await tx.session.findUnique({
        where: { id: sessionId },
        include: { answers: true }
      });

      if (!session) throw new Error('Session not found');
      if (session.expiresAt < new Date()) throw new Error('Expired');

      const totalScore = session.answers
        .filter(a => a.score !== null)
        .reduce((sum, a) => sum + (a.score || 0), 0);

      return await tx.session.update({
        where: { id: sessionId },
        data: { status: 'completed', score: totalScore }
      });
    });
  }
}

export const sessionService = new SessionService();