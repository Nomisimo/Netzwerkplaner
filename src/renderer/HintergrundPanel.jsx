import React, { useRef, useState } from "react";
import { S, LINE, SUB, MUTED } from "../shared/constants.js";
import { Toggle } from "./ui.jsx";
import { Image as ImageIcon, X as XIcon, Plus, Minus } from "lucide-react";

const MAX_PX = 2400; // größere Bilder werden verkleinert, damit Projektdatei und Rückgängig schlank bleiben

// Bild laden, bei Bedarf verkleinern → { src, bw, bh }
const bildLaden = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onerror = () => reject(new Error("Datei nicht lesbar"));
  r.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error("Kein unterstütztes Bildformat"));
    img.onload = () => {
      const bw = img.naturalWidth || 1000, bh = img.naturalHeight || 700;
      const f = Math.min(1, MAX_PX / Math.max(bw, bh));
      if (f === 1 && file.size < 1.5e6) return resolve({ src: r.result, bw, bh });
      const c = document.createElement("canvas");
      c.width = Math.round(bw * f); c.height = Math.round(bh * f);
      const g = c.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      resolve({ src: c.toDataURL("image/jpeg", 0.85), bw, bh });
    };
    img.src = r.result;
  };
  r.readAsDataURL(file);
});

/* Hintergrundbild der Topologie, z. B. Stage-Plot oder Hallenplan, um Geräte
   im Raum zu verorten. Liegt unter Geräten und Verbindungen und geht mit in den Export. */
export default function HintergrundPanel({ bg, bounds, onChange, onClose }) {
  const inp = useRef(null);
  const [fehler, setFehler] = useState("");
  const waehlen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const { src, bw, bh } = await bildLaden(file);
      const bx = bounds || { minX: -400, minY: -300, maxX: 400, maxY: 300 };
      const w = Math.max(900, (bx.maxX - bx.minX) * 1.1), h = (w * bh) / bw;
      const cx = (bx.minX + bx.maxX) / 2, cy = (bx.minY + bx.maxY) / 2;
      onChange((alt) => ({ deckkraft: 0.5, fest: false, ...(alt || {}), src, name: file.name, x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w: Math.round(w), h: Math.round(h) }));
      setFehler("");
    } catch (err) { setFehler(err.message); }
  };
  const skalieren = (f) => onChange((b) => {
    const w = Math.max(100, b.w * f), h = Math.max(70, b.h * f);
    return { ...b, x: Math.round(b.x + (b.w - w) / 2), y: Math.round(b.y + (b.h - h) / 2), w: Math.round(w), h: Math.round(h) };
  });
  return (
    <div className="np-ui" onMouseDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}
      style={{ position: "absolute", left: 10, top: 10, width: 270, background: "#1b2026f2", border: `1px solid ${LINE}`, borderRadius: 10, padding: 12, fontSize: 12, color: "#c8d0d8", boxShadow: "0 8px 24px rgba(0,0,0,.5)", zIndex: 5 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <b style={{ flex: 1, display: "inline-flex", alignItems: "center", gap: 6 }}><ImageIcon size={14} /> Hintergrundbild</b>
        <button style={{ ...S.ghostBtn, padding: "1px 7px" }} onClick={onClose}><XIcon size={14} /></button>
      </div>
      <input ref={inp} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif" style={{ display: "none" }} onChange={waehlen} />
      <button style={{ ...S.primaryBtn, width: "100%" }} onClick={() => inp.current?.click()}>{bg?.src ? "Anderes Bild wählen …" : "Bild wählen … (Stage-Plot, Hallenplan)"}</button>
      {fehler && <div style={{ color: "#ff8080", marginTop: 6 }}>{fehler}</div>}
      {bg?.src && <>
        <div style={{ color: MUTED, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bg.name}</div>
        <label style={{ display: "block", marginTop: 10, color: SUB }}>Deckkraft {Math.round((bg.deckkraft ?? 0.5) * 100)} %
          <input type="range" min="0.1" max="1" step="0.05" value={bg.deckkraft ?? 0.5} style={{ width: "100%" }} onChange={(e) => onChange((b) => ({ ...b, deckkraft: +e.target.value }))} />
        </label>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
          <span style={{ color: SUB, flex: 1 }}>Größe</span>
          <button style={S.smallBtn} onClick={() => skalieren(1 / 1.15)}><Minus size={12} /></button>
          <button style={S.smallBtn} onClick={() => skalieren(1.15)}><Plus size={12} /></button>
        </div>
        <div style={{ marginTop: 10 }}>
          <Toggle checked={bg.fest === false} onChange={(v) => onChange((b) => ({ ...b, fest: !v }))} label="Bild mit der Maus verschieben" title="An: das Bild lässt sich im Werkzeug „Bewegen“ ziehen. Aus: das Bild ist fixiert, Ziehen verschiebt die Ansicht." />
        </div>
        <button style={{ ...S.dangerBtn, width: "100%", marginTop: 12 }} onClick={() => onChange(() => null)}>Hintergrund entfernen</button>
      </>}
      <div style={{ ...S.hint, marginTop: 10 }}>PDF-Pläne vorher als PNG oder JPG exportieren. Jede Ansicht (Mindmap, Frontplatten) hat ihr eigenes Hintergrundbild.</div>
    </div>
  );
}
