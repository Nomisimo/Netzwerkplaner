/* ── VLAN in VLAN (QinQ, IEEE 802.1ad) ─────────────────────────────────────
   Ein VLAN kann in einem äußeren VLAN (S-VLAN, Service-Tag, Ethertype 0x88A8)
   laufen und ist dann ein inneres C-VLAN (Customer-Tag, 0x8100). Innere VLANs
   verschiedener S-VLANs sind auf der Leitung getrennt und dürfen dieselbe
   VLAN-ID tragen. Im Modell: vlan.svlan = id des äußeren VLANs (oder leer). */

export const aeusseresVlan = (v, vlans) => (v?.svlan ? vlans.find((x) => x.id === v.svlan) || null : null);

// Kette von außen nach innen, z. B. [S-VLAN 100, C-VLAN 10]
export const vlanKette = (v, vlans) => {
  const k = [];
  const seen = new Set();
  for (let x = v; x && !seen.has(x.id); x = aeusseresVlan(x, vlans)) { seen.add(x.id); k.unshift(x); }
  return k;
};

// Anzeige mit äußeren Tags: „100 › 10“
export const vlanPfad = (v, vlans) => vlanKette(v, vlans).map((x) => x.vid).join(" › ");

// Ist ein VLAN S-VLAN (äußeres VLAN) für andere?
export const istSvlan = (v, vlans) => vlans.some((x) => x.svlan === v.id);

// Mögliche äußere VLANs für v: nicht v selbst und nichts, was schon in v steckt
export const moeglicheAeussere = (v, vlans) => {
  const innen = new Set([v.id]);
  let neu = true;
  while (neu) { neu = false; for (const x of vlans) if (x.svlan && innen.has(x.svlan) && !innen.has(x.id)) { innen.add(x.id); neu = true; } }
  return vlans.filter((x) => !innen.has(x.id));
};

// VLANs in Baumreihenfolge: äußere nach ID, darunter ihre inneren
export const vlanBaum = (vlans) => {
  const out = [];
  const seen = new Set();
  const kinder = (id) => vlans.filter((x) => (x.svlan || null) === id && vlans.some((p) => p.id === id)).sort((a, b) => a.vid - b.vid);
  const gehe = (v, tiefe) => {
    if (seen.has(v.id)) return;
    seen.add(v.id); out.push({ v, tiefe });
    for (const k of kinder(v.id)) gehe(k, tiefe + 1);
  };
  const wurzeln = vlans.filter((v) => !v.svlan || !vlans.some((p) => p.id === v.svlan)).sort((a, b) => a.vid - b.vid);
  for (const w of wurzeln) gehe(w, 0);
  for (const v of vlans) if (!seen.has(v.id)) out.push({ v, tiefe: 0 }); // Zyklen trotzdem zeigen
  return out;
};

/* Prüfung der VLAN-IDs mit QinQ:
   - gleiche ID in derselben Ebene (gleiches äußeres VLAN oder beide ohne) → Fehler
   - gleiche ID, aber durch verschiedene S-VLANs getrennt → Warnung mit Hinweis auf 802.1ad
   - äußeres VLAN fehlt, zeigt auf sich selbst oder im Kreis → Fehler
   - mehr als zwei Tags (S-VLAN in S-VLAN) → Warnung */
export const qinqIssues = (vlans) => {
  const issues = [];
  const add = (sev, msg, ref) => issues.push({ sev, msg, ...ref });
  const name = (v) => `VLAN ${vlanPfad(v, vlans)} ${v.name}`.trim();
  const ebenenName = (id) => { const s = vlans.find((x) => x.id === id); return s ? `S-VLAN ${s.vid} ${s.name}`.trim() : "ohne äußeres VLAN"; };

  for (const v of vlans) {
    if (!v.svlan) continue;
    if (v.svlan === v.id) { add("error", `VLAN ${v.vid} ${v.name}: ist als sein eigenes äußeres VLAN eingetragen.`, { vlan: v.id }); continue; }
    if (!vlans.some((x) => x.id === v.svlan)) { add("error", `VLAN ${v.vid} ${v.name}: Das äußere VLAN (QinQ) gibt es nicht mehr.`, { vlan: v.id }); continue; }
    const k = vlanKette(v, vlans);
    if (k[0]?.svlan) add("error", `VLAN ${v.vid} ${v.name}: Die QinQ-Verschachtelung bildet einen Kreis.`, { vlan: v.id });
    else if (k.length > 2) add("warn", `${name(v)}: ${k.length} VLAN-Tags übereinander. IEEE 802.1ad sieht zwei Tags vor (S-VLAN außen, C-VLAN innen); mehr unterstützen nur wenige Switches.`, { vlan: v.id });
  }

  const nachId = new Map();
  for (const v of vlans) { const k = +v.vid; if (!nachId.has(k)) nachId.set(k, []); nachId.get(k).push(v); }
  for (const [vid, list] of nachId) {
    if (list.length < 2) continue;
    const ebenen = new Map();
    for (const v of list) { const e = v.svlan || null; if (!ebenen.has(e)) ebenen.set(e, []); ebenen.get(e).push(v); }
    for (const [e, gleich] of ebenen) if (gleich.length > 1)
      add("error", `VLAN-ID ${vid} ist doppelt vergeben (${gleich.map((v) => v.name || "ohne Namen").join(" / ")}) und nicht getrennt (${ebenenName(e)}). Eines davon umnummerieren oder per QinQ in verschiedene S-VLANs legen.`, { vlan: gleich[1].id, vlans: gleich.map((v) => v.id) });
    if (ebenen.size > 1)
      add("warn", `VLAN-ID ${vid} kommt ${list.length}× vor, getrennt per QinQ (IEEE 802.1ad): ${[...ebenen.keys()].map(ebenenName).join(" / ")}. Das funktioniert nur, wenn die beteiligten Switches QinQ beherrschen und die S-VLAN-Ports als 802.1ad-Ports (S-Tag 0x88A8) eingerichtet sind.`, { vlan: list[0].id, vlans: list.map((v) => v.id) });
  }
  return issues;
};

// VLAN per ID finden (z. B. beim Import): gleiche ID ohne äußeres VLAN bevorzugen
export const vlanNachVid = (vlans, vid) => {
  const l = vlans.filter((v) => +v.vid === +vid);
  return l.find((v) => !v.svlan) || l[0] || null;
};
