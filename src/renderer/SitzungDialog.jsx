import React, { useState, useEffect } from "react";
import { S, SUB, MUTED, ACCENT, ERR, WARN } from "../shared/constants.js";
import { Modal, Field } from "./ui.jsx";
import { serverApi, ladeEinstellungen, speichereEinstellungen, beitrittMoeglich } from "./sync.js";
import { Lock, Save, RefreshCw } from "lucide-react";

const zeit = (t) => new Date(t).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const dauer = (t) => { const h = Math.floor((Date.now() - Date.parse(t)) / 3600_000); return h < 1 ? "weniger als 1 Stunde" : h < 48 ? `${h} Stunden` : `${Math.floor(h / 24)} Tagen`; };
const Punkt = ({ farbe }) => <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 5, background: farbe, marginRight: 6 }} />;

// Fenster „Sitzung“: Server wählen, Sitzung anlegen oder beitreten; in der Sitzung Teilnehmer und Verlauf
export default function SitzungDialog({ sitzung, version, onClose, projektName, onKopieSpeichern }) {
  const z = sitzung.zustand;
  return (
    <Modal title="Gemeinsam arbeiten" width={720} onClose={onClose}>
      {z ? <InSitzung sitzung={sitzung} onKopieSpeichern={onKopieSpeichern} /> : <Verbinden sitzung={sitzung} version={version} projektName={projektName} onClose={onClose} />}
    </Modal>
  );
}

