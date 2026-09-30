import React, { useState, useEffect } from "react";
import { S, SUB, MUTED, ACCENT, ERR, WARN } from "../shared/constants.js";
import { Modal, Field } from "./ui.jsx";
import { serverApi, ladeEinstellungen, speichereEinstellungen } from "./sync.js";

const zeit = (t) => new Date(t).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const Punkt = ({ farbe }) => <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 5, background: farbe, marginRight: 6 }} />;

// Fenster „Sitzung“: Server wählen, Sitzung anlegen oder beitreten; in der Sitzung Teilnehmer und Verlauf
export default function SitzungDialog({ sitzung, onClose, projektName, onKopieSpeichern }) {
  const z = sitzung.zustand;
  return (
    <Modal title="Gemeinsam arbeiten" width={720} onClose={onClose}>
      {z ? <InSitzung sitzung={sitzung} onKopieSpeichern={onKopieSpeichern} /> : <Verbinden sitzung={sitzung} projektName={projektName} onClose={onClose} />}
    </Modal>
  );
}

function Verbinden({ sitzung, projektName, onClose }) {
  const [e, setE] = useState(() => ({ server: "", token: "", name: "", ...ladeEinstellungen() }));
  const [liste, setListe] = useState(null);
  const [fehler, setFehler] = useState("");
  const [neu, setNeu] = useState({ name: projektName || "", code: "" });
  const set = (k, v) => setE((x) => ({ ...x, [k]: v }));
  const ok = e.server.trim() && e.name.trim();
  const merken = () => speichereEinstellungen(e);

  const laden = async () => {
    setFehler(""); merken();
    try { setListe(await serverApi(e.server, e.token).liste()); } catch (x) { setListe(null); setFehler(`Server nicht erreichbar: ${x.message}`); }
  };
  const beitreten = (s) => {
    const code = s.codeNoetig ? prompt(`Sitzungscode für „${s.name}“:`) : "";
    if (s.codeNoetig && !code) return;
    if (!confirm("Beim Beitreten wird dein aktuelles Projekt durch den Stand der Sitzung ersetzt. Vorher speichern, falls nötig. Weiter?")) return;
    merken();
    sitzung.verbinden({ server: e.server, token: e.token, session: s.id, code, name: e.name.trim(), info: s });
    onClose();
  };
  const anlegen = async () => {
    setFehler(""); merken();
    try { await sitzung.erstellen({ server: e.server, token: e.token, name: e.name.trim(), sitzungsName: neu.name || "Sitzung", code: neu.code.trim() }); onClose(); }
    catch (x) { setFehler(`Sitzung konnte nicht angelegt werden: ${x.message}`); }
  };
  useEffect(() => { if (e.server) laden(); }, []);

  return (
    <div>
      <p style={{ marginTop: 0, fontSize: 13, color: SUB }}>Mehrere Personen bearbeiten denselben Plan gleichzeitig über den Planer-Server (Docker). Änderungen erscheinen sofort bei allen.</p>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
        <Field label="Server (IP oder Adresse; ohne http:// gilt Port 3001)"><input style={S.inputSm} value={e.server} onChange={(x) => set("server", x.target.value)} placeholder="192.168.1.10 oder http://planer.example.de" spellCheck={false} /></Field>
        <Field label="Server-Token (optional)"><input style={S.inputSm} type="password" value={e.token} onChange={(x) => set("token", x.target.value)} /></Field>
        <Field label="Dein Name"><input style={S.inputSm} value={e.name} onChange={(x) => set("name", x.target.value)} placeholder="z. B. Momo" /></Field>
      </div>
      <button style={{ ...S.secondaryBtn, marginTop: 10 }} disabled={!e.server.trim()} onClick={laden}>Sitzungen laden</button>
      {fehler && <div style={{ color: ERR, fontSize: 12, marginTop: 8 }}>{fehler}</div>}

      {liste && <>
        <div className="sp-section-label" style={{ marginTop: 16 }}>Laufende Sitzungen</div>
        {!liste.length && <div style={{ fontSize: 12, color: MUTED, fontStyle: "italic" }}>Noch keine Sitzung auf diesem Server.</div>}
        {liste.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #232a33", fontSize: 13 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{s.name}{s.codeNoetig && <span title="Sitzungscode nötig" style={{ marginLeft: 6 }}>🔒</span>}</div>
              <div style={{ fontSize: 11, color: MUTED }}>{s.users} online · Version {s.appVersion || "?"} · geändert {zeit(s.geaendert)}</div>
            </div>
            <button style={S.primaryBtn} disabled={!ok} onClick={() => beitreten(s)} title={ok ? "" : "Server und Name eintragen"}>Beitreten</button>
          </div>
        ))}
        <div className="sp-section-label" style={{ marginTop: 16 }}>Neue Sitzung mit dem aktuellen Projekt</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 10, alignItems: "end" }}>
          <Field label="Name der Sitzung"><input style={S.inputSm} value={neu.name} onChange={(x) => setNeu((n) => ({ ...n, name: x.target.value }))} /></Field>
          <Field label="Sitzungscode (optional)"><input style={S.inputSm} value={neu.code} onChange={(x) => setNeu((n) => ({ ...n, code: x.target.value }))} placeholder="z. B. 4711" /></Field>
          <button style={S.primaryBtn} disabled={!ok} onClick={anlegen}>Sitzung starten</button>
        </div>
      </>}
    </div>
  );
}

