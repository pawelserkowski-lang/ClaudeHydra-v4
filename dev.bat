@echo off
title ClaudeHydra DEV :5199

:: Launch Chrome in debug mode (shared, idempotent)
call "C:\Users\BIURODOM\Desktop\chrome-debug.bat"

:: Kill old dev server on port 5199
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5199 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Start dev server
cd /d "C:\Users\BIURODOM\Desktop\ClaudeHydra-v4"
pnpm dev
