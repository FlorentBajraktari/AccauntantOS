$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$backendEnvPath = Join-Path $backendDir ".env"

function Get-DotEnvValue {
    param(
        [string]$Path,
        [string]$Key,
        [string]$DefaultValue
    )

    if (-not (Test-Path $Path)) {
        return $DefaultValue
    }

    $match = Get-Content $Path |
    Where-Object { $_ -match "^$Key=" } |
    Select-Object -First 1

    if (-not $match) {
        return $DefaultValue
    }

    return ($match -split "=", 2)[1].Trim()
}

if (-not (Test-Path (Join-Path $backendDir ".venv\Scripts\python.exe"))) {
    throw "Backend virtual environment not found at backend/.venv. Install backend dependencies first."
}

if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    throw "Frontend node_modules not found. Run yarn install in frontend first."
}

$backendHost = Get-DotEnvValue -Path $backendEnvPath -Key "BACKEND_HOST" -DefaultValue "127.0.0.1"
$backendPort = Get-DotEnvValue -Path $backendEnvPath -Key "BACKEND_PORT" -DefaultValue "8001"
$backendUrl = "http://${backendHost}:${backendPort}"

$backendCommand = "Set-Location '$backendDir'; .\.venv\Scripts\python.exe -m uvicorn server:app --host $backendHost --port $backendPort"
$frontendCommand = "Set-Location '$frontendDir'; `$env:REACT_APP_BACKEND_URL='$backendUrl'; yarn start"

Start-Process powershell -ArgumentList @("-NoExit", "-Command", $backendCommand) -WorkingDirectory $backendDir
Start-Process powershell -ArgumentList @("-NoExit", "-Command", $frontendCommand) -WorkingDirectory $frontendDir