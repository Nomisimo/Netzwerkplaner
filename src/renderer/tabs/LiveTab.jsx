import React, { useState, useEffect } from "react";
import { S, OK, SUB, MUTED, WARN } from "../../shared/constants.js";
import { api, isElectron } from "../api.js";
import { useMonitor } from "../live/store.js";
import StatusView from "../live/StatusView.jsx";
import ScanView from "../live/ScanView.jsx";
import SwitchView from "../live/SwitchView.jsx";
import { SacnView, ArtnetView } from "../live/LichtViews.jsx";
import { DanteView, NdiView, ManetView, OscView, CitpView, PtpView } from "../live/ProtokollViews.jsx";

// Untertabs: [Schlüssel, Beschriftung, Monitor im Hauptprozess]
const SUBS = [
  ["status", "Online-Status", null],
  ["scan", "Netzwerkscan", "scan"],
  ["switch", "Switches (SNMP)", "snmp"],
  ["sacn", "sACN", "sacn"],
  ["artnet", "Art-Net", "artnet"],
  ["dante", "Dante", "dante"],
  ["manet", "MA-Net", "manet"],
  ["ndi", "NDI", "ndi"],
  ["osc", "OSC", "osc"],
  ["citp", "CITP", "citp"],
  ["ptp", "PTP-Clock", "ptp"],
];

function SubTab({ k, label, kind, active, onClick }) {
  const m = useMonitor(kind || "_none");
  const on = kind && m.running && !["scan", "snmp"].includes(kind);
  return (
    <button style={{ ...S.boxTab, ...(active ? S.boxTabActive : {}) }} onClick={onClick}>
      {on && <span title="läuft" style={{ width: 7, height: 7, borderRadius: "50%", background: OK, display: "inline-block" }} />}
      {label}
    </button>
  );
}

export default function LiveTab(props) {
  const [sub, setSub] = useState(() => localStorage.getItem("netzwerkplaner_live_sub") || "status");
  const [interfaces, setInterfaces] = useState([]);
  const [iface, setIface] = useState(() => localStorage.getItem("netzwerkplaner_live_iface") || "");
  useEffect(() => { localStorage.setItem("netzwerkplaner_live_sub", sub); }, [sub]);
  useEffect(() => { localStorage.setItem("netzwerkplaner_live_iface", iface); }, [iface]);
  useEffect(() => { api.monInterfaces().then((l) => { setInterfaces(l || []); if (iface && !(l || []).some((i) => i.address === iface)) setIface(""); }); }, []);

  const p = { ...props, iface, interfaces, goSub: setSub };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ ...S.boxTabs, marginBottom: 0, flex: 1 }}>
          {SUBS.map(([k, l, kind]) => <SubTab key={k} k={k} label={l} kind={kind} active={sub === k} onClick={() => setSub(k)} />)}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: SUB }} title="Über welche Netzwerkkarte mitgelesen wird. Gilt für Monitore, die danach gestartet werden.">
          Netzwerkkarte
          <select style={{ ...S.selectSm, width: 230 }} value={iface} onChange={(e) => setIface(e.target.value)}>
            <option value="">alle</option>
            {interfaces.map((i) => <option key={i.name + i.address} value={i.address}>{i.name} · {i.address}/{i.prefix}</option>)}
          </select>
          <button style={S.smallBtn} onClick={() => api.monInterfaces().then((l) => setInterfaces(l || []))} title="Liste neu laden">↻</button>
        </label>
      </div>
      {!isElectron && <div style={{ color: WARN, fontSize: 13, marginBottom: 12 }}>⚠ Die Live-Werkzeuge brauchen Netzwerkzugriff und funktionieren nur in der Desktop-App.</div>}
      {isElectron && !interfaces.length && <div style={{ color: WARN, fontSize: 13, marginBottom: 12 }}>⚠ Keine aktive Netzwerkverbindung gefunden.</div>}

      <div style={{ ...S.section, padding: 18 }}>
        {sub === "status" && <StatusView {...p} />}
        {sub === "scan" && <ScanView {...p} />}
        {sub === "switch" && <SwitchView {...p} />}
        {sub === "sacn" && <SacnView {...p} />}
        {sub === "artnet" && <ArtnetView {...p} />}
        {sub === "dante" && <DanteView {...p} />}
        {sub === "manet" && <ManetView {...p} />}
        {sub === "ndi" && <NdiView {...p} />}
        {sub === "osc" && <OscView {...p} />}
        {sub === "citp" && <CitpView {...p} />}
        {sub === "ptp" && <PtpView {...p} />}
      </div>
      <p style={{ ...S.hint, color: MUTED }}>
        Die Monitore hören nur zu. Pakete ins Netz schicken nur: „ArtPoll senden“, die mDNS-Abfragen bei Dante/NDI, der Netzwerkscan und die SNMP-Abfrage. Laufende Monitore arbeiten weiter, wenn du den Tab wechselst.
        Beim ersten Start fragt Windows nach der Firewall-Freigabe und macOS nach Zugriff auf das lokale Netzwerk; beides bitte erlauben.
      </p>
    </div>
  );
}
