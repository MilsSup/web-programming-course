```
✅ Checkpoint 1: Запуск сервера (Health check)
Задание: Инициализировать проект на Hono и создать эндпоинт GET /api/health.

Статус: Выполнено. запустил сервер командой npm run dev, по адресу localhost:3000/api/health возвращается JSON со статусом "ok".

✅ Checkpoint 2: Настройка Prisma и SQLite
Задание: Описать модель User в schema.prisma и настроить подключение к базе.

Статус: Выполнено. Файл schema.prisma содержит правильную модель пользователя со всеми необходимыми полями (id, email, name, githubId). Запустил Prisma Studio и увидел саму базу данных dev.db.

✅ Checkpoint 3: GitHub OAuth Callback
Задание: Реализовать маршрут POST /api/auth/github/callback, который создает пользователя и выдает JWT-токен.

Статус: Выполнено. Протестировал этот эндпоинт через PowerShell. Сервер принял тестовый код, создал запись в базе данных (увидел ее в Prisma Studio) и вернул мне готовый JWT-токен (eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW43azR2aWowMDAwZ2lla3QxMXNxc2QxIiwiZ2l0aHViSWQiOiJtb2..).
// Invoke-RestMethod -Uri "http://localhost:3000/api/auth/github/callback" -Method Post -Body '{"code":"test_nikita"}' -ContentType "application/json"

✅ Checkpoint 4: JWT Middleware
Задание: Настроить защиту маршрутов, чтобы сервер проверял заголовок Authorization: Bearer <token>.

Статус: Выполнено. В файле index.ts подключен роутер авторизации, а в auth.ts прописана логика работы с токенами.

✅ Checkpoint 5: Маршрут Profile
Задание: Создать защищенный эндпоинт GET /api/auth/me, возвращающий данные текущего пользователя.

Статус: Выполнено (в коде). В файле auth.ts этот хэндлер полностью написан и готов отдавать данные из базы на основе ID пользователя из токена.
```
