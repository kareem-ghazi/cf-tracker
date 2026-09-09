<div align="center">
  <img src="assets/cf-tracker.svg" alt="CF Tracker Logo" width="600"/>
  
  ---
  A decoupled, high-performance web platform to track Codeforces progress and contest performance for competitive programming training groups.
  
  [![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://python.org)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.111+-009688.svg)](https://fastapi.tiangolo.com)
  [![Next.js](https://img.shields.io/badge/Next.js-14+-black.svg)](https://nextjs.org)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg)](https://postgresql.org)
  [![Redis](https://img.shields.io/badge/Redis-7+-DC382D.svg)](https://redis.io)
  [![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
</div>

## Overview

**CF Tracker** is a modernized, decoupled web application engineered to help competitive programming coaches and team leaders track participant performance across Codeforces contests. Originally developed for ICPC NMU training management, it provides real-time standings, virtualized 2D matrix leaderboards, asynchronous synchronization via Celery, and CSV roster linkages.

## Modernized Architecture

- **Backend REST Engine**: FastAPI, Async SQLAlchemy 2.0 (`asyncpg`), Pydantic v2
- **Background Worker & Rate Limiter**: Redis 7, Celery (distributed token-bucket enforcing $\ge 2.0\text{s}$ spacing between Codeforces calls)
- **Database**: PostgreSQL 15 with native `citext` for case-insensitive handle queries
- **Frontend App**: Next.js 14 (App Router), TypeScript, Tailwind CSS, `@tanstack/react-table`, and `@tanstack/react-virtual` for 60fps scrolling across hundreds of participants

---

## Quick Start (Windows)

### 1. Prerequisites
- **Docker Desktop** (running, for PostgreSQL & Redis)
- **Python 3.11+**
- **Node.js 18+** & npm

### 2. One-Click Launch
Double-click **`run_app.bat`** (or **`quickstart.bat`**):
- Automatically verifies prerequisites (Docker, Python, Node.js).
- Spins up PostgreSQL 15 and Redis 7 containers via Docker Compose.
- Creates `backend/venv` and installs backend dependencies.
- Applies database migrations via Alembic.
- Installs frontend npm packages in `frontend/`.
- Starts the Celery background worker, FastAPI API server (`http://localhost:8000`), and Next.js frontend (`http://localhost:3000`).
- Automatically opens `http://localhost:3000` in your browser.

### 3. Graceful Shutdown
Double-click **`stop_app.bat`** to stop all background services and Docker containers.

---

## Manual Execution (Linux / macOS / CLI)

### 1. Infrastructure (Docker)
```bash
docker compose up -d postgres redis
```

### 2. Backend Setup & Startup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start Celery worker
celery -A app.workers.celery_app worker --loglevel=info

# Start FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend Setup & Startup
```bash
cd frontend
npm install
npm run dev
```

Visit **`http://localhost:3000`** in your browser. Interactive API documentation is available at **`http://localhost:8000/docs`**.

---

## Legacy Data Migration

To migrate an existing legacy SQLite database (`instance/database.db`) to PostgreSQL:

```bash
cd backend
python scripts/migrate_sqlite_to_pg.py --sqlite-path ../instance/database.db
```

---

## Automated Tests

Run backend integration test suite:
```bash
cd backend
pytest tests/test_api_integration.py -v
```

---

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
