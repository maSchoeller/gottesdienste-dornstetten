<#
  Speichert den API-Token des ChurchTools-Service-Accounts fuer dieses Projekt.
  Verschluesselt per DPAPI (nur dein Windows-Benutzer auf diesem PC kann ihn lesen),
  getrennt vom persoenlichen Token des churchtools-Skills.

  Aufruf:  pwsh -File scripts\set-token.ps1
#>
$ErrorActionPreference = 'Stop'
$dir  = Join-Path $env:APPDATA 'ChurchTools'
$file = Join-Path $dir 'gottesdienst-dashboard.dat'
New-Item -ItemType Directory -Force $dir | Out-Null

$secure = Read-Host 'API-Token des Service-Accounts (Eingabe verdeckt)' -AsSecureString
$plain  = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
if ([string]::IsNullOrWhiteSpace($plain)) { throw 'Kein Token eingegeben.' }

$cfg = Get-Content (Join-Path $PSScriptRoot '..\config.json') -Raw | ConvertFrom-Json
try {
    $me = Invoke-RestMethod "$($cfg.instanz)/api/whoami" -Headers @{ Authorization = "Login $($plain.Trim())" }
} catch {
    throw "Token wurde nicht akzeptiert: $($_.Exception.Message)"
}
$secure | ConvertFrom-SecureString | Set-Content -Path $file -Encoding ascii
Write-Host "Gespeichert fuer: $($me.data.firstName) $($me.data.lastName) (ID $($me.data.id))"
Write-Host "Datei: $file"
