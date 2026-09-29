/* ── IPv4-Hilfsfunktionen ──────────────────────────────────────────────── */

export const ip2int = (s) => {
  if (typeof s !== "string") return null;
  const m = s.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const o = m.slice(1).map(Number);
  if (o.some((x) => x > 255)) return null;
  return ((o[0] << 24) >>> 0) + (o[1] << 16) + (o[2] << 8) + o[3];
};

export const int2ip = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");

export const isValidIp = (s) => ip2int(s) !== null;

export const prefixToMask = (p) => (p <= 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);
export const prefixToMaskStr = (p) => int2ip(prefixToMask(p));

export const maskToPrefix = (s) => {
  const n = ip2int(s);
  if (n === null) return null;
  const bits = n.toString(2).padStart(32, "0");
  if (!/^1*0*$/.test(bits)) return null;
  return bits.indexOf("0") === -1 ? 32 : bits.indexOf("0");
};

// Akzeptiert "24", "/24" oder "255.255.255.0"
export const parsePrefix = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim().replace(/^\//, "");
  if (/^\d{1,2}$/.test(s)) { const p = +s; return p >= 0 && p <= 32 ? p : null; }
  return maskToPrefix(s);
};

// "10.10.10.0/24" → { net, prefix, mask, bcast, first, last, size, cidr }
export const parseCidr = (cidr) => {
  if (!cidr || typeof cidr !== "string") return null;
  const [ipS, pS] = cidr.trim().split("/");
  const ip = ip2int(ipS);
  const prefix = parsePrefix(pS);
  if (ip === null || prefix === null) return null;
  const mask = prefixToMask(prefix);
  const net = (ip & mask) >>> 0;
  const bcast = (net | (~mask >>> 0)) >>> 0;
  const size = 2 ** (32 - prefix);
  const first = prefix >= 31 ? net : net + 1;
  const last = prefix >= 31 ? bcast : bcast - 1;
  return { net, prefix, mask, bcast, first, last, size, hosts: Math.max(0, last - first + 1), cidr: `${int2ip(net)}/${prefix}`, exact: net === ip };
};

export const inSubnet = (ip, cidr) => {
  const n = typeof ip === "number" ? ip : ip2int(ip);
  const c = typeof cidr === "string" ? parseCidr(cidr) : cidr;
  if (n === null || !c) return false;
  return ((n & c.mask) >>> 0) === c.net;
};

export const subnetsOverlap = (a, b) => {
  const A = parseCidr(a), B = parseCidr(b);
  if (!A || !B) return false;
  return A.net <= B.bcast && B.net <= A.bcast;
};

// Nächste freie Adresse im Subnetz (ab optionalem Startwert), belegte als Set<int>
export const nextFreeIp = (cidr, usedSet, reserved = []) => {
  const c = parseCidr(cidr);
  if (!c) return null;
  const res = new Set(reserved.map((r) => (typeof r === "number" ? r : ip2int(r))).filter((x) => x !== null));
  for (let n = c.first; n <= c.last; n++) {
    if (!usedSet.has(n) && !res.has(n)) return int2ip(n);
  }
  return null;
};

export const ipSort = (a, b) => (ip2int(a) ?? 0xffffffff + 1) - (ip2int(b) ?? 0xffffffff + 1);

export const isValidMac = (s) => !s || /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(s.trim());

// Link-Local / Default-Bereiche der Recherche, gegen die Überschneidungen gemeldet werden
export const DEFAULT_RANGES = [
  { cidr: "169.254.0.0/16", name: "Link-Local (Dante Primary ohne DHCP)" },
  { cidr: "172.31.0.0/16",  name: "Dante Secondary Default / HogNet (172.31.0.1)" },
  { cidr: "2.0.0.0/8",      name: "Art-Net Primär" },
  { cidr: "10.101.0.0/16",  name: "ETC Eos Default" },
  { cidr: "192.168.10.0/24", name: "Blackmagic ATEM Default (192.168.10.240)" },
];
