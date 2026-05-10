@echo off
title Traffic Congestion Prediction System Launcher
color 0b

echo ========================================================
echo   Traffic Congestion Prediction System - Server Launcher
echo ========================================================
echo.

echo [1/2] Starting Backend Server (Port 5000)...
start "Traffic Predictor Backend" cmd /k "cd traffic-prediction-system\backend && npm run dev"

echo [2/2] Starting Frontend Server (Port 3000)...
start "Traffic Predictor Frontend" cmd /k "cd traffic-prediction-system\frontend && npm start"

echo.
echo ========================================================
echo Servers are booting up in separate background windows.
echo.
echo TO STOP THE SERVERS:
echo Simply close the two new black command prompt windows
echo that just opened ("Traffic Predictor Backend" and 
echo "Traffic Predictor Frontend").
echo ========================================================
echo.
pause
