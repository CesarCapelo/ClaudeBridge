@echo off
REM ClaudeBridge launcher — Windows (CMD)
setlocal

set ANTHROPIC_BASE_URL=https://api.oneprovider.dev
set ANTHROPIC_API_KEY=sk-5fc31868f0fe5418836c246ab599c60268689e7795606f5ff45a9cf1f1341e97
set CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1

cd /d "%~dp0"

where python >nul 2>&1
if errorlevel 1 (
    echo Error: Python no encontrado. Instala Python 3.10+ y agrega al PATH.
    pause
    exit /b 1
)

pip install -q -r requirements.txt

python app.py %*
