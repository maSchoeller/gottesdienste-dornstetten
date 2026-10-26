<#
  Holt die Gottesdienst-Termine aus ChurchTools und schreibt site/data/gottesdienste.json.
  Die Seite selbst ist statisch und braucht keinen Token.

  Token:  Umgebungsvariable CT_TOKEN (z. B. GitHub-Secret) oder lokal
          die mit scripts\set-token.ps1 gespeicherte Datei.
  Aufruf: pwsh -File scripts\export.ps1
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$cfg  = Get-Content (Join-Path $root 'config.json') -Raw -Encoding utf8 | ConvertFrom-Json

function Get-Token {
    if ($env:CT_TOKEN) { return $env:CT_TOKEN.Trim() }
    $file = if ($env:APPDATA) { Join-Path $env:APPDATA 'ChurchTools\gottesdienst-dashboard.dat' }
    if (-not $file -or -not (Test-Path $file)) { throw "Kein Token. Lokal: pwsh -File scripts\set-token.ps1 ausfuehren, in CI: CT_TOKEN setzen." }
    $secure = Get-Content $file | ConvertTo-SecureString
    return [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)).Trim()
}

$headers = @{ Authorization = "Login $(Get-Token)" }

# Vorab pruefen, ob der Account alle Kalender sehen darf – sonst verstaendlich abbrechen
$me      = (Invoke-RestMethod "$($cfg.instanz)/api/whoami" -Headers $headers).data
$sichtbar = @((Invoke-RestMethod "$($cfg.instanz)/api/calendars" -Headers $headers).data | ForEach-Object { [int]$_.id })
$fehlend = @($cfg.kalender | Where-Object { $sichtbar -notcontains [int]$_.id } | ForEach-Object { $_.id })
Write-Host "Account: $($me.firstName) $($me.lastName) (ID $($me.id)), sichtbare Kalender: $($sichtbar -join ', ')"
if ($fehlend.Count) {
    throw "Der Account darf diese Kalender nicht sehen: $($fehlend -join ', '). In ChurchTools unter Berechtigungen > Kalender 'Kategorie sehen' fuer diese Kalender freigeben."
}
$bis     = (Get-Date).Year + [int]$cfg.jahreVoraus

# Ort bestimmen: Ort/Kirche im Titel geht vor (2026 steht alles im Kalender Dornstetten),
# dann der Ort des Kalenders, dann Untertitel/Beschreibung, sonst "ohne".
$ortMuster = foreach ($o in $cfg.orte) { foreach ($t in $o.muster) { [pscustomobject]@{ key = $o.key; muster = $t } } }
function Find-Ort([string]$text) {
    if (-not $text) { return $null }
    # m.a.p.-Gottesdienste finden in Dornstetten statt; "m.a.p" schlaegt daher "Dornstetten"
    if ($text -match 'm\.a\.p') { return 'map' }
    $treffer = $null; $pos = -1
    foreach ($t in $ortMuster) {
        $m = [regex]::Matches($text, '(?<![\p{L}])' + [regex]::Escape($t.muster) + '(?![\p{L}])')
        if ($m.Count -and $m[$m.Count - 1].Index -gt $pos) { $pos = $m[$m.Count - 1].Index; $treffer = $t.key }
    }
    return $treffer
}
function Get-Ort($b, $kalOrt) {
    $o = Find-Ort $b.title
    if (-not $o) { $o = $kalOrt }
    if (-not $o) { $o = Find-Ort "$($b.subtitle) $($b.description)" }
    if (-not $o) { $o = 'ohne' }
    return $o
}

# Gottesdienst oder Sonderveranstaltung – nach Stichworten im Titel (config.json)
$gdRegex = '(?i)' + (($cfg.gottesdienstMuster) -join '|')

$termine = [System.Collections.Generic.List[object]]::new()
$kalOrt  = @{}; foreach ($k in $cfg.kalender) { $kalOrt[[int]$k.id] = $k.ort }
$kalHeimat = @($cfg.kalender | Where-Object { $_.heimatkirche } | ForEach-Object { [int]$_.id })
$kalQuery = ($cfg.kalender | ForEach-Object { "calendar_ids[]=$($_.id)" }) -join '&'

# jahresweise abrufen, damit einzelne Antworten klein bleiben
for ($jahr = [int]$cfg.abJahr; $jahr -le $bis; $jahr++) {
    $url = "$($cfg.instanz)/api/calendars/appointments?$kalQuery&from=$jahr-01-01&to=$jahr-12-31"
    $res = Invoke-RestMethod -Uri $url -Headers $headers
    foreach ($a in $res.data) {
        $b = $a.base
        if ($b.isInternal -and -not $cfg.interneEintraegeZeigen) { continue }
        $termine.Add([ordered]@{
            id     = "$($b.id)-$($a.calculated.startDate)"
            start  = $a.calculated.startDate
            ende   = $a.calculated.endDate
            ganztags = [bool]$b.allDay
            titel  = $b.title
            zusatz = $b.subtitle
            ort    = Get-Ort $b $kalOrt[[int]$b.calendar.id]
            art    = $(if ($b.title -match $gdRegex) { 'gd' } else { 'sonder' })
            heimat = ($kalHeimat -contains [int]$b.calendar.id) -or ($b.title -match $cfg.heimatkircheMuster)
            kalender = $b.calendar.name
        })
    }
    Write-Host ("{0}: {1} Termine" -f $jahr, $res.data.Count)
}

$sortiert = $termine | Sort-Object { $_.start }
$out = [ordered]@{
    stand   = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    orte    = $cfg.orte | ForEach-Object { [ordered]@{ key = $_.key; name = $_.name; spalte = $(if ($_.spalte) { $_.spalte } else { $_.name }); kurz = $(if ($_.kurz) { $_.kurz } else { $_.name }) } }
    termine = @($sortiert)
}
$ziel = Join-Path $root 'site' 'data' 'gottesdienste.json'   # auch auf Linux-Runnern
New-Item -ItemType Directory -Force (Split-Path $ziel) | Out-Null
$out | ConvertTo-Json -Depth 5 -Compress | Set-Content -Path $ziel -Encoding utf8NoBOM
Write-Host "Geschrieben: $ziel ($($sortiert.Count) Termine)"
