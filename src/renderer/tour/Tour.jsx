import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ACCENT, INPUT, TEXT, TEXT2, MUTED, LINE, HELL } from "../../shared/constants.js";

/* Interaktive Tour: Abdunkelung mit Loch über dem Anker, Sprechblase daneben.
   Klicks außerhalb des Lochs werden abgefangen, damit nichts aus Versehen passiert. */

const PAD = 6, BW = 340;
const finde = (a) => document.querySelector(`[data-tour="${a}"]`);
const rechteck = (anker) => {
  const els = [].concat(anker || []).map(finde).filter(Boolean);
  const rs = els.map((e) => e.getBoundingClientRect()).filter((r) => r.width || r.height);
  if (!rs.length) return null;
  const x = Math.min(...rs.map((r) => r.left)), y = Math.min(...rs.map((r) => r.top));
  const W = window.innerWidth, H = window.innerHeight;
  const l = Math.max(2, x - PAD), t = Math.max(2, y - PAD);
  return { x: l, y: t, w: Math.min(Math.max(...rs.map((r) => r.right)) + PAD, W - 2) - l, h: Math.min(Math.max(...rs.map((r) => r.bottom)) + PAD, H - 2) - t };
};
const gleich = (a, b) => (!a && !b) || (a && b && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.w - b.w) < 1 && Math.abs(a.h - b.h) < 1);
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

// Infokarte eines Geräts öffnen: Rechtsklick auf seinen Kasten in der Zeichenfläche
const kontextOeffnen = (name) => {
  const t = [...document.querySelectorAll('[data-tour="topo-flaeche"] svg title')].find((x) => x.textContent === name);
  const r = t?.parentElement?.getBoundingClientRect();
  if (!r) return;
  t.parentElement.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 30, clientY: r.top + 15, button: 2 }));
};

