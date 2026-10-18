import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // REACT E SUPABASE IN UN PACCHETTO LORO.
        //
        // All'avvio si scarica un file solo, e dentro c'e' tutto: il nostro
        // codice e le librerie. Ogni volta che pubblichiamo — e qui si
        // pubblica piu' volte al giorno — il telefono al banco riscarica
        // anche React e Supabase, che non sono cambiati di una virgola.
        //
        // Staccandoli, quella parte resta nella cache del browser fra un
        // aggiornamento e l'altro. Non riduce la PRIMA apertura: riduce
        // tutte quelle dopo, che su una rete di fiera e' quello che si
        // sente.
        manualChunks: {
          libreria: ["react", "react-dom", "react-dom/client", "@supabase/supabase-js"],
        },
      },
    },
  },
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
