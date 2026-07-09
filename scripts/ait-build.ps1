$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$nodeFromPath = Get-Command node -ErrorAction SilentlyContinue
$codexNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if ($env:NODE_EXE -and (Test-Path -LiteralPath $env:NODE_EXE)) {
  $nodeExe = $env:NODE_EXE
} elseif ($nodeFromPath) {
  $nodeExe = $nodeFromPath.Source
} elseif (Test-Path -LiteralPath $codexNode) {
  $nodeExe = $codexNode
} else {
  throw "Node.js executable was not found. Set NODE_EXE to node.exe and retry."
}

$nodeDir = Split-Path -Parent $nodeExe
$shimDir = Join-Path $repoRoot ".codex-shims"
$shimFile = Join-Path $shimDir "npx.cmd"
$aitCmd = Join-Path $repoRoot "node_modules\.bin\ait.cmd"

if (-not (Test-Path -LiteralPath $aitCmd)) {
  throw "AIT CLI was not found. Run yarn install before building."
}

New-Item -ItemType Directory -Force -Path $shimDir | Out-Null

@'
@echo off
setlocal enabledelayedexpansion

set "tool=%~1"
shift

set "args="
:collect
if "%~1"=="" goto run
if "%~1"=="--no-cache" (
  shift
  goto collect
)
set "args=!args! "%~1""
shift
goto collect

:run
if "%tool%"=="granite" (
  node "%CD%\node_modules\@granite-js\react-native\bin\cli.js" !args!
  exit /b %ERRORLEVEL%
)

node "%CD%\node_modules\.bin\%tool%" !args!
exit /b %ERRORLEVEL%
'@ | Set-Content -LiteralPath $shimFile -Encoding ASCII

try {
  $env:PATH = "$shimDir;$nodeDir;$env:PATH"
  Push-Location $repoRoot
  try {
    & $aitCmd build
    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
  } finally {
    Pop-Location
  }
} finally {
  Remove-Item -Recurse -Force -LiteralPath $shimDir -ErrorAction SilentlyContinue
}