function Verbinden({ sitzung, version, projektName, onClose }) {
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
  // Sitzungscode im Fenster abfragen (prompt() gibt es in Electron nicht) und vorab beim Server prüfen
  const [abfrage, setAbfrage] = useState(null); // { s, zweck: "beitreten" | "beenden", code, fehler }
  const mitCode = async (s, zweck, code) => {
    if (s.codeNoetig && code === undefined) return setAbfrage({ s, zweck, code: "", fehler: "" });
    if (s.codeNoetig) {
      try { await serverApi(e.server, e.token).pruefeCode(s.id, code); }
      catch (x) { return setAbfrage({ s, zweck, code, fehler: x.message }); }
    }
    setAbfrage(null);
    return zweck === "beitreten" ? beitreten(s, code || "") : extern(s, code || "");
  };
  const beitreten = (s, code) => {
    const b = beitrittMoeglich(s, version);
    if (!b.ok) return;
    if (b.umstellen && !confirm(b.grund + " Weiter?")) return;
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
  // Seit 72 h leere Sitzung von außen beenden, ohne beizutreten (mit Sitzungscode, falls gesetzt)
  const extern = async (s, code) => {
    if (!confirm(`Sitzung „${s.name}“ endgültig beenden? Sie ist seit ${dauer(s.leerSeit)} ohne Teilnehmer. Der Stand auf dem Server wird gelöscht; wer eine Kopie gespeichert hat, behält sie.`)) return;
    setFehler("");
    try { await serverApi(e.server, e.token).loeschen(s.id, code); await laden(); }
    catch (x) { setFehler(`Sitzung konnte nicht beendet werden: ${x.message}`); }
  };
  useEffect(() => { if (e.server) laden(); }, []);

  return (
    <div>
      <p style={{ marginTop: 0, fontSize: 13, color: SUB }}>Mehrere Personen bearbeiten denselben Plan gleichzeitig über den Planer-Server (Docker). Änderungen erscheinen sofort bei allen.</p>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
        <Field label="Server (IP, IP:Port oder Adresse wie https://planer.example.de)"><input style={S.inputSm} value={e.server} onChange={(x) => set("server", x.target.value)} placeholder="192.168.1.10 oder http://planer.example.de" spellCheck={false} /></Field>
        <Field label="Server-Token (optional)"><input style={S.inputSm} type="password" value={e.token} onChange={(x) => set("token", x.target.value)} /></Field>
        <Field label="Dein Name"><input style={S.inputSm} value={e.name} onChange={(x) => set("name", x.target.value)} placeholder="z. B. Momo" /></Field>
      </div>
      <button style={{ ...S.secondaryBtn, marginTop: 10 }} disabled={!e.server.trim()} onClick={laden}>Sitzungen laden</button>
      {fehler && <div style={{ color: ERR, fontSize: 12, marginTop: 8 }}>{fehler}</div>}

      {liste && <>
        <div className="sp-section-label" style={{ marginTop: 16 }}>Laufende Sitzungen</div>
        {!liste.length && <div style={{ fontSize: 12, color: MUTED, fontStyle: "italic" }}>Noch keine Sitzung auf diesem Server.</div>}
        {liste.map((s) => {
          const b = beitrittMoeglich(s, version);
          const andereVersion = s.appVersion && s.appVersion !== (version || "dev");
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #232a33", fontSize: 13 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{s.name}{s.codeNoetig && <span title="Sitzungscode nötig" style={{ marginLeft: 6, display: "inline-flex", verticalAlign: "-2px" }}><Lock size={13} /></span>}</div>
                <div style={{ fontSize: 11, color: MUTED }}>
                  {s.users ? `${s.users} online` : s.leerSeit ? `seit ${dauer(s.leerSeit)} niemand online` : "niemand online"} · <span style={andereVersion ? { color: b.ok ? WARN : ERR } : null}>Version {s.appVersion || "?"}</span> · geändert {zeit(s.geaendert)}
                </div>
                {!b.ok && <div style={{ fontSize: 11, color: ERR, marginTop: 2 }}>{b.grund}</div>}
              </div>
              {abfrage?.s.id === s.id && (
                <form style={{ display: "flex", gap: 6, alignItems: "center" }} onSubmit={(x) => { x.preventDefault(); if (abfrage.code.trim()) mitCode(s, abfrage.zweck, abfrage.code.trim()); }}>
                  <input autoFocus style={{ ...S.inputSm, width: 110 }} placeholder="Sitzungscode" value={abfrage.code} onChange={(x) => setAbfrage({ ...abfrage, code: x.target.value, fehler: "" })} />
                  <button type="submit" style={S.secondaryBtn} disabled={!abfrage.code.trim()}>{abfrage.zweck === "beenden" ? "Beenden" : "Beitreten"}</button>
                  <button type="button" style={S.ghostBtn} onClick={() => setAbfrage(null)}>✕</button>
                  {abfrage.fehler && <span style={{ color: ERR, fontSize: 11 }}>{abfrage.fehler}</span>}
                </form>
              )}
              {abfrage?.s.id !== s.id && <>
                {s.beendbar && <button style={S.dangerBtnWide} onClick={() => mitCode(s, "beenden")} title="Seit über 72 Stunden ohne Teilnehmer: von außen beenden, ohne beizutreten">Beenden</button>}
                <button style={{ ...S.primaryBtn, ...(!ok || !b.ok ? { opacity: 0.4, cursor: "not-allowed" } : null) }} disabled={!ok || !b.ok} onClick={() => mitCode(s, "beitreten")} title={!b.ok ? b.grund : ok ? (b.umstellen ? b.grund : "") : "Server und Name eintragen"}>Beitreten</button>
              </>}
            </div>
          );
        })}
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
  const [gehen, setGehen] = useState(false); // Auswahl: nur verlassen oder für alle beenden
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
        <button style={S.secondaryBtn} onClick={onKopieSpeichern}><Save size={14} /> Kopie speichern</button>
        <button style={S.dangerBtnWide} onClick={() => (z.veraltet ? sitzung.verlassen() : setGehen((x) => !x))}>Verlassen</button>
      </div>
      {gehen && !z.veraltet && (() => {
        const andere = (z.users || []).filter((u) => u.id !== z.you?.id).length;
        return (
          <div style={{ border: "1px solid #3a4350", borderRadius: 6, padding: "10px 12px", marginBottom: 12, fontSize: 13 }}>
            <div style={{ marginBottom: 8 }}>Dein aktueller Stand bleibt in jedem Fall als lokales Projekt erhalten.</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={S.secondaryBtn} onClick={() => sitzung.verlassen()}>Nur ich verlasse die Sitzung</button>
              <button style={S.dangerBtnWide} disabled={z.status !== "online"} title={z.status !== "online" ? "Nur mit Verbindung zum Server möglich" : ""}
                onClick={async () => { if (andere && !confirm(`${andere === 1 ? "1 Person ist" : `${andere} Personen sind`} noch in der Sitzung. Sie bekommen den Hinweis, dass die Sitzung beendet ist, und behalten eine veraltete Kopie. Wirklich für alle beenden?`)) return; try { await sitzung.beenden(); } catch (x) { alert(`Beenden fehlgeschlagen: ${x.message}`); } }}>
                Sitzung für alle beenden{andere ? ` (${andere} weitere online)` : ""}</button>
              <button style={S.ghostBtn} onClick={() => setGehen(false)}>Abbrechen</button>
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>Beenden löscht die Sitzung auf dem Server. Wer nur verlässt, kann später wieder beitreten.</div>
          </div>
        );
      })()}
      {z.veraltet && <div style={{ background: "#3a2a1a", border: `1px solid ${WARN}`, borderRadius: 6, padding: "8px 10px", fontSize: 12, marginBottom: 10 }}>Die Sitzung ist beendet. Dein Stand ist eine veraltete Kopie: Änderungen anderer fehlen ab jetzt. Bitte speichern.</div>}

      <div className="sp-section-label">Online</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13 }}>
        {(z.users || []).map((u) => <span key={u.id}><Punkt farbe={u.farbe} />{u.name}{u.id === z.you?.id ? " (du)" : ""}</span>)}
      </div>
      {!!z.sperren?.length && <div style={{ fontSize: 12, color: SUB, marginTop: 6 }}>{z.sperren.map((s) => `${s.name} bearbeitet gerade ${s.key.split("/").slice(-1)[0]}`).join(" · ")}</div>}

      <div style={{ display: "flex", alignItems: "center", marginTop: 16 }}>
        <div className="sp-section-label" style={{ flex: 1, margin: 0 }}>Verlauf aller Teilnehmer</div>
        {!z.veraltet && <button style={{ ...S.ghostBtn, padding: "3px 8px", fontSize: 11 }} onClick={ladeVerlauf}><RefreshCw size={12} /></button>}
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
