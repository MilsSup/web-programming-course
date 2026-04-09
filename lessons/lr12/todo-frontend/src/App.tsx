import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

type ServerTodo = {
  id: number;
  title: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};

// TODO(PWA): расширьте типы под офлайн-очередь операций.
type QueueAction = {
  id: string;
  type: 'create' | 'toggle' | 'delete';
  payload: any;
  ts: number;
};

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

function toLocalText(value: string) {
  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('ru-RU');
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function apiFetchTodos(): Promise<ServerTodo[]> {
  const response = await fetch(`${API_BASE_URL}/api/todos`);
  const data = await parseJson<{ items: ServerTodo[] }>(response);
  return data.items;
}

async function apiCreate(title: string): Promise<ServerTodo> {
  const response = await fetch(`${API_BASE_URL}/api/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });

  return parseJson<ServerTodo>(response);
}

async function apiToggle(todoId: number, done: boolean): Promise<ServerTodo> {
  const response = await fetch(`${API_BASE_URL}/api/todos/${todoId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done }),
  });

  return parseJson<ServerTodo>(response);
}

async function apiDelete(todoId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/todos/${todoId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

function registerServiceWorkerStarter() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    });
  }
}

export default function App() {
  const [todos, setTodos] = useState<ServerTodo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<string>('');
  const [inputValue, setInputValue] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [queueActions, setQueueActions] = useState<QueueAction[]>(() => {
  const saved = localStorage.getItem('todo_queue');
  return saved ? JSON.parse(saved) : [];
  });
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const isSyncingRef = useRef(false);

  const refreshFromServer = useCallback(async () => {
    const serverTodos = await apiFetchTodos();
    setTodos(serverTodos);
  }, []);

  const syncQueue = useCallback(async () => {
    // Если уже синхронизируемся или очередь пуста — выходим
    if (isSyncingRef.current || queueActions.length === 0) return;
    
    isSyncingRef.current = true;
    setSyncStatus('syncing');

    // Работаем с копией очереди из текущего замыкания
    const actionsToProcess = [...queueActions];

    for (const action of actionsToProcess) {
      try {
        if (action.type === 'create') await apiCreate(action.payload.title);
        if (action.type === 'toggle') await apiToggle(action.payload.id, action.payload.done);
        if (action.type === 'delete') await apiDelete(action.payload.id);
        
        // Удаляем конкретно ЭТО действие из стейта по его ID
        setQueueActions(prev => prev.filter(a => a.id !== action.id));
      } catch (err) {
        console.error('Ошибка синхронизации действия:', action, err);
        setSyncStatus('error');
        break; 
      }
    }

    await refreshFromServer();
    setSyncStatus('idle');
    isSyncingRef.current = false;
  }, [queueActions, refreshFromServer]);

  const addToQueue = (type: QueueAction['type'], payload: any) => {
    const newAction: QueueAction = {
      id: crypto.randomUUID(),
      type,
      payload,
      ts: Date.now(),
    };
    setQueueActions((prev) => [...prev, newAction]);
    setMessage('Сохранено в офлайн-очередь');
  };

  const onCreate = useCallback(async (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      await apiCreate(trimmed);
      await refreshFromServer();
    } catch {
      addToQueue('create', { title: trimmed });
    }
  }, [refreshFromServer]);

  const onToggle = useCallback(async (todo: ServerTodo) => {
    try {
      await apiToggle(todo.id, !todo.done);
      await refreshFromServer();
    } catch {
      addToQueue('toggle', { id: todo.id, done: !todo.done });
    }
  }, [refreshFromServer]);

  const onDelete = useCallback(async (todo: ServerTodo) => {
    try {
      await apiDelete(todo.id);
      await refreshFromServer();
    } catch {
      addToQueue('delete', { id: todo.id });
    }
  }, [refreshFromServer]);

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const value = inputValue;
      setInputValue('');
      await onCreate(value);
    },
    [inputValue, onCreate]
  );

  useEffect(() => {
    registerServiceWorkerStarter();

    const bootstrap = async () => {
      try {
        if (navigator.onLine) {
          await syncQueue();
        }
        await refreshFromServer();
      } catch (e) {
        console.error('Bootstrap error:', e);
      } finally {
        setIsLoading(false);
      }
    };

    void bootstrap();
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void syncQueue(); 
    };
    const handleOffline = () => {
      setIsOnline(false);
      setMessage('Интернет пропал. Работаем в офлайн-режиме.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncQueue]);

  useEffect(() => {
    localStorage.setItem('todo_queue', JSON.stringify(queueActions));
  }, [queueActions]);

  return (
    <main className="app">
      <header className="header">
        <h1>Todo-сы</h1>
        <span className={`badge ${isOnline ? 'online' : 'offline'}`}>{isOnline ? 'online' : 'offline'}</span>
      </header>

      <p className="muted">
        Есть: online CRUD. Реализовать: PWA, offline-очередь и синхронизацию после reconnect.
      </p>

      <form className="toolbar" onSubmit={onSubmit}>
        <input
          type="text"
          maxLength={200}
          placeholder="Новая задача"
          required
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
        />
        <button type="submit">Добавить</button>
        <button type="button" disabled>
          Синхронизация (TODO)
        </button>
      </form>

      <section className="meta">
        <span className="badge">Офлайн-очередь: {queueActions.length}</span>
        <span className={`badge ${syncStatus === 'syncing' ? 'syncing' : syncStatus === 'error' ? 'error' : ''}`}>
          sync: {syncStatus}
        </span>
      </section>

      {message ? <div className="message">{message}</div> : null}
      {isLoading ? <p>Загрузка...</p> : null}
      {!isLoading && todos.length === 0 ? <div className="empty">Пока нет задач</div> : null}

      <ul className="list">
        {todos.map((todo) => (
          <li className="item" key={todo.id}>
            <button type="button" onClick={() => void onToggle(todo)}>
              {todo.done ? '✅' : '⬜'}
            </button>
            <div>
              <div className={todo.done ? 'done' : ''}>{todo.title}</div>
              <div className="hint">Сервер · {toLocalText(todo.updatedAt)}</div>
            </div>
            <button type="button" onClick={() => void onDelete(todo)}>
              Удалить
            </button>
            <span className="hint">#{todo.id}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
