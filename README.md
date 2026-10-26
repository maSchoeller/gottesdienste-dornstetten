# Gottesdienst-Jahresplaner

Öffentliche Jahresübersicht der Gottesdienste der Ev. Verbundkirchengemeinde Dornstetten
(Dornstetten, Hallwangen, Aach, m.a.p.) aus ChurchTools (`elkw1608.krz.tools`), im ELKW-Design (Stil „nahbar“, Farbwelt 01).

## Aufbau

| Pfad | Zweck |
|---|---|
| `config.json` | Kalender, Orte, Stichworte für Ortszuordnung und „Gottesdienst“ |
| `scripts/set-token.ps1` | Service-Token lokal speichern (DPAPI, nur dieser Windows-Benutzer) |
| `scripts/export.ps1` | holt alle Termine und schreibt `site/data/gottesdienste.json` |
| `site/` | statische Seite – das ist alles, was gehostet wird |

Die Seite braucht **keinen Token**; nur der Export spricht mit ChurchTools.

## Regeln der Aufbereitung

- **Kalender:** 2 (Gottesdienste Dornstetten), 91 (Hallwangen), 94 (Aach), 97 (m.a.p.).
- **Ort:** Ortsname oder Kirche im Titel (Martinskirche, Engeltalkirche, Andreaskirche, „m.a.p“) → sonst Ort des Kalenders → sonst Untertitel/Beschreibung → sonst „Ohne Ortsangabe“.
- **Gottesdienst vs. Sonderveranstaltung:** Titel enthält eines der Stichworte aus `gottesdienstMuster` → Gottesdienst (Kirchen-Symbol). Alles andere ist Sonderveranstaltung und lässt sich auf der Seite ausblenden.
- **Nicht veröffentlicht:** in ChurchTools als „intern“ markierte Termine, die Beschreibung (enthält interne Notizen).

## Lokal

```powershell
pwsh -File scripts\set-token.ps1     # einmalig, Token verdeckt eingeben
pwsh -File scripts\export.ps1        # Daten holen
python -m http.server 8137 --directory site
```

## Veröffentlichen

GitHub Action [`.github/workflows/veroeffentlichen.yml`](.github/workflows/veroeffentlichen.yml):
täglich um 3 und 15 Uhr (Winterzeit; im Sommer eine Stunde später), bei jedem Push auf `main` und von Hand
(Actions → „Veröffentlichen“ → Run workflow). Sie führt `scripts/export.ps1` mit dem Repository-Secret
`CT_TOKEN` aus und veröffentlicht `site/` auf GitHub Pages: https://maschoeller.github.io/gottesdienste-dornstetten/

Schlägt der Export fehl (z. B. Token abgelaufen), bleibt die zuletzt veröffentlichte Fassung online.

Token im Secret erneuern:

```powershell
gh secret set CT_TOKEN --repo maSchoeller/gottesdienste-dornstetten
```

Eigene Domain später: Repository → Settings → Pages → Custom domain, dazu ein CNAME-Eintrag beim Domain-Anbieter auf `maschoeller.github.io`.
