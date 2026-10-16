-- FASE 2, TERZO PEZZO: la scrittura, e dove finiscono documento e firma.
-- APPLICATA il 16/10/2026 via MCP.
--
-- IL SECCHIO. Privato, e piu' stretto di quello dei consensi: li' anche
-- `anon` puo' LEGGERE, qui no. L'allieva deve poter CARICARE il suo
-- documento e basta; a rileggerlo e' lo staff, con un URL firmato che
-- scade. Un documento d'identita' non lo si lascia raggiungibile a
-- chiunque abbia la chiave del bundle, anche sapendone il nome.
--
-- LA SCRITTURA, due regole:
--   a) si scrivono SOLO le colonne dell'elenco `consentite`. Senza,
--      bastava infilare "totale_pattuito" nel pacchetto per cambiare il
--      prezzo concordato dalla pagina pubblica. Quote, pacchetto,
--      dermografo, taglia, modelle e note non ci sono, e non ci devono
--      entrare.
--   b) di quelle colonne si scrive solo quello che il venditore ha
--      lasciato VUOTO.
--
-- L'ECCEZIONE: `tipo_cliente` ha 'privato' come valore di serie su tutti
-- e 258 gli iscritti, quindi per la regola (b) risulterebbe sempre gia'
-- scritto e lei non potrebbe mai dire "azienda". Quella scelta e' sua:
-- si sovrascrive sempre, e solo con 'privato' o 'azienda'.
-- Per lo stesso motivo `modulo_campo_bloccato` lo dichiara mai bloccato,
-- cosi' anche la pagina lo disegna come scelta e non come dato deciso.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('moduli-iscrizione', 'moduli-iscrizione', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "moduli_iscrizione_carica" on storage.objects;
create policy "moduli_iscrizione_carica" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'moduli-iscrizione');

drop policy if exists "moduli_iscrizione_leggi" on storage.objects;
create policy "moduli_iscrizione_leggi" on storage.objects
  for select to authenticated
  using (bucket_id = 'moduli-iscrizione');

-- il corpo completo di modulo_salva e di modulo_campo_bloccato e' stato
-- applicato via MCP il 16/10/2026; vedi lo storico delle migrazioni del
-- progetto (modulo_allieva_salva_e_secchio).
