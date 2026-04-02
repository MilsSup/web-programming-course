# Лабораторная работа 5: Интеграция с API

## Описание задания

В этой лабораторной работе вы будете интегрировать приложение Quiz с реальным API, используя React Query для работы с серверными запросами.

**Цель:** Научиться работать с API через автоматически сгенерированные хуки React Query, управлять состоянием сессии и отправлять данные на сервер.

## Что уже готовоо

- ✅ Скелет приложения с авторизацией (кнопка Login/Logout)
- ✅ Настроенная генерация API-хуков из OpenAPI схемы
- ✅ Mock-сервер для разработки

## Что нужно реализовать

Вы будете использовать **только 3 API-хука**:
1. `usePostApiSessions` - создание игровой сессии и получение вопросов
2. `usePostApiSessionsSessionIdAnswers` - отправка ответов на сервер
3. `usePostApiSessionsSessionIdSubmit` - завершение сессии и получение результатов

---

## Шаг 0: Подготовка окружения

### 0.1 Установка зависимостей

```bash
npm install
```

### 0.2 Запуск mock-сервера

В отдельном терминале:

```bash
cd mock-server
npm install
npm start
```

Mock-сервер будет доступен по адресу: `http://localhost:3000`

### 0.3 Запуск приложения

В корневой директории проекта:

```bash
npm run dev
```

Приложение откроется по адресу: `http://localhost:5173`

### 0.4 Сброс кеша Vite (при необходимости)

Если после изменений в конфигурации (например, в `tailwind.config.ts`) стили не обновляются, очистите кеш Vite:

```bash
# Остановите dev-сервер (Ctrl+C) и выполните:
rm -rf node_modules/.vite

# Затем запустите заново:
npm run dev
```

Также можно использовать флаг `--force` при запуске:

```bash
npm run dev -- --force
```

---

## Шаг 1: Копирование реализации квиза из lr4

Скопируйте следующие файлы из `lessons/lr4` в `lessons/lr5`:

```bash
# Скопируйте файлы Task4.tsx и связанные компоненты
cp -r ../lr4/src/tasks/Task4.tsx src/tasks/
cp -r ../lr4/src/stores/gameStore.ts src/stores/
cp -r ../lr4/src/stores/uiStore.ts src/stores/
cp -r ../lr4/src/types/quiz.ts src/types/
cp -r ../lr4/src/data/questions.ts src/data/
```

**Важно:** Убедитесь, что в `src/App.tsx` подключен `Task4`:

```tsx
import Task4 from './tasks/Task4';

function App() {
  // ...
  // ...
  // ...

  return (
    <>
      ...
      <Task4 />
      ...
    </>
  );
}

export default App;
```

---

## Шаг 2: Изменение на множественный выбор ответов

### 2.1 Изменения в `gameStore.ts`

Замените `selectedAnswer: number | null` на массив:

```typescript
// Было:
selectedAnswer: number | null = null;

// Стало:
selectedAnswers: ???
```

Добавьте метод для переключения выбора ответа:

```typescript
toggleAnswer(answerIndex: number) {

}
```

Обновите все методы, использующие `selectedAnswer` на `selectedAnswers`.

### 2.2 Изменения в `Task4.tsx`

Измените обработчик клика на вариант ответа:

```typescript
// Было:
onClick={() => gameStore.selectAnswer(index)}

// Стало:
onClick={() => gameStore.toggleAnswer(index)}
```

Обновите условие отображения кнопки "Далее":

Добавьте визуальную индикацию выбранных ответов (галочка вместо буквы):

```typescript
{isSelected ? '✓' : String.fromCharCode(65 + index)}
```

---

## Шаг 3: Генерация API-хуков

Запустите кодогенерацию:

```bash
npm run codegen
```

Это создаст директорию `generated/api/` с автоматически сгенерированными хуками для работы с API.

**⚠️ Важно:** После генерации моковая авторизация будет заменена на реальную работу с backend.

---

## Шаг 4: Интеграция с API

### 4.1 Импорты хуков

Добавьте импорты в `Task4.tsx`:

```typescript
import { usePostApiSessions } from '../../generated/api/sessions/sessions';
import { usePostApiSessionsSessionIdAnswers } from '../../generated/api/sessions/sessions';
import { usePostApiSessionsSessionIdSubmit } from '../../generated/api/sessions/sessions';
```

