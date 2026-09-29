// Baut die Oberfläche (React) zu einer einzelnen HTML-Datei: dist-app/index.html
// Geräte-Icons aus assets/icons/devices/*.svg werden als virtuelles Modul eingebettet.
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "dist-app");
const ICON_DIR = path.join(ROOT, "assets", "icons", "devices");
const ANLEITUNG_DIR = path.join(ROOT, "assets", "anleitung");

const iconsPlugin = {
  name: "device-icons",
  setup(build) {
    build.onResolve({ filter: /^virtual:device-icons$/ }, () => ({ path: "device-icons", namespace: "virtual" }));
    build.onLoad({ filter: /.*/, namespace: "virtual" }, () => {
      const icons = {};
      for (const f of fs.readdirSync(ICON_DIR).filter((f) => f.endsWith(".svg")).sort())
        icons[f.replace(/\.svg$/, "")] = fs.readFileSync(path.join(ICON_DIR, f), "utf8").trim();
      return { contents: `export default ${JSON.stringify(icons)};`, loader: "js", watchFiles: fs.readdirSync(ICON_DIR).map((f) => path.join(ICON_DIR, f)) };
    });
  },
};

// Screenshots der Anleitung (assets/anleitung/*.jpg) als Data-URLs
const anleitungPlugin = {
  name: "anleitung-bilder",
  setup(build) {
    build.onResolve({ filter: /^virtual:anleitung-bilder$/ }, () => ({ path: "anleitung-bilder", namespace: "anleitung" }));
    build.onLoad({ filter: /.*/, namespace: "anleitung" }, () => {
      const bilder = {};
      const files = fs.existsSync(ANLEITUNG_DIR) ? fs.readdirSync(ANLEITUNG_DIR).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort() : [];
      for (const f of files)
        bilder[f.replace(/\.\w+$/, "")] = `data:image/${/png$/i.test(f) ? "png" : "jpeg"};base64,${fs.readFileSync(path.join(ANLEITUNG_DIR, f)).toString("base64")}`;
      return { contents: `export default ${JSON.stringify(bilder)};`, loader: "js", watchFiles: files.map((f) => path.join(ANLEITUNG_DIR, f)) };
    });
  },
};

async function build() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, "src", "renderer", "index.jsx")],
    bundle: true,
    format: "iife",
    minify: process.argv.includes("--minify"),
    loader: { ".jsx": "jsx", ".js": "jsx", ".svg": "text" },
    jsx: "transform",
    define: { "process.env.NODE_ENV": '"production"', __APP_VERSION__: JSON.stringify(pkg.version) },
    plugins: [iconsPlugin, anleitungPlugin],
    write: false,
    logLevel: "warning",
  });
  const css = fs.readFileSync(path.join(ROOT, "src", "renderer", "styles.css"), "utf8");
  const html =
    `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data: blob:; img-src 'self' data: blob:">` +
    `<link rel="icon" href="data:image/svg+xml;base64,${fs.readFileSync(path.join(ROOT, "assets", "app-icon", "icon.svg")).toString("base64")}">` +
    `<title>Netzwerkplaner</title><style>${css}</style></head>` +
    `<body><div id="root"></div><script>\n${result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "index.html"), html);
  console.log(`Build erfolgreich: dist-app/index.html (${Math.round(html.length / 1024)} KB)`);
}

build().catch((e) => { console.error("Build fehlgeschlagen:", e.message); process.exit(1); });
