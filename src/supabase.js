// Il client Supabase, uno solo per tutta l'app.
//
// Stava dentro App.jsx: da oggi lo usa anche il modulo "rientro materiali
// corso", e un secondo createClient significherebbe una seconda
// connessione e una seconda sessione — due verita' su chi sei.
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// PostgREST tronca ogni risposta a 1000 righe. Non e' un errore e non
// c'e' un avviso: le righe oltre la millesima semplicemente non
// arrivano, e l'app lavora su meta' tabella credendo di averla tutta.
// E' cosi' che gli accessori appena aggiunti a un corso sparivano —
// erano le ultime righe di corsi_kit_prodotti, e la millesima era gia'
// passata.
//
// Chi legge una tabella che puo' superare quel numero passa di qui. La
// query si ricostruisce a ogni giro perche' un builder di supabase-js
// si consuma quando lo si attende: riusarlo restituirebbe sempre la
// stessa pagina.
// Le pagine dopo la prima si chiedono a gruppi, tutte insieme. Una dopo
// l'altra erano cinque viaggi di andata e ritorno per le vendite (4.100
// righe): due secondi buoni di attesa a ogni apertura di Gestione
// magazzino o della Dashboard master, spesi ad aspettare la rete e non a
// leggere. A gruppi di quattro i viaggi diventano due.
//
// Non si sa quante pagine ci sono finche' non ne arriva una corta: si
// chiede un gruppo, e se sono tutte piene se ne chiede un altro. Nel caso
// normale — tabelle sotto le mille righe — resta una chiamata sola, come
// prima.
const PAGINE_INSIEME = 4;
export async function leggiTutte(costruisciQuery, pagina = 1000) {
  const prima = await costruisciQuery().range(0, pagina - 1);
  if (prima.error || !prima.data) return [];
  if (prima.data.length < pagina) return prima.data;
  let righe = prima.data;
  for (let da = pagina; ; da += PAGINE_INSIEME * pagina) {
    const inizi = Array.from({ length: PAGINE_INSIEME }, (_, i) => da + i * pagina);
    const risposte = await Promise.all(
      inizi.map((da) => costruisciQuery().range(da, da + pagina - 1)),
    );
    let finito = false;
    for (const { data, error } of risposte) {
      if (error || !data || data.length === 0) { finito = true; break; }
      righe = righe.concat(data);
      if (data.length < pagina) { finito = true; break; }
    }
    if (finito) return righe;
  }
}
