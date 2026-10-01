// Anbindung an den Planer-Server (Mehrbenutzerbetrieb). Ohne Sitzung ändert sich nichts.
import { useState, useRef, useCallback, useEffect } from "react";
import { createSyncClient, vergleicheVersion } from "../shared/sync-client.js";
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

// Leitet der Server (Reverse-Proxy) http:// auf https:// um, merken wir uns das für den WebSocket
const umleitung = new Map();
const httpBasis = (server) => {
  const b = roheBasis(server);
  return umleitung.get(b) || b;
};
const roheBasis = (server) => {
  // „192.168.1.10“ → http://192.168.1.10:3001; mit http(s):// davor gilt die Adresse wie eingegeben
  // (z. B. hinter einem Reverse-Proxy: http://planer.example.de → Port 80, https → wss)
  let s = String(server || "").trim().replace(/\/+$/, "");
  if (/^https?:\/\//.test(s)) return s;
  s = `http://${s}`;
  if (!/:\d+$/.test(s.slice(7))) s += ":3001";
  return s;
};
const wsUrl = (server) => httpBasis(server).replace(/^http/, "ws") + "/ws";

// Mögliche Adressen: wie eingegeben; ein reiner Hostname ohne Port kann auch hinter einem Reverse-Proxy stehen
const kandidaten = (server) => {
  const roh = String(server || "").trim().replace(/\/+$/, "");
  const b = [httpBasis(server)];
  if (!/^https?:\/\//.test(roh) && !/:\d+$/.test(roh)) b.push(`https://${roh}`, `http://${roh}`);
  return [...new Set(b)];
};

// Eine HTTP-Anfrage; in der App über den Hauptprozess (kein CORS, folgt Umleitungen, echte Fehlermeldung)
const hole = async (basis, p, init, headers) => {
  if (window.electronAPI?.serverFetch) {
    const r = await window.electronAPI.serverFetch({ url: basis + p, method: init.method || "GET", headers, body: init.body });
    if (r.fehler) throw new Error(r.fehler);
    return r;
  }
  const x = await fetch(basis + p, { ...init, headers });
  return { ok: x.ok, status: x.status, url: x.url, text: await x.text() };
};

export const serverApi = (server, token) => {
  const req = async (p, init = {}) => {
    const headers = { ...(init.body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) };
    let r, basis, fehler;
    for (const k of kandidaten(server)) {
      try { r = await hole(k, p, init, headers); basis = k; break; } catch (e) { fehler ??= e; }
    }
    if (!r) throw new Error(`${fehler?.message || "keine Antwort"} (${httpBasis(server)})`);
    // Tatsächliche Adresse merken (anderer Kandidat oder Umleitung http → https), gilt dann auch für den WebSocket
    const ziel = r.url && r.url.endsWith(p) ? r.url.slice(0, -p.length) : basis;
    if (ziel !== roheBasis(server)) umleitung.set(roheBasis(server), ziel);
    let body = {};
    try { body = JSON.parse(r.text); } catch { if (r.ok) throw new Error(`Unter ${ziel} antwortet kein Planer-Server`); }
    if (!r.ok) throw new Error(body.error === "Unauthorized" ? "Server-Token falsch" : GRUND[body.error] || body.error || `HTTP ${r.status} von ${ziel}`);
    return body;
  };
  return {
    liste: () => req(`/api/sessions?app=${APP_ID}`),
    erstellen: (b) => req("/api/sessions", { method: "POST", body: JSON.stringify({ app: APP_ID, ...b }) }),
    pruefeCode: (id, code) => req(`/api/sessions/${id}/verlauf?limit=1`, { headers: { "X-Session-Code": code || "" } }),
    loeschen: (id, code) => req(`/api/sessions/${id}`, { method: "DELETE", headers: { "X-Session-Code": code || "" } }),
  };
};

// Darf diese App-Version der Sitzung beitreten? Gleiche Version immer; eine neuere App übernimmt
// eine leere Sitzung (der Server stellt sie um), eine ältere nie.
export const beitrittMoeglich = (s, version) => {
  const v = version || "dev";
  if (!s.appVersion || s.appVersion === v) return { ok: true };
  if (vergleicheVersion(v, s.appVersion) < 0) return { ok: false, grund: `Die Sitzung läuft mit Version ${s.appVersion}, deine App ist älter (${v}). Bitte zuerst aktualisieren.` };
  if (s.users) return { ok: false, grund: `Die Sitzung läuft mit Version ${s.appVersion} und hat gerade Teilnehmer. Alle brauchen dieselbe Version.` };
  return { ok: true, umstellen: true, grund: `Die Sitzung läuft noch mit Version ${s.appVersion}. Beim Beitreten wird sie auf deine Version ${v} umgestellt; ältere Apps können danach nicht mehr beitreten.` };
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
        if (status === "fehler") { if (d?.reason !== "sitzung-geloescht") notify((d?.reason === "version" && d?.detail) || GRUND[d?.reason] || d?.detail || "Verbindung zum Server fehlgeschlagen.", "err"); return; }
        if (status === "beendet") {
          // Beitritt gescheitert: nichts wurde ersetzt, also auch keine veraltete Kopie
          if (!d?.warVerbunden) { setZustand(null); client.current = null; return; }
          // Sitzung vorbei (Q7): alle behalten ihre Kopie, als veraltet markiert
          upd({ status, veraltet: true });
          const von = d?.detail?.von;
          notify(`${von ? `${von} hat die Sitzung beendet.` : "Sitzung beendet."} Dein Stand ist eine veraltete Kopie, bitte speichern.`, "warn");
          return;
        }
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
  // Sitzung für alle beenden (Q7): die anderen behalten eine veraltete Kopie, du deinen Stand als lokales Projekt
  const beenden = useCallback(async () => {
    const c = client.current;
    if (!c) return;
    await c.beenden();
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

  return { zustand, aktiv, verbinden, erstellen, verlassen, beenden, senden, intent, verlauf, presence, sperreVon };
}
