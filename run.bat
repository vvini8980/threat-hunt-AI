@echo off
title Threat Hunt AI Application
color 0b

echo ==================================================
echo   Starting Threat Hunt AI Platform...
echo ==================================================
echo.

echo [1/2] Starting Backend Server (FastAPI) on Port 8000...
start "Backend API" cmd /k "cd backend && .venv\Scripts\python.exe -m uvicorn main:app --reload"

echo [2/2] Starting Frontend UI (React/Vite) on Port 5173...
start "Frontend UI" cmd /k "npm run dev"

echo.
echo Both servers have been launched in separate windows!
echo Feel free to minimize those windows while you work.
echo.
pause
