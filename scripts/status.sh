#!/bin/bash
# Roda antes de pedir qualquer mudança no chat — cola a saída inteira.
# Dá visibilidade real do estado do repositório, sem depender de lembrar
# comandos separados.

echo "=================================================="
echo "GIT STATUS"
echo "=================================================="
git status

echo ""
echo "=================================================="
echo "GIT DIFF (mudanças não commitadas)"
echo "=================================================="
git diff HEAD

echo ""
echo "=================================================="
echo "ÚLTIMOS 5 COMMITS"
echo "=================================================="
git log --oneline -5

echo ""
echo "=================================================="
echo "BUILD API"
echo "=================================================="
npm run build --workspace=apps/api 2>&1 | tail -25

echo ""
echo "=================================================="
echo "BUILD WEB"
echo "=================================================="
npm run build --workspace=apps/web 2>&1 | tail -25

echo ""
echo "=================================================="
echo "Fim do relatório — cola tudo isso no chat"
echo "=================================================="