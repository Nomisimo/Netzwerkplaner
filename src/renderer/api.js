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
  exportPdf: async (html, name) => {
    if (E) return E.exportPdf({ html, name });
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
    return null;
  },
  openExternal: (url) => (E ? E.openExternal(url) : window.open(url, "_blank")),
  // Erreichbarkeit: [{ id, ip, port }] → { id: { ok, ms, method } }
  checkReachability: async (targets) => {
    if (E) return E.checkReachability(targets);
    return Object.fromEntries(targets.map((t) => [t.id, { ok: null, method: "nur in der Desktop-App" }]));
  },
  onOpenFile: (cb) => E && E.onOpenFile && E.onOpenFile(cb),
};
