@echo off
setlocal

cd /d "%~dp0"

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing requirements...
pip install -r requirements.txt

if not exist .env (
    setlocal EnableDelayedExpansion
    echo.
    echo .env file not found. Setting up configuration...
    echo.
    echo Please enter your Codeforces API credentials.
    echo You can find them at https://codeforces.com/settings/api
    echo Press Enter to skip if you don't have them yet.
    echo.
    
    set /p API_KEY="Enter Codeforces API Key: "
    set /p API_SECRET="Enter Codeforces API Secret: "
    
    echo # Codeforces API credentials > .env
    echo CF_API_KEY=!API_KEY! >> .env
    echo CF_API_SECRET=!API_SECRET! >> .env
    echo. >> .env
    echo # Flask configuration >> .env
    echo FLASK_SECRET_KEY=generated_key_%RANDOM%%RANDOM%%RANDOM% >> .env
    
    echo.
    echo .env file created successfully.
    endlocal
)

echo.
echo Starting application...
python app.py

pause
