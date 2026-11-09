// afterPack-Hook für electron-builder: signiert die Mac-App ad-hoc („-“), wenn kein
// Apple-Zertifikat verwendet wird.
// electron-builder 25 überspringt das Signieren bei identity „-“ („no valid identity with
// this name“). Dann trägt nur das Electron-Programm noch seine Linker-Signatur, die nach dem
// Einpacken von Info.plist und Ressourcen nicht mehr zum Bundle passt. Apple-Silicon-Macs
// lehnen so eine App als „beschädigt“ ab. Eine frische Ad-hoc-Signatur über das ganze
// Bundle macht sie wieder gültig.
// Mit Developer-ID-Zertifikat (scripts/mac-signieren.js entfernt identity) signiert
// electron-builder danach selbst und überschreibt diese Signatur.
const { execFileSync } = require("child_process");
const path = require("path");

exports.default = async function adhocSignieren(context) {
  if (context.electronPlatformName !== "darwin") return;
  const identity = context.packager.platformSpecificBuildOptions.identity;
  if (identity !== "-") return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log(`  • ad-hoc signieren  ${app}`);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", "--timestamp=none", app], { stdio: "inherit" });
  execFileSync("codesign", ["--verify", "--deep", "--strict", "--verbose=2", app], { stdio: "inherit" });
};
