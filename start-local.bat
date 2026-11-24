@echo off
chcp 65001 >nul
title Gestione Tornei Padel
echo ========================================================
echo   🎾 Avvio Gestione Tornei Padel (Modalità Locale)
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Verifica se Node.js è già presente nel sistema o nella cartella locale
where node >nul 2>nul
if %errorlevel% equ 0 goto node_ready

if exist "tools\node.exe" (
    set "PATH=%~dp0tools;%PATH%"
    goto node_ready
)

if exist "%ProgramFiles%\nodejs\node.exe" (
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
    goto node_ready
)

if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
    goto node_ready
)

:: 2. Se Node.js non è presente, avvia il download e l'installazione automatica
echo ⚠️ Node.js non e' presente su questo PC.
echo ⬇️ Download e installazione automatica di Node.js LTS in corso...
echo    (Operazione una tantum, attendere il completamento)
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; " ^
    "$url = 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi'; " ^
    "$dest = Join-Path $env:TEMP 'nodejs_setup.msi'; " ^
    "Write-Host '📥 Scaricamento installer ufficiale da nodejs.org...' -ForegroundColor Cyan; " ^
    "(New-Object System.Net.WebClient).DownloadFile($url, $dest); " ^
    "Write-Host '⚙️ Installazione di Node.js in corso...' -ForegroundColor Cyan; " ^
    "$proc = Start-Process msiexec.exe -ArgumentList '/i', ('\"' + $dest + '\"'), '/passive', '/norestart' -Wait -PassThru; " ^
    "Remove-Item $dest -Force -ErrorAction SilentlyContinue; " ^
    "if ($proc.ExitCode -eq 0) { Write-Host '✅ Node.js installato con successo!' -ForegroundColor Green } else { Write-Host 'Installazione completata con codice: ' + $proc.ExitCode -ForegroundColor Yellow }"

:: Ricarica il PATH nella sessione corrente
set "PATH=%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%PATH%"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ❌ Non e' stato possibile rilevare Node.js dopo l'installazione.
    echo    Puoi completarla manualmente scaricando da: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:node_ready
echo ✅ Node.js attivo:
node -v
echo.

if not exist "backend\node_modules\" (
    echo 📦 Installazione dipendenze backend...
    cd backend && call npm install && cd ..
)

if not exist "frontend\dist\" (
    echo 🔨 Compilazione interfaccia frontend...
    cd frontend && call npm install && call npm run build && cd ..
)

echo.
echo ✅ Tutto pronto! Apertura browser su http://localhost:4000/login
echo 🔑 Credenziali predefinite: admin@padel.local / admin123
echo.

start http://localhost:4000/login

cd backend
node server.js
pause
