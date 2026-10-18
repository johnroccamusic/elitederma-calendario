import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // LE PROVE.
  //
  // Stanno in `prove/` e si lanciano con `npm test`. Montano i componenti
  // veri in un browser finto (jsdom) e li toccano: non controllano che il
  // codice "compili", controllano che il gesto funzioni — perche' questo
  // progetto si rompe quasi sempre al montaggio o al clic, non in
  // compilazione.
  //
  // Niente rete: `prove/preparazione.js` intercetta `fetch` prima di ogni
  // prova. Una prova che parla col database vero non e' una prova, e' un
  // incidente in attesa.
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./prove/preparazione.js"],
    include: ["prove/**/*.test.{js,jsx}"],
  },
});
