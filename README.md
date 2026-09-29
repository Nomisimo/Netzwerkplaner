# Netzwerkplaner

Offline-Netzwerktopologie-Planer für die Veranstaltungstechnik als Electron-App (macOS und Windows).

- Darstellung als Mindmap-/Diagramm-Layout
- Standard-Hardware und -Netzwerkprotokolle, Geräte mit eigenen Icons
- VLANs, IP-Adressen, Subnetzmasken
- Verbindungen über Switches
- Markierung, ob ein Gerät eine Web-UI hat (Direktlink, wenn im selben Netz erreichbar)

## Struktur

| Ordner | Inhalt |
|---|---|
| `src/main` | Electron-Hauptprozess |
| `src/preload` | Preload-Skripte (IPC-Brücke) |
| `src/renderer` | Oberfläche (Diagramm-Editor) |
| `src/shared` | Gemeinsame Typen, Datenmodell, Gerätebibliothek |
| `assets/icons/devices` | Geräte-Icons |
| `assets/app-icon` | App-Icon (`.icns` / `.ico`) |
| `build` | Build-/Packaging-Konfiguration |
| `docs` | Dokumentation |
| `test` | Tests |
