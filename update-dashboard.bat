@echo off
setlocal EnableDelayedExpansion
title BizOps AI - Update Script
cd /d "%~dp0"

echo.
echo  ============================================
echo   BizOps AI - Update (Development)
echo  ============================================
echo.

:: Optional: pull latest code (uncomment next 3 lines if you use git)
:: echo [Git] Pulling latest changes...
:: git pull
:: if errorlevel 1 echo Warning: git pull had issues. Continuing with dependency update...

echo [1/2] Updating backend dependencies...
if exist "backend\venv\Scripts\activate.bat" (
    call backend\venv\Scripts\activate.bat
    pip install -q -U pip
    pip install -r backend\requirements.txt
    echo        Backend packages updated.
) else (
    echo        No venv found. Run start-dashboard.bat first, or create venv manually.
)

echo [2/2] Updating frontend dependencies...
if exist "frontend\package.json" (
    cd frontend
    call npm install
    cd ..
    echo        Frontend packages updated.
) else (
    echo        frontend\package.json not found.
)

echo.
echo  Update complete.
echo ============================================
pause
