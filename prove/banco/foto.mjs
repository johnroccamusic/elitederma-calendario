// Foto di un banco a 390 px (iPhone): node prove/banco/foto.mjs <nome banco> <foto.png>
// Dice anche se la pagina scorre di lato, che sul telefono e' il guasto classico.
import { createRequire } from "node:module";
import path from "node:path";
const { chromium, devices } = createRequire(path.join(process.env.PLAYWRIGHT_DIR, "package.json"))("playwright");
const [banco, foto] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
page.on("pageerror", (e) => console.log("ERRORE IN PAGINA:", e.message));
await page.goto(`http://localhost:4173/prove/banco/${banco}.html`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const m = await page.evaluate(() => ({ larghezzaPagina: document.documentElement.scrollWidth, schermo: window.innerWidth,
  tabella: (() => { const t = document.querySelector("table"); if (!t) return null; const r = t.getBoundingClientRect(); return { sinistra: Math.round(r.left), destra: Math.round(r.right) }; })() }));
await page.screenshot({ path: foto, fullPage: true });
await browser.close();
console.log(JSON.stringify(m));
console.log(m.larghezzaPagina > m.schermo ? `GUASTO: la pagina scorre di lato di ${m.larghezzaPagina - m.schermo} px` : "OK: niente scorrimento laterale");
