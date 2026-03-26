#!/bin/bash
echo ""
echo "⚽  Fanáticos FC — Iniciando..."
echo ""

# Verifica se porta 3001 está livre
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "⚠️  Porta 3001 já em uso. Encerrando processo anterior..."
  fuser -k 3001/tcp 2>/dev/null
  sleep 1
fi

# Tenta Node.js primeiro, senão usa Python
if [ -d "backend/node_modules" ]; then
  echo "🟢 Usando Node.js backend..."
  cd backend && node server.js
else
  echo "🐍 Usando Python backend (standalone, sem dependências)..."
  python3 backend/server_standalone.py
fi
