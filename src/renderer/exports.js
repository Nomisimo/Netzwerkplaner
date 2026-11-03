import * as XLSX from "xlsx";
import { TYPEN, HELL, FARBEN_DUNKEL, FARBEN_HELL } from "../shared/constants.js";
import { connVlan, otherEnd, webUrl, kabelLabel } from "../shared/model.js";
import { ipSort, prefixToMaskStr } from "../shared/net.js";
import { ladeLogo } from "./logo.js";
import { vlanBaum, aeusseresVlan } from "../shared/qinq.js";
import { ipPorts, physPorts } from "../shared/catalog.js";
import { feldSpalten, feldWert } from "../shared/felder.js";
import { patchGruppen, patchExportZeilen } from "../shared/patchliste.js";
import { hellMachen, vlanGruppen, standortGruppen, switchGruppen } from "../shared/exportplan.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const fileBase = (P) => (P.meta.veranstaltung || "Netzwerkplan").replace(/[\\/:*?"<>|]+/g, "_").trim() || "Netzwerkplan";

/* ── Topologie als eigenständiges SVG ─────────────────────────────────── */
export const topologySvg = (svgEl, P) => {
  if (!svgEl) return null;
  // Clean-Cat-Ansicht: das A3-Blatt so übernehmen, wie es ist
  if (svgEl.hasAttribute("data-cleancat")) {
    const c = svgEl.cloneNode(true);
    c.removeAttribute("style");
    return { svg: new XMLSerializer().serializeToString(c), w: +c.getAttribute("width"), h: +c.getAttribute("height") };
  }
  const clone = svgEl.cloneNode(true);
  const world = clone.querySelector("#np-world");
  const b = JSON.parse(world.getAttribute("data-bounds"));
  // Exporte sind immer hell: die Anschluss-Ansicht zeichnet App.jsx dafür hell (data-hell),
  // die Mindmap bekommt unten die Farben der hellen Oberfläche
  const bgColor = "#ffffff";
  clone.querySelectorAll(".np-ui, .np-legend").forEach((n) => n.remove());
  world.removeAttribute("transform");
  // Mindmap in den Farben der hellen Oberfläche; der Wurzel-Switch und Stapel-Rahmen haben eigene dunkle Töne
  if (!HELL && !world.hasAttribute("data-hell")) {
    const extra = { "#262d36": "#fbefed", "#ffffff08": "#00000006" };
    for (const n of clone.querySelectorAll("*")) for (const a of ["fill", "stroke", "stop-color", "color", "style"]) {
      const v = n.getAttribute(a);
      if (v && v.includes("#")) n.setAttribute(a, hellMachen(v, FARBEN_DUNKEL, FARBEN_HELL, extra));
    }
  }
  const pad = 40, head = 50;
  const x = b.minX - pad, y = b.minY - pad - head, w = b.maxX - b.minX + pad * 2, h = b.maxY - b.minY + pad * 2 + head;
  clone.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
  clone.setAttribute("width", Math.round(w));
  clone.setAttribute("height", Math.round(h));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.removeAttribute("style");
  const ns = "http://www.w3.org/2000/svg";
  const bg = document.createElementNS(ns, "rect");
  Object.entries({ x, y, width: w, height: h, fill: bgColor }).forEach(([k, v]) => bg.setAttribute(k, v));
  clone.insertBefore(bg, clone.firstChild.nextSibling);
  const t = document.createElementNS(ns, "text");
  Object.entries({ x: x + pad, y: y + 34, fill: "#b3483f", "font-size": 18, "font-weight": 800, class: "np-titel" }).forEach(([k, v]) => t.setAttribute(k, v));
  t.textContent = `${P.meta.veranstaltung}${P.meta.ort ? " · " + P.meta.ort : ""} · Netzwerktopologie · v${P.meta.version} · ${P.meta.datum}`;
  clone.appendChild(t);
  return { svg: new XMLSerializer().serializeToString(clone), w, h };
};

