import React, { useState, useMemo, useEffect, useRef } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, WARN, INFO, OK, katColor, TYPEN, KATEGORIEN } from "../shared/constants.js";
import { KATALOG_GERAETE, ipPorts } from "../shared/catalog.js";
import { IconView, ICON_GRUPPEN, ICON_LABEL } from "./icons.jsx";
import { vlanBaum, vlanPfad } from "../shared/qinq.js";
import { X as XIcon, OctagonX, TriangleAlert, Info, ChevronDown } from "lucide-react";

export function Section({ title, subtitle, right, children, style }) {
  return (
    <section style={{ ...S.section, ...style }}>
      {(title || right) && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: subtitle ? 0 : 12 }}>
          <div style={{ flex: 1 }}>{title && <h2 style={S.h2}>{title}</h2>}</div>
          {right}
        </div>
      )}
      {subtitle && <p style={S.subtitle}>{subtitle}</p>}
      {children}
    </section>
  );
}

export function Field({ label, children, hint, style }) {
  return (
    <label style={{ ...S.field, ...style }}>
      <span style={S.fieldLabel}>{label}</span>
      {children}
      {hint && <span className="sp-norm-hint">{hint}</span>}
    </label>
  );
}

export function Modal({ title, onClose, children, width = 640, footer }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div style={S.modalOverlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modalBox, width, maxWidth: "94vw" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", flex: 1 }}>{title}</div>
          <button style={{ ...S.ghostBtn, padding: "3px 9px" }} onClick={onClose}><XIcon size={14} /></button>
        </div>
        {children}
        {footer && <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>{footer}</div>}
      </div>
    </div>
  );
}

export const SEV = {
  error: { label: "Fehler", color: ERR, icon: <OctagonX size={12} /> },
  warn:  { label: "Warnung", color: WARN, icon: <TriangleAlert size={12} /> },
  info:  { label: "Hinweis", color: INFO, icon: <Info size={12} /> },
};
export const SevBadge = ({ sev }) => (
  <span style={{ ...S.badge, display: "inline-flex", alignItems: "center", gap: 3, background: SEV[sev].color + "22", color: SEV[sev].color, border: `1px solid ${SEV[sev].color}55` }}>{SEV[sev].icon} {SEV[sev].label}</span>
);

export const Dot = ({ color, size = 9, title }) => (
  <span title={title} style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, flexShrink: 0 }} />
);

export const StatusDot = ({ st, size = 9 }) => {
  const c = !st || st.ok === null || st.ok === undefined ? "#5b6570" : st.ok ? OK : ERR;
  const t = !st ? "Status unbekannt" : st.ok === null ? st.method : st.ok ? `erreichbar (${st.method}, ${st.ms} ms)` : `nicht erreichbar (${st.method})`;
  return <Dot color={c} size={size} title={t} />;
};

export function Toggle({ checked, onChange, label, title, disabled }) {
  return (
    <label title={title} style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", flexShrink: 0, cursor: disabled ? "default" : "pointer", fontSize: 12, color: "#c8d0d8", userSelect: "none", opacity: disabled ? 0.55 : 1 }}>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: ACCENT }} />
      {label}
    </label>
  );
}

export function VlanSelect({ vlans, value, onChange, style, allowNone = true, noneLabel = "– kein VLAN –" }) {
  return (
    <select style={{ ...S.selectSm, ...style }} value={value || ""} onChange={(e) => onChange(e.target.value || null)}>
      {allowNone && <option value="">{noneLabel}</option>}
      {vlanBaum(vlans).map(({ v }) => <option key={v.id} value={v.id}>{vlanPfad(v, vlans)} · {v.name}</option>)}
    </select>
  );
}

export const VlanChip = ({ v, small }) => v ? (
  <span style={{ ...S.chip, borderColor: v.farbe + "88", padding: small ? "0 6px" : S.chip.padding }}>
    <Dot color={v.farbe} size={7} /> {v.vid}{!small && ` ${v.name}`}
  </span>
) : <span style={{ color: MUTED }}>–</span>;

export const KatChip = ({ k }) => (
  <span style={{ ...S.chip, borderColor: katColor(k) + "66" }}><Dot color={katColor(k)} size={7} />{k}</span>
);

