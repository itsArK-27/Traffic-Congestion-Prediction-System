@echo off
title Stop Traffic Congestion Servers
color 0c

echo ========================================================
echo   Traffic Congestion Prediction System - Server Stopper
echo ========================================================
echo.

echo Stopping Frontend Server (Port 3000)...
FOR /F "tokens=5" %%T IN ('netstat -a -n -o ^| findstr "0.0.0.0:3000" ') DO (
  IF NOT "%%T"=="" (
    echo Killing process ID %%T...
    taskkill /F /PID %%T >nul 2>&1
  )
)

echo Stopping Backend Server (Port 5000)...
FOR /F "tokens=5" %%T IN ('netstat -a -n -o ^| findstr "0.0.0.0:5000" ') DO (
  IF NOT "%%T"=="" (
    echo Killing process ID %%T...
    taskkill /F /PID %%T >nul 2>&1
  )
)

echo.
echo ========================================================
echo Servers have been successfully stopped!
echo ========================================================
echo.
pause
