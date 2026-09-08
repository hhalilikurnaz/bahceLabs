.PHONY: help docker-up docker-down db-migrate db-revision backend-install backend-dev backend-test frontend-install frontend-dev

help:
	@echo "BahçeLab — bahcelab-web monorepo"
	@echo ""
	@echo "  make docker-up          Start PostgreSQL + PostGIS"
	@echo "  make docker-down        Stop database"
	@echo "  make backend-install    Install Python dependencies"
	@echo "  make db-migrate         Run Alembic migrations"
	@echo "  make backend-dev        Start FastAPI dev server (port 8000)"
	@echo "  make backend-test       Run backend tests"
	@echo "  make frontend-install   Install frontend dependencies"
	@echo "  make frontend-dev       Start Vite dev server (port 5173)"

docker-up:
	docker compose up -d

docker-down:
	docker compose down

backend-install:
	cd bahcelab-backend && python3 -m pip install -e ".[dev]"

db-migrate:
	cd bahcelab-backend && alembic upgrade head

db-revision:
	cd bahcelab-backend && alembic revision --autogenerate -m "$(msg)"

backend-dev:
	cd bahcelab-backend && uvicorn bahcelab_backend.main:app --reload --host 0.0.0.0 --port 8001

backend-test:
	cd bahcelab-backend && pytest -v

frontend-install:
	npm install

frontend-dev:
	npm run dev
