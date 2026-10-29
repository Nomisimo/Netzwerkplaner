import React, { useState } from "react";
import { S } from "../../shared/constants.js";
import AnleitungTab from "./AnleitungTab.jsx";
import WissenTab from "./WissenTab.jsx";
import { BookOpen, GraduationCap } from "lucide-react";

/* Hilfe: Anleitung zur App und Netzwerk-Wissen (Anforderungen, Schaubilder, Poster) an einem Ort.
   Die Protokoll-Referenz steht in der Bibliothek unter „Protokolle“. */
export const HILFE_KEY = "netzwerkplaner_hilfe";
export default function HilfeTab({ goTab, sub: subVon, setSub: setSubVon }) {
  const [eigen, setEigen] = useState(() => { try { return localStorage.getItem(HILFE_KEY) || "anleitung"; } catch { return "anleitung"; } });
  const sub = subVon || eigen;
  const setSub = (k) => { setEigen(k); setSubVon?.(k); try { localStorage.setItem(HILFE_KEY, k); } catch { /* ohne Speicher */ } };
  return (
    <>
      <div style={S.boxTabs}>
        {[["anleitung", "Anleitung", BookOpen], ["wissen", "Netzwerk-Wissen", GraduationCap]].map(([k, l, Ic]) => (
          <button key={k} style={{ ...S.boxTab, ...(sub === k ? S.boxTabActive : {}) }} onClick={() => setSub(k)}><Ic size={14} />{l}</button>
        ))}
      </div>
      {sub === "wissen" ? <WissenTab /> : <AnleitungTab goTab={goTab} />}
    </>
  );
}
