@echo off
setlocal
cd /d "%~dp0"

if exist "node\node.exe" (
  echo Using bundled Node: node\node.exe
  "node\node.exe" server.mjs
) else (
  where node >nul 2>&1
  if errorlevel 1 (
    echo Node.js not found. Install from https://nodejs.org or run:
    echo   node scripts\download-portable-node.mjs win-x64
    pause
    exit /b 1
  )
  node server.mjs
)

pause