### 4.2 Инициализация хуков

```typescript
const [sessionId, setSessionId] = useState<string | null>(null);

const createSession = usePostApiSessions();
...
...

```

### 4.3 Создание сессии при старте игры

Замените `gameStore.startGame()` на:

```typescript
const handleStartGame = () => {
  createSession.mutate(
    {
      data: {
        questionCount: 5,
        difficulty: 'medium'
      }
    },
    {
      onSuccess: (response) => {
        setSessionId(response.sessionId);
        // Загружаем вопросы в gameStore
        ...
      },
      onError: (error) => {
        console.error('Failed to create session:', error);
      },
    }
  );
};
```

**Подсказка:** Вам нужно добавить метод `setQuestionsFromAPI` в gameStore:

### 4.4 Отправка ответа при переходе к следующему вопросу

```typescript
const handleNextQuestion = () => {
  if (sessionId && currentQuestion && selectedAnswers.length > 0) {
    // Сохраняем ответ в истории
    gameStore.saveCurrentAnswer();

    // Отправляем ответ на сервер
    submitAnswer.mutate(
      {
        ...
      },
      {
        onSuccess: (response) => {
          // Обновляем счет на основе ответа сервера
          if ('pointsEarned' in response) {
            const isCorrect = response.status === 'correct';
            ... обновляем результат ...
          }
          // Переходим к следующему вопросу
          gameStore.nextQuestion();
        },
        onError: (error) => {
          console.error('Failed to submit answer:', error);
          gameStore.nextQuestion();
        },
      }
    );
  }
};
```

**Подсказка:** Добавьте метод `updateAnswerResult` в gameStore

### 4.5 Завершение сессии

При завершении игры (последний вопрос):

```typescript
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
```

Измените логику кнопки "Завершить":

```typescript
{selectedAnswers.length > 0 && (
  <button
    onClick={gameStore.isLastQuestion ? handleFinishGame : handleNextQuestion}
    disabled={submitAnswer.isPending || submitSession.isPending}
  >
    {gameStore.isLastQuestion ? 'Завершить' : 'Следующий вопрос'}
  </button>
)}
```

---

## Шаг 5: Изменение типов для совместимости с API

API возвращает `id` как `string`, а не `number`. Обновите `src/types/quiz.ts`:

```typescript
export interface Question {
  id: string | number; // Было: id: number
  question: string;
  options: string[];
  correctAnswer: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface Answer {
  questionId: string | number; // Было: questionId: number
  selectedAnswer: number;
  isCorrect: boolean;
}
```

---

## Проверка работы

1. **Авторизация**: Нажмите "Login" - должен появиться токен в localStorage
2. **Старт игры**: Нажмите "Начать игру" - должны загрузиться вопросы с сервера
3. **Выбор ответов**: Выберите несколько вариантов - они должны подсвечиваться
4. **Отправка ответа**: Нажмите "Следующий вопрос" - ответ отправится на сервер
5. **Завершение**: После последнего вопроса нажмите "Завершить" - сессия завершится

**Проверьте в DevTools:**
- Network → видны запросы к API (`POST /api/sessions`, `POST /api/sessions/{id}/answers`, `POST /api/sessions/{id}/submit`)
- Console → нет ошибок
- React Query DevTools → видны кэшированные данные

---

## Частые ошибки

### Ошибка: "Type 'string' is not assignable to type 'number'"

**Решение:** Обновите типы в `src/types/quiz.ts` на `string | number`.

### Ошибка: "Cannot read property 'id' of null"

**Решение:** Добавьте проверку `currentQuestion` перед использованием:

```typescript
if (!currentQuestion) return;
```

---

## Полезные ссылки

- [React Query документация](https://tanstack.com/query/latest/docs/react/overview)
- [OpenAPI спецификация проекта](./quiz-api-schema.yaml)
- [Orval документация](https://orval.dev/)

---

## Дополнительные задания (по желанию)

1. **Отображение результатов**: После завершения сессии показать детальную статистику с сервера
2. **История сессий**: Добавить список прошлых игровых сессий
3. **Выбор сложности**: Позволить пользователю выбрать количество вопросов и сложность перед стартом
4. **Таймер**: Добавить ограничение по времени на каждый вопрос
5. **Режим Battle**: Реализовать соревновательный режим с другими игроками

