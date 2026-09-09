@echo off
setlocal

cd /d "%~dp0"

echo ====================================================================
echo                 Stopping CF Tracker Services
echo ====================================================================
echo.

echo [1/2] Stopping Docker containers (PostgreSQL and Redis)...
docker compose stop postgres redis

echo.
echo [2/2] Closing running server terminals...
taskkill /FI "WINDOWTITLE eq CF Tracker - FastAPI Backend*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq CF Tracker - Celery Worker*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq CF Tracker - Next.js Frontend*" /T /F >nul 2>nul

echo.
echo [SUCCESS] All CF Tracker services have been stopped.
echo.
pause