export const svgToPngBase64 = (svg, w, h, scale = 2) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    const s = Math.min(scale, 8000 / Math.max(w, h));
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, c.width, c.height);
    resolve(c.toDataURL("image/png").split(",")[1]);
  };
  img.onerror = reject;
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
});

/* ── Tabellen ─────────────────────────────────────────────────────────── */
export const ipRows = (P, X) => {
  const r = [];
  for (const d of P.geraete) for (const i of ipPorts(d)) {
    if (!i.ip && !i.dhcp && !i.virtuell) continue; // Ports ohne Adresse (z. B. zweiter Port eines Daisy-Chain-Geräts)
    const v = X.vlanById.get(i.vlan);
    r.push({ IP: i.ip || (i.dhcp ? "DHCP" : ""), Maske: prefixToMaskStr(+i.prefix), CIDR: "/" + i.prefix, VLAN: v ? v.vid : "", "VLAN-Name": v?.name || "", Gerät: d.name, Port: i.name, Gateway: i.gateway || "", MAC: i.mac, Standort: d.bereich, Hersteller: d.hersteller, Modell: d.modell, "Web-UI": webUrl(d) || "" });
  }
  return r.sort((a, b) => (+a.VLAN || 9999) - (+b.VLAN || 9999) || ipSort(a.IP, b.IP));
};
export const patchRows = (P, X) => P.verbindungen.map((c, n) => {
  const ra = X.portRef.get(`${c.a.dev}:${c.a.port}`), rb = X.portRef.get(`${c.b.dev}:${c.b.port}`);
  const cv = connVlan(c, X);
  return { "#": n + 1, Label: c.label, "Von Gerät": ra?.dev.name, "Von Port": ra?.port.name, "Nach Gerät": rb?.dev.name, "Nach Port": rb?.port.name,
    VLAN: (cv.kind === "trunk" ? "Trunk: " : "") + cv.vlans.map((id) => X.vlanById.get(id)?.vid).join(", "), Kabel: kabelLabel(c.kabel), Notiz: c.notiz || "" };
});
export const deviceRows = (P, X) => { const felder = feldSpalten(P.geraete, P.feldKatalog); return P.geraete.map((d) => ({
  Name: d.name, Netzwerkname: d.netzname || "", Typ: TYPEN[d.typ]?.label, Gewerk: d.kategorie, Standort: d.bereich, Hersteller: d.hersteller, Modell: d.modell,
  IPs: ipPorts(d).filter((i) => i.ip).map((i) => `${i.ip}/${i.prefix}`).join(", "), Ports: physPorts(d).length, "Web-UI": webUrl(d) || (d.webUi?.vorhanden ? "ja (IP fehlt)" : ""),
  Protokolle: (d.protokolle || []).join(", "), ...Object.fromEntries(felder.map((f) => [f.name, feldWert(d, f.id)])), Notizen: d.notizen,
})); };
export const vlanRows = (P) => vlanBaum(P.vlans).map(({ v }) => ({
  VLAN: v.vid, "S-VLAN (QinQ)": aeusseresVlan(v, P.vlans)?.vid ?? "", Name: v.name, Zweck: v.zweck,
  IGMP: v.igmp ? "ja" : "nein", "EEE aus": v.eeeAus ? "ja" : "nein", QoS: v.qos ? "ja" : "nein", DHCP: v.dhcp?.aktiv ? "ja" : "nein", Notiz: v.notiz,
}));
export const switchPortRows = (P, X) => {
  const r = [];
  for (const sw of P.geraete.filter((d) => d.isSwitch)) for (const p of sw.ports) {
    const cs = X.connsByPort.get(`${sw.id}:${p.id}`) || [];
    const o = cs[0] ? otherEnd(cs[0], sw.id) : null;
    const od = o ? X.portRef.get(`${o.dev}:${o.port}`) : null;
    r.push({ Switch: sw.name, Port: p.name, Typ: p.typ, Modus: p.modus === "trunk" ? "Trunk" : "Access",
      VLAN: p.modus === "trunk" ? (p.vlans || []).map((id) => X.vlanById.get(id)?.vid).filter(Boolean).sort((a, b) => a - b).join(",") : X.vlanById.get(p.vlan)?.vid || "", PoE: p.poe ? "ja" : "",
      Gegenstelle: od ? `${od.dev.name} [${od.port.name}]` : "" });
  }
  return r;
};

