/* Native Menüleiste (macOS). Die Funktionen bleiben zusätzlich in der App-Leiste.
   Klicks gehen als 'menu'-Ereignis an das Fenster; die Tastenkürzel stehen im System,
   damit Hilfen wie KeyClu oder CheatSheet sie anzeigen. Kürzel, die die App selbst
   abfängt (⌘S, ⌘O, ⌘Z …), lösen nicht doppelt aus: die Seite bekommt die Taste zuerst. */
const { Menu, shell } = require('electron');

const REPO_URL = 'https://github.com/Nomisimo/Netzwerkplaner';

const baueMenue = (win, app) => {
  const senden = (aktion) => () => { if (win && !win.isDestroyed()) win.webContents.send('menu', aktion); };
  const item = (label, aktion, accelerator) => ({ label, click: senden(aktion), ...(accelerator ? { accelerator } : {}) });
  const tabs = [['Setup', 'projekt'], ['Topologie', 'topologie'], ['Geräte', 'geraete'], ['Live', 'live'], ['Katalog', 'bibliothek'], ['Wissen', 'wissen'], ['Anleitung', 'hilfe']];
  const vorlage = [
    {
      label: app.name,
      submenu: [
        { role: 'about', label: 'Über Netzwerkplaner' },
        { type: 'separator' },
        item('Einstellungen …', 'einstellungen', 'CmdOrCtrl+,'),
        { type: 'separator' },
        { role: 'services', label: 'Dienste' },
        { type: 'separator' },
        { role: 'hide', label: 'Netzwerkplaner ausblenden' },
        { role: 'hideOthers', label: 'Andere ausblenden' },
        { role: 'unhide', label: 'Alle einblenden' },
        { type: 'separator' },
        { role: 'quit', label: 'Netzwerkplaner beenden' },
      ],
    },
    {
      label: 'Ablage',
      submenu: [
        item('Neues Projekt', 'neu', 'CmdOrCtrl+N'),
        item('Öffnen …', 'oeffnen', 'CmdOrCtrl+O'),
        item('Zuletzt geöffnet …', 'zuletzt'),
        { type: 'separator' },
        item('Speichern', 'speichern', 'CmdOrCtrl+S'),
        item('Speichern unter …', 'speichernUnter', 'Shift+CmdOrCtrl+S'),
        { type: 'separator' },
        item('Exportieren …', 'export', 'CmdOrCtrl+E'),
        { type: 'separator' },
        item('Gemeinsam arbeiten (Sitzung) …', 'sitzung'),
      ],
    },
    {
      label: 'Bearbeiten',
      submenu: [
        item('Widerrufen', 'undo', 'CmdOrCtrl+Z'),
        item('Wiederholen', 'redo', 'Shift+CmdOrCtrl+Z'),
        { type: 'separator' },
        { role: 'cut', label: 'Ausschneiden' },
        { role: 'copy', label: 'Kopieren' },
        { role: 'paste', label: 'Einsetzen' },
        { role: 'selectAll', label: 'Alles auswählen' },
        { type: 'separator' },
        item('Gerät hinzufügen …', 'geraetNeu', 'CmdOrCtrl+Shift+N'),
        item('Prüfung anzeigen', 'pruefung', 'CmdOrCtrl+Shift+M'),
      ],
    },
    {
      label: 'Darstellung',
      submenu: [
        ...tabs.map(([l, k], i) => item(l, `tab:${k}`, `CmdOrCtrl+${i + 1}`)),
        { type: 'separator' },
        item('Geräte: Liste', 'geraeteAnsicht:liste', 'CmdOrCtrl+Alt+L'),
        item('Geräte: Patchliste', 'geraeteAnsicht:patch', 'CmdOrCtrl+Alt+P'),
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Vollbild' },
      ],
    },
    {
      label: 'Topologie',
      submenu: [
        item('Mindmap', 'ansicht:mindmap', 'CmdOrCtrl+Alt+1'),
        item('Anschlüsse', 'ansicht:front', 'CmdOrCtrl+Alt+2'),
        item('Plott', 'ansicht:cleancat', 'CmdOrCtrl+Alt+3'),
        { type: 'separator' },
        // Einzeltasten ohne ⌘ gehen nicht als Systemkürzel (sie würden beim Tippen auslösen), daher im Namen
        item('Bewegen  (M)', 'werkzeug:move'),
        item('Verbinden  (C)', 'werkzeug:connect'),
        item('Stapeln  (S)', 'werkzeug:stack'),
        { type: 'separator' },
        { label: 'Anpinnen / lösen  (P)', enabled: false },
        { label: 'Auswahl löschen  (Entf)', enabled: false },
        { label: 'Geräte kopieren / einfügen  (⌘C / ⌘V)', enabled: false },
      ],
    },
    { role: 'windowMenu', label: 'Fenster' },
    {
      role: 'help', label: 'Hilfe',
      submenu: [
        item('Anleitung', 'tab:hilfe'),
        item('Was ist neu?', 'neuigkeiten'),
        { type: 'separator' },
        { label: 'Netzwerkplaner auf GitHub', click: () => shell.openExternal(REPO_URL) },
      ],
    },
  ];
  return Menu.buildFromTemplate(vorlage);
};

module.exports = { baueMenue };
