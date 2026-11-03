/* Native Menüleiste. macOS: oben am Bildschirmrand; das Suchfeld im Hilfe-Menü findet alle
   Einträge. Windows: Leiste im Fenster, ausgeblendet, bis man Alt drückt (Alt+D öffnet
   „Datei“ usw.), auf Wunsch immer sichtbar. Die Funktionen bleiben zusätzlich in der App.
   Klicks gehen als 'menu'-Ereignis an das Fenster; die Tastenkürzel stehen im System,
   damit Hilfen wie KeyClu oder CheatSheet sie anzeigen. Kürzel, die die App selbst
   abfängt (⌘S, ⌘O, ⌘Z …), lösen nicht doppelt aus: die Seite bekommt die Taste zuerst.
   Den Stand (Einstellungen, Tabs, Anleitungs-Kapitel) meldet die Oberfläche über
   'menu-zustand'; das Menü wird dann neu gebaut, damit Häkchen und Listen stimmen. */
// Electron erst beim Bauen laden, damit sich die Vorlage ohne Electron testen lässt
const oeffne = (url) => require('electron').shell.openExternal(url);

const REPO_URL = 'https://github.com/Nomisimo/Netzwerkplaner';

// Bis die Oberfläche ihren Stand meldet
const STANDARD_TABS = [['projekt', 'Projekt'], ['vlans', 'VLANs'], ['topologie', 'Topologie'], ['geraete', 'Geräte'], ['live', 'Live'], ['bibliothek', 'Bibliothek'], ['hilfe', 'Hilfe']];

