import React, { useState, useMemo } from "react";
import { S, ACCENT, LINE, SUB, MUTED, OK, WARN, ERR, TEXT, TEXT2 } from "../shared/constants.js";
import { netzRechnen, v4Aufteilen, macZuLinkLocal } from "../shared/netzrechner.js";
import { Field } from "./ui.jsx";

/* Netzrechner im Wissen-Tab: IPv4 oder IPv6 eingeben, alles Wichtige ablesen.
   Erkennt die Version am Doppelpunkt. Ein Klick auf einen Wert kopiert ihn. */
const BEISPIELE = ["10.10.20.0/24", "192.168.1.130/26", "172.16.5.9", "169.254.12.7/16", "2.0.0.1/8", "239.255.0.1", "fe80::211:22ff:fe33:4455", "fd00:10:20::5/64", "2001:db8:1::/48"];
const FARBE = { privat: OK, oeffentlich: ACCENT, linklocal: WARN, loopback: SUB, multicast: "#c792ea", broadcast: WARN, reserviert: ERR };
const ART = { privat: "privat", oeffentlich: "öffentlich", linklocal: "link-local", loopback: "loopback", multicast: "multicast", broadcast: "broadcast", reserviert: "reserviert" };

function Wert({ l, v, hint, mono = true }) {
  const [kopiert, setKopiert] = useState(false);
  const kopieren = () => { try { navigator.clipboard?.writeText(String(v)); setKopiert(true); setTimeout(() => setKopiert(false), 900); } catch { /* ohne Zwischenablage */ } };
  return (
    <div onClick={v != null ? kopieren : undefined} title={v != null ? "Klicken zum Kopieren" : undefined}
      style={{ ...S.card, margin: 0, padding: "7px 11px", cursor: v != null ? "copy" : "default", minWidth: 0 }}>
      <div style={{ fontSize: 10.5, color: SUB, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>{l}{kopiert && <span style={{ color: OK, marginLeft: 6, textTransform: "none", letterSpacing: 0 }}>kopiert</span>}</div>
      <div style={{ fontSize: 13.5, marginTop: 2, fontFamily: mono ? "ui-monospace, Menlo, Consolas, monospace" : "inherit", wordBreak: "break-all" }}>{v ?? "–"}</div>
      {hint && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

const Raster = ({ children }) => <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 8 }}>{children}</div>;

// Binärdarstellung: Netzanteil farbig, Hostanteil grau
function Binaer({ r }) {
  let i = 0;
  const zeile = (s) => s.split("").map((c, k) => {
    if (c === ".") return <span key={k} style={{ color: MUTED }}>.</span>;
    const netz = i++ < r.prefix;
    return <span key={k} style={{ color: netz ? ACCENT : TEXT2 }}>{c}</span>;
  });
  const reihe = (l, s) => { i = 0; return <tr><td style={{ ...S.td, color: SUB, width: 70 }}>{l}</td><td style={{ ...S.td, fontFamily: "ui-monospace, Menlo, Consolas, monospace", letterSpacing: 0.5 }}>{zeile(s)}</td></tr>; };
  return (
    <table style={{ ...S.table, fontSize: 12.5, marginTop: 8 }}><tbody>
      {reihe("Adresse", r.binaer.ip)}
      {reihe("Maske", r.binaer.maske)}
      {reihe("Netz", r.binaer.netz)}
    </tbody></table>
  );
}

const SEITE = 256;

function Aufteilen({ r }) {
  const [p, setP] = useState(Math.min(32, r.prefix < 24 ? 24 : r.prefix + 2));
  const [max, setMax] = useState(SEITE);
  const a = useMemo(() => v4Aufteilen(r.cidr, p, max), [r.cidr, p, max]);
  // Jede Zielgröße bis /32 wählbar, auch /8 in /24-Netze
  const optionen = Array.from({ length: 32 - r.prefix }, (_, k) => r.prefix + k + 1);
  if (!optionen.length) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Aufteilen in</span>
        <select style={{ ...S.selectSm, width: "auto" }} value={p} onChange={(e) => { setP(+e.target.value); setMax(SEITE); }}>
          {optionen.map((x) => <option key={x} value={x}>/{x} ({(2 ** (x - r.prefix)).toLocaleString("de-DE")} Netze)</option>)}
        </select>
        {a && <span style={{ fontSize: 12, color: SUB }}>{a.anzahl.toLocaleString("de-DE")} Teilnetze mit je {a.hostsJe.toLocaleString("de-DE")} {a.hostsJe === 1 ? "Host" : "Hosts"}{a.gekuerzt ? `, die ersten ${a.netze.length.toLocaleString("de-DE")} gezeigt` : ""}</span>}
      </div>
      {a && <div style={{ overflowX: "auto", maxHeight: 280, overflowY: "auto", marginTop: 6 }}>
        <table style={{ ...S.table, fontSize: 12.5 }}>
          <thead><tr><th style={S.th}>Netz</th><th style={S.th}>Erste</th><th style={S.th}>Letzte</th><th style={S.th}>Broadcast</th></tr></thead>
          <tbody>{a.netze.map((n) => <tr key={n.cidr}>{[n.cidr, n.erste, n.letzte, n.broadcast || "–"].map((x, k) => <td key={k} style={{ ...S.td, fontFamily: "ui-monospace, Menlo, Consolas, monospace" }}>{x}</td>)}</tr>)}</tbody>
        </table>
      </div>}
      {a?.gekuerzt && <button style={{ ...S.smallBtn, marginTop: 6 }} onClick={() => setMax((m) => m + SEITE)}>Weitere {Math.min(SEITE, a.anzahl - a.netze.length).toLocaleString("de-DE")} anzeigen</button>}
    </div>
  );
}

function Ergebnis4({ r }) {
  const b = r.bereich;
  return (
    <>
      <Raster>
        <Wert l="Netz (CIDR)" v={r.cidr} hint={r.ohnePraefix ? `Ohne Maske: Klassenmaske /${r.prefix} angenommen` : null} />
        <Wert l="Subnetzmaske" v={r.maske} hint={`/${r.prefix}`} />
        <Wert l="Wildcard" v={r.wildcard} hint="für ACLs (Cisco)" />
        <Wert l="Broadcast" v={r.broadcast} hint={r.prefix >= 31 ? "/31 und /32 haben keinen" : null} />
        <Wert l="Erste Host-Adresse" v={r.erste} />
        <Wert l="Letzte Host-Adresse" v={r.letzte} />
        <Wert l="Nutzbare Hosts" v={r.hosts.toLocaleString("de-DE")} hint={`${r.groesse.toLocaleString("de-DE")} Adressen gesamt`} />
        <Wert l="Klasse" v={`${r.klasse.k} (${r.klasse.bereich})`} mono={false} hint={r.klasse.std ? `Klassenmaske /${r.klasse.std}, heute nur noch historisch` : null} />
      </Raster>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 10, fontSize: 12.5 }}>
        <span style={{ ...S.chip, borderColor: FARBE[b.art], color: FARBE[b.art] }}>{ART[b.art]}</span>
        <span>{b.name}{b.cidr ? <span style={{ color: MUTED }}> · {b.cidr}</span> : null}</span>
        {r.vorgabe && <span style={{ color: WARN }}>· Hinweis: {r.vorgabe}</span>}
        {r.istNetz && <span style={{ color: WARN }}>· Das ist die Netzadresse, nicht als Geräte-IP vergeben.</span>}
        {r.istBroadcast && <span style={{ color: ERR }}>· Das ist die Broadcast-Adresse, nicht als Geräte-IP vergeben.</span>}
        <span style={{ color: MUTED, marginLeft: "auto" }}>Hex {r.hex}</span>
      </div>
      <Binaer r={r} />
      {r.prefix < 32 && <Aufteilen key={r.cidr} r={r} />}
    </>
  );
}

