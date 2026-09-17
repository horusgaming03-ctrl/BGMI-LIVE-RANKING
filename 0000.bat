@echo off
title BGMI Live Ranking — 0000
cd /d "%~dp0"

echo.
echo  BGMI LIVE RANKING
echo  ==================
echo  Admin:    http://127.0.0.1:5173/admin
echo  Round Robin overlay: http://127.0.0.1:5173/overlay/round-robin
echo  Live overlay:        http://127.0.0.1:5173/overlay/themed
echo.
echo  Starting API + Vite on 0.0.0.0 ...
echo  Press Ctrl+C to stop.
echo.

start "" "http://127.0.0.1:5173/admin"
npm run dev -- --host 0.0.0.0
