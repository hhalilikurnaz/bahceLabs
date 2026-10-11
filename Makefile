.PHONY: e2e-test e2e-clean backend-typecheck help docker-up docker-down db-seed db-migrate db-revision backend-install backend-dev backend-test frontend-install frontend-dev

help:
	@echo "BahçeLab — bahcelab-web monorepo"
	@echo ""
	@echo "  make docker-up          Start PostgreSQL + PostGIS (port 5432)"
	@echo "  make docker-down        Stop database"
	@echo "  make backend-install    Install Python dependencies"
	@echo "  make db-migrate         Run Alembic migrations"
	@echo "  make db-seed            Create dev user test@bahcelab.com / test1234"
	@echo "  make backend-dev        Start FastAPI dev server (port 8001)"
	@echo "  make backend-test       Run backend tests"
	@echo "  make frontend-install   Install frontend dependencies"
	@echo "  make frontend-dev       Start Vite dev server (port 5173)"

docker-up:
	docker compose up -d

docker-down:
	docker compose down

backend-install:
	cd bahcelab-backend && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"

db-migrate:
	cd bahcelab-backend && PYTHONPATH=src .venv/bin/alembic upgrade head

db-seed:
	cd bahcelab-backend && PYTHONPATH=src .venv/bin/python scripts/seed_dev_user.py

db-revision:
	cd bahcelab-backend && PYTHONPATH=src .venv/bin/alembic revision --autogenerate -m "$(msg)"

backend-dev:
	cd bahcelab-backend && PYTHONPATH=src .venv/bin/uvicorn bahcelab_backend.main:app --reload --host 0.0.0.0 --port 8001

backend-test:
	cd bahcelab-backend && PYTHONPATH=src .venv/bin/pytest -v

frontend-install:
	npm install

frontend-dev:
	npm run dev

backend-typecheck:
	cd bahcelab-backend && PYTHONPATH=src .venv/bin/mypy && .venv/bin/ruff check src tests scripts

e2e-test:
	cd bahcelab-frontend && npm run test:e2e

e2e-clean:
	docker exec bahcelab-db psql -U bahcelab -d bahcelab -tAc "DELETE FROM workspaces WHERE id IN (SELECT m.workspace_id FROM workspace_members m JOIN users u ON u.id=m.user_id WHERE u.email LIKE 'e2e-%@example.test'); DELETE FROM users WHERE email LIKE 'e2e-%@example.test';"
