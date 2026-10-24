// Config di build del banco visivo: entra da prove/banco/finestra.html,
// esce nella cartella passata con --outDir. Le due variabili VITE_ sono
// finte: la Modal non parla col database, ma src/supabase.js le vuole.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { rollupOptions: { input: { finestra: resolve(process.cwd(), "prove/banco/finestra.html"), vendite: resolve(process.cwd(), "prove/banco/vendite.html"), pos: resolve(process.cwd(), "prove/banco/pos.html"), advisor: resolve(process.cwd(), "prove/banco/advisor.html") } }, emptyOutDir: true },
});
