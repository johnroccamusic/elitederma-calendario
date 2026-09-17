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
