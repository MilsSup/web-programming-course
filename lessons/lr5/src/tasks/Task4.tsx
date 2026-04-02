import { observer } from 'mobx-react-lite';
import { gameStore } from '../stores/gameStore';
import { useUIStore } from '../stores/uiStore';
import { usePostApiSessions } from '../../generated/api/sessions/sessions';
import { usePostApiSessionsSessionIdAnswers } from '../../generated/api/sessions/sessions';
import { usePostApiSessionsSessionIdSubmit } from '../../generated/api/sessions/sessions';
import * as React from 'react'
import { StartScreen } from './StartScreen';
import { FinishScreen } from './FinishScreen';
import { GameScreen } from './Game';
import { useState } from 'react';
import { runInAction } from 'mobx';

/**
 * Task 4: Комбинированное использование MobX + Zustand
 */
const Task4 = observer(() => {
  // 1. РАСКОММЕНТИРУЕМ MOBX-ПЕРЕМЕННЫЕ
  const { 
    gameStatus, 
    currentQuestion,
    selectedAnswers, // <-- Вернули
    essayAnswer,
    score, 
    questions,
    correctAnswersCount,
    currentQuestionIndex, // <-- Вернули
    isLastQuestion, // <-- Вернули
  } = gameStore;

  // Zustand - UI состояние
  const theme = useUIStore((state) => state.theme);
  const soundEnabled = useUIStore((state) => state.soundEnabled);
  const toggleTheme = useUIStore((state) => state.toggleTheme);

  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const createSession = usePostApiSessions();
  const submitAnswer = usePostApiSessionsSessionIdAnswers();
  const submitSession = usePostApiSessionsSessionIdSubmit();
  
  
  const handleStartGame = () => {
    createSession.mutate(
      {
        data: {
          // @ts-ignore
          categoryId: 'cmmm03e3f0000p93kx7z6kseo', 
          questionCount: 5,
          difficulty: 'medium'
        }
      },
      {
        onSuccess: (response) => {
          // 1. Достаем саму сессию из ответа бэкенда
          const currentSession = (response as any).session;

          // 2. Берем ID сессии (обычно в базе Prisma это поле называется id)
          setSessionId(currentSession.id); 
          console.log("❓ ВОПРОСЫ:", JSON.stringify(currentSession.questions, null, 2));

          // 3. Передаем правильный массив вопросов в игру!
          gameStore.startGame(currentSession.questions);
        },
        onError: (error) => {
          console.error('Failed to create session:', error);
        },
      }
    );
  };

const handleNextQuestion = () => {
    if (!currentQuestion || !sessionId) return;

    const isLastQuestion = currentQuestionIndex === (gameStore.questions.length - 1);

    const answerData = {
      questionId: currentQuestion.id,
      userAnswer: selectedAnswers.map(index => currentQuestion.options[index]),
      sessionId: sessionId
    };

    submitAnswer.mutate({
      sessionId: sessionId,
      data: answerData as any
    }, {
      onSuccess: () => {
        if (isLastQuestion) {
          submitSession.mutate({ sessionId: sessionId! }, {
            onSuccess: (response: any) => {
              const finalScore = response.session.score;
              const summary = response.session.summary;

              runInAction(() => {
                gameStore.score = finalScore;
                gameStore.answeredQuestions = Array(summary.correct).fill({
                  isCorrect: true,
                  questionId: 'fake-id',
                  selectedAnswers: []
                });
                gameStore.finishGame(); 
              });
            }
          });
        } else {
          // 4. ДЕЛЕГИРУЕМ ПЕРЕКЛЮЧЕНИЕ ВОПРОСА В MOBX
          // Экшен nextQuestion сам увеличит индекс и очистит selectedAnswers
          gameStore.nextQuestion();
        }
      }
    });
  };

  const handleFinishGame = () => {
    if (sessionId) {
      submitSession.mutate(
        { sessionId },
        {
          onSuccess: (response) => {
            console.log('Session completed:', response);
            gameStore.finishGame();
          },
          onError: (error) => {
            console.error('Failed to submit session:', error);
            gameStore.finishGame();
          },
        }
      );
    } else {
      gameStore.finishGame();
    }
  };

  // Проверяем, можно ли перейти к следующему вопросу
  const canProceed = () => {
    if (!currentQuestion) return false;
    
    if (currentQuestion.type === 'essay') {
      // Для эссе проверяем, что введен текст
      return essayAnswer && essayAnswer.trim().length > 0;
    } else {
      // Для вопросов с выбором проверяем, что выбран хотя бы один вариант
      return selectedAnswers.length > 0;
    }
  };

  /* 
  //Цвета в зависимости от темы
  const bgGradient = theme === 'light'
    ? 'from-purple-500 to-indigo-600'
    : 'from-gray-900 to-black';

  const cardBg = theme === 'light' ? 'bg-white' : 'bg-gray-800';
  const textColor = theme === 'light' ? 'text-gray-800' : 'text-white';
  const mutedText = theme === 'light' ? 'text-gray-600' : 'text-gray-400';
  const primaryColor = theme === 'light' ? 'bg-purple-600' : 'bg-purple-700';
  const primaryHover = theme === 'light' ? 'hover:bg-purple-700' : 'hover:bg-purple-800';

   Расчет процентов для экрана результатов
  const percentage = questions.length > 0 
    ? Math.round((correctAnswersCount / questions.length) * 100)
    : 0;

  const getEmoji = () => {
    if (percentage >= 80) return '🏆';
    if (percentage >= 60) return '😊';
    if (percentage >= 40) return '🤔';
    return '😢';
  };
  */

  // Стартовый экран
  if (gameStatus === 'idle') {
    return (
      <StartScreen
        theme={theme}
        toggleTheme={toggleTheme}
        soundEnabled={soundEnabled}
        handleStartGame={handleStartGame}
      />
    );
  }

  // Экран результатов
  if (gameStatus === 'finished') {
    return (
    <FinishScreen
      theme={theme}
      score={score}
      correctAnswersCount={correctAnswersCount}
      totalQuestions={questions.length}
      resetGame={() => gameStore.resetGame()}
    />
    );
  }

  // Игровой экран
  if (!currentQuestion) return null;

  return (
    <GameScreen
      theme={theme}
      toggleTheme={toggleTheme}
      handleNextQuestion={handleNextQuestion}
    />
  );
});

export default Task4;