const menueVorlage = (win, app, { zustand = {}, recents = [], leisteImmer = false, onLeiste, plattform = process.platform } = {}) => {
  const MAC = plattform === 'darwin';
  // & markiert unter Windows den Buchstaben für Alt+Taste; macOS kennt das nicht
  const m = (label) => (MAC ? label.replace(/&/g, '') : label);
  // Wörtliches & (z. B. „Port & VLAN“) schreibt Windows doppelt
  const w = (label) => (MAC ? label : label.replace(/&/g, '&&'));
  const tabs = zustand.tabs?.length ? zustand.tabs : STANDARD_TABS;
  const kapitel = zustand.kapitel || [];
  const e = zustand.einst;
  const t = e?.topo || {};

  const senden = (aktion) => () => { if (win && !win.isDestroyed()) win.webContents.send('menu', aktion); };
  const item = (label, aktion, accelerator) => ({ label: m(label), click: senden(aktion), ...(accelerator ? { accelerator } : {}) });
  const radio = (label, aktion, an) => ({ label: w(label), type: 'radio', checked: !!an, click: senden(aktion) });
  const haken = (label, aktion, an, extra) => ({ label: w(label), type: 'checkbox', checked: !!an, click: senden(aktion), ...extra });
  const auswahl = (label, schluessel, wert, optionen) => ({ label: w(label), submenu: optionen.map(([k, l]) => radio(l, `${schluessel}:${k}`, wert === k)) });
  // Strg+Alt ist unter Windows AltGr (Strg+Alt+2 = ²), daher dort Strg+Umschalt
  const alt = MAC ? 'CmdOrCtrl+Alt' : 'Ctrl+Shift';
  const eigeneFokus = Array.isArray(e?.fokusHersteller) ? e.fokusHersteller : null;

  const einstellungen = {
    label: m('E&instellungen'),
    submenu: [
      // macOS: ⌘, sitzt wie gewohnt im App-Menü
      item('Alle Einstellungen …', 'einstellungen', MAC ? undefined : 'CmdOrCtrl+,'),
      { type: 'separator' },
      auswahl('Erscheinungsbild', 'theme', zustand.theme || 'system', [['system', 'Wie das System'], ['hell', 'Hell'], ['dunkel', 'Dunkel']]),
      ...(e ? [
        auswahl('Port-Lasche an Geräten', 'einst:lasche', e.lasche, [['standard', 'Standard (nur der Port, über den das Gerät hängt)'], ['erweitert', 'Erweitert (alle belegten Ports)']]),
        {
          label: 'Fokus im Katalog',
          submenu: [
            radio('Recherchierte Hersteller', 'einst:fokus:recherchiert', !eigeneFokus),
            radio('Keine', 'einst:fokus:keine', eigeneFokus && !eigeneFokus.length),
            radio(`Eigene Auswahl${eigeneFokus?.length ? ` (${eigeneFokus.length})` : ''}`, 'einstellungen', eigeneFokus?.length > 0),
            { type: 'separator' },
            item('Hersteller auswählen …', 'einstellungen'),
          ],
        },
        { type: 'separator' },
        {
          label: 'Topologie: Standard-Anzeige',
          submenu: [
            auswahl('Ansicht', 'einst:topo:ansicht', t.ansicht, [['mindmap', 'Mindmap'], ['front', 'Anschlüsse'], ['cleancat', 'Druckplan']]),
            auswahl('Linien', 'einst:topo:linien', t.linien, [['rund', 'Rund'], ['eckig', 'Eckig'], ['direkt', 'Direkt']]),
            auswahl('Farbe', 'einst:topo:farbe', t.farbe, [['vlan', 'VLAN'], ['kat', 'Bereich'], ['kabel', 'Kabeltyp']]),
            auswahl('Titel', 'einst:topo:titel', t.titel, [['name', 'Gerätename'], ['netzname', 'Netzwerkname'], ['typ', 'Typ / Modell']]),
            { type: 'separator' },
            haken('Einrasten (Anschlüsse)', 'einst:topo:einrasten', t.einrasten),
            haken('Auto-Anordnen (Anschlüsse)', 'einst:topo:autoAnordnen', t.autoAnordnen),
            haken('Kabel bündeln (nur bei eckigen Linien)', 'einst:topo:kabelBuendel', t.kabelBuendel, { enabled: t.linien === 'eckig' }),
            haken('Port & VLAN', 'einst:topo:portVlan', t.portVlan),
            { type: 'separator' },
            item('Auf offenes Projekt anwenden', 'einst:topoAnwenden'),
            item('Zurücksetzen', 'einst:topoZuruecksetzen'),
          ],
        },
      ] : []),
      ...(MAC ? [] : [
        { type: 'separator' },
        { label: 'Menüleiste immer anzeigen', type: 'checkbox', checked: leisteImmer, click: (mi) => onLeiste?.(mi.checked) },
      ]),
    ],
  };

  const zuletzt = {
    label: m('&Zuletzt geöffnet'),
    submenu: recents.length
      ? [...recents.map((r) => ({ label: r.name, toolTip: r.filePath, click: senden(`datei:${r.filePath}`) })),
        { type: 'separator' }, item('Liste in der App zeigen', 'zuletzt')]
      : [{ label: 'Noch keine Dateien geöffnet', enabled: false }],
  };

  const vorlage = [
    ...(MAC ? [{
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
    }] : []),
    {
      label: m(MAC ? 'Ablage' : '&Datei'),
      submenu: [
        item('&Neues Projekt', 'neu', 'CmdOrCtrl+N'),
        item('Ö&ffnen …', 'oeffnen', 'CmdOrCtrl+O'),
        zuletzt,
        { type: 'separator' },
        item('&Speichern', 'speichern', 'CmdOrCtrl+S'),
        item('Speichern &unter …', 'speichernUnter', 'Shift+CmdOrCtrl+S'),
        { type: 'separator' },
        item('&Exportieren …', 'export', 'CmdOrCtrl+E'),
        { type: 'separator' },
        item('&Gemeinsam arbeiten (Sitzung) …', 'sitzung'),
        ...(MAC ? [] : [{ type: 'separator' }, { role: 'quit', label: '&Beenden', accelerator: 'Alt+F4' }]),
      ],
    },
    {
      label: m('&Bearbeiten'),
      submenu: [
        item('&Widerrufen', 'undo', 'CmdOrCtrl+Z'),
        item('Wieder&holen', 'redo', MAC ? 'Shift+CmdOrCtrl+Z' : 'CmdOrCtrl+Y'),
        { type: 'separator' },
        { role: 'cut', label: m('&Ausschneiden') },
        { role: 'copy', label: m('&Kopieren') },
        { role: 'paste', label: m('&Einsetzen') },
        { role: 'selectAll', label: m('A&lles auswählen') },
        { type: 'separator' },
        item('&Gerät hinzufügen …', 'geraetNeu', 'CmdOrCtrl+Shift+N'),
        item('&Prüfung anzeigen', 'pruefung', 'CmdOrCtrl+Shift+M'),
      ],
    },
    {
      label: m(MAC ? 'Darstellung' : '&Ansicht'),
      submenu: [
        ...tabs.slice(0, 9).map(([k, l], i) => item(l, `tab:${k}`, `CmdOrCtrl+${i + 1}`)),
        { type: 'separator' },
        item('Geräte: Liste', 'geraeteAnsicht:liste', `${alt}+L`),
        item('Geräte: Patchliste', 'geraeteAnsicht:patch', `${alt}+P`),
        { type: 'separator' },
        { role: 'togglefullscreen', label: m('&Vollbild') },
      ],
    },
    {
      label: m('&Topologie'),
      submenu: [
        item('Mindmap', 'ansicht:mindmap', `${alt}+1`),
        item('Anschlüsse', 'ansicht:front', `${alt}+2`),
        item('Druckplan', 'ansicht:cleancat', `${alt}+3`),
        { type: 'separator' },
        // Einzeltasten ohne ⌘ gehen nicht als Systemkürzel (sie würden beim Tippen auslösen), daher im Namen
        item('Auswählen / Bewegen  (M)', 'werkzeug:move'),
        item('Verbinden  (C)', 'werkzeug:connect'),
        item('Stapeln  (S)', 'werkzeug:stack'),
        { type: 'separator' },
        { label: 'Anpinnen / lösen  (P)', enabled: false },
        { label: `Auswahl löschen  (${MAC ? '⌫' : 'Entf'})`, enabled: false },
        { label: `Geräte kopieren / einfügen  (${MAC ? '⌘C / ⌘V' : 'Strg+C / Strg+V'})`, enabled: false },
      ],
    },
    einstellungen,
    ...(MAC ? [{ role: 'windowMenu', label: 'Fenster' }] : []),
    {
      role: 'help', label: m('&Hilfe'),
      submenu: [
        item('&Anleitung', 'tab:anleitung', MAC ? undefined : 'F1'),
        item('&Tour starten', 'tour:schnell'),
        // Jedes Kapitel als eigener Eintrag, damit die Suche im Hilfe-Menü (macOS) es findet
        ...(kapitel.length ? [{ label: m('Anleitung: &Kapitel'), submenu: kapitel.map(([id, titel]) => item(titel, `kapitel:${id}`)) }] : []),
        item('Netzwerk-&Wissen: Protokolle und Netzrechner', 'tab:wissen'),
        item('Was ist &neu?', 'neuigkeiten'),
        { type: 'separator' },
        { label: m('Netzwerkplaner auf &GitHub'), click: () => oeffne(REPO_URL) },
        { label: m('Fehler &melden …'), click: () => oeffne(`${REPO_URL}/issues/new`) },
        ...(MAC ? [] : [{ type: 'separator' }, { role: 'about', label: '&Über Netzwerkplaner' }]),
      ],
    },
  ];
  return vorlage;
};
const baueMenue = (win, app, opt) => require('electron').Menu.buildFromTemplate(menueVorlage(win, app, opt));

module.exports = { baueMenue, menueVorlage };
