.PHONY: up down build db-push release logs

# Запустить проект
up:
	docker compose up -d

# Остановить проект
down:
	docker compose down

# Пересобрать Докер-образы
build:
	docker compose up --build -d

# Накатить миграции базы данных
db-push:
	npx prisma db push

# локальный релиз (выполняет команды по цепочке)
release: down build db-push
	@echo "🚀 Release successful! Backend is running on http://localhost:3000"

# просмотр логов всех контейнеров в реальном времени
logs:
	docker compose logs -f