/* ── Geräteauswahl: Katalogmodelle, eigene Vorlagen, generische Typen ──── */
export function DevicePicker({ onPick, onClose, vorlagen = [], bestand = [], title = "Gerät hinzufügen", customIcons }) {
  const [q, setQ] = useState("");
  const [kat, setKat] = useState("");
  const [nurFokus, setNurFokus] = useState(true);
  const inp = useRef(null);
  useEffect(() => inp.current?.focus(), []);
  const ql = q.toLowerCase();
  const items = useMemo(() => {
    const gen = Object.entries(TYPEN).map(([k, t]) => ({ kind: "typ", key: k, title: t.label, sub: "Generischer Typ", icon: t.icon, kat: t.kat }));
    const own = vorlagen.map((v) => ({ kind: "vorlage", key: v.id, title: v.name, sub: `Eigene Vorlage · ${v.geraet.hersteller || ""} ${v.geraet.modell || ""}`, icon: v.geraet.icon, kat: v.geraet.kategorie }));
    const kg = KATALOG_GERAETE.filter((g) => !nurFokus || g.fokus).map((g) => ({ kind: "katalog", key: g.id, title: `${g.hersteller} ${g.modell}`, sub: g.geraetetyp + (g.raw["Web-UI"] !== "Nein" ? " · Web-UI" : ""), icon: g.icon, kat: g.kategorie, search: `${g.raw.Protokolle} ${g.raw.Funktion}` }));
    const best = bestand.map((b) => ({ kind: "bestand", key: b.id, title: b.name, sub: ["Bestand", [b.geraet.hersteller, b.geraet.modell].filter(Boolean).join(" "), ipPorts(b.geraet).filter((i) => i.ip).map((i) => i.ip).join(", ")].filter(Boolean).join(" · "), icon: b.geraet.icon, kat: b.geraet.kategorie, search: `${b.geraet.netzname || ""} ${(b.geraet.felder || []).map((f) => f.wert).join(" ")}` }));
    return [...best, ...own, ...kg, ...gen].filter((i) => (!kat || i.kat === kat) && (!ql || `${i.title} ${i.sub} ${i.search || ""}`.toLowerCase().includes(ql)));
  }, [ql, kat, vorlagen, bestand, nurFokus]);
  return (
    <Modal title={title} onClose={onClose} width={720}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input ref={inp} style={{ ...S.input, flex: 1 }} placeholder="Suchen: Hersteller, Modell, Typ oder Protokoll (z. B. „Dante“, „GigaCore“, „Node“)" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && items[0] && onPick(items[0])} />
        <select style={S.select} value={kat} onChange={(e) => setKat(e.target.value)}>
          <option value="">Alle Bereiche</option>
          {Object.keys(KATEGORIEN).map((k) => <option key={k}>{k}</option>)}
        </select>
        <Toggle checked={nurFokus} onChange={setNurFokus} label="nur Fokus" title="Nur Modelle der Fokus-Hersteller (MA, Luminex, Cisco, Yamaha, Schnick-Schnack-Systems, Dante) anzeigen" />
      </div>
      <div style={{ maxHeight: "58vh", overflowY: "auto", border: `1px solid ${LINE}`, borderRadius: 8 }}>
        {items.length === 0 && <div style={{ ...S.empty, padding: 16 }}>Nichts gefunden.</div>}
        {items.slice(0, 250).map((i) => (
          <button key={i.kind + i.key} onClick={() => onPick(i)}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: `1px solid #232a33`, padding: "8px 12px", cursor: "pointer", color: "#e8eaed" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#232a33")} onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
            <IconView icon={i.icon} customIcons={customIcons} color={katColor(i.kat)} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{i.title}</div>
              <div style={{ fontSize: 11, color: SUB }}>{i.sub}</div>
            </div>
            {i.kind === "bestand" && <span style={{ ...S.badge, background: "#2ecc71", color: "#10261a" }}>Bestand</span>}
            {i.kind === "vorlage" && <span style={{ ...S.badge, background: ACCENT, color: "#fff" }}>Vorlage</span>}
            {i.kind === "typ" && <span style={{ ...S.badge, border: `1px solid ${LINE}`, color: SUB }}>generisch</span>}
          </button>
        ))}
      </div>
      <p style={S.hint}>{items.length} Treffer · Enter übernimmt den ersten Treffer · Katalog: {KATALOG_GERAETE.length} Modelle</p>
    </Modal>
  );
}

export function IconPicker({ value, onChange, customIcons, color }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button style={{ ...S.ghostBtn, padding: "4px 8px" }} onClick={() => setOpen((o) => !o)} title="Icon wählen">
        <IconView icon={value} customIcons={customIcons} color={color} /> <ChevronDown size={12} />
      </button>
      {open && (
        <div style={{ position: "absolute", zIndex: 50, top: "100%", left: 0, marginTop: 4, background: "#1b2026", border: `1px solid ${LINE}`, borderRadius: 8, padding: 8, width: 320, maxHeight: 380, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,.5)" }}
          onMouseLeave={() => setOpen(false)}>
          {[...ICON_GRUPPEN, ...(customIcons.length ? [{ titel: "Eigene Icons", icons: customIcons.map((c) => "custom:" + c.id) }] : [])].map((g) => (
            <div key={g.titel}>
              <div style={{ fontSize: 11, color: "#8a939d", margin: "6px 2px 4px" }}>{g.titel}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
                {g.icons.map((n) => (
                  <button key={n} title={n.startsWith("custom:") ? customIcons.find((c) => "custom:" + c.id === n)?.name : ICON_LABEL[n] || n}
                    onClick={() => { onChange(n); setOpen(false); }}
                    style={{ background: n === value ? ACCENT + "33" : "transparent", border: `1px solid ${n === value ? ACCENT : "transparent"}`, borderRadius: 6, padding: 6, cursor: "pointer" }}>
                    <IconView icon={n} customIcons={customIcons} color={color} size={24} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const th = (extra) => ({ ...S.th, ...extra });
export const td = (extra) => ({ ...S.td, ...extra });
