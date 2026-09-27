@echo off
title Klaups TikTok LIVE connector
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required. Download the LTS version from https://nodejs.org
  start https://nodejs.org
  pause
  exit /b 1
)

if not exist .env (
  copy .env.example .env >nul
  echo.
  echo First run: fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the file that opens,
  echo save it, close Notepad, then double-click start-worker.bat again.
  echo Find both in Supabase: Project Settings - API.
  notepad .env
  exit /b 0
)

if not exist node_modules (
  echo Installing dependencies, this happens once...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

echo.
echo Klaups LIVE connector is running. Keep this window open while you stream.
echo Press Ctrl+C to stop.
echo.
call npm start
pause
