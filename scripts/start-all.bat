@echo off
echo ========================================================
echo   Starting Antigravity Agent OS
echo ========================================================

REM 1. Ensure PostgreSQL Server is active
echo Checking PostgreSQL on port 5434...
powershell -Command "if (!(Get-NetTCPConnection -LocalPort 5434 -State Listen -ErrorAction SilentlyContinue)) { & 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D 'd:\agent_pg_data' -o '-p 5434' start }"

REM 2. Start Backend in separate window
echo Starting Express Backend on http://localhost:3001...
start "Agent OS Backend Server" cmd /k "cd /d d:\general-purpose AI agent\server && npm run dev"

REM 3. Start Frontend Client in separate window
echo Starting Vite Frontend on http://localhost:5173...
start "Agent OS Frontend Client" cmd /k "cd /d d:\general-purpose AI agent\client && npm run dev"

echo ========================================================
echo   Antigravity Agent OS is booting up!
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:3001
echo ========================================================
pause
