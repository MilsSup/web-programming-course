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

    let score: number = 0; // По умолчанию 0, чтобы избавиться от null
    let isCorrect: boolean = false;
    let feedback: string = "Ответ не проверен";

    // Проверяем: если у вопроса вообще есть правильный ответ в базе, начинаем считать
    // ... начало метода submitAnswer ...
    // Проверяем: если у вопроса вообще есть правильный ответ в базе, начинаем считать
    if (question.correctAnswer) {
      
      let correctArr: string[] = [];
      
      try {
        // Prisma может отдать Json как строку или уже как готовый объект
        const parsed = typeof question.correctAnswer === 'string' 
          ? JSON.parse(question.correctAnswer) 
          : question.correctAnswer;

        // 1. Сценарий: Если препод сохранил как объект { options: [...], correct: "a" }
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          // @ts-ignore - игнорируем ругань TS на неизвестные поля
          if (parsed.correct) {
            // @ts-ignore
            correctArr = Array.isArray(parsed.correct) ? parsed.correct : [String(parsed.correct)];
          }
        } 
        // 2. Сценарий: Если это обычный массив ["a"] (как мы и ожидали изначально)
        else if (Array.isArray(parsed)) {
          correctArr = parsed.map(String);
        }
      } catch (e) {
        console.error("Ошибка парсинга correctAnswer:", e);
      }
        
      const userArr = Array.isArray(userAnswer) ? userAnswer : [userAnswer];

      // Считаем баллы
      score = scoringService.scoreMultipleSelect(correctArr, userArr);
      
      isCorrect = score > 0;
      feedback = isCorrect ? "Отличная работа! Ответ верный." : "К сожалению, в ответе есть ошибка.";
    }

    return await prisma.answer.create({
      data: {
        sessionId,
        questionId,
        userAnswer, 
        score,
        isCorrect,
        feedback
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
      .reduce((sum, a) => sum + (a.score ?? 0), 0);

      return await tx.session.update({
        where: { id: sessionId },
        data: { status: 'completed', score: totalScore }
      });
    });
  }
}

export const sessionService = new SessionService();