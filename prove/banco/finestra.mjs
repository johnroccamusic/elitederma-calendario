// Misura la finestra modale in un browser vero (Chromium headless, iPhone
// da 390 px). Stampa i numeri che contano e salva una foto.
//   PLAYWRIGHT_DIR=<cartella con node_modules/playwright> node prove/banco/finestra.mjs <url> <foto.png>
import { createRequire } from "node:module";
import path from "node:path";

const dir = process.env.PLAYWRIGHT_DIR;
if (!dir) { console.error("Serve PLAYWRIGHT_DIR"); process.exit(2); }
const { chromium, devices } = createRequire(path.join(dir, "package.json"))("playwright");
const [url, foto] = process.argv.slice(2);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector("[data-ultima]");

const m = await page.evaluate(() => {
  const overlay = document.querySelector("[data-ultima]").closest("div[style*='position: fixed']");
  const scheda = overlay.children[0];
  const r = scheda.getBoundingClientRect();
  overlay.scrollTop = overlay.scrollHeight;
  const u = document.querySelector("[data-ultima]").getBoundingClientRect();
  return {
    larghezzaSchermo: window.innerWidth,
    scheda: { sinistra: Math.round(r.left), destra: Math.round(r.right), larghezza: Math.round(r.width) },
    sbordaADestra: Math.round(r.right - window.innerWidth),
    scorrimentoOrizzontale: overlay.scrollWidth - overlay.clientWidth,
    spazioSottoUltimaRiga: Math.round(window.innerHeight - u.bottom),
    divisorio: Math.round(overlay.querySelector('[data-campo="spazio-sotto-la-finestra"]')?.getBoundingClientRect().height || 0),
    altezzaSchermo: window.innerHeight,
    bodyOverflow: document.body.style.overflow,
  };
});
if (foto) await page.screenshot({ path: foto });
await browser.close();

const guasti = [];
if (m.sbordaADestra > 0) guasti.push(`la scheda sborda a destra di ${m.sbordaADestra} px`);
if (m.scheda.sinistra < 16) guasti.push(`la scheda sta a ${m.scheda.sinistra} px dal bordo sinistro`);
if (m.scorrimentoOrizzontale > 0) guasti.push(`si scorre in orizzontale di ${m.scorrimentoOrizzontale} px`);
if (m.spazioSottoUltimaRiga < 140) guasti.push(`sotto l'ultima riga restano ${m.spazioSottoUltimaRiga} px, ne servono 140 (il dock aperto e' alto circa 110)`);
if (m.bodyOverflow !== "hidden") guasti.push("la pagina sotto non è bloccata");
console.log(JSON.stringify(m));
console.log(guasti.length ? "GUASTI: " + guasti.join("; ") : "OK: scheda dentro lo schermo, niente orizzontale, spazio in fondo, pagina sotto ferma");
process.exit(guasti.length ? 1 : 0);