function Ergebnis6({ r }) {
  const b = r.bereich;
  return (
    <>
      <Raster>
        <Wert l="Kurzform" v={r.kurz} />
        <Wert l="Netz" v={r.netz} hint={r.ohnePraefix ? "Ohne Präfix: /64 angenommen" : null} />
        <Wert l="Erste Adresse" v={r.erste} />
        <Wert l="Letzte Adresse" v={r.letzte} />
        <Wert l="Adressen im Netz" v={r.anzahl} mono={false} />
        {r.subnetze64 && <Wert l="/64-Netze darin" v={r.subnetze64} mono={false} hint="Ein LAN bekommt immer ein /64" />}
        {r.interfaceId && <Wert l="Interface-ID" v={r.interfaceId} hint="die unteren 64 Bit" />}
        {r.mac && <Wert l="MAC (aus EUI-64)" v={r.mac} hint="ff:fe in der Mitte, 7. Bit gekippt" />}
        {r.v4 && <Wert l="Enthaltene IPv4" v={r.v4} />}
      </Raster>
      <div style={{ marginTop: 8 }}><Wert l="Volle Schreibweise" v={r.voll} /></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 10, fontSize: 12.5 }}>
        <span style={{ ...S.chip, borderColor: FARBE[b.art], color: FARBE[b.art] }}>{ART[b.art]}</span>
        <span>{b.name}{b.cidr ? <span style={{ color: MUTED }}> · {b.cidr}</span> : null}</span>
      </div>
    </>
  );
}

