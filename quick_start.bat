@echo off
REM DisputeIQ quick-start. Verifies prerequisites, then runs dev servers.
REM Auto-rebuilt per the global rule "rebuild quick_start.bat after changes that required it."

setlocal EnableDelayedExpansion

cd /d "%~dp0"

echo ======================================================
echo  DisputeIQ quick-start
echo  cwd: %CD%
echo ======================================================

REM ── Node + npm ───────────────────────────────────────────
where node >nul 2>nul
if errorlevel 1 (
  echo [ERR] Node.js not on PATH. Install Node 20+ and retry.
  exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_V=%%v
echo [ok ] Node !NODE_V!

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERR] npm not on PATH.
  exit /b 1
)

REM ── .env.local presence and key checks ───────────────────
if not exist ".env.local" (
  echo [ERR] .env.local missing. Copy values from .env.example, then re-run.
  exit /b 1
)

REM Check MISTRAL_API_KEY (used by Mistral OCR + paralegal LLM).
findstr /B /C:"MISTRAL_API_KEY=" .env.local >nul 2>nul
if errorlevel 1 (
  echo [ERR] MISTRAL_API_KEY not set in .env.local.
  echo       The credit-report upload pipeline refuses to run without it.
  echo       Grab the value from VH (C:\Users\jon89\Desktop\VH\violationHunterai\backend\.env.local)
  echo       or your Mistral console: https://console.mistral.ai/
  exit /b 1
)
echo [ok ] MISTRAL_API_KEY present

REM Check ENCRYPTION_KEY (raw-payload AES-256-GCM key).
for /f "tokens=2 delims==" %%v in ('findstr /B /C:"ENCRYPTION_KEY=" .env.local') do set ENC_KEY=%%v
if "!ENC_KEY!"=="" (
  echo [ERR] ENCRYPTION_KEY not set in .env.local. Min 32 chars required.
  exit /b 1
)
set ENC_LEN=0
set TMP=!ENC_KEY!
:enclen_loop
if not "!TMP!"=="" (
  set TMP=!TMP:~1!
  set /a ENC_LEN+=1
  goto enclen_loop
)
if !ENC_LEN! LSS 32 (
  echo [ERR] ENCRYPTION_KEY too short (!ENC_LEN! chars; need 32+).
  exit /b 1
)
echo [ok ] ENCRYPTION_KEY present (!ENC_LEN! chars)

REM Check Convex URL.
findstr /B /C:"NEXT_PUBLIC_CONVEX_URL=" .env.local >nul 2>nul
if errorlevel 1 (
  echo [warn] NEXT_PUBLIC_CONVEX_URL not set. Convex calls will fail.
)

REM ── Dependencies ────────────────────────────────────────
if not exist "node_modules" (
  echo [..] Installing npm dependencies (first run)...
  call npm install
  if errorlevel 1 (
    echo [ERR] npm install failed.
    exit /b 1
  )
)
echo [ok ] node_modules present

REM ── Typecheck (fast fail) ────────────────────────────────
echo [..] Typechecking...
call npx tsc --noEmit
if errorlevel 1 (
  echo [ERR] Typecheck failed. Fix errors before launching dev server.
  exit /b 1
)
echo [ok ] Typecheck clean

REM ── Launch ───────────────────────────────────────────────
echo.
echo Starting Next.js dev server on http://localhost:3000 ...
echo (Ctrl+C to stop.)
call npm run dev

endlocal
