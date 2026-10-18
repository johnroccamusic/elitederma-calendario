// ESLint, scritto stretto: solo errori veri, nessuna regola di stile.
//
// PERCHE' COSI'. Questo progetto ha 98.000 righe, di cui 84.000 in un
// file solo, e una convenzione sua — stili in linea, commenti discorsivi,
// italiano ovunque. Una configurazione "consigliata" sputerebbe migliaia
// di segnalazioni su cose che vanno benissimo, e nessuno le leggerebbe
// piu': un controllo che grida sempre e' un controllo spento.
//
// Qui ci sono solo le regole che avrebbero preso i guasti VERI di questo
// progetto, quelli costati ore:
//
//   no-undef           "dataIso is not defined" in produzione (18/10), e
//                      le schermate bianche da identificatore inesistente
//                      nel JSX, che la build di Vite non vede
//   no-dupe-keys       `opacity` scritta due volte in FasciaStato.jsx,
//                      `saltati` due volte in woo-riallinea-shop: la
//                      seconda vince e la prima non fa niente
//   rules-of-hooks     un hook dopo un return anticipato spegne la pagina
//                      al montaggio (in App.jsx i return stanno a ~73700)
//
// `no-unused-vars` sta a "warn" e non a "error": su un monolite di questa
// eta' le variabili lasciate indietro sono tante, e non voglio che il
// controllo fallisca per quelle — ma voglio vederle, perche' ogni tanto
// una e' un pezzo di codice che qualcuno credeva vivo.
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    // i commenti `eslint-disable` di exhaustive-deps restano dalle
    // configurazioni di prima: quella regola qui non e' accesa, e non
    // voglio quarantotto avvisi su commenti innocui
    linterOptions: { reportUnusedDisableDirectives: "off" },
    ignores: ["dist/**", "node_modules/**", "supabase/functions/**", "public/**"],
  },
  {
    files: ["src/**/*.{js,jsx}", "*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.es2021, process: "readonly" },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      // quello che non esiste
      "no-undef": "error",
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
      // quello che e' scritto due volte e quindi non fa quello che sembra
      "no-dupe-keys": "error",
      "no-dupe-args": "error",
      "no-dupe-else-if": "error",
      "no-duplicate-case": "error",
      // quello che non verra' mai eseguito
      "no-unreachable": "error",
      "no-constant-condition": ["error", { checkLoops: false }],
      // confronti che non fanno quello che si crede
      "use-isnan": "error",
      "valid-typeof": "error",
      "no-self-compare": "error",
      "no-self-assign": "error",
      "no-unsafe-negation": "error",
      // assegnamenti dentro un if: quasi sempre un == scritto male. Resta
      // il comportamento predefinito e non "always", perche' `while ((m =
      // re.exec(t)))` — con le parentesi in piu', che dichiarano
      // l'intenzione — e' il modo normale di scorrere i risultati di una
      // espressione regolare, e in App.jsx serve davvero.
      "no-cond-assign": "error",
      // GLI HOOK DI REACT, e perche' qui avvisa invece di fermare.
      //
      // Segnala 185 punti, e sono tutti la stessa cosa: in `App()` le
      // rotte pubbliche (`?master=`, `?modulo=`, `?consenso=`...) escono
      // con un `return` anticipato intorno alla riga 80330, e tutti gli
      // hook del gestionale stanno dopo. Per React e' una violazione: il
      // numero di hook cambia a seconda della strada.
      //
      // Oggi non esplode perche' quella strada la decide l'indirizzo, che
      // non cambia finche' la pagina non si ricarica: il conto degli hook
      // e' stabile per tutta la vita del montaggio. Esploderebbe il giorno
      // in cui si aggiungesse una navigazione interna.
      //
      // Metterla a "error" vorrebbe dire un controllo rosso per sempre, e
      // un controllo sempre rosso non lo guarda piu' nessuno. La cura vera
      // e' spostare la scelta della rotta in un componente che sta SOPRA
      // ad App: e' un lavoro suo, da fare a mente fresca.
      "react-hooks/rules-of-hooks": "warn",
    },
  },
];
