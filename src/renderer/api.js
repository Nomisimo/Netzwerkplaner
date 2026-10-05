// Brücke zum Electron-Hauptprozess mit Browser-Rückfall (z. B. für Tests im Browser)
const E = typeof window !== "undefined" ? window.electronAPI : null;
export const isElectron = !!E;

export const downloadBlob = (data, filename, type) => {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const pickFile = (accept) => new Promise((resolve) => {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = accept;
  inp.onchange = () => {
    const f = inp.files[0];
    if (!f) return resolve(null);
    const r = new FileReader();
    r.onload = () => resolve({ data: r.result, name: f.name.replace(/\.netplan(\.json)?$|\.json$/i, ""), filePath: null });
    r.readAsText(f);
  };
  inp.click();
});

export const api = {
  checkForUpdates: () => (E?.checkForUpdates ? E.checkForUpdates() : Promise.resolve({ auto: false })),
  macUpdateLaden: (tag) => (E?.macUpdateLaden ? E.macUpdateLaden(tag) : Promise.resolve({ ok: false })),
  appBeenden: () => E?.appBeenden?.(),
  installUpdate: (url) => (E?.installUpdate ? E.installUpdate(url) : window.open(url, "_blank")),
  onUpdateStatus: (cb) => (E?.onUpdateStatus ? E.onUpdateStatus(cb) : () => {}),
  fetchReleases: () => (E ? E.fetchReleases() : fetch("https://api.github.com/repos/Nomisimo/Netzwerkplaner/releases?per_page=20").then((r) => (r.ok ? r.json() : null)).catch(() => null)),
  appVersion: () => (E ? E.appVersion() : Promise.resolve(typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev")),
  saveProject: async (json, suggestedName, filePath) => {
    if (E) return E.saveProject({ json, suggestedName, filePath });
    downloadBlob(json, `${suggestedName}.netplan`, "application/json");
    return { name: suggestedName, filePath: null };
  },
  openProject: () => (E ? E.openProject() : pickFile(".netplan,.json")),
  openRecent: (p) => (E ? E.openRecent(p) : Promise.resolve(null)),
  getRecents: () => (E ? E.getRecents() : Promise.resolve([])),
  loadLibrary: () => (E ? E.loadLibrary() : Promise.resolve(JSON.parse(localStorage.getItem("netzwerkplaner_bibliothek") || "null"))),
  saveLibrary: (data) => (E ? E.saveLibrary(data) : Promise.resolve(localStorage.setItem("netzwerkplaner_bibliothek", JSON.stringify(data)))),
  saveFile: async (data, name, filters, encoding) => {
    if (E) return E.saveFile({ data, name, filters, encoding });
    downloadBlob(encoding === "base64" ? Uint8Array.from(atob(data), (c) => c.charCodeAt(0)) : data, name);
    return name;
  },
  exportPdf: async (html, name, { pageSize } = {}) => {
    if (E) return E.exportPdf({ html, name, pageSize });
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
    return null;
  },
  openExternal: (url) => (E ? E.openExternal(url) : window.open(url, "_blank")),
  // Erreichbarkeit: [{ id, ip, port }] → { id: { ok, ms, method } }; src = Adresse der Netzwerkkarte
  checkReachability: async (targets, src) => {
    if (E) return E.checkReachability(targets, src);
    return Object.fromEntries(targets.map((t) => [t.id, { ok: null, method: "nur in der Desktop-App" }]));
  },
  // Live-Monitore (nur Desktop-App)
  monInterfaces: () => (E?.monInterfaces ? E.monInterfaces() : Promise.resolve([])),
  monStart: (kind, opts) => (E?.monStart ? E.monStart(kind, opts) : Promise.resolve({ ok: false, error: "Live-Monitore funktionieren nur in der Desktop-App." })),
  monStop: (kind) => (E?.monStop ? E.monStop(kind) : Promise.resolve(true)),
  monAction: (kind, name, args) => (E?.monAction ? E.monAction(kind, name, args) : Promise.resolve({ ok: false, error: "Nur in der Desktop-App." })),
  monState: () => (E?.monState ? E.monState() : Promise.resolve({})),
  onMonEvent: (cb) => (E?.onMonEvent ? E.onMonEvent(cb) : () => {}),
  onOpenFile: (cb) => E && E.onOpenFile && E.onOpenFile(cb),
};