// Blätter des Excel-Exports; der Export-Dialog wählt daraus aus
export const XLSX_BLAETTER = ["Patchliste", "IP-Liste", "VLANs", "Verbindungen", "Switch-Ports", "Geräte", "Prüfung"];
export const buildXlsxBase64 = (P, X, issues, blaetter = XLSX_BLAETTER) => {
  const mit = new Set(blaetter);
  const wb = XLSX.utils.book_new();
  const add = (name, rows) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "": "keine Einträge" }]);
    const keys = Object.keys(rows[0] || { "": "" });
    ws["!cols"] = keys.map((k) => ({ wch: Math.min(48, Math.max(k.length + 2, ...rows.map((r) => String(r[k] ?? "").length + 1))) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  if (mit.has("Patchliste")) add("Patchliste", patchExportZeilen(P, X));
  if (mit.has("IP-Liste")) add("IP-Liste", ipRows(P, X));
  if (mit.has("VLANs")) add("VLANs", vlanRows(P));
  if (mit.has("Verbindungen")) add("Verbindungen", patchRows(P, X));
  if (mit.has("Switch-Ports")) add("Switch-Ports", switchPortRows(P, X));
  if (mit.has("Geräte")) add("Geräte", deviceRows(P, X));
  if (mit.has("Prüfung")) add("Prüfung", issues.map((i) => ({ Schwere: { error: "Fehler", warn: "Warnung", info: "Hinweis" }[i.sev], Meldung: i.msg })));
  if (!wb.SheetNames.length) add("Leer", []);
  return XLSX.write(wb, { type: "base64", bookType: "xlsx" });
};

// CSV mit Semikolon und BOM, damit Excel Umlaute und Spalten richtig erkennt
const csv = (rows, leer) => {
  const keys = Object.keys(rows[0] || leer);
  const q = (v) => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return "\ufeff" + [keys.join(";"), ...rows.map((r) => keys.map((k) => q(r[k])).join(";"))].join("\r\n");
};
export const buildIpCsv = (P, X) => csv(ipRows(P, X), { IP: "" });
export const buildPatchCsv = (P, X) => csv(patchExportZeilen(P, X), { "#": "" });


/* ── PDF-Dokumentation ────────────────────────────────────────────────────
   Jede Information steht nur einmal: Kabel und Ports in der Patchliste (je Switch),
   Adressen in der VLAN-Liste (je VLAN), Modelle und Web-UIs in der Geräteliste
   (je Standort). Die Switch-Konfiguration und die Prüfung sind optional. */
export const PDF_TEILE = [
  ["deckblatt", "Deckblatt", "Projektangaben, Kennzahlen, Inhalt"],
  ["topologie", "Topologie", "Plan in der gewählten Ansicht, immer hell"],
  ["patch", "Patchliste je Switch", "Was steckt wo: Port, Gerät, IP, Standort, Abhaken vor Ort"],
  ["vlans", "VLAN- und IP-Liste", "VLANs mit Subnetz und Einstellungen, darunter die IPs je VLAN"],
  ["geraete", "Geräte je Standort", "Modell, Gewerk, Web-UI, Protokolle, Notizen"],
  ["ports", "Switch-Konfiguration", "Alle Switch-Ports mit Modus, VLANs und PoE"],
  ["pruefung", "Prüfung", "Fehler, Warnungen und Hinweise"],
];
export const PDF_STANDARD = ["deckblatt", "topologie", "patch", "vlans", "geraete"];
const zl = (l) => l.filter(Boolean).map(esc).join("<br>");
const nl = (s) => esc(s).replace(/\n/g, "<br>");

/* Tabelle mit festen Spaltenbreiten, damit die Tabellen einer Seite bündig untereinander stehen.
   Spalten mit `opt` fallen weg, wenn sie in allen Zeilen (aller Gruppen) leer wären. */
const spaltenMit = (spalten, alle) => spalten.filter((c) => !c.opt || alle.some(c.opt));
const tabelle = (spalten, zeilen, { cls = "", zeile = () => "" } = {}) =>
  `<table class="${cls}"><colgroup>${spalten.map((c) => `<col${c.w ? ` style="width:${c.w}"` : ""}>`).join("")}</colgroup><thead><tr>${spalten.map((c) => `<th class="${c.cls || ""}">${esc(c.t)}</th>`).join("")}</tr></thead><tbody>${zeilen.map((r) =>
    `<tr${zeile(r) ? ` class="${zeile(r)}"` : ""}>${spalten.map((c) => `<td class="${c.cls || ""}">${c.h(r)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

const patchSeite = (P, X) => {
  const gruppen = patchGruppen(P, X);
  if (!gruppen.length) return `<p class="empty">Keine Geräte.</p>`;
  const alle = gruppen.flatMap((g) => g.zeilen);
  const spalten = spaltenMit([
    { t: "Port", w: "14mm", cls: "port", h: (r) => esc(r.switchPort) },
    { t: "Gerät", w: "52mm", h: (r) => `<div class="nm">${esc(r.name)}</div><div class="sub">${zl([r.netzname, r.modell + (r.stapel ? " · Stapel " + r.stapel : "")])}</div>` },
    { t: "Geräte-Port", w: "20mm", cls: "port", opt: (r) => r.geraetPort, h: (r) => esc(r.geraetPort) },
    { t: "IP (VLAN)", w: "62mm", cls: "mono", h: (r) => zl(r.ips) },
    { t: "Standort", w: "26mm", opt: (r) => r.standort, h: (r) => esc(r.standort) },
    { t: "Notizen", opt: (r) => r.felder.length || r.notizen, h: (r) => [zl(r.felder), nl(r.notizen)].filter(Boolean).join("<br>") },
    { t: "Vor Ort", w: "38mm", cls: "vorort", h: () => "" },
    { t: "OK", w: "8mm", cls: "box", h: () => "<span></span>" },
  ], alle);
  return gruppen.map(({ kopf, zeilen }) => {
    const d = kopf && X.devById.get(kopf.id);
    const titel = kopf
      ? `${d?.isSwitch ? "" : "An "}${esc(kopf.name)}<span>${[kopf.modell, kopf.standort, kopf.ips[0]].filter(Boolean).map(esc).join(" · ")}${kopf.aufSwitch ? ` · hängt an ${esc(kopf.switchName)} Port ${esc(kopf.switchPort)}` : ""}</span>`
      : "Ohne Verbindung<span>Geräte, die noch an keinem Switch stecken</span>";
    return `<h3>${titel}</h3>${tabelle(spalten, zeilen, { cls: "patch", zeile: (r) => (r.isSwitch ? "sw" : "") })}`;
  }).join("");
};

const vlanSeite = (P, X) => {
  const g = vlanGruppen(P, X);
  if (!g.length) return `<p class="empty">Keine VLANs.</p>`;
  const vl = g.filter((x) => x.vlan);
  const uebersicht = tabelle(spaltenMit([
    { t: "VLAN", w: "16mm", cls: "vid", h: (x) => `<i style="background:${esc(x.vlan.farbe)}"></i>${esc(x.vid)}` },
    { t: "Name", w: "40mm", h: (x) => `<b>${esc(x.name)}</b>` },
    { t: "Subnetz", w: "34mm", cls: "mono", opt: (x) => x.subnetz, h: (x) => esc(x.subnetz) },
    { t: "Gateway", w: "28mm", cls: "mono", opt: (x) => x.gateway, h: (x) => esc(x.gateway) },
    { t: "Zweck", opt: (x) => x.zweck, h: (x) => esc(x.zweck) },
    { t: "Einstellungen", w: "48mm", opt: (x) => x.optionen, h: (x) => esc(x.optionen) },
    { t: "IPs", w: "12mm", cls: "zahl", h: (x) => String(x.ips.length || "") },
  ], vl), vl);
  const alle = g.flatMap((x) => x.ips);
  const spalten = spaltenMit([
    { t: "IP", w: "34mm", cls: "mono", h: (i) => `${esc(i.ip)}${i.prefix && i.ip !== "DHCP" ? `<span class="sub">/${esc(i.prefix)}</span>` : ""}` },
    { t: "Gerät", w: "52mm", h: (i) => `<b>${esc(i.geraet)}</b>` },
    { t: "Port", w: "28mm", opt: (i) => i.port, h: (i) => esc(i.port) },
    { t: "Standort", w: "30mm", opt: (i) => i.standort, h: (i) => esc(i.standort) },
    { t: "MAC", w: "38mm", cls: "mono", opt: (i) => i.mac, h: (i) => esc(i.mac) },
    { t: "Web-UI", cls: "mono", opt: (i) => i.web, h: (i) => esc(i.web) },
  ], alle);
  const ips = g.filter((x) => x.ips.length).map((x) => `<h3>${x.vlan ? `<i class="vf" style="background:${esc(x.vlan.farbe)}"></i>VLAN ${esc(x.vid)} · ${esc(x.name)}` : "Ohne VLAN"}${x.subnetz || x.gateway ? `<span>${[x.subnetz, x.gateway && "Gateway " + x.gateway].filter(Boolean).map(esc).join(" · ")}</span>` : ""}</h3>${tabelle(spalten, x.ips)}`).join("");
  return uebersicht + ips;
};

const geraeteSeite = (P) => {
  const g = standortGruppen(P);
  if (!g.length) return `<p class="empty">Keine Geräte.</p>`;
  const spalten = spaltenMit([
    { t: "Gerät", w: "52mm", h: (d) => `<div class="nm">${esc(d.name)}</div>${d.netzname ? `<div class="sub mono">${esc(d.netzname)}</div>` : ""}` },
    { t: "Modell", w: "60mm", h: (d) => esc(d.modell) },
    { t: "Gewerk", w: "22mm", opt: (d) => d.gewerk, h: (d) => esc(d.gewerk) },
    { t: "Web-UI", w: "38mm", cls: "mono", opt: (d) => d.web, h: (d) => esc(d.web) },
    { t: "Protokolle", w: "50mm", opt: (d) => d.protokolle, h: (d) => esc(d.protokolle) },
    { t: "Notizen", opt: (d) => d.notizen, h: (d) => nl(d.notizen) },
  ], g.flatMap((x) => x.geraete));
  return g.map((x) => `<h3>${esc(x.standort)}<span>${x.geraete.length} ${x.geraete.length === 1 ? "Gerät" : "Geräte"}</span></h3>${tabelle(spalten, x.geraete, { zeile: (d) => (d.isSwitch ? "sw" : "") })}`).join("");
};

const switchSeite = (P, X) => {
  const g = switchGruppen(P, X);
  if (!g.length) return `<p class="empty">Keine Switches.</p>`;
  const spalten = spaltenMit([
    { t: "Port", w: "14mm", cls: "port", h: (p) => esc(p.port) },
    { t: "Typ", w: "24mm", h: (p) => esc(p.typ) },
    { t: "Modus", w: "18mm", h: (p) => esc(p.modus) },
    { t: "VLAN", w: "40mm", cls: "mono", h: (p) => esc(p.vlan) },
    { t: "PoE", w: "12mm", opt: (p) => p.poe, h: (p) => esc(p.poe) },
    { t: "Gegenstelle", h: (p) => esc(p.gegenstelle) || "frei" },
  ], g.flatMap((s) => s.ports));
  return g.map((s) => `<h3>${esc(s.name)}<span>${[s.modell, s.standort, s.ip && "Management " + s.ip, s.unmanaged && "unmanaged, ohne VLAN-Einstellungen"].filter(Boolean).map(esc).join(" · ")}</span></h3>${tabelle(
    s.unmanaged ? spalten.filter((c) => !["Modus", "VLAN"].includes(c.t)) : spalten, s.ports, { zeile: (p) => (p.gegenstelle ? "" : "frei") })}`).join("");
};

export const buildPdfHtml = (P, X, issues, topo, { nurPatch = false, teile = PDF_STANDARD, seite = "A4", hoch = false } = {}) => {
  const mit = new Set(nurPatch ? ["patch"] : teile);
  // Seitenmaße in mm: A4/A3, quer oder hoch
  const [kurz, lang] = seite === "A3" ? [297, 420] : [210, 297];
  const [pw, ph] = hoch ? [kurz, lang] : [lang, kurz];
  const m = P.meta;
  const sev = { error: "Fehler", warn: "Warnung", info: "Hinweis" };
  const nErr = issues.filter((i) => i.sev === "error").length, nWarn = issues.filter((i) => i.sev === "warn").length;
  const logo = ladeLogo();
  const logoImg = (h) => (logo && /^data:image\//.test(logo) ? `<img src="${logo.replace(/"/g, "&quot;")}" style="max-height:${h}px;max-width:${h * 4}px;object-fit:contain">` : "");
  const head = (t) => `<div class="head">${logo ? `<span class="corp">${logoImg(22)}</span>` : ""}<span>${esc(m.veranstaltung)}${m.ort ? " · " + esc(m.ort) : ""} · v${esc(m.version)} · ${esc(m.datum)}</span><span class="t">${esc(t)}</span></div>`;
  const titel = Object.fromEntries(PDF_TEILE.map(([k, l]) => [k, l]));
  const inhalt = PDF_TEILE.filter(([k]) => k !== "deckblatt" && mit.has(k) && (k !== "topologie" || topo));
  const standorte = new Set(P.geraete.map((d) => (d.bereich || "").trim()).filter(Boolean)).size;
  const seiteMit = (k, body) => (mit.has(k) ? `<div class="page">${head(titel[k])}${body}</div>` : "");
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>${esc(m.veranstaltung)} – Netzwerkplan v${esc(m.version)}</title><style>
@page { size: ${seite} ${hoch ? "portrait" : "landscape"}; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Segoe UI', system-ui, sans-serif; color: #1c2127; font-size: 9.5px; background: #fff; }
.page { width: ${pw}mm; min-height: ${ph}mm; padding: 10mm 12mm; page-break-after: always; position: relative; }
.page:last-child { page-break-after: auto; }
.head { display: flex; gap: 14px; align-items: baseline; border-bottom: 2px solid #b3483f; padding-bottom: 5px; margin-bottom: 10px; color: #555; }
.head .corp { align-self: center; } .head .corp img { display: block; }
.head .t { margin-left: auto; font-weight: 700; color: #1c2127; font-size: 12px; }
h1 { font-size: 26px; margin: 30mm 0 4px; } h2 { font-size: 13px; margin: 14px 0 6px; }
h3 { font-size: 11px; margin: 12px 0 4px; page-break-after: avoid; display: flex; align-items: baseline; gap: 6px; }
h3 span { font-weight: 400; color: #666; font-size: 9px; } h3 span::before { content: "· "; }
h3 .vf, td.vid i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 4px; align-self: center; }
.meta { color: #555; font-size: 12px; line-height: 1.7; }
.stats { display: flex; gap: 10px; margin: 16px 0; } .stats div { border: 1px solid #ddd; border-radius: 6px; padding: 8px 12px; min-width: 90px; }
.stats b { display: block; font-size: 18px; }
.inhalt { font-size: 12px; line-height: 1.8; padding-left: 18px; }
.hinweis { margin-top: 14px; padding: 6px 10px; border-left: 3px solid #d68910; background: #fdf6e8; font-size: 11px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 8px; table-layout: fixed; } td { overflow-wrap: anywhere; } th { text-align: left; background: #1c2127; color: #fff; padding: 4px 5px; font-size: 8.5px; text-transform: uppercase; letter-spacing: .3px; }
td { padding: 3px 5px; border-bottom: 1px solid #e3e3e3; vertical-align: top; } tr:nth-child(even) td { background: #f7f7f7; }
tr { page-break-inside: avoid; }
.mono { font-family: Consolas, monospace; } .zahl { text-align: right; width: 12mm; }
.sub { color: #666; font-size: 8px; } .nm { font-weight: 700; font-size: 9.5px; }
.sw td { background: #e9ecf3 !important; font-weight: 700; } .frei td { color: #999; }
td.port { font-weight: 700; }
.topo { width: 100%; height: ${ph - 38}mm; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.topo svg { width: 100%; height: 100%; } .topo .np-titel { display: none; }
.sev-error { color: #c0392b; font-weight: 700; } .sev-warn { color: #d68910; font-weight: 700; } .sev-info { color: #2e86de; }
.empty { color: #888; font-style: italic; }
.patch td { font-size: 8.5px; }
.patch td.vorort { background-image: repeating-linear-gradient(to bottom, transparent 0, transparent 11px, #c9ced6 11px, #c9ced6 12px); height: 26px; }
.patch .box span { display: inline-block; width: 11px; height: 11px; border: 1.2px solid #555; border-radius: 2px; }
</style></head><body>
${mit.has("deckblatt") ? `<div class="page">
  ${head("Deckblatt")}
  ${logo ? `<div style="margin-top:22mm">${logoImg(70)}</div>` : ""}
  <h1${logo ? ' style="margin-top:10mm"' : ""}>${esc(m.veranstaltung)}</h1>
  <div class="meta">Netzwerkplan · Version ${esc(m.version)} · ${esc(m.datum)}${m.ort ? `<br>Ort: ${esc(m.ort)}` : ""}${m.ersteller ? `<br>Ersteller: ${esc(m.ersteller)}` : ""}${m.notiz ? `<br><br>${nl(m.notiz)}` : ""}</div>
  <div class="stats"><div><b>${P.geraete.length}</b>Geräte</div><div><b>${P.geraete.filter((d) => d.isSwitch).length}</b>Switches</div><div><b>${P.verbindungen.length}</b>Kabel</div><div><b>${P.vlans.length}</b>VLANs</div><div><b>${standorte}</b>Standorte</div></div>
  ${inhalt.length ? `<h2>Inhalt</h2><ol class="inhalt">${inhalt.map(([, l]) => `<li>${esc(l)}</li>`).join("")}</ol>` : ""}
  ${nErr + nWarn ? `<div class="hinweis">Offen: ${[nErr && `${nErr} Fehler`, nWarn && `${nWarn} ${nWarn === 1 ? "Warnung" : "Warnungen"}`].filter(Boolean).join(", ")}${mit.has("pruefung") ? " (siehe Prüfung)" : ""}</div>` : ""}
</div>` : ""}
${topo && mit.has("topologie") ? `<div class="page">${head("Topologie")}<div class="topo">${topo.svg.replace(/^<svg /, '<svg preserveAspectRatio="xMidYMid meet" ')}</div></div>` : ""}
${seiteMit("patch", patchSeite(P, X))}
${seiteMit("vlans", vlanSeite(P, X))}
${seiteMit("geraete", geraeteSeite(P))}
${seiteMit("ports", switchSeite(P, X))}
${seiteMit("pruefung", `${issues.length ? `<table><thead><tr><th style="width:70px">Schwere</th><th>Meldung</th></tr></thead><tbody>${issues.map((i) => `<tr><td class="sev-${i.sev}">${sev[i.sev]}</td><td>${esc(i.msg)}</td></tr>`).join("")}</tbody></table>` : `<p>Keine Auffälligkeiten.</p>`}
<p class="empty">Protokoll- und Gerätedaten aus der Projektrecherche; teils nicht datenblattgeprüft.</p>`)}
</body></html>`;
};
