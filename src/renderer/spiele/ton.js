// Töne der Spiele: dieselben prozeduralen 8-Bit-Klänge wie in den Python-Originalen
// (Rechteckwellen, Hüllkurven, Mario-Titelmelodie), hier per Web Audio erzeugt.
const RATE = 22050;

const sq = (n, f, duty = 0.5) => Float32Array.from({ length: n }, (_, i) => (((i / RATE) * f) % 1 < duty ? 1 : -1));
const glide = (n, f0, f1) => {
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) { ph += (f0 + ((f1 - f0) * i) / Math.max(1, n - 1)) / RATE; out[i] = Math.sign(Math.sin(2 * Math.PI * ph)); }
  return out;
};
const lin = (n, a, b) => Float32Array.from({ length: n }, (_, i) => (n === 1 ? a : a + ((b - a) * i) / (n - 1)));
function env(n, a = 0.01, d = 0.05, s = 0.7, r = 0.2) {
  const na = Math.max(Math.floor(n * a), 1), nd = Math.max(Math.floor(n * d), 1), nr = Math.max(Math.floor(n * r), 1);
  const ns = Math.max(n - na - nd - nr, 0);
  return cat([lin(na, 0, 1), lin(nd, 1, s), new Float32Array(ns).fill(s), lin(nr, s, 0)]).subarray(0, n);
}
const mul = (a, b) => a.map((v, i) => v * (b[i] ?? 0));
const cat = (parts) => { const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const vol = (a, v) => a.map((x) => Math.max(-1, Math.min(1, x * v)));
const N = (sec) => Math.floor(RATE * sec);

// Python-Pieptöne (Snake, Pong): Rechteck mit exponentiellem Abklingen
const beep = (f, ms, v, decay) => Float32Array.from({ length: N(ms / 1000) }, (_, i) => { const t = i / RATE; return (Math.sin(2 * Math.PI * f * t) >= 0 ? 1 : -1) * Math.exp(-t * decay) * v; });
const chord = (fs, ms, v, decay) => Float32Array.from({ length: N(ms / 1000) }, (_, i) => {
  const t = i / RATE;
  return (fs.reduce((s, f) => s + (Math.sin(2 * Math.PI * f * t) >= 0 ? 1 : -1), 0) / fs.length) * Math.exp(-t * decay) * v;
});

/* ── Mario: SMB-Titelmelodie (Achtelnoten bei 185 BPM, 25 % Pulsbreite) ── */
const NOTE = { G3: 196, E4: 329.63, F4: 349.23, Fs4: 369.99, G4: 392, Ab4: 415.3, A4: 440, Bb4: 466.16, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.26, F5: 698.46, Fs5: 739.99, G5: 784, A5: 880, C6: 1046.5, R: 0 };
const TEIL_A = "C5 2,R 1,G4 2,R 3,E4 2,R 3,A4 2,R 1,B4 2,R 1,Bb4 1,A4 2,G4 1.5,E5 1.5,G5 2,A5 2,R 1,F5 1,G5 2,R 1,E5 2,R 1,C5 2,D5 1,B4 3";
const SMB = [
  "E5 1,R .5,E5 1,R .5,R 1,C5 1,E5 2,R 1,G5 2,R 2,G4 2,R 4",
  TEIL_A, TEIL_A,
  "E4 1,R .5,C5 1,R .5,G3 1.5,R .5,Ab4 1.5,R .5,A4 1,R .5,F4 1,R .5,Fs4 1.5,R .5,G4 1,E5 1,R .5,E5 1,E5 1,C5 1,D5 1.5,R .5",
  "G5 1,Fs5 1,F5 1,D5 1.5,E5 1,R .5,G4 1,A4 1,C5 1,R .5,A4 1,C5 1,D5 2,G5 1,Fs5 1,F5 1,D5 1.5,E5 1,R .5,C6 1,R .5,C6 1,C6 1.5,R 1",
  TEIL_A, TEIL_A.replace(/B4 3$/, "B4 4"),
].join(",").split(",").map((x) => { const [n, b] = x.trim().split(" "); return [n, +b]; });

function smbTheme() {
  const eighth = 60 / (185 * 2), parts = [];
  for (const [note, beats] of SMB) {
    const n = Math.max(Math.floor(beats * eighth * RATE), 1), f = NOTE[note] || 0;
    if (!f) { parts.push(new Float32Array(n)); continue; }
    const w = sq(n, f, 0.25);
    const na = Math.min(Math.max(N(0.006), 1), n >> 2), ng = Math.min(Math.max(N(0.012), 1), n >> 2);
    for (let i = 0; i < na; i++) w[i] *= na === 1 ? 0 : i / (na - 1);
    for (let i = n - ng; i < n; i++) w[i] = 0;
    parts.push(w);
  }
  return vol(cat(parts), 0.16);
}

function marioSounds() {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const n = N(0.08), noise = Float32Array.from({ length: n }, rnd);
  for (let i = 1; i < n; i++) noise[i] = noise[i] * 0.35 + noise[i - 1] * 0.65;
  const arp = (fs, d, e) => cat(fs.map((f) => mul(sq(N(d), f), env(N(d), ...e))));
  return {
    jump: vol(mul(glide(N(0.13), 270, 540), env(N(0.13), 0.01, 0.08, 0.85, 0.08)), 0.27),
    stomp: vol(mul(glide(N(0.09), 380, 80), env(N(0.09), 0.01, 0.05, 0.55, 0.42)), 0.38),
    coin: vol(cat([mul(sq(N(0.045), 659), env(N(0.045), 0.01, 0.02, 0.75, 0.15)), mul(sq(N(0.105), 988), env(N(0.105), 0.01, 0.04, 0.65, 0.28))]), 0.26),
    block: vol(mul(glide(N(0.065), 380, 160), env(N(0.065), 0.01, 0.04, 0.45, 0.52)), 0.32),
    brick: vol(mul(noise, env(n, 0.01, 0.04, 0.25, 0.68)), 0.32),
    powerup: vol(arp([262, 330, 392, 523], 0.068, [0.02, 0.04, 0.72, 0.18]), 0.26),
    "1up": vol(arp([262, 330, 392, 523, 659, 784, 1047], 0.052, [0.02, 0.03, 0.72, 0.18]), 0.24),
    death: vol(cat([
      mul(sq(N(0.12), 494), env(N(0.12), 0.01, 0.05, 0.72, 0.25)),
      mul(sq(N(0.12), 392), env(N(0.12), 0.01, 0.05, 0.62, 0.35)),
      new Float32Array(N(0.04)),
      mul(glide(N(0.32), 380, 55), env(N(0.32), 0.02, 0.08, 0.5, 0.45)),
    ]), 0.29),
    kick: vol(mul(glide(N(0.065), 880, 440), env(N(0.065), 0.01, 0.03, 0.5, 0.52)), 0.24),
    star: vol(arp([523, 659, 784, 1047], 0.042, [0.01, 0.02, 0.8, 0.12]), 0.22),
  };
}

const KLAENGE = {
  snake: () => ({ eat: beep(880, 55, 0.25, 20), die: chord([130, 98], 480, 0.35, 5) }),
  pong: () => ({ paddle: beep(480, 45, 0.35, 18), wall: beep(260, 30, 0.25, 18), score: beep(110, 450, 0.45, 18) }),
  mario: marioSounds,
};

export function createTon() {
  let ctx = null, master = null, musik = null, an = true;
  const aktive = new Set();
  const cache = {};
  const puffer = (spiel, name) => {
    const k = `${spiel}:${name}`;
    if (!cache[k]) {
      const data = name === "_music" ? smbTheme() : (cache[`${spiel}:*`] ||= KLAENGE[spiel]?.() || {})[name];
      if (!data) return null;
      const b = ctx.createBuffer(1, data.length, RATE);
      b.copyToChannel(data, 0);
      cache[k] = b;
    }
    return cache[k];
  };
  const ensure = () => {
    if (!ctx) {
      try { ctx = new AudioContext(); master = ctx.createGain(); master.connect(ctx.destination); master.gain.value = an ? 1 : 0; } catch { return false; }
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return true;
  };
  const stopMusik = () => { if (musik) { try { musik.stop(); } catch {} musik = null; } };
  const stopAlle = () => { stopMusik(); for (const s of aktive) { try { s.stop(); } catch {} } aktive.clear(); };
  const play = (spiel, name) => {
    if (name === "_stop") return stopAlle();
    if (!ensure()) return;
    if (name === "death") stopAlle();                 // wie pygame.mixer.stop()
    const b = puffer(spiel, name);
    if (!b) return;
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.connect(master);
    if (name === "_music") { stopMusik(); src.loop = true; musik = src; }
    else { aktive.add(src); src.onended = () => aktive.delete(src); }
    src.start();
  };
  return {
    play, stopAlle,
    get an() { return an; },
    setAn(v) { an = v; if (master) master.gain.value = v ? 1 : 0; },
    close() { stopAlle(); try { ctx?.close(); } catch {} ctx = null; },
  };
}
