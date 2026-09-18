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
export async function leggiTutte(costruisciQuery, pagina = 1000) {
  let righe = [];
  for (let da = 0; ; da += pagina) {
    const { data, error } = await costruisciQuery().range(da, da + pagina - 1);
    if (error || !data || data.length === 0) break;
    righe = righe.concat(data);
    if (data.length < pagina) break;
  }
  return righe;
}
