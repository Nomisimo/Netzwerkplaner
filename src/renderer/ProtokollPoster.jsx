import React from "react";
import { LINE, SUB, MUTED } from "../shared/constants.js";

/* OSI-Schichten und übliche Protokolle, nach den Postern „OSI-Layer und übliche
   Protokolle in der Lichttechnik“ (Frank Plöger, 2024) und „Die wichtigsten
   Intra- und Internet-Protokolle für Techniker“ (W&T), im Design der App.
   Übertragung: U = Unicast, B = Broadcast, M = Multicast (klein = selten). */

const OSI = [
  [7, "Application", "Anwendung", "Daten", "", "Firewall, Gateway, Proxy", "#d9822b"],
  [6, "Presentation", "Darstellung", "Daten", "", "", "#3aa0b8"],
  [5, "Session", "Sitzung", "Daten", "", "", "#7c5aa6"],
  [4, "Transport", "Transport", "Segmente", "Port", "", "#6f9a3a"],
  [3, "Network", "Vermittlung", "Pakete", "IPv4 / IPv6", "Router, L3-Switch", "#b8453f"],
  [2, "Data Link", "Sicherung", "Frames", "MAC-Adresse", "Switch, Access Point", "#3d6fb0"],
  [1, "Physical", "Bitübertragung", "Bits", "Kabel", "Hub, Medienkonverter", "#24466f"],
];

export const POSTER_PROTOKOLLE = [
  // [Port, Kurzname, Langname, Transport, Übertragung, Multicast-Adresse, Gruppe]
  ["–", "ARP", "Address Resolution Protocol", "L2", "B", "", "std"],
  ["–", "ICMP", "Internet Control Message Protocol (Ping)", "IP", "U", "", "std"],
  ["20/21", "FTP", "File Transfer Protocol", "TCP", "U", "", "std"],
  ["22", "SSH", "Secure Shell", "TCP", "U", "", "std"],
  ["23", "Telnet", "Teletype Network", "TCP", "U", "", "std"],
  ["25", "SMTP", "Simple Mail Transfer Protocol", "TCP", "U", "", "std"],
  ["80", "HTTP", "Hypertext Transfer Protocol", "TCP", "U", "", "std"],
  ["110", "POP3", "Post Office Protocol", "TCP", "U", "", "std"],
  ["143", "IMAP", "Internet Message Access Protocol", "TCP", "U", "", "std"],
  ["443", "HTTPS", "Hypertext Transfer Protocol Secure", "TCP", "U", "", "std"],
  ["445", "SMB", "Server Message Block", "TCP", "U", "", "std"],
  ["502", "Modbus/TCP", "Modbus über TCP", "TCP", "U", "", "std"],
  ["2049", "NFS", "Network File System", "TCP", "U", "", "std"],
  ["9", "WoL", "Wake-on-LAN", "UDP", "B", "", "std"],
  ["53", "DNS*", "Domain Name System", "UDP", "U", "", "std"],
  ["67/68", "DHCP", "Dynamic Host Configuration Protocol", "UDP", "BU", "", "std"],
  ["69", "TFTP", "Trivial File Transfer Protocol", "UDP", "U", "", "std"],
  ["123", "NTP", "Network Time Protocol", "UDP", "UBm", "", "std"],
  ["161", "SNMP", "Simple Network Management Protocol", "UDP", "U", "", "std"],
  ["162", "SNMP Trap", "SNMP-Meldungen an den Manager", "UDP", "U", "", "std"],
  ["319/320", "PTP", "Precision Time Protocol", "UDP", "M", "224.0.1.129", "std"],
  ["514", "Syslog", "System Logging Protocol", "UDP", "U", "", "std"],
  ["5353", "mDNS", "Multicast DNS", "UDP", "M", "224.0.0.251", "std"],
  ["5568", "sACN", "Streaming ACN (ANSI E1.31)", "UDP", "uM", "239.255.hi.lo", "licht"],
  ["6454", "Art-Net*", "Artistic Licence Network", "UDP", "uB", "", "licht"],
  ["9138", "MA-Net1", "grandMA Serie 1", "UDP", "M", "236.3.2.1 (Alive), 236.3.2.65 (DMX)", "licht"],
  ["29998/29999", "MA-Net2", "grandMA2", "UDP", "M", "236.4.0.0 – 236.4.0.255", "licht"],
  ["30020", "MA-Net3*", "grandMA3", "UDP", "M", "ab 236.4.1.0", "licht"],
  ["4809", "CITP", "Controller Interface Transport Protocol", "UDP", "M", "224.0.0.180", "vt"],
  ["56565", "PSN", "PosiStageNet", "UDP", "M", "236.10.10.10", "vt"],
  ["frei", "OSC", "Open Sound Control", "UDP", "Ub", "", "vt"],
  ["5960/5961", "NDI", "Network Device Interface", "UDP", "Um", "", "vt"],
];

