# Сборка
FROM node:20-alpine AS builder
WORKDIR /app

# Копируем файлы зависимостей и устанавливаем их
COPY package*.json ./
RUN npm install

# Копируем схему Prisma и генерируем клиент
COPY prisma ./prisma
RUN npx prisma generate

# Копируем весь остальной код и собираем проект
COPY . .
RUN npm run build


# Запуск
FROM node:20-alpine AS runner
WORKDIR /app

# зависимости
COPY package*.json ./
RUN npm install --omit=dev

# Копируем скомпилированный код из первого этапа
COPY --from=builder /app/dist ./dist
# Копируем сгенерированный клиент Prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Открываем порт, на котором работает Hono
EXPOSE 3000

# Команда для старта
CMD ["npm", "run", "start"]