@echo off
setlocal
title BizOps AI - Docker Launcher
cd /d "%~dp0"

echo.
echo  ============================================
echo   BizOps AI - Docker (Full Stack)
echo  ============================================
echo.

if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [Setup] .env created from .env.example. Set OPENAI_API_KEY and DB vars as needed.
    )
)

echo Starting Postgres, Redis, Backend, and Frontend...
echo.
docker-compose up --build

echo.
echo When ready: Frontend http://localhost:5173  ^|  Backend http://localhost:8000
echo ============================================
pause