function MacRechner() {
  const [mac, setMac] = useState("00:11:22:33:44:55");
  const ll = macZuLinkLocal(mac);
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginTop: 14 }}>
      <Field label="MAC → Link-Local (EUI-64)"><input style={{ ...S.inputSm, width: 190, fontFamily: "ui-monospace, Menlo, Consolas, monospace" }} value={mac} onChange={(e) => setMac(e.target.value)} /></Field>
      <div style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 13.5, paddingBottom: 6, color: ll ? TEXT : ERR }}>{ll || "MAC ungültig"}</div>
    </div>
  );
}

export default function Netzrechner() {
  const [eingabe, setEingabe] = useState("192.168.1.130/26");
  const [maske, setMaske] = useState("");
  const { v, r } = netzRechnen(eingabe, maske);
  const v4ohneMaske = v === 4 && r && !r.fehler && !/[\/\s]/.test(eingabe.trim());
  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: 14, maxWidth: 1000 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <Field label="Adresse (IPv4 oder IPv6, mit /Präfix oder Maske)">
          <input autoFocus style={{ ...S.input, width: 340, fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 14 }} value={eingabe}
            placeholder="z. B. 10.10.20.5/24 oder 2001:db8::1/64" onChange={(e) => setEingabe(e.target.value)} />
        </Field>
        {(v === 4) && <Field label="Maske (optional)">
          <input style={{ ...S.input, width: 160, fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 14, opacity: v4ohneMaske || maske ? 1 : 0.5 }} value={maske}
            placeholder="255.255.255.0" onChange={(e) => setMaske(e.target.value)} />
        </Field>}
        <span style={{ ...S.chip, marginBottom: 6, borderColor: ACCENT, color: ACCENT }}>{v === 6 ? "IPv6" : "IPv4"}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0 12px" }}>
        <span style={{ fontSize: 11.5, color: MUTED, alignSelf: "center" }}>Beispiele:</span>
        {BEISPIELE.map((x) => <button key={x} style={{ ...S.smallBtn, fontFamily: "ui-monospace, Menlo, Consolas, monospace" }} onClick={() => { setEingabe(x); setMaske(""); }}>{x}</button>)}
      </div>
      {!r && <div style={{ color: eingabe.trim() ? ERR : MUTED, fontSize: 13 }}>{eingabe.trim() ? "Keine gültige Adresse." : "Adresse eingeben."}</div>}
      {r?.fehler && <div style={{ color: ERR, fontSize: 13 }}>{r.fehler}</div>}
      {r && !r.fehler && (v === 4 ? <Ergebnis4 r={r} /> : <Ergebnis6 r={r} />)}
      {v === 6 && <MacRechner />}
    </div>
  );
}
