/* ── Farben (identisch zum Stromplaner) ─────────────────────────────────── */
export const ACCENT = "#b3483f", DARK = "#1c2127", PANEL = "#252b33", LINE = "#3a424c", BG = "#15191e";
export const OK = "#2ecc71", WARN = "#f39c12", ERR = "#ff5d5d", INFO = "#4ea1ff", MUTED = "#7c8794", SUB = "#9aa4af";

export const LS_KEY = "netzwerkplaner_autosave";

/* ── Anwendungsbereiche (Kategorie eines Geräts) ────────────────────────── */
export const KATEGORIEN = {
  Ton:       { color: "#4ea1ff" },
  Licht:     { color: "#f5d023" },
  Bild:      { color: "#b37dff" },
  Netzwerk:  { color: "#2ecc71" },
  Intercom:  { color: "#ff7eb6" },
  Bühne:     { color: "#ff8c42" },
  Steuerung: { color: "#39d0c8" },
  Sonstiges: { color: "#9aa4af" },
};
export const katColor = (k) => (KATEGORIEN[k] || KATEGORIEN.Sonstiges).color;

/* ── Generische Gerätetypen (Rückfall, wenn kein Katalogmodell passt) ───── */
export const TYPEN = {
  switch_managed:   { label: "Switch (managed)",            icon: "switch",      kat: "Netzwerk",  isSwitch: true, ports: 10 },
  switch_unmanaged: { label: "Switch (unmanaged)",          icon: "switch_u",    kat: "Netzwerk",  isSwitch: true, ports: 8, unmanaged: true },
  router:           { label: "Router / Firewall",           icon: "router",      kat: "Netzwerk",  ports: 5 },
  wlan:             { label: "WLAN-Access-Point",           icon: "wlan",        kat: "Netzwerk",  ports: 1, web: true },
  mischpult:        { label: "Mischpult",                   icon: "mischpult",   kat: "Ton",       ports: 3 },
  stagebox:         { label: "Stagebox / I/O",              icon: "stagebox",    kat: "Ton",       ports: 2 },
  verstaerker:      { label: "Verstärker",                  icon: "verstaerker", kat: "Ton",       ports: 2 },
  controller:       { label: "Lautsprecher-Controller / DSP", icon: "controller", kat: "Ton",      ports: 2 },
  funk:             { label: "Funkstrecke / IEM",           icon: "funk",        kat: "Ton",       ports: 1 },
  lichtpult:        { label: "Lichtpult",                   icon: "lichtpult",   kat: "Licht",     ports: 2 },
  node:             { label: "Node (Art-Net/sACN)",         icon: "node",        kat: "Licht",     ports: 1, web: true },
  dimmer:           { label: "Dimmer",                      icon: "dimmer",      kat: "Licht",     ports: 1 },
  scheinwerfer:     { label: "Moving Head / Scheinwerfer",  icon: "scheinwerfer",kat: "Licht",     ports: 2 },
  medienserver:     { label: "Medienserver",                icon: "medienserver",kat: "Bild",      ports: 2 },
  videomischer:     { label: "Videomischer",                icon: "videomischer",kat: "Bild",      ports: 1 },
  kamera:           { label: "Kamera",                      icon: "kamera",      kat: "Bild",      ports: 1, web: true },
  ledproc:          { label: "LED-Wall-Prozessor",          icon: "ledproc",     kat: "Bild",      ports: 1, web: true },
  projektor:        { label: "Projektor",                   icon: "projektor",   kat: "Bild",      ports: 1, web: true },
  intercom:         { label: "Intercom",                    icon: "intercom",    kat: "Intercom",  ports: 1 },
  pc:               { label: "Laptop / PC",                 icon: "pc",          kat: "Steuerung", ports: 1 },
  tablet:           { label: "Tablet",                      icon: "tablet",      kat: "Steuerung", ports: 0 },
  steuerung:        { label: "Show-Steuerung",              icon: "steuerung",   kat: "Steuerung", ports: 1 },
  rigging:          { label: "Motorsteuerung / Rigging",    icon: "rigging",     kat: "Bühne",     ports: 2 },
  sonstiges:        { label: "Sonstiges Gerät",             icon: "sonstiges",   kat: "Sonstiges", ports: 1 },
};

