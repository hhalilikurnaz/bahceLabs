# Kök .env (portlar, konteyner adları): cp .env.example .env
-include .env
export
# DİKKAT: kök .env'deki BOŞ `EARTHDATA_TOKEN=` satırı export edilince bahcelab-backend/.env.local'daki gerçek belirteci EZER (ortam değişkeni dosyadan önceliklidir).
# Bu yüzden sunucu/işçi hedefleri `env -u EARTHDATA_TOKEN` ile başlar: belirteç yalnız .env.local'dan okunur. (Bu hata yüzünden SMAP/IMERG çekimi sessizce atlanıyordu.)

.PHONY: dev worker job e2e-test e2e-db-remove backend-typecheck help docker-up docker-down db-seed db-migrate db-revision backend-install backend-dev backend-test backend-test-fast frontend-install frontend-dev

help:
	@echo "BahçeLab — bahcelab-web monorepo"
	@echo ""
	@echo "  make docker-up          Start PostgreSQL + PostGIS (port $$DB_PORT)"
	@echo "  make docker-down        Stop database"
	@echo "  make backend-install    Install Python dependencies"
	@echo "  make db-migrate         Run Alembic migrations"
	@echo "  make db-seed            Create dev user test@bahcelab.com / test1234"
	@echo "  make dev                TAM geliştirme yığını: DB + Redis + migration + API + arq işçisi (zamanlanmış işler) + Vite"
	@echo "  make worker             Yalnız arq işçisi (JOB_BACKEND=arq; Redis gerekir)"
	@echo "  make job ad=<iş>        Zamanlanmış bir işi şimdi bir kez koştur (ad vermezsen liste)"
	@echo "  make backend-dev        Start FastAPI dev server (port $$API_PORT)"
	@echo "  make backend-test       Run full backend tests (parallel, per-worker test DB)"
	@echo "  make backend-test-fast  Run fast backend tests (-m 'not slow')"
	@echo "  make frontend-install   Install frontend dependencies"
	@echo "  make frontend-dev       Start Vite dev server (port $$WEB_PORT)"

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
	cd bahcelab-backend && env -u EARTHDATA_TOKEN PYTHONPATH=src .venv/bin/uvicorn bahcelab_backend.main:app --reload --host 0.0.0.0 --port $(API_PORT)

# Geliştirme yığını: API + arq işçisi AYNI kuyruğu (Redis) kullanır; zamanlanmış işler (besleme, izleme, IMERG/SMAP doğrulama) işçide koşar.
# Not: JOB_BACKEND=arq iken API işleri kendi içinde zamanlamaz; işçi yoksa HİÇBİR zamanlanmış iş koşmaz
DEV_ORTAM = JOB_BACKEND=arq REDIS_URL=$(or $(REDIS_URL),redis://localhost:6379/0)

dev:  ## docker (db + redis) + migration + API (--reload) + arq işçisi + Vite; Ctrl+C hepsini durdurur
	@$(MAKE) docker-up db-migrate
	@trap 'kill 0' INT TERM EXIT; \
	  (cd bahcelab-backend && env -u EARTHDATA_TOKEN $(DEV_ORTAM) PYTHONPATH=src .venv/bin/uvicorn bahcelab_backend.main:app --reload --host 0.0.0.0 --port $(API_PORT)) & \
	  (cd bahcelab-backend && env -u EARTHDATA_TOKEN $(DEV_ORTAM) PYTHONPATH=src .venv/bin/arq bahcelab_backend.jobs.arq_worker.WorkerSettings) & \
	  (npm run dev) & \
	  wait

worker:  ## yalnız işçi (API'yi başka terminalde `make backend-dev` ile açtıysanız; ikisi de JOB_BACKEND=arq olmalı)
	cd bahcelab-backend && env -u EARTHDATA_TOKEN $(DEV_ORTAM) PYTHONPATH=src .venv/bin/arq bahcelab_backend.jobs.arq_worker.WorkerSettings

job:  ## bir zamanlanmış işi şimdi bir kez koştur: make job ad=refresh_validation
	cd bahcelab-backend && env -u EARTHDATA_TOKEN PYTHONPATH=src .venv/bin/python scripts/is_calistir.py $(ad)

backend-test:  ## TAM paket (yavaş testler dahil), işçi başına ayrı test veritabanı, paralel
	cd bahcelab-backend && PYTHONPATH=src:. .venv/bin/pytest -q -n 8

backend-test-fast:  ## HIZLI paket (her commit): yavaş işaretli testler hariç
	cd bahcelab-backend && PYTHONPATH=src:. .venv/bin/pytest -q -n 8 -m "not slow"

frontend-install:
	npm install

frontend-dev:
	npm run dev

backend-typecheck:
	cd bahcelab-backend && PYTHONPATH=src .venv/bin/mypy && .venv/bin/ruff check src tests scripts

e2e-test:  ## ayrı e2e veritabanı (docker profili e2e) + ayrı API/web portları; sonunda temizlenir
	cd bahcelab-frontend && npm run test:e2e

e2e-db-remove:  ## e2e veritabanını ve hacmini tamamen kaldırır
	docker compose --profile e2e rm -sf db-e2e && docker volume rm bahcelab_bahcelab_pgdata_e2e
