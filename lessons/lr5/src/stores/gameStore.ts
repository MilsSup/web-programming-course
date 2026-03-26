import { makeAutoObservable } from 'mobx';
import { Question, Answer } from '../types/quiz';
import { QuestionPreview } from '../../generated/api/quizBattleAPI.schemas';

/**
 * GameStore - MobX Store для управления игровой логикой
 *
 * Используется в Task2 и Task4
 */
class GameStore {
  // Observable состояние
  gameStatus: 'idle' | 'playing' | 'finished' = 'idle';

  // TODO: Добавьте другие поля состояния:
  questions: QuestionPreview[] = [];
  currentQuestionIndex = 0;
  score = 0;
  selectedAnswers: number[] = [];
  answeredQuestions: Answer[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  // Actions - методы для изменения состояния

  startGame() {
    this.gameStatus = 'playing';
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.selectedAnswers = [];
    this.answeredQuestions = [];
  }

  toggleAnswer(answerIndex: number) {
    if (this.selectedAnswers.includes(answerIndex)) {
      this.selectedAnswers = this.selectedAnswers.filter(a => a !== answerIndex);
    } else {
      this.selectedAnswers.push(answerIndex);
    }
  }

  selectAnswer(answerIndex: number) {
  console.log('Selected answer:', answerIndex);

  if (!this.selectedAnswers) {
    this.selectedAnswers = [];
  }

  
  // toggle


  if (this.selectedAnswers.includes(answerIndex)) {
    this.selectedAnswers = this.selectedAnswers.filter(a => a !== answerIndex);
    return;
  }

  this.selectedAnswers.push(answerIndex);

  const question = this.currentQuestion;
  if (!question) return;


  this.answeredQuestions.push({
    questionId: question.id,
    selectedAnswer: this.selectedAnswers[0],
    isCorrect: false,
  });
}

  nextQuestion() {
    if (this.isLastQuestion) {
      this.finishGame();
      return;
    }

    this.currentQuestionIndex++;
    this.selectedAnswers = [];
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
  }

setQuestionsFromAPI(questions: QuestionPreview[]) {
  this.questions = questions;
}

  updateAnswerResult(questionId: number, isCorrect: boolean) {
    const answer = this.answeredQuestions.find(a => a.questionId === questionId);
    if (answer) {
      answer.isCorrect = isCorrect;
    }

  }

  get currentQuestion(): QuestionPreview | null {
    return this.questions[this.currentQuestionIndex] ?? null;
  }

  get progress(): number {
    if (this.questions.length === 0) return 0;
    return (this.currentQuestionIndex / this.questions.length) * 100;
  }

  // TODO: Добавьте другие computed values:
  get isLastQuestion(): boolean {
    return this.currentQuestionIndex === this.questions.length - 1;
  }

  get correctAnswersCount(): number {
    return this.score;
  }
}

export const gameStore = new GameStore();
