-- LA LETTURA AUTOMATICA DEL DOCUMENTO (25/10/2026).
-- `leggi-documento` scrive qui i soli dati anagrafici letti dalla foto
-- del documento (per lato: fronte/retro), con modello e data. Niente
-- immagini. Il venditore ci confronta la scheda; l'allieva lo vede nel
-- modulo e corregge se vuole. Vedi il Punto 9 dell'informativa.
alter table public.iscritti add column if not exists documento_letto jsonb;
comment on column public.iscritti.documento_letto is
  'Dati anagrafici letti automaticamente dalla foto del documento ({fronte:{...}, retro:{...}}, con modello e letto_il). Solo per confronto: nessuna decisione automatica.';
