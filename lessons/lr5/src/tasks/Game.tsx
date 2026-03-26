import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { gameStore } from '../stores/gameStore';

interface GameProps {
  theme: string;
  toggleTheme: () => void;
  handleNextQuestion: () => void;
}

export const GameScreen    = observer(
  ({ theme, toggleTheme, handleNextQuestion }: GameProps) => {
    const {
      currentQuestion,
      selectedAnswers,
      essayAnswer,
      setEssayAnswer,
      selectAnswer,
      score,
      progress,
      currentQuestionIndex,
      questions,
      isLastQuestion,
    } = gameStore;
    
    if (!currentQuestion) return null;

    const canProceed = () => {
      if (currentQuestion.type === 'essay') {
        return essayAnswer?.trim().length > 0;
      }
      return selectedAnswers.length > 0;
    };
    const bgGradient = theme === 'light'
        ? 'from-purple-500 to-indigo-600'
        : 'from-gray-900 to-black';

    const cardBg = theme === 'light' ? 'bg-white' : 'bg-gray-800';
    const textColor = theme === 'light' ? 'text-gray-800' : 'text-white';
    const mutedText = theme === 'light' ? 'text-gray-600' : 'text-gray-400';
    const primaryColor = theme === 'light' ? 'bg-purple-600' : 'bg-purple-700';
    const primaryHover = theme === 'light' ? 'hover:bg-purple-700' : 'hover:bg-purple-800';
    return (
        <div className={`min-h-screen bg-gradient-to-br ${bgGradient} p-4 transition-colors duration-300`}>
            <div className="max-w-2xl mx-auto">
                {/* Заголовок с темой */}
                <div className={`${cardBg} rounded-lg shadow-md p-4 mb-4 transition-colors duration-300`}>
                <div className="flex justify-between items-center mb-2">
                    <span className={`text-sm ${mutedText}`}>
                    Вопрос {currentQuestionIndex + 1} из {questions.length}
                    </span>
                    <div className="flex items-center gap-3">
                    <span className={`text-xl font-bold ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`}>
                        Счёт: {score}
                    </span>
                    <button
                        onClick={toggleTheme}
                        className={`p-2 rounded ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200' : 'bg-gray-700 hover:bg-gray-600'} transition-colors`}
                    >
                        {theme === 'light' ? '🌙' : '☀️'}
                    </button>
                    </div>
                </div>
                {/* Прогресс бар */}
                <div className={`w-full ${theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'} rounded-full h-2`}>
                    <div
                    className={`${theme === 'light' ? 'bg-purple-600' : 'bg-purple-500'} h-2 rounded-full transition-all duration-300`}
                    style={{ width: `${progress}%` }}
                    />
                </div>
                </div>
        
                {/* Карточка с вопросом */}
                <div className={`${cardBg} rounded-2xl shadow-2xl p-6 transition-colors duration-300`}>
                <div className="mb-4">
                    <span className={`
                    text-xs px-2 py-1 rounded-full
                    ${currentQuestion.difficulty === 'easy' && 'bg-green-100 text-green-700'}
                    ${currentQuestion.difficulty === 'medium' && 'bg-yellow-100 text-yellow-700'}
                    ${currentQuestion.difficulty === 'hard' && 'bg-red-100 text-red-700'}
                    `}>
                    {currentQuestion.difficulty === 'easy' && 'Легкий'}
                    {currentQuestion.difficulty === 'medium' && 'Средний'}
                    {currentQuestion.difficulty === 'hard' && 'Сложный'}
                    </span>
                </div>
        
                <h2 className={`text-2xl font-bold mb-6 ${textColor}`}>
                    {currentQuestion.question}
                </h2>
        
                {/* Рендерим в зависимости от типа вопроса */}
                {currentQuestion.type === 'essay' ? (
                    // Поле для текстового ответа (эссе)
                    <div className="space-y-3">
                    <textarea
                        value={essayAnswer || ''}
                        onChange={(e) => setEssayAnswer(e.target.value)}
                        className={`
                        w-full p-4 text-left rounded-lg border-2 transition-all
                        ${theme === 'light' ? 'border-gray-200 bg-white' : 'border-gray-600 bg-gray-700'}
                        ${theme === 'light' ? 'text-gray-800' : 'text-white'}
                        focus:outline-none focus:border-purple-500
                        min-h-[200px]
                        `}
                        placeholder="Введите ваш ответ здесь..."
                    />
                    </div>
                ) : (
                    // Варианты ответов для вопросов с выбором
                    <div className="space-y-3">
                    {currentQuestion.options.map((option: string, index: number) => {
                        const isSelected = selectedAnswers.includes(index);
                        const isCorrect = false // index === currentQuestion.correctAnswer;
                        const showResult = selectedAnswers !== null;
        
                        return (
                        <button
                            key={index}
                            onClick={() => gameStore.selectAnswer(index)}
                            // disabled={selectedAnswers !== null}
                            className={`
                            w-full p-4 text-left rounded-lg border-2 transition-all
                            ${!showResult && theme === 'light' && 'hover:border-purple-400 hover:bg-purple-50'}
                            ${!showResult && theme === 'dark' && 'hover:border-purple-500 hover:bg-gray-700'}
                            ${!showResult && !isSelected && (theme === 'light' ? 'border-gray-200 bg-white' : 'border-gray-600 bg-gray-700')}
                            ${!showResult && isSelected && (theme === 'light' ? 'border-purple-500 bg-purple-50' : 'border-purple-500 bg-gray-600')}
                            ${showResult && isCorrect && 'border-green-500 bg-green-50'}
                            ${showResult && isSelected && !isCorrect && 'border-red-500 bg-red-50'}
                            ${showResult && !isCorrect && !isSelected && 'opacity-60'}
                            `}
                        >
                            <div className="flex items-center">
                            <span className={`
                                w-8 h-8 rounded-full flex items-center justify-center mr-3 font-semibold
                                ${!showResult && (theme === 'light' ? 'bg-gray-200' : 'bg-gray-600 text-white')}
                                ${showResult && isCorrect && 'bg-green-500 text-white'}
                                ${showResult && isSelected && !isCorrect && 'bg-red-500 text-white'}
                            `}>
                                {isSelected ? '✓' : String.fromCharCode(65 + index)}
                            </span>
                            <span className={`flex-1 ${textColor}`}>{option}</span>
                            </div>
                        </button>
                        );
                    })}
                    </div>
                )}
        
                {/* Кнопка "Далее" */}
                {canProceed() && (
                    <button
                    onClick={handleNextQuestion}
                    className={`mt-6 w-full ${primaryColor} ${primaryHover} text-white py-3 px-6 rounded-lg font-semibold transition-colors`}
                    >
                    {isLastQuestion ? 'Завершить' : 'Следующий вопрос'}
                    </button>
                )}
                </div>
        
                {/* Подсказка */}
                <div className={`mt-4 backdrop-blur-sm rounded-lg p-4 ${theme === 'light' ? 'bg-white/20' : 'bg-black/20'}`}>
                    <p className={`text-sm ${theme === 'light' ? 'text-white' : 'text-gray-300'}`}>
                        <strong>MobX + Zustand:</strong> gameStore управляет игровой логикой (observer автообновление),
                        UIStore управляет темой (селекторы). Оба работают независимо!
                    </p>
                </div>
            </div>
        </div>
    );
});