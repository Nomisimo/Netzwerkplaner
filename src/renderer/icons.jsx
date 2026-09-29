import React from "react";
import BUILTIN from "virtual:device-icons";
import { MODELL_ICONS } from "../shared/geraeteicons.js";

export const BUILTIN_ICONS = BUILTIN; // { name: innerSvgMarkup }
export const ICON_NAMES = Object.keys(BUILTIN).sort();

// Für das Auswahlmenü: erst die Typ-Icons, dann die Modell-Icons je Hersteller
export const ICON_LABEL = Object.fromEntries(Object.entries(MODELL_ICONS).map(([k, [, label]]) => [k, label]));
export const ICON_GRUPPEN = [
  { titel: "Gerätetypen", icons: ICON_NAMES.filter((n) => !MODELL_ICONS[n]) },
  ...[...new Set(Object.values(MODELL_ICONS).map(([h]) => h))].map((h) => ({
    titel: h,
    icons: Object.keys(MODELL_ICONS).filter((k) => MODELL_ICONS[k][0] === h && BUILTIN[k]),
  })),
];

const inner = (svg) => svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const INNER = Object.fromEntries(Object.entries(BUILTIN).map(([k, v]) => [k, inner(v)]));

// Icon innerhalb eines SVG (Topologie)
export function SvgIcon({ icon, customIcons = [], x = 0, y = 0, size = 24, color = "#e8eaed" }) {
  if (icon && icon.startsWith("custom:")) {
    const c = customIcons.find((i) => i.id === icon.slice(7));
    if (c) return <image href={c.data} x={x} y={y} width={size} height={size} preserveAspectRatio="xMidYMid meet" />;
  }
  const markup = INNER[icon] || INNER.sonstiges;
  return (
    <g transform={`translate(${x},${y}) scale(${size / 24})`} style={{ color }} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: markup }} />
  );
}

// Icon in normalem HTML (Listen, Tabellen)
export function IconView({ icon, customIcons, size = 22, color = "#e8eaed", style }) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0, display: "block", ...style }}>
      <SvgIcon icon={icon} customIcons={customIcons} size={size} color={color} />
    </svg>
  );
}
