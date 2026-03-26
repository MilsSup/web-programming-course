
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FinishScreen } from './FinishScreen';

describe('Finish', () => {
  it('renders score and percentage', () => {
    render(
      <FinishScreen
        theme="light"
        score={80}
        correctAnswersCount={4}
        totalQuestions={5}
        resetGame={vi.fn()}
      />
    );

    expect(screen.getByText('Игра завершена!')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText(/4\s*из\s*5/)).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('calls onRestart when restart button clicked', () => { 
    const mockRestart = vi.fn();

    render(
      <FinishScreen
        theme="light"
        score={50}
        correctAnswersCount={2}
        totalQuestions={5}
        resetGame={mockRestart}
      />
    );

    fireEvent.click(screen.getByText('Играть снова'));

    expect(mockRestart).toHaveBeenCalledTimes(1);
  });
});
