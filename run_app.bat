@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo ====================================================================
echo             CF Tracker - Rebuild Environment Quickstart
echo ====================================================================
echo.

:: ----------------------------------------------------------------------
:: 0. Check Prerequisites
:: ----------------------------------------------------------------------
echo [0/5] Checking prerequisites...

where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not in your PATH.
    echo Please install and start Docker Desktop to run PostgreSQL and Redis.
    echo.
    pause
    exit /b 1
)

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in your PATH.
    echo Please install Python 3.11+ to run the backend and Celery workers.
    echo.
    pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js / npm is not installed or not in your PATH.
    echo Please install Node.js 18+ to run the Next.js frontend.
    echo.
    pause
    exit /b 1
)

echo        Prerequisites verified: Docker, Python, Node.js found.
echo.

:: ----------------------------------------------------------------------
:: 1. Start Infrastructure (PostgreSQL 15 & Redis 7 via Docker Compose)
:: ----------------------------------------------------------------------
echo [1/5] Starting PostgreSQL and Redis containers...
docker compose up -d postgres redis

if %errorlevel% neq 0 (
    echo [ERROR] Failed to start Docker containers. Make sure Docker Desktop is running.
    pause
    exit /b 1
)

echo        Waiting 5 seconds for database initialization...
timeout /t 5 /nobreak >nul
echo.

:: ----------------------------------------------------------------------
:: 2. Setup Backend Virtual Environment & Dependencies
:: ----------------------------------------------------------------------
echo [2/5] Setting up Python backend environment...

if not exist "backend\venv" (
    echo        Creating virtual environment in backend\venv...
    python -m venv backend\venv
)

echo        Activating virtual environment and verifying dependencies...
call backend\venv\Scripts\activate.bat
pip install -r backend\requirements.txt --quiet

echo.

:: ----------------------------------------------------------------------
:: 3. Run Database Migrations (Alembic)
:: ----------------------------------------------------------------------
echo [3/5] Running Alembic database migrations...
cd /d "%~dp0backend"
call alembic upgrade head
if %errorlevel% neq 0 (
    echo [WARNING] Alembic migrations encountered an issue. Proceeding with startup...
)
cd /d "%~dp0"
echo.

:: ----------------------------------------------------------------------
:: 4. Setup Frontend Dependencies
:: ----------------------------------------------------------------------
echo [4/5] Checking frontend dependencies...
if not exist "frontend\node_modules" (
    echo        Installing frontend npm dependencies (first time only)...
    cd /d "%~dp0frontend"
    call npm install
    cd /d "%~dp0"
) else (
    echo        Frontend dependencies already installed.
)
echo.

:: ----------------------------------------------------------------------
:: 5. Launch Background Worker, API Server, and Next.js Frontend
:: ----------------------------------------------------------------------
echo [5/5] Launching CF Tracker services...

:: Celery Worker (using --pool=solo for Windows compatibility)
echo        Starting Celery Background Worker...
start "CF Tracker - Celery Worker" cmd /k "title CF Tracker - Celery Worker && cd /d %~dp0backend && call venv\Scripts\activate.bat && celery -A app.workers.celery_app worker --loglevel=info --pool=solo"

:: FastAPI Development Server
echo        Starting FastAPI Backend API Server (Port 8000)...
start "CF Tracker - FastAPI Backend" cmd /k "title CF Tracker - FastAPI Backend && cd /d %~dp0backend && call venv\Scripts\activate.bat && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Next.js Frontend Development Server
echo        Starting Next.js Frontend Server (Port 3000)...
start "CF Tracker - Next.js Frontend" cmd /k "title CF Tracker - Next.js Frontend && cd /d %~dp0frontend && npm run dev"

echo.
echo ====================================================================
echo                  All Services Successfully Started!
echo ====================================================================
echo.
echo   * Frontend Web UI:     http://localhost:3000
echo   * Interactive API Docs: http://localhost:8000/docs
echo   * PostgreSQL Database: localhost:5432 (db: cf_tracker)
echo   * Redis Broker/Cache:  localhost:6379
echo.
echo   To gracefully stop all services, run: stop_app.bat
echo ====================================================================
echo.

echo Opening CF Tracker in your browser...
timeout /t 4 /nobreak >nul
start http://localhost:3000

pause
