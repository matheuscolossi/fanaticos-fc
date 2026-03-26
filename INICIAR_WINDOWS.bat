@echo off
echo.
echo  Fanatidos FC -- Iniciando...
echo.

if exist "backend\node_modules" (
  echo  Usando Node.js backend...
  cd backend
  node server.js
) else (
  echo  Usando Python backend (sem dependencias)...
  python backend\server_standalone.py
)