function InSitzung({ sitzung, onKopieSpeichern }) {
  const z = sitzung.zustand;
  const [verlauf, setVerlauf] = useState(null);
  const ladeVerlauf = async () => { try { setVerlauf(await sitzung.verlauf({ limit: 200 })); } catch { setVerlauf([]); } };
  useEffect(() => { if (!z.veraltet) ladeVerlauf(); }, []);
  const statusText = { online: "verbunden", verbinden: "verbindet …", "neu-verbinden": "verbindet neu …", offline: "offline", beendet: "beendet", fehler: "Fehler" }[z.status] || z.status;
  const farbe = z.status === "online" ? "#2ecc71" : z.veraltet || z.status === "fehler" ? ERR : WARN;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{z.info?.name || "Sitzung"}</div>
          <div style={{ fontSize: 12, color: farbe }}>{statusText}{z.ausstehend ? ` · ${z.ausstehend} Änderungen ausstehend` : ""}</div>
        </div>
        <button style={S.secondaryBtn} onClick={onKopieSpeichern}>💾 Kopie speichern</button>
        <button style={S.dangerBtnWide} onClick={() => { if (confirm("Sitzung verlassen? Dein aktueller Stand bleibt als lokale Kopie erhalten.")) sitzung.verlassen(); }}>Verlassen</button>
      </div>
      {z.veraltet && <div style={{ background: "#3a2a1a", border: `1px solid ${WARN}`, borderRadius: 6, padding: "8px 10px", fontSize: 12, marginBottom: 10 }}>Die Sitzung ist beendet. Dein Stand ist eine veraltete Kopie: Änderungen anderer fehlen ab jetzt. Bitte speichern.</div>}

      <div className="sp-section-label">Online</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13 }}>
        {(z.users || []).map((u) => <span key={u.id}><Punkt farbe={u.farbe} />{u.name}{u.id === z.you?.id ? " (du)" : ""}</span>)}
      </div>
      {!!z.sperren?.length && <div style={{ fontSize: 12, color: SUB, marginTop: 6 }}>{z.sperren.map((s) => `${s.name} bearbeitet gerade ${s.key.split("/").slice(-1)[0]}`).join(" · ")}</div>}

      <div style={{ display: "flex", alignItems: "center", marginTop: 16 }}>
        <div className="sp-section-label" style={{ flex: 1, margin: 0 }}>Verlauf aller Teilnehmer</div>
        {!z.veraltet && <button style={{ ...S.ghostBtn, padding: "3px 8px", fontSize: 11 }} onClick={ladeVerlauf}>↻</button>}
      </div>
      <div style={{ maxHeight: 320, overflow: "auto", marginTop: 6, fontSize: 12 }}>
        {verlauf === null ? <div style={{ color: MUTED }}>Lädt …</div> : !verlauf.length ? <div style={{ color: MUTED, fontStyle: "italic" }}>Noch keine Änderungen.</div>
          : verlauf.map((v) => (
            <div key={v.seq} style={{ padding: "5px 0", borderBottom: "1px solid #232a33" }}>
              <div><span style={{ color: MUTED }}>{zeit(v.zeit)}</span> · <b style={{ color: (z.users || []).find((u) => u.id === v.user)?.farbe || ACCENT }}>{v.name}</b>{v.absicht ? <span style={{ color: MUTED }}> · {v.absicht}</span> : null}</div>
              {v.texte.map((t, i) => <div key={i} style={{ color: SUB, paddingLeft: 10 }}>{t}</div>)}
              {v.anzahl > v.texte.length && <div style={{ color: MUTED, paddingLeft: 10 }}>… und {v.anzahl - v.texte.length} weitere</div>}
            </div>
          ))}
      </div>
    </div>
  );
}
