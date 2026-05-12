# ClaudeBridge launcher — Windows PowerShell
$ErrorActionPreference = "Stop"

$env:ANTHROPIC_BASE_URL                    = "https://api.oneprovider.dev"
$env:ANTHROPIC_API_KEY                     = "sk-5fc31868f0fe5418836c246ab599c60268689e7795606f5ff45a9cf1f1341e97"
$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1"

Set-Location -Path $PSScriptRoot

# Check Python
$python = (Get-Command python -ErrorAction SilentlyContinue)?.Source
if (-not $python) {
    $python = (Get-Command python3 -ErrorAction SilentlyContinue)?.Source
}
if (-not $python) {
    Write-Error "Python no encontrado. Instala Python 3.10+ y agrega al PATH."
    exit 1
}

# Install dependencies
& $python -m pip install -q -r requirements.txt

# Launch
& $python app.py @args
