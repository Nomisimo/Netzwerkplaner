import React from "react";
import { ACCENT, LINE, SUB, MUTED, TEXT, STRONG, CARD, PANEL, OK, ERR, WARN, INFO } from "../shared/constants.js";

/* Schaubilder für den Wissen-Tab. Reine SVG-Zeichnungen in den Farben des
   gewählten Erscheinungsbilds (hell oder dunkel). */
const ROT = "#e53935", GRUEN = "#2e9e44", BLAU = "#4ea1ff", GELB = "#f5b800", LILA = "#b37dff";

const Kasten = ({ x, y, w = 96, h = 34, t, s, farbe = LINE, fill = CARD, fett }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx="6" fill={fill} stroke={farbe} strokeWidth={fett ? 2 : 1.2} />
    <text x={x + w / 2} y={y + (s ? 14 : h / 2 + 4)} fontSize="11.5" fontWeight="700" fill={STRONG} textAnchor="middle">{t}</text>
    {s && <text x={x + w / 2} y={y + 27} fontSize="9.5" fill={SUB} textAnchor="middle">{s}</text>}
  </g>
);
const Linie = ({ p, farbe = SUB, w = 2, dash, pfeil }) => (
  <polyline points={p.map((q) => q.join(",")).join(" ")} fill="none" stroke={farbe} strokeWidth={w} strokeDasharray={dash} strokeLinejoin="round" markerEnd={pfeil ? `url(#sb-pfeil-${pfeil})` : undefined} />
);
const T = ({ x, y, t, s = 10.5, f = SUB, a = "middle", b }) => <text x={x} y={y} fontSize={s} fill={f} textAnchor={a} fontWeight={b ? 700 : 400}>{t}</text>;
const Pfeile = ({ farben }) => (
  <defs>{Object.entries(farben).map(([k, c]) => (
    <marker key={k} id={`sb-pfeil-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 1 L10 5 L0 9 z" fill={c} /></marker>
  ))}</defs>
);

function Rahmen({ w, h, titel, children, unter }) {
  return (
    <figure style={{ margin: "14px 0", maxWidth: 900 }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", maxWidth: w, display: "block", background: PANEL, border: `1px solid ${LINE}`, borderRadius: 8, fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
        {titel && <T x={14} y={22} t={titel} s={12.5} f={STRONG} a="start" b />}
        {children}
      </svg>
      {unter && <figcaption style={{ fontSize: 11.5, color: MUTED, marginTop: 5 }}>{unter}</figcaption>}
    </figure>
  );
}

/* VLAN: Access-Ports und Trunk zwischen zwei Switches */
const Vlan = () => (
  <Rahmen w={760} h={250} titel="Access-Ports und Trunk" unter="Endgeräte hängen untagged an Access-Ports. Zwischen den Switches trägt der Trunk alle VLANs mit 802.1Q-Tag.">
    <Kasten x={130} y={110} w={150} h={40} t="Switch FOH" s="managed" fett />
    <Kasten x={480} y={110} w={150} h={40} t="Switch Bühne" s="managed" fett />
    <Linie p={[[280, 124], [480, 124]]} farbe={BLAU} w={3} />
    <Linie p={[[280, 130], [480, 130]]} farbe={GELB} w={3} />
    <Linie p={[[280, 136], [480, 136]]} farbe={LILA} w={3} />
    <T x={380} y={112} t="Trunk (802.1Q)" s={10.5} f={TEXT} b />
    <T x={380} y={154} t="VLAN 10 · 20 · 30 getaggt" s={10} />
    {[["Pult", BLAU, "VLAN 10", 40], ["Lichtpult", GELB, "VLAN 20", 150], ["Kamera", LILA, "VLAN 30", 260]].map(([n, c, v, x]) => (
      <g key={n}><Kasten x={x} y={190} w={90} t={n} farbe={c} /><Linie p={[[x + 45, 190], [x + 45, 170], [205, 170], [205, 150]]} farbe={c} /><T x={x + 45} y={238} t={`Access ${v}`} s={9.5} /></g>
    ))}
    {[["Stagebox", BLAU, "VLAN 10", 470], ["Node", GELB, "VLAN 20", 580]].map(([n, c, v, x]) => (
      <g key={n}><Kasten x={x} y={190} w={90} t={n} farbe={c} /><Linie p={[[x + 45, 190], [x + 45, 170], [555, 170], [555, 150]]} farbe={c} /><T x={x + 45} y={238} t={`Access ${v}`} s={9.5} /></g>
    ))}
    <T x={14} y={46} t="Das Endgerät sieht kein Tag; der Access-Port des Switches bestimmt sein VLAN." s={10} a="start" />
  </Rahmen>
);

/* IGMP: Fluten ohne Snooping, gezielt mit Snooping */
function IgmpHaelfte({ x0, mit }) {
  const empf = [0, 1, 2, 3].map((i) => ({ x: x0 + 8 + i * 84, an: i === 0 || i === 2 }));
  return (
    <g>
      <Kasten x={x0 + 110} y={50} w={120} t="Sender" s="239.255.0.1" farbe={ACCENT} />
      <Linie p={[[x0 + 170, 84], [x0 + 170, 108]]} farbe={ACCENT} w={2.5} />
      <Kasten x={x0 + 95} y={108} w={150} h={36} t={mit ? "Switch, Snooping an" : "Switch, Snooping aus"} farbe={mit ? OK : ERR} fett />
      {empf.map((e, i) => {
        const fliesst = !mit || e.an;
        return (
          <g key={i}>
            <Linie p={[[x0 + 170, 144], [x0 + 170, 160], [e.x + 39, 160], [e.x + 39, 186]]} farbe={fliesst ? ACCENT : LINE} w={fliesst ? 2.5 : 1.2} dash={fliesst ? undefined : "4 3"} />
            <Kasten x={e.x} y={186} w={78} h={34} t="Empfänger" s={e.an ? "Join" : "kein Join"} farbe={e.an ? OK : LINE} />
          </g>
        );
      })}
      <T x={x0 + 170} y={240} t={mit ? "Nur angemeldete Empfänger bekommen den Strom" : "Jeder Port im VLAN bekommt den Strom"} s={10.5} f={mit ? OK : ERR} />
    </g>
  );
}
const Igmp = () => (
  <Rahmen w={760} h={262} titel="Multicast mit und ohne IGMP-Snooping" unter="Ohne Snooping wird Multicast wie Broadcast verteilt. Mit Snooping und Querier geht jede Gruppe nur dorthin, wo jemand per IGMP-Join angemeldet ist.">
    <IgmpHaelfte x0={20} mit={false} />
    <line x1="380" y1="40" x2="380" y2="245" stroke={LINE} strokeDasharray="4 4" />
    <IgmpHaelfte x0={400} mit />
  </Rahmen>
);

/* Dante-Redundanz: zwei getrennte Netze */
const Redundanz = () => {
  const geraete = [["Pult", 50], ["Stagebox A", 230], ["Stagebox B", 410], ["Amp-Rack", 590]];
  return (
    <Rahmen w={760} h={300} titel="Dante Primary und Secondary" unter="Zwei physisch getrennte Netze. Jedes Gerät sendet auf beiden; fällt ein Netz oder Switch aus, läuft der Ton über das andere ohne Aussetzer weiter.">
      <Kasten x={250} y={42} w={260} h={36} t="Switch Primary" s="z. B. 10.10.10.x" farbe={ROT} fett />
      <Kasten x={250} y={238} w={260} h={36} t="Switch Secondary" s="z. B. 10.10.11.x" farbe={GRUEN} fett />
      {geraete.map(([n, x], i) => {
        const xs = 280 + i * 66;
        return (
          <g key={n}>
            <Kasten x={x} y={138} w={120} h={40} t={n} s="Primary · Secondary" />
            <Linie p={[[x + 30, 138], [x + 30, 108], [xs, 108], [xs, 78]]} farbe={ROT} w={2.2} />
            <Linie p={[[x + 90, 178], [x + 90, 208 + (i === 3 ? 10 : 0)], [xs + 20, 208 + (i === 3 ? 10 : 0)], [xs + 20, 238]]} farbe={GRUEN} w={2.2} />
          </g>
        );
      })}
    </Rahmen>
  );
};

/* Spanning Tree: Ring mit blockiertem Port */
const Stp = () => (
  <Rahmen w={760} h={240} titel="Schleife und Spanning Tree" unter="Drei Switches im Ring ergeben eine Schleife. RSTP wählt einen Root-Switch und blockiert einen Port, bis ein anderer Weg ausfällt. Ohne STP kreisen Broadcasts endlos (Broadcast-Sturm).">
    <Kasten x={310} y={44} w={140} h={38} t="Core" s="Root-Bridge" farbe={ACCENT} fett />
    <Kasten x={110} y={168} w={140} h={38} t="Switch FOH" fett />
    <Kasten x={510} y={168} w={140} h={38} t="Switch Bühne" fett />
    <Linie p={[[330, 82], [200, 168]]} farbe={OK} w={3} />
    <Linie p={[[430, 82], [560, 168]]} farbe={OK} w={3} />
    <Linie p={[[250, 187], [380, 187]]} farbe={OK} w={3} />
    <Linie p={[[380, 187], [510, 187]]} farbe={ERR} w={3} dash="7 5" />
    <rect x={494} y={180} width={14} height={14} fill={ERR} />
    <T x={445} y={178} t="blockiert" s={10.5} f={ERR} b />
    <T x={265} y={120} t="Weiterleitung" s={10} f={OK} />
    <T x={495} y={120} t="Weiterleitung" s={10} f={OK} />
    <T x={380} y={226} t="Geräteports als Edge-Port: sofort aktiv, ohne 30 s Wartezeit" s={10} />
  </Rahmen>
);

/* QoS: Warteschlangen mit Strict Priority */
const Qos = () => {
  const q = [["PTP (DSCP 56)", ROT, 1], ["Audio (DSCP 46)", BLAU, 3], ["reserviert (DSCP 8)", MUTED, 0], ["Best Effort (alles andere)", SUB, 6]];
  return (
    <Rahmen w={760} h={250} titel="Warteschlangen am Switch-Port (Strict Priority)" unter="Der Port leert immer zuerst die höchste Queue. Ein großer Datei-Transfer wartet, Takt- und Audiopakete gehen sofort raus.">
      {q.map(([n, c, k], i) => (
        <g key={n}>
          <T x={28} y={66 + i * 42} t={n} s={11} f={TEXT} a="start" />
          <rect x={210} y={50 + i * 42} width={300} height={24} rx="4" fill="none" stroke={LINE} />
          {Array.from({ length: k }, (_, j) => <rect key={j} x={486 - j * 34} y={53 + i * 42} width={28} height={18} rx="3" fill={c} opacity={0.85} />)}
          <Linie p={[[512, 62 + i * 42], [580, 62 + i * 42], [580, 128]]} farbe={c} w={1.5} />
          <T x={200} y={66 + i * 42} t={`Q${4 - i}`} s={10.5} a="end" b />
        </g>
      ))}
      <Kasten x={600} y={110} w={130} h={38} t="Port-Ausgang" s="zuerst Q4" farbe={ACCENT} fett />
      <T x={360} y={228} t="Trust DSCP am Switch einschalten, sonst landet alles in Best Effort" s={10} />
    </Rahmen>
  );
};

/* IPv4-Aufbau: Netz- und Hostanteil bei /24 */
const IpAufbau = () => {
  const okt = [10, 10, 20, 15];
  return (
    <Rahmen w={760} h={210} titel="IPv4-Adresse 10.10.20.15/24" unter="Die Maske /24 (255.255.255.0) teilt die 32 Bit: 24 Bit Netz, 8 Bit Host. Alle Geräte mit 10.10.20.x sind im selben Netz.">
      {okt.map((o, i) => {
        const netz = i < 3;
        return (
          <g key={i}>
            <rect x={40 + i * 175} y={50} width={160} height={44} rx="6" fill={netz ? INFO + "26" : WARN + "26"} stroke={netz ? INFO : WARN} />
            <T x={120 + i * 175} y={79} t={String(o)} s={18} f={STRONG} b />
            <T x={120 + i * 175} y={114} t={o.toString(2).padStart(8, "0")} s={11} f={TEXT} />
            <T x={120 + i * 175} y={132} t={netz ? "Maske 255" : "Maske 0"} s={10} />
          </g>
        );
      })}
      <Linie p={[[40, 150], [550, 150]]} farbe={INFO} w={3} />
      <Linie p={[[565, 150], [725, 150]]} farbe={WARN} w={3} />
      <T x={295} y={170} t="Netzanteil (24 Bit)" s={11} f={INFO} b />
      <T x={645} y={170} t="Hostanteil (8 Bit): .1 bis .254" s={11} f={WARN} b />
    </Rahmen>
  );
};

/* Subnetze: /22 in vier /24 */
const Subnetze = () => (
  <Rahmen w={760} h={170} titel="10.10.0.0/22 in vier /24 aufgeteilt" unter="Ein Bit mehr im Präfix halbiert das Netz. Zwei Bit mehr ergeben vier gleich große Teilnetze.">
    <rect x={40} y={44} width={680} height={30} rx="5" fill={ACCENT + "22"} stroke={ACCENT} />
    <T x={380} y={64} t="10.10.0.0/22 · 1022 Hosts" s={11.5} f={STRONG} b />
    {[BLAU, GELB, LILA, GRUEN].map((c, i) => (
      <g key={i}>
        <rect x={40 + i * 170} y={96} width={166} height={30} rx="5" fill={c + "26"} stroke={c} />
        <T x={123 + i * 170} y={116} t={`10.10.${i}.0/24`} s={11} f={STRONG} b />
        <T x={123 + i * 170} y={142} t="254 Hosts" s={10} />
      </g>
    ))}
  </Rahmen>
);

/* PTP: Leader und Follower */
const Ptp = () => (
  <Rahmen w={760} h={220} titel="PTP: ein Leader, alle anderen folgen" unter="Der Leader (Grandmaster) schickt Sync-Nachrichten, die Follower messen die Laufzeit und stellen ihre Uhr nach. Dante wählt den Leader selbst; bevorzugten Leader im Dante Controller setzen.">
    <Kasten x={300} y={44} w={160} h={40} t="Pult" s="PTP Leader" farbe={ACCENT} fett />
    <Kasten x={300} y={110} w={160} h={30} t="Switch (QoS: PTP zuerst)" />
    <Linie p={[[380, 84], [380, 110]]} farbe={ACCENT} w={2.5} pfeil="a" />
    {[["Stagebox", 60], ["Amp", 250], ["Recording", 440], ["Monitor", 630]].map(([n, x]) => (
      <g key={n}><Kasten x={x - 50} y={170} w={110} h={34} t={n} s="Follower" /><Linie p={[[380, 140], [380, 155], [x + 5, 155], [x + 5, 170]]} farbe={ACCENT} w={1.8} pfeil="a" /></g>
    ))}
  </Rahmen>
);

const BILDER = { vlan: Vlan, igmp: Igmp, redundanz: Redundanz, stp: Stp, qos: Qos, ip: IpAufbau, subnetze: Subnetze, ptp: Ptp };

export default function Schaubild({ id }) {
  const B = BILDER[id];
  if (!B) return null;
  return <><svg width="0" height="0" style={{ position: "absolute" }}><Pfeile farben={{ a: ACCENT }} /></svg><B /></>;
}
