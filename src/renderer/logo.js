/* Eigenes Logo (wie im Stromplaner): lokal im Browser-Speicher der App,
   erscheint im Kopf der App und in den PDF-Exporten. */
const KEY = "np_corp_logo";
export const ladeLogo = () => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } };
export const speichereLogo = (dataUrl) => { try { dataUrl ? localStorage.setItem(KEY, dataUrl) : localStorage.removeItem(KEY); } catch {} };
// Bild einlesen und auf höchstens 600 px Kantenlänge verkleinern, damit der Speicher klein bleibt
export const logoAusDatei = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onerror = reject;
  r.onload = () => {
    if (/svg/.test(file.type)) return resolve(r.result);
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      const f = Math.min(1, 600 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/png"));
    };
    img.src = r.result;
  };
  r.readAsDataURL(file);
});
