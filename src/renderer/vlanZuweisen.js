/* VLAN-Zuweisung per Klick: im Switch-Editor eingeschaltet, in der Topologie
   (Ansicht „Anschlüsse“) setzt ein Klick auf einen Switch-Port das gewählte VLAN. */
import { useSyncExternalStore } from "react";

let stand = null; // { vlan: VLAN-ID, dev: Switch, für den der Modus eingeschaltet wurde }
const hoerer = new Set();
export const setVlanZuweisen = (v) => { stand = v; hoerer.forEach((f) => f()); };
const abo = (f) => { hoerer.add(f); return () => hoerer.delete(f); };
export const useVlanZuweisen = () => useSyncExternalStore(abo, () => stand);