const GRUPPE = { std: ["Standard-Protokolle", "#5b6b80"], licht: ["Licht", "#3aa0b8"], vt: ["Veranstaltungstechnik", "#a08a55"] };
const FARBE = { TCP: "#4f9a5f", UDP: "#3d8fd1", L2: "#3d6fb0", IP: "#8a8f98" };
const UEB = { U: "Unicast", B: "Broadcast", M: "Multicast" };
const uebText = (s) => s.split("").map((c) => (UEB[c.toUpperCase()] ? (c === c.toLowerCase() ? `(${UEB[c.toUpperCase()]})` : UEB[c]) : "")).filter(Boolean).join(", ");

export default function ProtokollPoster() {
  const COL = 30, LEFT = 440, TOP = 150, ROW = 26;
  const n = POSTER_PROTOKOLLE.length;
  const W = LEFT + n * COL + 20, H = TOP + 7 * ROW + 190;
  const yLayer = (l) => TOP + (7 - l) * ROW;
  const tcp = POSTER_PROTOKOLLE.map((p, i) => [p, i]).filter(([p]) => p[3] === "TCP");
  const udp = POSTER_PROTOKOLLE.map((p, i) => [p, i]).filter(([p]) => p[3] === "UDP");
  const span = (list) => [LEFT + list[0][1] * COL, LEFT + (list[list.length - 1][1] + 1) * COL];
  const [tx0, tx1] = span(tcp), [ux0, ux1] = span(udp);
  const gruppen = ["std", "licht", "vt"].map((g) => { const ix = POSTER_PROTOKOLLE.map((p, i) => [p, i]).filter(([p]) => p[6] === g); return [g, ...span(ix)]; });

  return (
    <div>
      <div style={{ overflowX: "auto", border: `1px solid ${LINE}`, borderRadius: 8, background: "#161b21" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", minWidth: 1100, height: "auto", fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
          {/* OSI-Schichten links */}
          <text x="14" y={TOP - 14} fontSize="11" fill={SUB} fontWeight="700">OSI-SCHICHT</text>
          <text x="232" y={TOP - 14} fontSize="11" fill={SUB} fontWeight="700">EINHEIT · ADRESSE · GERÄTE</text>
          {OSI.map(([nr, en, de, einheit, adr, ger, col]) => (
            <g key={nr}>
              <rect x="10" y={yLayer(nr)} width={LEFT - 20} height={ROW - 2} rx="3" fill={col + "cc"} />
              <text x="18" y={yLayer(nr) + 16} fontSize="12" fontWeight="700" fill="#fff">{nr} {en}</text>
              <text x="140" y={yLayer(nr) + 16} fontSize="10.5" fill="#ffffffcc">{de}</text>
              <text x="232" y={yLayer(nr) + 16} fontSize="10" fill="#fff">{[einheit, adr, ger].filter(Boolean).join(" · ")}</text>
            </g>
          ))}
          {/* Spalten je Protokoll */}
          {POSTER_PROTOKOLLE.map(([port, kurz, lang, tr, ueb, mc, g], i) => {
            const x = LEFT + i * COL;
            const oben = tr === "L2" ? yLayer(3) : tr === "IP" ? yLayer(3) : yLayer(7);
            const col = FARBE[tr];
            return (
              <g key={kurz}>
                <title>{`${kurz}: ${lang}\nPort ${port} · ${tr}${ueb ? " · " + uebText(ueb) : ""}${mc ? "\nMulticast: " + mc : ""}`}</title>
                <rect x={x + 2} y={oben - (tr === "L2" ? 0 : 118)} width={COL - 4} height={(tr === "L2" ? yLayer(2) + ROW - 2 : yLayer(4) - 2) - (oben - (tr === "L2" ? 0 : 118))} rx="3" fill={col + "33"} stroke={col} strokeWidth=".8" />
                <text transform={`translate(${x + COL / 2 + 4},${tr === "L2" ? yLayer(2) + ROW - 8 : yLayer(4) - 8}) rotate(-90)`} fontSize="11" fill="#fff" fontWeight="700">
                  {port !== "–" ? `${port} ${kurz}` : kurz}{mc && <tspan fontSize="9.5" fontWeight="400" fill="#8ec5ff">{`  ${mc}`}</tspan>}
                </text>
                <text x={x + COL / 2} y={yLayer(3) + 16} fontSize="9.5" fontWeight="700" fill="#fff" textAnchor="middle">{ueb}</text>
                <text transform={`translate(${x + COL / 2 + 4},${yLayer(1) + ROW + 58}) rotate(-90)`} fontSize="9.5" fill={SUB} textAnchor="end" fontStyle="italic">{lang.length > 34 ? lang.slice(0, 33) + "…" : lang}</text>
              </g>
            );
          })}
          {/* Transportbänder */}
          <rect x={tx0} y={yLayer(4)} width={tx1 - tx0} height={ROW - 2} rx="3" fill={FARBE.TCP} />
          <text x={(tx0 + tx1) / 2} y={yLayer(4) + 16} fontSize="11.5" fontWeight="700" fill="#fff" textAnchor="middle">TCP · Transmission Control Protocol</text>
          <rect x={ux0} y={yLayer(4)} width={ux1 - ux0} height={ROW - 2} rx="3" fill={FARBE.UDP} />
          <text x={(ux0 + ux1) / 2} y={yLayer(4) + 16} fontSize="11.5" fontWeight="700" fill="#fff" textAnchor="middle">UDP · User Datagram Protocol</text>
          <rect x={LEFT + COL} y={yLayer(3)} width={W - 20 - LEFT - COL} height={ROW - 2} rx="3" fill="none" stroke="#b8453f" strokeWidth="1" />
          <rect x={LEFT + 2} y={yLayer(2)} width={W - 22 - LEFT} height={ROW - 2} rx="3" fill={OSI[5][6]} />
          <text x={(LEFT + W - 20) / 2} y={yLayer(2) + 16} fontSize="11.5" fontWeight="700" fill="#fff" textAnchor="middle">Ethernet · WLAN</text>
          <rect x={LEFT + 2} y={yLayer(1)} width={W - 22 - LEFT} height={ROW - 2} rx="3" fill={OSI[6][6]} />
          <text x={(LEFT + W - 20) / 2} y={yLayer(1) + 16} fontSize="11.5" fontWeight="700" fill="#fff" textAnchor="middle">LAN · WLAN</text>
          {/* Gruppen */}
          {gruppen.map(([g, x0, x1]) => (
            <g key={g}>
              <rect x={x0 + 2} y={yLayer(1) + ROW + 2} width={x1 - x0 - 4} height="16" rx="3" fill={GRUPPE[g][1]} />
              <text x={(x0 + x1) / 2} y={yLayer(1) + ROW + 14} fontSize="10.5" fontWeight="700" fill="#fff" textAnchor="middle">{GRUPPE[g][0]}</text>
            </g>
          ))}
          <text x="14" y="26" fontSize="18" fontWeight="800" fill="#fff">OSI-Schichten und übliche Protokolle</text>
          <text x="14" y="46" fontSize="11.5" fill={SUB}>U = Unicast · B = Broadcast · M = Multicast (klein geschrieben = selten) · * auch über TCP möglich</text>
          <text x="14" y="62" fontSize="10.5" fill={MUTED}>Nach den Postern von Frank Plöger (2024) und W&amp;T. Mauszeiger auf eine Spalte zeigt Details.</text>
        </svg>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginTop: 14 }}>
        <thead><tr>{["Protokoll", "Port", "Transport", "Übertragung", "Multicast-Adresse", "Bereich"].map((h) => <th key={h} style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${LINE}`, color: SUB, fontSize: 11 }}>{h}</th>)}</tr></thead>
        <tbody>{POSTER_PROTOKOLLE.map(([port, kurz, lang, tr, ueb, mc, g]) => (
          <tr key={kurz}>
            <td style={{ padding: "5px 8px", borderBottom: "1px solid #232a33" }}><b>{kurz}</b> <span style={{ color: MUTED }}>{lang}</span></td>
            <td style={{ padding: "5px 8px", borderBottom: "1px solid #232a33", fontFamily: "Consolas,monospace" }}>{port}</td>
            <td style={{ padding: "5px 8px", borderBottom: "1px solid #232a33" }}>{tr === "L2" ? "Schicht 2" : tr === "IP" ? "IP" : tr}</td>
            <td style={{ padding: "5px 8px", borderBottom: "1px solid #232a33" }}>{uebText(ueb)}</td>
            <td style={{ padding: "5px 8px", borderBottom: "1px solid #232a33", fontFamily: "Consolas,monospace", color: "#8ec5ff" }}>{mc}</td>
            <td style={{ padding: "5px 8px", borderBottom: "1px solid #232a33", color: GRUPPE[g][1] }}>{GRUPPE[g][0]}</td>
          </tr>
        ))}</tbody>
      </table>
      <p style={{ fontSize: 11.5, color: MUTED, marginTop: 8 }}>Korrigiert gegenüber den Vorlagen: PSN nutzt UDP 56565 (auf dem Poster 65655, ein Port über 65535 existiert nicht), NDI 5960/5961, IMAP 143 und NTP 123.</p>
    </div>
  );
}
