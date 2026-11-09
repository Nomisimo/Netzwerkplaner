// afterPack-Hook für electron-builder: signiert die Mac-App ad-hoc („-“), wenn kein
// Apple-Zertifikat verwendet wird.
// In package.json steht build.mac.identity: null, damit electron-builder das Signieren
// gezielt überspringt und diese Signatur danach nicht mehr anfasst. Dann trägt nur das Electron-Programm noch seine Linker-Signatur, die nach dem
// Einpacken von Info.plist und Ressourcen nicht mehr zum Bundle passt. Apple-Silicon-Macs
// lehnen so eine App als „beschädigt“ ab. Eine frische Ad-hoc-Signatur über das ganze
// Bundle macht sie wieder gültig.
// Mit Developer-ID-Zertifikat (scripts/mac-signieren.js entfernt identity, CSC_LINK ist
// gesetzt) signiert electron-builder selbst; dann tut dieser Hook nichts.
const { execFileSync } = require("child_process");
const path = require("path");

exports.default = async function adhocSignieren(context) {
  if (context.electronPlatformName !== "darwin") return;
  const identity = context.packager.platformSpecificBuildOptions.identity;
  if (process.env.CSC_LINK || (identity != null && identity !== "-")) return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log(`  • ad-hoc signieren  ${app}`);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", "--timestamp=none", app], { stdio: "inherit" });
  execFileSync("codesign", ["--verify", "--deep", "--strict", "--verbose=2", app], { stdio: "inherit" });
};
