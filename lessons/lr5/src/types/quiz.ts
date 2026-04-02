export interface Question {
  id: string;
  text: string; 
  options?: string[]; 
  correctAnswer: any; 
  difficulty?: 'easy' | 'medium' | 'hard'; 
  type: string;
}

export interface Answer {
  questionId: string;
  selectedAnswers: number[];
  isCorrect: boolean;
}

export type GameStatus = 'idle' | 'playing' | 'paused' | 'finished';

export type Theme = 'light' | 'dark';