/* ── Port- und Kabeltypen ───────────────────────────────────────────────── */
export const PORT_TYPEN = ["RJ45", "etherCON", "SFP", "SFP+", "SFP28", "opticalCON", "WLAN"];
export const KABEL = {
  cat5e:  { label: "Cat5e",              dash: "" },
  cat6:   { label: "Cat6 / Cat6a",       dash: "" },
  ethercon: { label: "etherCON Cat6 (Tour)", dash: "" },
  fiber_sm: { label: "Glasfaser SM",     dash: "10 3" },
  fiber_mm: { label: "Glasfaser MM",     dash: "10 3" },
  opticalcon: { label: "opticalCON",     dash: "10 3" },
  dac:    { label: "DAC (SFP-Direktkabel)", dash: "" },
  wlan:   { label: "WLAN",               dash: "2 4" },
  p2p:    { label: "Punkt-zu-Punkt (kein Ethernet)", dash: "6 3 2 3" },
};

/* ── Vorschlag Standard-VLANs (Protokollrecherche, Abschnitt „Standard-VLANs“) */
export const STANDARD_VLANS = [
  { vid: 10, name: "Audio Primary",   farbe: "#4ea1ff", subnetz: "10.10.10.0/24", gateway: "",           zweck: "Dante, AES67, Q-LAN",                   igmp: true,  eeeAus: true,  qos: true,  notiz: "QoS, PTP, IGMP, EEE aus" },
  { vid: 11, name: "Audio Secondary", farbe: "#8ec5ff", subnetz: "10.10.11.0/24", gateway: "",           zweck: "Dante Secondary",                       igmp: true,  eeeAus: true,  qos: true,  notiz: "physisch getrennte Switches" },
  { vid: 20, name: "Licht",           farbe: "#f5d023", subnetz: "10.10.20.0/24", gateway: "",           zweck: "sACN, Art-Net, MA-Net3, HogNet, RDMnet", igmp: true,  eeeAus: true,  qos: false, notiz: "IGMP-Querier" },
  { vid: 30, name: "Video",           farbe: "#b37dff", subnetz: "10.10.30.0/24", gateway: "",           zweck: "NDI, SDVoE, ST 2110",                   igmp: true,  eeeAus: false, qos: false, notiz: "10 G Uplinks, IGMP" },
  { vid: 40, name: "Intercom",        farbe: "#ff7eb6", subnetz: "10.10.40.0/24", gateway: "",           zweck: "Green-GO, Riedel/Clear-Com AES67",      igmp: true,  eeeAus: true,  qos: true,  notiz: "QoS DSCP 46" },
  { vid: 50, name: "Steuerung",       farbe: "#39d0c8", subnetz: "10.10.50.0/24", gateway: "",           zweck: "OSC, PJLink, VISCA, Companion, Crestron", igmp: false, eeeAus: false, qos: false, notiz: "Unicast" },
  { vid: 99, name: "Management",      farbe: "#2ecc71", subnetz: "10.10.99.0/24", gateway: "10.10.99.1", zweck: "Switch-Web-UIs, SNMP, Syslog",          igmp: false, eeeAus: false, qos: false, notiz: "kein Show-Traffic" },
];
// Welcher Standard-VLAN passt zu welcher Kategorie (für Vorbelegung neuer Geräte)
export const KAT_VLAN = { Ton: 10, Licht: 20, Bild: 30, Intercom: 40, Steuerung: 50, Bühne: 50, Netzwerk: 99, Sonstiges: 50 };

export const DEFAULT_BEREICHE = ["FOH", "Bühne", "Monitor", "Delay", "Backstage", "Video-Regie"];

