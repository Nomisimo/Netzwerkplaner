// Bündelt die Tests (ESM + JSON-Import) mit esbuild und startet node --test
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "node_modules", ".cache", "np-tests");
fs.rmSync(OUT, { recursive: true, force: true });
const files = fs.readdirSync(path.join(ROOT, "test")).filter((f) => f.endsWith(".test.js"));
esbuild.buildSync({ entryPoints: files.map((f) => path.join(ROOT, "test", f)), bundle: true, platform: "node", format: "cjs", outdir: OUT, logLevel: "warning" });
const r = spawnSync(process.execPath, ["--test", ...files.map((f) => path.join(OUT, f))], { stdio: "inherit" });
process.exit(r.status);
