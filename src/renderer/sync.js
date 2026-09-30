// Anbindung an den Planer-Server (Mehrbenutzerbetrieb). Ohne Sitzung ändert sich nichts.
import { useState, useRef, useCallback, useEffect } from "react";
import { createSyncClient } from "../shared/sync-client.js";
import { pathKey } from "../shared/ops.js";

export const APP_ID = "netzwerkplaner";
const LS = "netzwerkplaner_sitzung"; // { server, token, name }

// Ansichtsdaten bleiben pro Person (eingeklappte Äste, Mindmap/Frontplatte, Einrasten)
const LOKAL = ["collapsed", "ansicht", "einrasten"];
const istLokal = (o) => o.path[0] === "layout" && LOKAL.includes(o.path[1]);
const mitLokalerAnsicht = (doc, lokal) => {
  const layout = { ...doc.layout };
  for (const k of LOKAL) { if (lokal?.layout?.[k] !== undefined) layout[k] = lokal.layout[k]; else delete layout[k]; }
  return { ...doc, layout };
};

export const ladeEinstellungen = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } };
export const speichereEinstellungen = (e) => { try { localStorage.setItem(LS, JSON.stringify(e)); } catch { /* egal */ } };

const httpBasis = (server) => {
  let s = String(server || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(s)) s = `http://${s}`;
  if (!/:\d+$/.test(s.replace(/^https?:\/\//, ""))) s += ":3001";
  return s;
};
const wsUrl = (server) => httpBasis(server).replace(/^http/, "ws") + "/ws";

export const serverApi = (server, token) => {
  const basis = httpBasis(server);
  const req = async (p, init = {}) => {
    const r = await fetch(basis + p, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error === "Unauthorized" ? "Server-Token falsch" : body.error || `HTTP ${r.status}`);
    return body;
  };
  return {
    liste: () => req(`/api/sessions?app=${APP_ID}`),
    erstellen: (b) => req("/api/sessions", { method: "POST", body: JSON.stringify({ app: APP_ID, ...b }) }),
    loeschen: (id, code) => req(`/api/sessions/${id}`, { method: "DELETE", headers: { "X-Session-Code": code || "" } }),
  };
};

const GRUND = { "code-falsch": "Sitzungscode falsch.", gesperrt: "Zu viele Fehlversuche, bitte eine Minute warten.", token: "Server-Token falsch.", version: "Andere App-Version als die Sitzung.", unbekannt: "Sitzung nicht gefunden.", protokoll: "Server und App passen nicht zusammen.", "sitzung-geloescht": "Die Sitzung wurde gelöscht." };

export function useSitzung({ Pref, setP, notify, version }) {
  const client = useRef(null);
  const [zustand, setZustand] = useState(null); // { status, info, users, you, sperren, veraltet, ausstehend }
  const aktiv = !!zustand && !zustand.veraltet;
  const upd = (x) => setZustand((z) => (z ? { ...z, ...x } : z));

  const verbinden = useCallback(({ server, token, session, code, name, info }) => {
    client.current?.close();
    setZustand({ status: "verbinden", info, users: [], you: null, sperren: [], veraltet: false, ausstehend: 0, server, token });
    const c = createSyncClient({
      url: wsUrl(server), app: APP_ID, appVersion: version || "dev", session, code, name, token,
      onDoc: (doc, i) => {
        const next = mitLokalerAnsicht(doc, Pref.current);
        Pref.current = next; setP(next);
        upd({ info: i || info, ausstehend: client.current?.ausstehend ?? 0 });
      },
      onUsers: (users, you) => upd(you ? { users, you } : { users }),
      onSperren: (sperren) => upd({ sperren }),
      onStatus: (status, d) => {
        if (status === "fehler") notify(GRUND[d?.reason] || d?.detail || "Verbindung zum Server fehlgeschlagen.", "err");
        // Sitzung vorbei (Q7): alle behalten ihre Kopie, als veraltet markiert
        if (status === "beendet") { upd({ status, veraltet: true }); notify("Sitzung beendet. Dein Stand ist eine veraltete Kopie, bitte speichern.", "warn"); return; }
        upd({ status, ausstehend: d?.pending ?? client.current?.ausstehend ?? 0 });
      },
      onHinweis: (h) => {
        if (h.art === "ueberschrieben") notify(`${h.konflikte[0].von} hat dasselbe Feld gerade geändert. Dein Wert gilt jetzt.`, "warn");
        else if (h.art === "verworfen") notify("Deine Änderung betraf etwas, das inzwischen gelöscht wurde, und wurde verworfen.", "warn");
        else if (h.art === "gesperrt") notify(`${h.von} bearbeitet dieses Feld gerade.`, "warn");
        else if (h.art === "abgelehnt") notify(h.reason === "invariante" ? "Änderung abgelehnt: Sie passt nicht mehr zum aktuellen Stand (z. B. Port inzwischen belegt)." : `Änderung abgelehnt: ${typeof h.detail === "string" ? h.detail : h.reason}`, "err");
      },
    });
    client.current = c;
  }, [version]);

  const erstellen = useCallback(async ({ server, token, name, sitzungsName, code }) => {
    const doc = Pref.current;
    const info = await serverApi(server, token).erstellen({ name: sitzungsName, code: code || undefined, appVersion: version || "dev", doc });
    verbinden({ server, token, session: info.id, code, name, info });
    return info;
  }, [verbinden, version]);

  const verlassen = useCallback(() => {
    client.current?.close();
    client.current = null;
    setZustand(null);
  }, []);
  useEffect(() => () => client.current?.close(), []);

  // Aus mutate()/undo(): Operationen an den Server. Beim Tippen in einem Feld wird es gesperrt (Q5).
  const senden = useCallback((alleOps) => {
    const c = client.current;
    if (!c || zustandRef.current?.veraltet) return;
    const ops = alleOps.filter((o) => !istLokal(o));
    if (!ops.length) return;
    c.submit(ops);
    const el = document.activeElement;
    if (el && /INPUT|TEXTAREA/.test(el.tagName) && ops.every((o) => o.op === "set") && new Set(ops.map((o) => pathKey(o.path))).size === 1) {
      if (tippPfad.current !== pathKey(ops[0].path)) { tippPfad.current = pathKey(ops[0].path); c.sperre(ops[0].path); }
    }
  }, []);
  const tippPfad = useRef(null);
  const zustandRef = useRef(zustand);
  zustandRef.current = zustand;
  useEffect(() => {
    const blur = () => { if (tippPfad.current) { tippPfad.current = null; client.current?.freigabe(); } };
    document.addEventListener("focusout", blur);
    return () => document.removeEventListener("focusout", blur);
  }, []);

  const intent = useCallback((name, args) => client.current.intent(name, args), []);
  const verlauf = useCallback((o) => client.current?.verlauf(o) || Promise.resolve([]), []);
  const presence = useCallback((d) => client.current?.presence(d), []);

  // Fremde Sperre auf einem Pfad? (für Hinweise im Editor)
  const sperreVon = useCallback((path) => {
    const k = pathKey(path);
    const l = (zustandRef.current?.sperren || []).find((s) => s.user !== zustandRef.current?.you?.id && (s.key === k || s.key.startsWith(k + "/")));
    return l?.name || null;
  }, []);

  return { zustand, aktiv, verbinden, erstellen, verlassen, senden, intent, verlauf, presence, sperreVon };
}