export default function Tour({ schritte, titel, onEnde, aktionen, geraeteAnzahl }) {
  const [i, setI] = useState(0);
  const [r, setR] = useState(null);
  const [bereit, setBereit] = useState(false);
  const [bh, setBh] = useState(180);
  const blase = useRef(null);
  const s = schritte[i];
  const letzter = i === schritte.length - 1;

  const weiter = useCallback(() => (letzter ? onEnde(true) : setI((x) => x + 1)), [letzter, onEnde]);
  const zurueck = () => setI((x) => Math.max(0, x - 1));

  // Vorbereitung: Dialoge schließen, Tabs und Knöpfe anklicken, Gerät wählen
  useEffect(() => {
    let aus = false;
    setBereit(false);
    (async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      aktionen.auswahlLeeren();
      await warte(60);
      for (const v of s.vor || []) {
        if (aus) return;
        if (typeof v === "string") finde(v)?.click();
        else if (v.waehle) aktionen.waehle(v.waehle);
        else if (v.kontext) { await warte(150); kontextOeffnen(v.kontext); }
        await warte(160);
      }
      // auf den Anker warten (Tab baut sich auf), höchstens 1,5 s
      for (let n = 0; n < 15 && s.anker && !rechteck(s.anker) && !aus; n++) await warte(100);
      if (!aus) setBereit(true);
    })();
    return () => { aus = true; };
  }, [i]); // nur beim Schrittwechsel, nicht bei jedem Neuzeichnen der App

  // Lage des Ankers laufend nachführen (Scrollen, Größe, Aufklappen)
  useEffect(() => {
    if (!bereit) return;
    let id, alt = null;
    const lauf = () => { const n = s.anker ? rechteck(s.anker) : null; if (!gleich(n, alt)) { alt = n; setR(n); } id = requestAnimationFrame(lauf); };
    const el = [].concat(s.anker || []).map(finde)[0];
    el?.scrollIntoView?.({ block: "nearest" });
    lauf();
    return () => cancelAnimationFrame(id);
  }, [bereit, i]);
  useLayoutEffect(() => { if (blase.current) setBh(blase.current.offsetHeight); });

  // Klick-Schritt: weiter, sobald der Klick auf dem Anker ankommt (nach der App)
  useEffect(() => {
    if (!bereit || s.art !== "klick") return;
    const h = (e) => { if ([].concat(s.anker).map(finde).some((el) => el?.contains(e.target))) setTimeout(weiter, 120); };
    document.addEventListener("click", h, true);
    return () => document.removeEventListener("click", h, true);
  }, [bereit, s, weiter]);
  // Zieh-Schritt: weiter, sobald ein Gerät dazukommt
  const start = useRef(geraeteAnzahl);
  useEffect(() => { start.current = geraeteAnzahl; }, [i]);
  useEffect(() => { if (bereit && s.art === "ziehen" && geraeteAnzahl > start.current) setTimeout(weiter, 400); }, [geraeteAnzahl]);

  // Tastatur: → / Enter weiter, ← zurück, Esc beenden
  useEffect(() => {
    const k = (e) => {
      if (!e.isTrusted) return;
      const imFeld = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
      if (e.key === "Escape") { e.stopImmediatePropagation(); e.preventDefault(); onEnde(false); }
      else if (!imFeld && (e.key === "ArrowRight" || e.key === "Enter") && s.art !== "klick") { e.stopImmediatePropagation(); e.preventDefault(); weiter(); }
      else if (!imFeld && e.key === "ArrowLeft") { e.stopImmediatePropagation(); e.preventDefault(); zurueck(); }
    };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [s, weiter, onEnde]);

  const W = window.innerWidth, H = window.innerHeight;
  const loch = bereit && s.anker ? r : null;
  let x = (W - BW) / 2, y = (H - bh) / 2;
  if (loch) {
    const platz = [
      [loch.x + loch.w + 14, loch.y, W - (loch.x + loch.w) > BW + 24],
      [loch.x - BW - 14, loch.y, loch.x > BW + 24],
      [loch.x, loch.y + loch.h + 14, H - (loch.y + loch.h) > bh + 24],
      [loch.x, loch.y - bh - 14, loch.y > bh + 24],
    ].find((c) => c[2]);
    [x, y] = platz || [W - BW - 24, H - bh - 24];
    x = Math.max(12, Math.min(W - BW - 12, x)); y = Math.max(12, Math.min(H - bh - 12, y));
  }
  const schatten = HELL ? "rgba(15,18,24,.55)" : "rgba(0,0,0,.66)";
  const sperre = { position: "fixed", background: schatten, pointerEvents: "auto" };
  const aufforderung = { klick: "👆 Klick auf die markierte Stelle", eingabe: "⌨️ Probier es aus, dann „Weiter“", ziehen: "✋ Zieh einen Typ auf die Fläche" }[s.art];
  const knopf = { fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 6, cursor: "pointer", border: `1px solid ${LINE}`, background: "transparent", color: TEXT2 };

  return createPortal(
    <div data-tour-overlay="" style={{ position: "fixed", inset: 0, zIndex: 3000, pointerEvents: "none", fontFamily: "'Segoe UI',system-ui,sans-serif" }} onMouseDown={(e) => e.stopPropagation()}>
      {loch ? <>
        <div style={{ ...sperre, left: 0, top: 0, right: 0, height: loch.y }} />
        <div style={{ ...sperre, left: 0, top: loch.y + loch.h, right: 0, bottom: 0 }} />
        <div style={{ ...sperre, left: 0, top: loch.y, width: loch.x, height: loch.h }} />
        <div style={{ ...sperre, left: loch.x + loch.w, top: loch.y, right: 0, height: loch.h }} />
        <div style={{ position: "fixed", left: loch.x, top: loch.y, width: loch.w, height: loch.h, borderRadius: 8, border: `2px solid ${ACCENT}`, boxShadow: `0 0 0 4px ${ACCENT}44`, transition: "all .2s ease" }} />
      </> : <div style={{ ...sperre, inset: 0 }} />}
      <div ref={blase} role="dialog" aria-label={s.titel} style={{ position: "fixed", left: x, top: y, width: BW, background: INPUT, color: TEXT, borderRadius: 10, borderTop: `4px solid ${ACCENT}`, boxShadow: "0 12px 32px rgba(0,0,0,.4)", padding: "14px 16px 12px", pointerEvents: "auto", transition: "left .2s ease, top .2s ease", opacity: bereit ? 1 : 0.6 }}>
        <div style={{ fontSize: 10.5, letterSpacing: 0.5, textTransform: "uppercase", color: MUTED, fontWeight: 700, marginBottom: 4 }}>{titel} · Schritt {i + 1}/{schritte.length}</div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{s.titel}</div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: TEXT2 }}>{s.text}</div>
        {aufforderung && <div style={{ marginTop: 9, fontSize: 12, fontWeight: 600, color: ACCENT }}>{aufforderung}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
          <div style={{ flex: 1, height: 4, background: LINE, borderRadius: 2, overflow: "hidden" }}><div style={{ width: `${Math.round(((i + 1) / schritte.length) * 100)}%`, height: "100%", background: ACCENT, transition: "width .2s" }} /></div>
          {letzter ? null : <button style={{ ...knopf, border: "none", padding: "5px 4px", color: MUTED, fontWeight: 400 }} onClick={() => onEnde(false)} title="Tour beenden (Esc)">Beenden</button>}
          {i > 0 && <button style={knopf} onClick={zurueck} title="Zurück (←)">Zurück</button>}
          {s.art !== "klick" && <button style={{ ...knopf, background: ACCENT, borderColor: ACCENT, color: "#fff" }} onClick={weiter} title="Weiter (→)" autoFocus>{s.knopf || (letzter ? "Fertig" : "Weiter")}</button>}
        </div>
      </div>
    </div>,
    document.body
  );
}
