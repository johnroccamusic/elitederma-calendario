// Foto di un banco a 390 px (iPhone): node prove/banco/foto.mjs <nome banco> <foto.png>
// Dice anche se la pagina scorre di lato, che sul telefono e' il guasto classico.
import { createRequire } from "node:module";
import path from "node:path";
const { chromium, webkit, devices } = createRequire(path.join(process.env.PLAYWRIGHT_DIR, "package.json"))("playwright");
const [banco, foto] = process.argv.slice(2);
// MOTORE=webkit per guardare con il motore di Safari (iPhone e iPad):
// certi guasti di layout vivono solo li'
const browser = await (process.env.MOTORE === "webkit" ? webkit : chromium).launch();
const page = await (await browser.newContext(process.env.VISTA === "scrivania" ? { viewport: { width: 1280, height: 900 } } : process.env.VISTA === "ipad" ? { ...devices["iPad (gen 7) landscape"] } : process.env.VISTA === "stretta" ? { viewport: { width: 600, height: 900 }, isMobile: true, hasTouch: true } : { ...devices["iPhone 13"] })).newPage();
page.on("pageerror", (e) => console.log("ERRORE IN PAGINA:", e.message));
await page.goto(`http://localhost:4173/prove/banco/${banco}.html${process.env.QUERY || ""}`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
// CLICCA="testo1|testo2": tocca in sequenza gli elementi con quel testo
// (il primo che lo contiene), per arrivare alla schermata da fotografare
for (const t of (process.env.CLICCA || "").split("|").filter(Boolean)) {
  await page.locator(`text=${t}`).first().click();
  await page.waitForTimeout(300);
}
// (dopo i clic) SCEGLI="corso-pos=cd1": seleziona un'opzione in una tendina (data-campo=valore)
for (const coppia of (process.env.SCEGLI || "").split("|").filter(Boolean)) {
  const [campo, valore] = coppia.split("=");
  await page.locator(`select[data-campo="${campo}"]`).first().selectOption(valore);
  await page.waitForTimeout(300);
}
const m = await page.evaluate(() => ({ larghezzaPagina: document.documentElement.scrollWidth, schermo: window.innerWidth,
  tabella: (() => { const t = document.querySelector("table"); if (!t) return null; const r = t.getBoundingClientRect(); return { sinistra: Math.round(r.left), destra: Math.round(r.right) }; })() }));
await page.screenshot({ path: foto, fullPage: true });
await browser.close();
console.log(JSON.stringify(m));
console.log(m.larghezzaPagina > m.schermo ? `GUASTO: la pagina scorre di lato di ${m.larghezzaPagina - m.schermo} px` : "OK: niente scorrimento laterale");
