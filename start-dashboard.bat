@echo off
setlocal EnableDelayedExpansion
title BizOps AI - Dashboard Launcher
cd /d "%~dp0"

goto :main
:error
echo.
echo  Something went wrong. Check the messages above.
goto :end
:main

echo.
echo  ============================================
echo   BizOps AI - Dashboard Launcher
echo  ============================================
echo.

:: Must be in project folder
if not exist "backend\requirements.txt" (
    echo  ERROR: Run this script from the project root.
    goto :error
)

:: Python & Node required
where python >nul 2>nul
if errorlevel 1 (
    echo  ERROR: Python not found. Install Python 3.11+ and add to PATH.
    goto :error
)
where node >nul 2>nul
if errorlevel 1 (
    echo  ERROR: Node.js not found. Install Node.js 18+ and add to PATH.
    goto :error
)

:: .env only on first run
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [Setup] .env created.
    )
)

:: --- Backend: setup only when venv missing ---
set NEED_BACKEND_INSTALL=0
if not exist "backend\venv" (
    echo [Backend] First-time setup: creating venv and installing packages...
    python -m venv backend\venv
    if errorlevel 1 (
        echo  ERROR: Could not create venv.
        goto :error
    )
    set NEED_BACKEND_INSTALL=1
)

if %NEED_BACKEND_INSTALL%==1 (
    call backend\venv\Scripts\activate.bat
    pip install -q -r backend\requirements.txt
    if errorlevel 1 (
        echo  ERROR: Backend install failed.
        goto :error
    )
    echo [Backend] Done.
) else (
    echo [Backend] Ready.
)

:: --- Frontend: setup only when node_modules missing ---
if not exist "frontend\node_modules" (
    echo [Frontend] First-time setup: installing npm packages...
    if not exist "frontend\package.json" (
        echo  ERROR: frontend\package.json not found.
        goto :error
    )
    cd frontend
    call npm install
    if errorlevel 1 (
        echo  ERROR: Frontend install failed.
        cd ..
        goto :error
    )
    cd ..
    echo [Frontend] Done.
) else (
    echo [Frontend] Ready.
)

:: --- Start servers ---
echo.
echo  Starting servers...
echo.

start "BizOps Backend" cmd /k "cd /d "%~dp0" && call "%~dp0backend\venv\Scripts\activate.bat" && cd /d "%~dp0backend" && set DATABASE_URL=sqlite:///./sql_app.db && python -m uvicorn main:app --host 127.0.0.1 --port 8000"
timeout /t 3 /nobreak >nul

start "BizOps Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
timeout /t 4 /nobreak >nul

start "" "http://localhost:5173"
echo.
echo  Dashboard: http://localhost:5173
echo  API Docs:  http://localhost:8000/docs
echo.
echo  Close the Backend and Frontend windows to stop.

:end
echo.
echo  ============================================
pause >nul
