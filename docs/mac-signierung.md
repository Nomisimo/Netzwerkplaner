# Mac-App signieren und beglaubigen

Der Release-Workflow signiert die Mac-Installer mit einem Apple-Zertifikat vom Typ
„Developer ID Application“ und lässt sie bei Apple beglaubigen (Notarisierung). Dann
startet die App ohne Gatekeeper-Warnung und ohne `xattr -cr`. Fehlt das Zertifikat, baut
der Workflow wie bisher eine ad-hoc signierte App und schreibt den Hinweis zum ersten
Start in die Release-Beschreibung.

## Secrets im Repository

GitHub → Settings → Secrets and variables → Actions → „New repository secret“:

| Secret | Inhalt |
|---|---|
| `MAC_CERT_P12_BASE64` | Das Zertifikat mit privatem Schlüssel als .p12, Base64-kodiert |
| `MAC_CERT_PASSWORD` | Passwort der .p12-Datei |
| `APPLE_ID` | E-Mail der Apple-ID im Developer-Account |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-spezifisches Passwort von appleid.apple.com |
| `APPLE_TEAM_ID` | Team-ID (10 Zeichen, developer.apple.com → Membership) |

## Zertifikat als .p12 exportieren

1. In der Schlüsselbundverwaltung unter „Meine Zertifikate“ das Zertifikat
   „Developer ID Application: …“ aufklappen, Zertifikat und Schlüssel markieren,
   Rechtsklick → „2 Objekte exportieren …“ → Format „Persönlicher Informationsaustausch (.p12)“,
   ein Passwort vergeben.
2. Im Terminal kodieren und in die Zwischenablage legen:
   `base64 -i Zertifikat.p12 | pbcopy`
3. Den Inhalt als `MAC_CERT_P12_BASE64` einfügen, das Passwort als `MAC_CERT_PASSWORD`.

Die .p12-Datei und das Passwort gehören nie ins Repository.

## Ablauf im Workflow

- `scripts/mac-signieren.js` stellt die Mac-Konfiguration in package.json für den Build um:
  Zertifikat statt ad-hoc, Hardened Runtime mit `build/entitlements.mac.plist`, Beglaubigung an.
- Das Zertifikat geht nur an die Mac-Jobs, nicht an den Windows-Build.
- „Mac-Signatur prüfen“ bricht ab, wenn die signierte App nicht gültig signiert, nicht
  beglaubigt oder von Gatekeeper abgelehnt ist.
