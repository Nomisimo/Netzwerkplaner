import React, { useState, useEffect, useRef, useCallback } from "react";
import { S, OK, ERR, WARN, SUB, MUTED, TEXT2, INPUT, LINE, SPIELE_GRUEN as GRUEN } from "../../shared/constants.js";
import { SPIELE, Bild, W, H } from "../../shared/spiele/index.js";
import { api, isElectron } from "../api.js";
import { createTon } from "../spiele/ton.js";
import { Toggle, Dot } from "../ui.jsx";
import { Card, Table, td, Hint } from "../live/common.jsx";
import { Volume2, VolumeX, RotateCcw, RefreshCw, TriangleAlert, Gamepad2 } from "lucide-react";

const LS = "netzwerkplaner_spiele";
// Vorgaben wie im Snake-Original auf der echten Matrix (Universe 29 und 33, 144 Fixtures je Universe)
const STANDARD = { spiel: "snake", ton: true, sacn: { on: false, iface: "", u1: 29, u2: 33, fpu: 144 }, ndi: { on: false, name: "Matrix Games" } };
const laden = () => { try { const v = JSON.parse(localStorage.getItem(LS) || "null"); return v ? { ...STANDARD, ...v, sacn: { ...STANDARD.sacn, ...v.sacn }, ndi: { ...STANDARD.ndi, ...v.ndi } } : STANDARD; } catch { return STANDARD; } };

// Der Spiele-Tab hat Grün als Akzentfarbe (statt Rot wie der Rest der App)
const GRUEN_CSS = `
.np-spiele input[type=checkbox] { accent-color: ${GRUEN}; }
.np-spiele input:focus, .np-spiele select:focus { outline-color: ${GRUEN}; }
.np-spiele .sp-section-label { color: ${GRUEN}; }
`;
const tabAktiv = { background: GRUEN, color: "#fff", fontWeight: 700, border: `1px solid ${GRUEN}` };

const STEP = 1000 / 60;
const ZUSTAND = { title: "Titelbild", playing: "läuft", paused: "Pause", point_scored: "Punkt", game_over: "Game Over" };
// Tasten, die im Spiel nicht scrollen oder Knöpfe auslösen sollen
const SPIELTASTEN = new Set(["Space", "Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Escape"]);
const istEingabe = (el) => el && (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.isContentEditable);

