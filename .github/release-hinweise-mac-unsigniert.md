
**macOS:** Diese Version ist nicht mit einem Apple-Zertifikat signiert, nur ad-hoc. Beim ersten Öffnen meldet macOS, dass die App nicht überprüft werden kann. Ab macOS 15 hilft Rechtsklick › „Öffnen“ nicht mehr: Systemeinstellungen › Datenschutz & Sicherheit › ganz unten „Dennoch öffnen“. Bis macOS 14 geht auch Rechtsklick › „Öffnen“.

Meldet eine ältere, schon installierte Version „beschädigt“, im Terminal ausführen:
`xattr -cr /Applications/Netzwerkplaner.app` und `codesign --force --deep --sign - /Applications/Netzwerkplaner.app`. Meldet macOS dabei „Operation not permitted“, unter Datenschutz & Sicherheit › App-Verwaltung dem Terminal erlauben, Apps zu ändern.