/* ── Style-Objekt (Stromplaner-Designsprache) ───────────────────────────── */
export const S = {
  app:          { fontFamily: "'Segoe UI',system-ui,sans-serif", background: BG, minHeight: "100vh", color: "#e8eaed" },
  header:       { display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: DARK, borderBottom: `2px solid ${ACCENT}`, position: "sticky", top: 0, zIndex: 10, flexWrap: "wrap" },
  logo:         { fontWeight: 800, fontSize: 18, letterSpacing: 1, color: ACCENT, whiteSpace: "nowrap" },
  headerMeta:   { fontSize: 12, color: SUB, flex: 1, minWidth: 120 },
  exportBtn:    { background: ACCENT, color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", fontWeight: 700, cursor: "pointer", fontSize: 13 },
  ghostBtn:     { background: "transparent", color: "#e8eaed", border: `1px solid ${LINE}`, borderRadius: 6, padding: "7px 11px", fontWeight: 600, cursor: "pointer", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 },
  nav:          { display: "flex", gap: 4, padding: "0 18px", background: DARK, borderBottom: `1px solid ${LINE}`, flexWrap: "wrap", position: "sticky", top: 51, zIndex: 9 },
  navBtn:       { background: "transparent", border: "none", color: SUB, padding: "11px 13px", cursor: "pointer", fontSize: 13, borderBottom: "3px solid transparent", transition: "color 0.14s,border-color 0.14s" },
  navBtnActive: { color: "#fff", borderBottom: `3px solid ${ACCENT}`, fontWeight: 600 },
  main:         { padding: 20, maxWidth: 1280, margin: "0 auto" },
  mainWide:     { padding: 0 },
  section:      { background: PANEL, borderRadius: 10, padding: 20, marginBottom: 20, border: `1px solid ${LINE}` },
  h2:           { margin: "0 0 4px", fontSize: 17, color: "#fff" },
  h3:           { margin: "0 0 8px", fontSize: 14, color: "#fff" },
  subtitle:     { margin: "0 0 14px", fontSize: 12, color: SUB, lineHeight: 1.5 },
  metaGrid:     { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 8 },
  field:        { display: "flex", flexDirection: "column", gap: 4 },
  fieldLabel:   { fontSize: 11, color: SUB, fontWeight: 600 },
  input:        { background: "#1b2026", border: `1px solid ${LINE}`, borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 14 },
  inputSm:      { background: "#1b2026", border: `1px solid ${LINE}`, borderRadius: 5, padding: "5px 8px", color: "#fff", fontSize: 13, width: "100%", boxSizing: "border-box" },
  select:       { background: "#1b2026", border: `1px solid ${LINE}`, borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 14, minWidth: 160 },
  selectSm:     { background: "#1b2026", border: `1px solid ${LINE}`, borderRadius: 5, padding: "5px 8px", color: "#fff", fontSize: 13, width: "100%", boxSizing: "border-box" },
  row:          { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 },
  primaryBtn:   { background: ACCENT, color: "#fff", border: "none", borderRadius: 6, padding: "9px 14px", fontWeight: 700, cursor: "pointer", fontSize: 13 },
  secondaryBtn: { background: "#323a44", color: "#fff", border: `1px solid ${LINE}`, borderRadius: 6, padding: "8px 12px", cursor: "pointer", fontSize: 12 },
  smallBtn:     { background: "#323a44", color: "#fff", border: `1px solid ${LINE}`, borderRadius: 5, padding: "4px 8px", cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" },
  dangerBtn:    { background: "transparent", color: ERR, border: "1px solid #5a2a2a", borderRadius: 5, padding: "4px 9px", cursor: "pointer", fontWeight: 700 },
  dangerBtnWide:{ background: "transparent", color: ERR, border: "1px solid #5a2a2a", borderRadius: 6, padding: "8px 12px", cursor: "pointer", fontWeight: 600 },
  table:        { width: "100%", borderCollapse: "collapse", marginTop: 12, fontSize: 13 },
  th:           { textAlign: "left", padding: "7px 8px", borderBottom: `2px solid ${LINE}`, color: SUB, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" },
  td:           { padding: "5px 8px", borderBottom: `1px solid ${LINE}`, verticalAlign: "middle" },
  empty:        { color: MUTED, fontStyle: "italic", padding: "16px 0" },
  hint:         { fontSize: 11, color: MUTED, marginTop: 10, lineHeight: 1.5 },
  card:         { border: `1px solid ${LINE}`, borderRadius: 8, marginBottom: 8, background: "#1f242b" },
  cardHead:     { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", cursor: "pointer", gap: 10 },
  cardTitle:    { fontWeight: 600, fontSize: 14 },
  cardSub:      { fontSize: 11, color: SUB },
  cardBody:     { padding: 14, borderTop: `1px solid ${LINE}` },
  boxTabs:      { display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 },
  boxTab:       { background: PANEL, border: `1px solid ${LINE}`, color: SUB, borderRadius: 6, padding: "7px 12px", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6 },
  boxTabActive: { background: ACCENT, color: "#fff", fontWeight: 700, border: `1px solid ${ACCENT}` },
  chip:         { display: "inline-flex", alignItems: "center", gap: 4, background: "#1b2026", border: `1px solid ${LINE}`, borderRadius: 12, padding: "2px 8px", fontSize: 11, color: "#c8d0d8", whiteSpace: "nowrap" },
  badge:        { display: "inline-block", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" },
  modalBox:     { background: "#1e2530", border: "1px solid #2e3a4a", borderRadius: 10, padding: "22px 24px", color: "#e8eaf0", maxHeight: "86vh", overflow: "auto", boxShadow: "0 16px 48px rgba(0,0,0,.6)" },
};

// Helle Farben für neue VLANs, damit ID und Linien auf dunklem Grund lesbar bleiben
export const VLAN_FARBEN = ["#ff9f43", "#54a0ff", "#1dd1a1", "#feca57", "#ff6b6b", "#c56cf0", "#48dbfb", "#a3cb38", "#fd79a8", "#7bed9f"];
