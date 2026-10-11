/* Suche in Listen (Katalog, Bestand, Vorlagen, Geräte, Auswahlfelder).
   Groß-/Kleinschreibung egal. Leerzeichen trennen Suchbegriffe, die alle vorkommen müssen.
   „*“ steht für beliebig viele Zeichen: „Cisco*1300*24“ findet „Cisco Catalyst 1300 C1300-24FP-4G“. */
const cache = new Map();
export const suchMuster = (q) => {
  const key = (q || "").trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const teile = key.split(/\s+/).filter((t) => t && t !== "*").map((t) =>
    t.includes("*") ? new RegExp(t.split("*").map((x) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")) : t);
  if (cache.size > 200) cache.clear();
  cache.set(key, teile);
  return teile;
};
export const passtSuche = (text, q) => {
  const teile = suchMuster(q);
  if (!teile.length) return true;
  const t = (text || "").toLowerCase();
  return teile.every((m) => (typeof m === "string" ? t.includes(m) : m.test(t)));
};
