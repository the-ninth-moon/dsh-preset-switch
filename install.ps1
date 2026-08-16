<#
# dsh-preset-switch installer (Windows / PowerShell)
#
# One-line install:
#   irm https://raw.githubusercontent.com/the-ninth-moon/dsh-preset-switch/master/install.ps1 | iex
#
# What it does:
#   1. Locates $DSH_HOME (default $HOME\.dsh) and the web profile's cordis.patch.yml
#   2. Runs `npm install github:the-ninth-moon/dsh-preset-switch` from the profile root
#      (so the package lands in the shared module root, not profiles/web/node_modules)
#   3. Idempotently appends the `preset-switch` row to cordis.patch.yml
#   4. Verifies the package resolves, then tells you to restart dsh
#
# Safe to re-run: registration is skipped when already present.
#>

$ErrorActionPreference = 'Stop'

$repo = 'the-ninth-moon/dsh-preset-switch'

function Write-Step($text) { Write-Host "[dsh-preset-switch] $text" -ForegroundColor Cyan }

# --- 1. locate profile ------------------------------------------------
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$profilesRoot = Join-Path $dshHome 'profiles'
if (-not (Test-Path $profilesRoot)) {
    throw "dsh profiles root not found at '$profilesRoot'. Is dsh installed? Set DSH_HOME if it lives elsewhere."
}

$patchFiles = Get-ChildItem -Path $profilesRoot -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Join-Path $_.FullName 'cordis.patch.yml' } |
    Where-Object { Test-Path $_ }
if (-not $patchFiles) {
    throw "No cordis.patch.yml found under '$profilesRoot' (expected e.g. profiles\web\cordis.patch.yml)."
}
# Prefer the web profile; fall back to the first match.
$patch = $patchFiles | Where-Object { $_.ToLower().Contains('web') } | Select-Object -First 1
if (-not $patch) { $patch = $patchFiles | Select-Object -First 1 }
$profileDir = Split-Path (Split-Path $patch -Parent) -Parent

Write-Step "DSH_HOME      : $dshHome"
Write-Step "profile dir   : $profileDir"
Write-Step "patch file    : $patch"

# --- 2. npm install from profile root ---------------------------------
Push-Location $profileDir
try {
    Write-Step "npm install github:$repo ..."
    npm install "github:$repo"
    if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE" }
} finally {
    Pop-Location
}

# --- 3. idempotent registration ----------------------------------------
$raw = Get-Content -Path $patch -Raw -Encoding UTF8
if ($raw -match 'preset-switch') {
    Write-Step "Registration already present in $patch — skipping."
} else {
    $block = @'

# dsh-preset-switch: mid-session agent-preset switching (composer button beside
# the access-mode control + /preset command).
- insert:
    - id: preset-switch
      name: 'dsh-preset-switch'
'@
    $trimmed = $raw.TrimEnd()
    if ($trimmed -eq '[]') {
        # Replace the empty array literal with the insert entry.
        $new = $trimmed.Substring(0, $trimmed.Length - 2).TrimEnd() + $block + "`n"
    } else {
        $new = $trimmed + $block + "`n"
    }
    Set-Content -Path $patch -Value $new -Encoding UTF8
    Write-Step "Registered preset-switch row in $patch"
}

# --- 4. verify resolution ----------------------------------------------
Push-Location $profileDir
try {
    node -e "require.resolve('dsh-preset-switch/package.json')" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'package does not resolve after install' }
} finally {
    Pop-Location
}
Write-Step "Package resolves OK."

Write-Host ""
Write-Host "[dsh-preset-switch] Done. Restart dsh, open any session, and look for the '⇄' mode button" -ForegroundColor Green
Write-Host "[dsh-preset-switch] beside the access-mode (permission) control in the composer." -ForegroundColor Green
