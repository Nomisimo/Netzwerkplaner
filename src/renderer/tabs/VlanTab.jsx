import React, { useState, useMemo } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, WARN, OK, INFO, VLAN_FARBEN, STRONG } from "../../shared/constants.js";
import { newVlan, standardVlans } from "../../shared/model.js";
import { newTrunk, vlanZuTrunk, trunkZuVlan, trunkPorts, trunkVlanText } from "../../shared/trunks.js";
import { Section, Field, Toggle, SevBadge } from "../ui.jsx";
import { vlanBaum, vlanPfad, aeusseresVlan, istSvlan, moeglicheAeussere } from "../../shared/qinq.js";
import { ipPorts } from "../../shared/catalog.js";
import { CornerDownRight, TriangleAlert, ChevronUp, ChevronDown, Trash2, Layers } from "lucide-react";
import { uiConfirm } from "../dialoge.jsx";

function VlanRow({ v, P, mutate, issues, count, tiefe = 0, startOffen = false, onNeu }) {
  const [open, setOpen] = useState(startOffen);
  const upd = (fn) => mutate((d) => fn(d.vlans.find((x) => x.id === v.id)));
  const iss = issues.filter((i) => i.vlan === v.id || i.vlans?.includes(v.id));
  const aussen = aeusseresVlan(v, P.vlans);
  const sv = istSvlan(v, P.vlans);
  return (
    <div style={{ ...S.card, borderLeft: `4px solid ${v.farbe}`, marginLeft: tiefe * 28 }}>
      <div style={S.cardHead} onClick={() => setOpen((o) => !o)}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          {tiefe > 0 && <span style={{ color: MUTED, marginLeft: -6, display: "inline-flex" }} title="Inneres VLAN (C-VLAN) im äußeren VLAN darüber"><CornerDownRight size={14} /></span>}
          <span style={{ fontWeight: 800, fontSize: 15, minWidth: 44, textAlign: "center", color: STRONG, background: v.farbe + "33", border: `1px solid ${v.farbe}`, borderRadius: 6, padding: "1px 6px" }} title={aussen ? `VLAN-ID ${v.vid} · Tags: ${vlanPfad(v, P.vlans)} (außen › innen)` : `VLAN-ID ${v.vid}`}>{v.vid}</span>
          <div style={{ minWidth: 0 }}>
            <div style={S.cardTitle}>{v.name || "(ohne Name)"}</div>
            {v.zweck && <div style={S.cardSub}>{v.zweck}</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {sv && <span style={{ ...S.chip, borderColor: ACCENT, color: ACCENT }} title="Äußeres VLAN (Service-Tag, IEEE 802.1ad)">S-VLAN</span>}
          {aussen && <span style={{ ...S.chip, color: SUB }} title="Inneres VLAN (Customer-Tag) im äußeren VLAN">in S-VLAN {aussen.vid}</span>}
          {v.igmp && <span style={S.chip}>IGMP</span>}
          {v.eeeAus && <span style={S.chip}>EEE aus</span>}
          {v.qos && <span style={S.chip}>QoS</span>}
          {v.dhcp?.aktiv && <span style={S.chip}>DHCP</span>}
          <span style={{ ...S.chip, color: SUB }}>{count} IPs</span>
          {(() => {
            // Warndreieck nur, wenn die Prüfung für dieses VLAN etwas meldet; der Grund steht im Tooltip und aufgeklappt unten
            const w = iss.filter((i) => i.sev === "error" || i.sev === "warn");
            if (!w.length) return null;
            const err = w.some((i) => i.sev === "error");
            return <span style={{ color: err ? ERR : WARN, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 3 }} title={w.map((i) => "• " + i.msg).join("\n")}><TriangleAlert size={13} /> {w.length}</span>;
          })()}
          <span style={{ color: MUTED, display: "inline-flex" }}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
        </div>
      </div>
      {open && (
        <div style={S.cardBody}>
          <div style={{ marginBottom: 10 }}>
            <Toggle checked={false} label="Ist ein Trunk" title="Macht aus diesem Eintrag einen Trunk: ein Bündel mehrerer VLANs (tagged), das an Switch-Ports gewählt wird. Ports mit diesem VLAN werden Trunk-Ports."
              onChange={async (c) => {
                if (!c) return;
                const genutzt = P.geraete.some((g) => g.ports.some((p) => p.vlan === v.id || (p.vlans || []).includes(v.id)));
                if (genutzt && !await uiConfirm(`VLAN ${v.vid} ist an Ports eingetragen. Als Trunk werden diese Ports Trunk-Ports mit „${v.name || v.vid}“, aus anderen Trunks fällt VLAN ${v.vid} heraus. Fortfahren?`)) return;
                onNeu?.(v.id); // gleiche ID: der Trunk geht aufgeklappt auf
                mutate((d) => { vlanZuTrunk(d, v.id); });
              }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
            <Field label="VLAN-ID"><input type="number" min="1" max="4094" style={S.inputSm} value={v.vid} onChange={(e) => upd((x) => (x.vid = +e.target.value))} /></Field>
            <Field label="Name"><input style={S.inputSm} value={v.name} onChange={(e) => upd((x) => (x.name = e.target.value))} /></Field>
            <Field label="Farbe"><input type="color" style={{ ...S.inputSm, padding: 2, height: 31 }} value={v.farbe} onChange={(e) => upd((x) => (x.farbe = e.target.value))} /></Field>
          </div>
          <Field label="Äußeres VLAN (QinQ, IEEE 802.1ad)" style={{ marginTop: 10 }}>
            <select style={S.selectSm} value={v.svlan || ""} onChange={(e) => upd((x) => (x.svlan = e.target.value || null))}>
              <option value="">– keins, normales VLAN –</option>
              {moeglicheAeussere(v, P.vlans).sort((a, b) => a.vid - b.vid).map((o) => <option key={o.id} value={o.id}>{vlanPfad(o, P.vlans)} · {o.name}</option>)}
            </select>
            <div style={{ ...S.hint, marginTop: 4 }}>Läuft dieses VLAN als inneres C-VLAN in einem S-VLAN, darf seine ID auch in anderen S-VLANs vorkommen. Die Switches müssen dafür QinQ können.</div>
          </Field>
          <Field label="Zweck / Protokolle" style={{ marginTop: 10 }}><input style={S.inputSm} value={v.zweck} onChange={(e) => upd((x) => (x.zweck = e.target.value))} /></Field>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
            <Toggle checked={v.igmp} onChange={(b) => upd((x) => (x.igmp = b))} label="IGMP-Snooping" />
            <Toggle checked={!v.eeeAus} onChange={(b) => upd((x) => (x.eeeAus = !b))} label="EEE (802.3az) an" title="Energy Efficient Ethernet. Haken gesetzt = EEE an, Haken raus = EEE aus (für Dante, AES67 und MA-Net3 empfohlen)" />
            <Toggle checked={v.qos} onChange={(b) => upd((x) => (x.qos = b))} label="QoS / DSCP aktiv" />
            <Toggle checked={v.dhcp?.aktiv} onChange={(b) => upd((x) => (x.dhcp = { ...x.dhcp, aktiv: b }))} label="DHCP" />
          </div>
          <Field label="Notiz" style={{ marginTop: 10 }}><input style={S.inputSm} value={v.notiz} onChange={(e) => upd((x) => (x.notiz = e.target.value))} /></Field>
          {iss.map((i, n) => <div key={n} style={{ fontSize: 11, marginTop: 6, display: "flex", gap: 6 }}><SevBadge sev={i.sev} /><span>{i.msg}</span></div>)}
          <button style={{ ...S.dangerBtnWide, marginTop: 12, display: "inline-flex", alignItems: "center", gap: 4 }} onClick={async () => {
            if (!await uiConfirm(`VLAN ${v.vid} löschen? Ports verlieren die Zuordnung.`)) return;
            mutate((d) => {
              d.vlans = d.vlans.filter((x) => x.id !== v.id);
              d.vlans.forEach((x) => { if (x.svlan === v.id) x.svlan = null; });
              for (const g of d.geraete) {
                g.ports.forEach((p) => { if (p.vlan === v.id) p.vlan = null; p.vlans = (p.vlans || []).filter((x) => x !== v.id); });
              }
            });
          }}><Trash2 size={14} /> VLAN löschen</button>
        </div>
      )}
    </div>
  );
}

/* Trunk: Bündel mehrerer VLANs, wird an Switch-Ports gewählt */
function TrunkRow({ t, P, mutate, startOffen = false, onNeu }) {
  const [open, setOpen] = useState(startOffen);
  const upd = (fn) => mutate((d) => fn(d.trunks.find((x) => x.id === t.id)));
  const ports = trunkPorts(P, t.id);
  const drin = new Set(t.vlans || []);
  const vlans = [...P.vlans].sort((a, b) => a.vid - b.vid);
  return (
    <div style={{ ...S.card, borderLeft: `4px solid ${t.farbe}`, backgroundImage: `repeating-linear-gradient(135deg, ${t.farbe}14 0 6px, transparent 6px 12px)` }}>
      <div style={S.cardHead} onClick={() => setOpen((o) => !o)}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 800, fontSize: 12, minWidth: 44, textAlign: "center", color: STRONG, background: t.farbe + "33", border: `1px solid ${t.farbe}`, borderRadius: 6, padding: "3px 6px", display: "inline-flex", alignItems: "center", gap: 4 }} title="Trunk: mehrere VLANs tagged"><Layers size={12} />Trunk</span>
          <div style={{ minWidth: 0 }}>
            <div style={S.cardTitle}>{t.name || "(ohne Name)"}</div>
            <div style={S.cardSub}>VLANs {trunkVlanText(t, P.vlans)}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {vlans.filter((v) => drin.has(v.id)).slice(0, 8).map((v) => <span key={v.id} style={{ ...S.chip, padding: "0 6px", borderColor: v.farbe }}><span style={{ width: 7, height: 7, borderRadius: 4, background: v.farbe, display: "inline-block" }} /> {v.vid}</span>)}
          <span style={{ ...S.chip, color: SUB }}>{ports.length} Ports</span>
          {!drin.size && <span style={{ color: WARN, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }} title="Der Trunk transportiert noch keine VLANs"><TriangleAlert size={13} /></span>}
          <span style={{ color: MUTED, display: "inline-flex" }}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
        </div>
      </div>
      {open && (
        <div style={S.cardBody}>
          <div style={{ marginBottom: 10 }}>
            <Toggle checked label="Ist ein Trunk" title="Haken raus: wieder ein normales VLAN mit der nächsten freien VLAN-ID. Ports mit diesem Trunk behalten ihre VLAN-Liste."
              onChange={(c) => { if (!c) { onNeu?.(t.id); mutate((d) => { trunkZuVlan(d, t.id, newVlan); }); } }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
            <Field label="Name"><input style={S.inputSm} value={t.name} placeholder="z. B. Uplink Ton+Licht" onChange={(e) => upd((x) => (x.name = e.target.value))} /></Field>
            <Field label="Farbe"><input type="color" style={{ ...S.inputSm, padding: 2, height: 31 }} value={t.farbe} onChange={(e) => upd((x) => (x.farbe = e.target.value))} /></Field>
          </div>
          <Field label="Transportierte VLANs (tagged)" style={{ marginTop: 10 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <button style={S.smallBtn} onClick={() => upd((x) => (x.vlans = P.vlans.map((v) => v.id)))}>alle</button>
              <button style={S.smallBtn} onClick={() => upd((x) => (x.vlans = []))}>keine</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 4 }}>
              {vlans.map((v) => (
                <Toggle key={v.id} checked={drin.has(v.id)} label={<><span style={{ width: 8, height: 8, borderRadius: 4, background: v.farbe, display: "inline-block" }} /> {vlanPfad(v, P.vlans)} {v.name}</>}
                  onChange={(c) => upd((x) => { const s = new Set(x.vlans || []); if (c) s.add(v.id); else s.delete(v.id); x.vlans = P.vlans.map((y) => y.id).filter((id) => s.has(id)); })} />
              ))}
              {!vlans.length && <span style={{ fontSize: 12, color: MUTED }}>Noch keine VLANs angelegt.</span>}
            </div>
          </Field>
          <Field label="Notiz" style={{ marginTop: 10 }}><input style={S.inputSm} value={t.notiz || ""} onChange={(e) => upd((x) => (x.notiz = e.target.value))} /></Field>
          <div style={{ ...S.hint, marginTop: 8 }}>
            {ports.length ? <>Genutzt an: {ports.map(({ dev, port }) => `${dev.name} · ${port.name}`).join(", ")}</> : "Noch an keinem Port. Im Switch-Editor beim Port unter VLAN den Trunk wählen oder die Trunk-Kachel anklicken und in der Topologie Ports anklicken."}
            {" "}Änderungen an den VLANs gelten sofort für alle Ports mit diesem Trunk. Gerätevorlagen und Bestand speichern den Trunk mit Namen und VLAN-IDs.
          </div>
          <button style={{ ...S.dangerBtnWide, marginTop: 12, display: "inline-flex", alignItems: "center", gap: 4 }} onClick={async () => {
            if (!await uiConfirm(`Trunk „${t.name}“ löschen? Ports behalten ihre VLAN-Liste als eigene Auswahl.`)) return;
            mutate((d) => { d.trunks = d.trunks.filter((x) => x.id !== t.id); });
          }}><Trash2 size={14} /> Trunk löschen</button>
        </div>
      )}
    </div>
  );
}

export default function VlanTab({ P, X, mutate, issues, onSelectDevice }) {
  const counts = useMemo(() => Object.fromEntries(P.vlans.map((v) => [v.id, P.geraete.reduce((s, d) => s + ipPorts(d).filter((i) => i.vlan === v.id && i.ip).length, 0)])), [P]);
  const baum = useMemo(() => vlanBaum(P.vlans), [P.vlans]);
  const [neuId, setNeuId] = useState(null); // neu angelegt: aufgeklappt, damit „Ist ein Trunk“ gleich sichtbar ist
  const trunks = P.trunks || [];
  return (
    <>
      <Section title="VLANs" subtitle={<>ID, Name und Switch-Einstellungen je VLAN. <TriangleAlert size={12} style={{ verticalAlign: "-2px" }} /> erscheint nur, wenn Geräte im VLAN es verlangen: Multicast-Protokolle (sACN, Dante-Multicast, MA-Net3, NDI …) ohne IGMP-Snooping, Audio over IP ohne „EEE aus“, doppelte IDs oder QinQ-Fehler. Ein leeres VLAN hat keine Warnung. Maus auf <TriangleAlert size={12} style={{ verticalAlign: "-2px" }} /> zeigt den Grund.</>}
        right={<div style={{ display: "flex", gap: 6 }}>
          <button style={S.secondaryBtn} title="Trunk: Bündel mehrerer VLANs für Uplinks zwischen Switches" onClick={() => {
            const t = newTrunk({ name: `Trunk ${(P.trunks || []).length + 1}`, vlans: P.vlans.map((v) => v.id) });
            setNeuId(t.id);
            mutate((d) => { (d.trunks ||= []).push(t); });
          }}>+ Trunk</button>
          <button style={S.primaryBtn} onClick={() => {
            const vid = Math.max(0, ...P.vlans.map((v) => +v.vid)) + 1;
            const v = newVlan({ vid, name: `VLAN ${vid}`, farbe: VLAN_FARBEN[P.vlans.length % VLAN_FARBEN.length], subnetz: vid < 256 ? `10.10.${vid}.0/24` : "" });
            setNeuId(v.id);
            mutate((d) => { d.vlans.push(v); });
          }}>+ VLAN</button>
        </div>}>
        {baum.length === 0 && <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <p style={{ ...S.empty, margin: 0 }}>Keine VLANs angelegt.</p>
          <button style={S.smallBtn} title="Audio Primary/Secondary, Licht, Video, Intercom, Steuerung und Management (10, 11, 20, 30, 40, 50, 99)" onClick={() => mutate((d) => { d.vlans.push(...standardVlans()); })}>Standard-VLANs einfügen</button>
        </div>}
        {baum.map(({ v, tiefe }) => <VlanRow key={v.id} v={v} tiefe={tiefe} P={P} mutate={mutate} issues={issues} count={counts[v.id]} startOffen={v.id === neuId} onNeu={setNeuId} />)}
        {trunks.length > 0 && <div className="sp-section-label" style={{ marginTop: 16 }}>Trunks</div>}
        {trunks.map((t) => <TrunkRow key={t.id} t={t} P={P} mutate={mutate} startOffen={t.id === neuId} onNeu={setNeuId} />)}
      </Section>

    </>
  );
}
