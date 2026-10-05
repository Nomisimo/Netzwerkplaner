import * as XLSX from "xlsx";
import { KABEL, TYPEN } from "../shared/constants.js";
import { connVlan, otherEnd, webUrl, kabelLabel } from "../shared/model.js";
import { ipSort, prefixToMaskStr, parseCidr } from "../shared/net.js";
import { ladeLogo } from "./logo.js";
import { vlanBaum, aeusseresVlan } from "../shared/qinq.js";
import { ipPorts, physPorts } from "../shared/catalog.js";
import { feldSpalten, feldWert } from "../shared/felder.js";
import { patchZeilen, patchExportZeilen } from "../shared/patchliste.js";

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
  const bgColor = world.getAttribute("data-bg") || "#15191e";
  clone.querySelectorAll(".np-ui, .np-legend").forEach((n) => n.remove());
  world.removeAttribute("transform");
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
  Object.entries({ x: x + pad, y: y + 34, fill: "#b3483f", "font-size": 18, "font-weight": 800 }).forEach(([k, v]) => t.setAttribute(k, v));
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
  Name: d.name, Netzwerkname: d.netzname || "", Typ: TYPEN[d.typ]?.label, Bereich: d.kategorie, Standort: d.bereich, Hersteller: d.hersteller, Modell: d.modell,
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

