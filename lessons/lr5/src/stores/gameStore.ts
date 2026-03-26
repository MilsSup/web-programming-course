import { makeAutoObservable } from 'mobx';
import { Question, Answer } from '../types/quiz';
import { mockQuestions } from '../data/questions';
import { QuestionPreview } from '../../generated/api/quizBattleAPI.schemas';

/**
 * GameStore - MobX Store для управления игровой логикой
 *
 * Используется в Task2 и Task4
 */
class GameStore {
  // Observable состояние
  gameStatus: 'idle' | 'playing' | 'finished' = 'idle';
  questions: Question[] = [];
  currentQuestionIndex = 0;
  score = 0;
  selectedAnswers: number[] = [];
  answeredQuestions: Answer[] = [];
  

  constructor() {
    makeAutoObservable(this);
  }
 
  essayAnswer: string = '';
  
  // Метод для установки текстового ответа
  setEssayAnswer = (answer: string) => {
    this.essayAnswer = answer;
  };
  // Actions - методы для изменения состояния

  startGame(questions: QuestionPreview[]) {
    this.gameStatus = 'playing';
    this.questions = questions.map(item => ({...item, correctAnswer: -1, options: item.options ?? []}));
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.selectedAnswers = [];
    this.answeredQuestions = [];
  }

  selectAnswer(answerIndex: number) {
    // Проверяем, что ответ еще не был выбран и игра идет
    if (this.gameStatus !== 'playing') {
      return;
    }

     // Проверяем, выбран ли уже этот ответ
     if (this.selectedAnswers.includes(answerIndex)) {
      // Ответ уже выбран - удаляем из массива
      this.selectedAnswers = this.selectedAnswers.filter(
          selectedIndex => selectedIndex !== answerIndex
      );
    } else {
      // Ответ еще не выбран - добавляем в массив
      this.selectedAnswers.push(answerIndex);
    }
  
    const currentQuestion = this.currentQuestion;
    if (!currentQuestion) return;

    // Проверяем правильность ответа
    const isCorrect = answerIndex === currentQuestion.correctAnswer;
    
    if (isCorrect) {
      this.score += this.getPointsForDifficulty(currentQuestion.difficulty);
    }

    // Сохраняем в историю ответов
    this.answeredQuestions.push({
      questionId: currentQuestion.id,
      selectedAnswers: [...this.selectedAnswers],
      isCorrect: isCorrect
    });
  }

  nextQuestion() {
    if (this.isLastQuestion) {
      return false;
    }

    this.currentQuestionIndex++;
    this.selectedAnswers = [];
    this.essayAnswer = '';
    return true;
  }

  finishGame() {
    this.gameStatus = 'finished';
  }

  resetGame() {
    this.gameStatus = 'idle';
    this.questions = [];
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.selectedAnswers = [];
    this.answeredQuestions = [];
    this.essayAnswer = '';
  }

  // Вспомогательный метод для получения очков за сложность
  private getPointsForDifficulty(difficulty: string): number {
    switch (difficulty) {
      case 'easy': return 10;
      case 'medium': return 20;
      case 'hard': return 30;
      default: return 10;
    }
  }

  // Computed values - вычисляемые значения

  get currentQuestion(): Question | null {
    return this.questions[this.currentQuestionIndex] || null;
  }

  get progress(): number {
    if (this.questions.length === 0) return 0;
    return ((this.currentQuestionIndex + 1) / this.questions.length) * 100;
  }

  get isLastQuestion(): boolean {
    return this.currentQuestionIndex === this.questions.length - 1;
  }

  get correctAnswersCount(): number {
    return this.answeredQuestions.filter(answer => answer.isCorrect).length;
  }

}

export const gameStore = new GameStore();
