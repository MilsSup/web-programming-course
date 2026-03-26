import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameScreen } from './Game';

// Мокаем MobX store полностью
vi.mock('../stores/gameStore', () => ({
  gameStore: {
    selectAnswer: vi.fn(),
    setEssayAnswer: vi.fn(),
    currentQuestion: { 
      id: '1',
      type: 'single',
      question: 'Test question?',
      options: ['A', 'B', 'C'],
      difficulty: 'easy',
      correctAnswer: 0
    },
    selectedAnswers: [],
    essayAnswer: '',
    score: 0,
    progress: 50,
    currentQuestionIndex: 0,
    questions: [{}, {}],
    isLastQuestion: false,
    correctAnswersCount: 0
  }
}));


import { gameStore } from '../stores/gameStore';

describe('GameScreen', () => {
  const mockNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders question text', () => {
    render(<GameScreen theme="light" toggleTheme={vi.fn()} handleNextQuestion={mockNext} />);
    expect(screen.getByText('Test question?')).toBeInTheDocument();
  });

  it('renders answer options', () => {
    render(<GameScreen theme="light" toggleTheme={vi.fn()} handleNextQuestion={mockNext} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('calls selectAnswer when option clicked', () => {
    render(<GameScreen theme="light" toggleTheme={vi.fn()} handleNextQuestion={mockNext} />);
    fireEvent.click(screen.getByText('A'));
    expect(gameStore.selectAnswer).toHaveBeenCalledWith(0);
  });
});