export const buildXlsxBase64 = (P, X, issues) => {
  const wb = XLSX.utils.book_new();
  const add = (name, rows) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "": "keine Einträge" }]);
    const keys = Object.keys(rows[0] || { "": "" });
    ws["!cols"] = keys.map((k) => ({ wch: Math.min(48, Math.max(k.length + 2, ...rows.map((r) => String(r[k] ?? "").length + 1))) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add("Patchliste", patchExportZeilen(P, X));
  add("IP-Liste", ipRows(P, X));
  add("VLANs", vlanRows(P));
  add("Verbindungen", patchRows(P, X));
  add("Switch-Ports", switchPortRows(P, X));
  add("Geräte", deviceRows(P, X));
  add("Prüfung", issues.map((i) => ({ Schwere: { error: "Fehler", warn: "Warnung", info: "Hinweis" }[i.sev], Meldung: i.msg })));
  return XLSX.write(wb, { type: "base64", bookType: "xlsx" });
};

export const buildIpCsv = (P, X) => {
  const rows = ipRows(P, X);
  const keys = Object.keys(rows[0] || { IP: "" });
  const q = (v) => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return "﻿" + [keys.join(";"), ...rows.map((r) => keys.map((k) => q(r[k])).join(";"))].join("\r\n");
};

/* Patchliste fürs PDF: mehrzeilige Zellen, linierte Spalte für Notizen vor Ort, Kästchen zum Abhaken */
const patchTabelle = (P, X) => {
  const z = patchZeilen(P, X);
  if (!z.length) return `<p class="empty">Keine Geräte.</p>`;
  const zl = (l) => l.map(esc).join("<br>");
  return `<table class="patch"><thead><tr><th>#</th><th>Gerät</th><th>IPs / Interfaces</th><th>Gesteckt auf</th><th>Weitere Kabel</th><th>Abteilung · Standort</th><th>Felder</th><th>Notizen</th><th>Notizen vor Ort</th><th>OK</th></tr></thead><tbody>${z.map((r, i) => {
    const grp = i > 0 && (r.isSwitch || (r.aufSwitch !== z[i - 1].aufSwitch && !z[i - 1].isSwitch));
    return `<tr class="${r.isSwitch ? "sw" : ""}${grp ? " grp" : ""}"><td>${r.nr}</td><td><div class="nm">${esc(r.name)}</div>${r.netzname ? `<div class="mono">${esc(r.netzname)}</div>` : ""}<div class="sub">${esc(r.modell)}${r.stapel ? " · Stapel " + esc(r.stapel) : ""}</div></td>
<td class="mono">${zl(r.ips)}</td><td>${esc(r.gesteckt)}</td><td>${zl(r.weitereKabel)}</td><td>${esc(r.abteilung)}${r.standort ? "<br>" + esc(r.standort) : ""}</td><td>${zl(r.felder)}</td><td>${esc(r.notizen).replace(/\n/g, "<br>")}</td><td class="vorort"></td><td class="box"><span></span></td></tr>`;
  }).join("")}</tbody></table>`;
};
export const buildPatchCsv = (P, X) => {
  const rows = patchExportZeilen(P, X);
  const keys = Object.keys(rows[0] || { "#": "" });
  const q = (v) => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return "\ufeff" + [keys.join(";"), ...rows.map((r) => keys.map((k) => q(r[k])).join(";"))].join("\r\n");
};

/* ── PDF-Dokumentation ────────────────────────────────────────────────── */
const table = (rows, cols) => {
  if (!rows.length) return `<p class="empty">Keine Einträge.</p>`;
  const keys = cols || Object.keys(rows[0]);
  return `<table><thead><tr>${keys.map((k) => `<th>${esc(k)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${keys.map((k) => `<td>${esc(r[k])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
};

export const buildPdfHtml = (P, X, issues, topo, { nurPatch = false } = {}) => {
  const m = P.meta;
  const sev = { error: "Fehler", warn: "Warnung", info: "Hinweis" };
  const logo = ladeLogo();
  const logoImg = (h) => (logo && /^data:image\//.test(logo) ? `<img src="${logo.replace(/"/g, "&quot;")}" style="max-height:${h}px;max-width:${h * 4}px;object-fit:contain">` : "");
  const head = (t) => `<div class="head">${logo ? `<span class="corp">${logoImg(22)}</span>` : ""}<span class="logo">NETZWERKPLANER</span><span>${esc(m.veranstaltung)}${m.ort ? " · " + esc(m.ort) : ""} · v${esc(m.version)} · ${esc(m.datum)}</span><span class="t">${esc(t)}</span></div>`;
  const vlanTable = vlanRows(P).map((v) => ({ ...v, VLAN: v.VLAN }));
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>${esc(m.veranstaltung)} – Netzwerkplan</title><style>
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Segoe UI', system-ui, sans-serif; color: #1c2127; font-size: 9.5px; }
.page { width: 297mm; min-height: 210mm; padding: 10mm 12mm; page-break-after: always; position: relative; }
.page:last-child { page-break-after: auto; }
.head { display: flex; gap: 14px; align-items: baseline; border-bottom: 2px solid #b3483f; padding-bottom: 5px; margin-bottom: 10px; color: #555; }
.head .logo { font-weight: 800; letter-spacing: 1px; color: #b3483f; font-size: 12px; }
.head .corp { align-self: center; } .head .corp img { display: block; }
.head .t { margin-left: auto; font-weight: 700; color: #1c2127; font-size: 12px; }
h1 { font-size: 26px; margin: 30mm 0 4px; } h2 { font-size: 13px; margin: 14px 0 6px; }
.meta { color: #555; font-size: 12px; line-height: 1.7; }
.stats { display: flex; gap: 10px; margin: 16px 0; } .stats div { border: 1px solid #ddd; border-radius: 6px; padding: 8px 12px; min-width: 90px; }
.stats b { display: block; font-size: 18px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 8px; } th { text-align: left; background: #1c2127; color: #fff; padding: 4px 5px; font-size: 8.5px; text-transform: uppercase; letter-spacing: .3px; }
td { padding: 3px 5px; border-bottom: 1px solid #e3e3e3; vertical-align: top; } tr:nth-child(even) td { background: #f7f7f7; }
.topo { width: 100%; height: 172mm; background: #15191e; border-radius: 6px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.topo svg { width: 100%; height: 100%; }
.sev-error { color: #c0392b; font-weight: 700; } .sev-warn { color: #d68910; font-weight: 700; } .sev-info { color: #2e86de; }
.empty { color: #888; font-style: italic; }
.patch td { font-size: 8.5px; } .patch .sw td { background: #e9ecf3 !important; font-weight: 700; } .patch .grp td { border-top: 1.5px solid #9aa4af; }
.patch .nm { font-weight: 700; font-size: 9.5px; } .patch .sub { color: #666; font-size: 8px; } .patch .mono { font-family: Consolas, monospace; } .patch td.mono { white-space: nowrap; }
.patch .vorort { width: 46mm; height: 38px; background-image: repeating-linear-gradient(to bottom, transparent 0, transparent 11px, #c9ced6 11px, #c9ced6 12px); min-height: 26px; }
.patch .box { width: 7mm; } .patch .box span { display: inline-block; width: 11px; height: 11px; border: 1.2px solid #555; border-radius: 2px; }
.patch tr { page-break-inside: avoid; }
.foot { position: absolute; bottom: 6mm; left: 12mm; right: 12mm; font-size: 8px; color: #999; display: flex; justify-content: space-between; }
</style></head><body>
${nurPatch ? `<div class="page">${head("Patchliste")}${patchTabelle(P, X)}</div>` : `
<div class="page">
  ${head("Deckblatt")}
  ${logo ? `<div style="margin-top:22mm">${logoImg(70)}</div>` : ""}
  <h1${logo ? ' style="margin-top:10mm"' : ""}>${esc(m.veranstaltung)}</h1>
  <div class="meta">Netzwerkplan · Version ${esc(m.version)} · ${esc(m.datum)}${m.ort ? `<br>Ort: ${esc(m.ort)}` : ""}${m.ersteller ? `<br>Ersteller: ${esc(m.ersteller)}` : ""}${m.notiz ? `<br><br>${esc(m.notiz).replace(/\n/g, "<br>")}` : ""}</div>
  <div class="stats"><div><b>${P.geraete.length}</b>Geräte</div><div><b>${P.geraete.filter((d) => d.isSwitch).length}</b>Switches</div><div><b>${P.verbindungen.length}</b>Verbindungen</div><div><b>${P.vlans.length}</b>VLANs</div><div><b>${issues.filter((i) => i.sev === "error").length}</b>Fehler</div><div><b>${issues.filter((i) => i.sev === "warn").length}</b>Warnungen</div></div>
  <h2>VLANs</h2>${table(vlanTable, ["VLAN", "S-VLAN (QinQ)", "Name", "Zweck", "IGMP", "EEE aus", "QoS", "DHCP"])}
</div>
${topo ? `<div class="page">${head("Topologie")}<div class="topo">${topo.svg.replace(/^<svg /, '<svg preserveAspectRatio="xMidYMid meet" ')}</div></div>` : ""}
<div class="page">${head("Patchliste")}${patchTabelle(P, X)}</div>
<div class="page">${head("IP-Liste")}${table(ipRows(P, X), ["IP", "CIDR", "VLAN", "Gerät", "Port", "Gateway", "MAC", "Standort", "Modell", "Web-UI"])}</div>
<div class="page">${head("Switch-Ports")}${table(switchPortRows(P, X))}</div>
<div class="page">${head("Geräte")}${table(deviceRows(P, X), ["Name", "Typ", "Bereich", "Standort", "Hersteller", "Modell", "IPs", "Web-UI", "Protokolle"])}</div>
<div class="page">${head("Prüfung")}${issues.length ? `<table><thead><tr><th style="width:70px">Schwere</th><th>Meldung</th></tr></thead><tbody>${issues.map((i) => `<tr><td class="sev-${i.sev}">${sev[i.sev]}</td><td>${esc(i.msg)}</td></tr>`).join("")}</tbody></table>` : `<p>Keine Auffälligkeiten.</p>`}
<p class="empty">Protokoll- und Gerätedaten aus der Projektrecherche; teils nicht datenblattgeprüft.</p></div>
`}
</body></html>`;
};