// Zwei LED-Matrizen à 24×24 als runde Punkte, so wie das Bild per sACN/NDI hinausgeht
function zeichneMatrix(cv, px) {
  const ctx = cv.getContext("2d"), z = 7, gap = 18, r = z * 0.38;
  ctx.fillStyle = "#07090b";
  ctx.fillRect(0, 0, cv.width, cv.height);
  for (let m = 0; m < 2; m++) {
    const ox = m * (24 * z + gap);
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
      const i = (y * W + m * 24 + x) * 3, R = px[i], G = px[i + 1], B = px[i + 2];
      ctx.fillStyle = R | G | B ? `rgb(${R},${G},${B})` : "#15191e";
      ctx.beginPath();
      ctx.arc(ox + x * z + z / 2, y * z + z / 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export default function SpieleTab() {
  const [cfg, setCfg] = useState(laden);
  const [interfaces, setInterfaces] = useState([]);
  const [status, setStatus] = useState(null);
  const [zustand, setZustand] = useState("title");
  const canvasRef = useRef(null), matrixRef = useRef(null), boxRef = useRef(null);
  const gameRef = useRef(null), tonRef = useRef(null), held = useRef(new Set()), zustandRef = useRef("title");
  const ausgabeAn = (cfg.sacn.on || cfg.ndi.on) && isElectron;
  const ausgabeRef = useRef(ausgabeAn);
  ausgabeRef.current = ausgabeAn;

  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch {} }, [cfg]);
  const set = (k, v) => setCfg((c) => ({ ...c, [k]: typeof v === "object" && !Array.isArray(v) ? { ...c[k], ...v } : v }));

  // Netzwerkkarten wie im Live-Tab
  const ladeIfaces = () => api.monInterfaces().then((l) => setInterfaces(l || []));
  useEffect(() => { ladeIfaces(); }, []);

  // Ausgabe im Hauptprozess (sACN/NDI) an die Einstellungen anpassen; beim Verlassen abschalten
  useEffect(() => {
    if (!isElectron) return;
    api.spieleAusgabe({ sacn: cfg.sacn, ndi: cfg.ndi }).then(setStatus);
  }, [JSON.stringify(cfg.sacn), JSON.stringify(cfg.ndi)]);
  useEffect(() => {
    const off = api.onSpieleStatus(setStatus);
    return () => { off(); api.spieleAusgabe({}); };
  }, []);

  // Ton
  useEffect(() => { tonRef.current = createTon(); return () => tonRef.current.close(); }, []);
  useEffect(() => { tonRef.current.setAn(cfg.ton); }, [cfg.ton]);

  // Spiel anlegen (bei Wechsel neu)
  const neu = useCallback(() => {
    tonRef.current?.stopAlle();
    const def = SPIELE.find((s) => s.id === cfg.spiel) || SPIELE[0];
    gameRef.current = def.create({ ton: (name) => tonRef.current?.play(def.id, name) });
    held.current.clear();
    boxRef.current?.focus();
  }, [cfg.spiel]);
  useEffect(() => { neu(); }, [neu]);

  // Spielschleife: feste 60 Schritte je Sekunde. setInterval statt requestAnimationFrame,
  // damit sACN/NDI auch bei minimiertem Fenster weiterlaufen (der Hauptprozess schaltet die Drosselung ab).
  useEffect(() => {
    const bild = new Bild();
    let last = performance.now(), acc = 0, n = 0;
    const id = setInterval(() => {
      const now = performance.now();
      acc = Math.min(acc + now - last, STEP * 5);
      last = now;
      const g = gameRef.current;
      if (!g) return;
      let schritte = 0;
      while (acc >= STEP) { g.step(held.current); acc -= STEP; schritte++; }
      if (!schritte) return;
      g.render(bild);
      const cv = canvasRef.current;
      if (cv) cv.getContext("2d").putImageData(new ImageData(rgba(bild.px), W, H), 0, 0);
      if (matrixRef.current && (n++ & 1) === 0) zeichneMatrix(matrixRef.current, bild.px);
      if (ausgabeRef.current) api.spieleFrame(bild.px);
      if (g.state !== zustandRef.current) { zustandRef.current = g.state; setZustand(g.state); }
    }, 4);
    return () => clearInterval(id);
  }, []);

  // Tastatur: nur wenn kein Eingabefeld den Fokus hat
  useEffect(() => {
    const down = (e) => {
      if (istEingabe(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (SPIELTASTEN.has(e.code)) e.preventDefault();
      if (!e.repeat) gameRef.current?.key(e.code);
      held.current.add(e.code);
    };
    const up = (e) => held.current.delete(e.code);
    const blur = () => held.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, []);

  const def = SPIELE.find((s) => s.id === cfg.spiel) || SPIELE[0];
  const sacnSt = status?.sacn, ndiSt = status?.ndi;
  const uni = (start) => { const n = Math.ceil(24 * 24 / Math.max(1, Math.min(170, +cfg.sacn.fpu || 144))); return `${start}–${+start + n - 1}`; };

  return (
    <div className="np-spiele">
      <style>{GRUEN_CSS}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ ...S.boxTabs, marginBottom: 0, flex: 1 }}>
          {SPIELE.map((s) => (
            <button key={s.id} style={{ ...S.boxTab, ...(cfg.spiel === s.id ? tabAktiv : {}) }} onClick={() => set("spiel", s.id)}>{s.name}</button>
          ))}
        </div>
        <button style={S.ghostBtn} onClick={() => set("ton", !cfg.ton)} title={cfg.ton ? "Ton aus" : "Ton an"}>{cfg.ton ? <Volume2 size={14} /> : <VolumeX size={14} />} Ton</button>
        <button style={S.ghostBtn} onClick={neu} title="Spiel neu starten (zurück zum Titel)"><RotateCcw size={14} /> Neu</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 20, alignItems: "start" }}>
        <div>
          <div style={{ ...S.section, padding: 14 }}>
            <div ref={boxRef} tabIndex={0} onMouseDown={() => boxRef.current?.focus()} style={{ outline: "none", background: "#000", borderRadius: 6, overflow: "hidden", border: `2px solid ${GRUEN}` }}>
              <canvas ref={canvasRef} width={W} height={H} style={{ display: "block", width: "100%", aspectRatio: `${W} / ${H}`, imageRendering: "pixelated" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, fontSize: 12, color: SUB, flexWrap: "wrap" }}>
              <Gamepad2 size={14} color={GRUEN} /> {def.name} · {W}×{H} px · 60 fps
              <span style={{ flex: 1 }} />
              <span>Zustand: <b style={{ color: TEXT2 }}>{ZUSTAND[zustand] || zustand}</b></span>
            </div>
          </div>
          <Card title="Tasten">
            <Table head={["Taste", "Funktion"]}>
              {def.tasten.map(([k, f]) => <tr key={k}><td style={td({ fontWeight: 600, whiteSpace: "nowrap" })}>{k}</td><td style={td()}>{f}</td></tr>)}
            </Table>
          </Card>
        </div>

        <div>
          <div style={{ ...S.section, padding: 16 }}>
            <div className="sp-section-label">Ausgabe an die LED-Matrix</div>
            {!isElectron && <div style={{ color: WARN, fontSize: 12, marginBottom: 10, display: "flex", gap: 6 }}><TriangleAlert size={14} style={{ flexShrink: 0 }} /> sACN und NDI gibt es nur in der Desktop-App. Spielen geht auch hier.</div>}

            <Toggle checked={cfg.sacn.on} disabled={!isElectron} onChange={(v) => set("sacn", { on: v })} label="sACN (E1.31) senden" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "10px 0 14px" }}>
              <label style={{ ...S.field, gridColumn: "1 / -1" }}><span style={S.fieldLabel}>Netzwerkkarte</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <select style={S.selectSm} value={cfg.sacn.iface} onChange={(e) => set("sacn", { iface: e.target.value })}>
                    <option value="">wie das System</option>
                    {interfaces.map((i) => <option key={i.name + i.address} value={i.address}>{i.name} · {i.address}/{i.prefix}</option>)}
                  </select>
                  <button style={S.smallBtn} onClick={ladeIfaces} title="Liste neu laden"><RefreshCw size={12} /></button>
                </div>
              </label>
              <label style={S.field}><span style={S.fieldLabel}>Matrix 1 ab Universe</span>
                <input style={S.inputSm} type="number" min={1} max={63999} value={cfg.sacn.u1} onChange={(e) => set("sacn", { u1: +e.target.value })} /></label>
              <label style={S.field}><span style={S.fieldLabel}>Matrix 2 ab Universe</span>
                <input style={S.inputSm} type="number" min={1} max={63999} value={cfg.sacn.u2} onChange={(e) => set("sacn", { u2: +e.target.value })} /></label>
              <label style={{ ...S.field, gridColumn: "1 / -1" }}><span style={S.fieldLabel}>Pixel (RGB) je Universe</span>
                <input style={S.inputSm} type="number" min={1} max={170} value={cfg.sacn.fpu} onChange={(e) => set("sacn", { fpu: +e.target.value })} />
                <span className="sp-norm-hint">144 = 9 Kacheln à 4×4 Pixel (432 Kanäle). Je Matrix {Math.ceil(576 / Math.max(1, Math.min(170, +cfg.sacn.fpu || 144)))} Universes.</span></label>
            </div>

            <Toggle checked={cfg.ndi.on} disabled={!isElectron} onChange={(v) => set("ndi", { on: v })} label="NDI-Stream senden" />
            <label style={{ ...S.field, margin: "10px 0 4px" }}><span style={S.fieldLabel}>Name des NDI-Streams</span>
              <input style={S.inputSm} value={cfg.ndi.name} onChange={(e) => set("ndi", { name: e.target.value })} /></label>
            <span className="sp-norm-hint">480×240 px BGRA, 60 fps (jedes Pixel 10×10). Braucht die NDI Runtime (ndi.video/tools).</span>

            {isElectron && (cfg.sacn.on || cfg.ndi.on) && (
              <div style={{ marginTop: 14, borderTop: `1px solid ${LINE}`, paddingTop: 12, fontSize: 12, display: "grid", gap: 6 }}>
                <div style={{ color: SUB }}>Bilder je Sekunde: <b style={{ color: TEXT2 }}>{status?.fps ?? 0}</b></div>
                {cfg.sacn.on && <Zeile ok={sacnSt?.on && !sacnSt?.err} text={sacnSt?.err ? `sACN: ${sacnSt.err}` : `sACN: Universes ${uni(cfg.sacn.u1)} und ${uni(cfg.sacn.u2)}, ${sacnSt?.pakete ?? 0} Pakete`} />}
                {cfg.ndi.on && <Zeile ok={ndiSt?.on && !ndiSt?.err} text={ndiSt?.err ? `NDI: ${ndiSt.err}` : ndiSt?.on ? `NDI: „${ndiSt.name}“, ${ndiSt.verbindungen} Empfänger verbunden` : "NDI: startet …"} />}
              </div>
            )}
          </div>

          <div style={{ ...S.section, padding: 16 }}>
            <div className="sp-section-label">Live-Ansicht</div>
            <canvas ref={matrixRef} width={24 * 7 * 2 + 18} height={24 * 7} style={{ width: "100%", display: "block", borderRadius: 6, background: INPUT, border: `1px solid ${GRUEN}` }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED, marginTop: 6 }}>
              <span>Matrix 1{cfg.sacn.on ? ` · U ${uni(cfg.sacn.u1)}` : ""}</span>
              <span>Matrix 2{cfg.sacn.on ? ` · U ${uni(cfg.sacn.u2)}` : ""}</span>
            </div>
            <Hint>So sieht das Bild auf den Matrizen aus: genau dieser Stand geht per sACN und NDI hinaus. Mit dem sACN-Monitor im Live-Tab lässt sich die Ausgabe gegenprüfen.</Hint>
          </div>
        </div>
      </div>
      <p style={{ ...S.hint, color: MUTED }}>
        Die Spiele laufen nur, solange dieser Tab offen ist. Beim Verlassen stoppen sACN und NDI. Solange gesendet wird, läuft die Ausgabe auch bei minimiertem Fenster weiter.
      </p>
    </div>
  );
}

const Zeile = ({ ok, text }) => (
  <div style={{ display: "flex", alignItems: "flex-start", gap: 6, color: ok ? TEXT2 : ERR }}>
    <span style={{ marginTop: 3 }}><Dot color={ok ? OK : ERR} size={7} /></span> {text}
  </div>
);

function rgba(px) {
  const out = new Uint8ClampedArray(W * H * 4);
  for (let i = 0, j = 0; i < px.length; i += 3, j += 4) { out[j] = px[i]; out[j + 1] = px[i + 1]; out[j + 2] = px[i + 2]; out[j + 3] = 255; }
  return out;
}
