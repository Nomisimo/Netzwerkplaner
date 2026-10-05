// Zustand der Live-Monitore: ein gemeinsamer Speicher, den der Hauptprozess per Ereignis füllt.
// Monitore laufen weiter, wenn man den Tab wechselt; beim Zurückkommen ist der Stand sofort da.
import { useSyncExternalStore, useCallback, useState } from "react";
import { api } from "../api.js";

let state = {};
const listeners = new Set();
let started = false;

const set = (kind, v) => { state = { ...state, [kind]: v }; listeners.forEach((l) => l()); };

function init() {
  if (started) return;
  started = true;
  api.monState().then((s) => { state = { ...s, ...state }; listeners.forEach((l) => l()); });
  // Gestoppte Monitore schicken ihren letzten Stand mit; die Einträge bleiben sichtbar, bis man sie verwirft
  api.onMonEvent((msg) => set(msg.kind, msg));
}

const subscribe = (l) => { init(); listeners.add(l); return () => listeners.delete(l); };

export function useMonitor(kind) {
  const m = useSyncExternalStore(subscribe, () => state[kind]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const start = useCallback(async (opts) => {
    setBusy(true); setError("");
    const r = await api.monStart(kind, opts);
    if (!r?.ok) setError(r?.error || "Start fehlgeschlagen.");
    setBusy(false);
    return r?.ok;
  }, [kind]);
  const stop = useCallback(async () => { await api.monStop(kind); }, [kind]);
  const action = useCallback(async (name, args) => {
    // Gestoppte Monitore zeigen nur ihren letzten Stand; Klicks darin starten nichts neu
    if (!state[kind]?.running && !["scan", "snmp"].includes(kind)) return undefined;
    const r = await api.monAction(kind, name, args);
    if (!r?.ok) setError(r?.error || "Aktion fehlgeschlagen.");
    else setError("");
    return r?.result;
  }, [kind]);
  const verwerfen = useCallback(async () => { set(kind, { running: false }); await api.monAction(kind, "verwerfen"); }, [kind]);
  return { running: !!m?.running, snapshot: m?.snapshot || null, opts: m?.opts || {}, started: m?.started, stopped: m?.stopped, start, stop, action, verwerfen, error, busy };
}

// Wie viele Monitore laufen gerade (für den Punkt am Tab)
export function useRunningCount() {
  return useSyncExternalStore(subscribe, () => Object.values(state).filter((m) => m?.running).length);
}
