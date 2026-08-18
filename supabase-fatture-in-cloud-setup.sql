-- ---------------------------------------------------------
-- Integrazione Fatture in Cloud: legge le fatture di acquisto
-- ("received_documents", API v2) nel Registro documenti fornitore, con
-- un tasto per importarle come spesa.
--
-- DUE TABELLE CON REGOLE DI ACCESSO DIVERSE:
--
-- 1) fatture_in_cloud_config — access_token/refresh_token OAuth2.
--    A DIFFERENZA DI TUTTE LE ALTRE TABELLE DI QUESTO DATABASE, qui
--    RLS è abilitata SENZA NESSUNA POLICY: significa accesso negato di
--    default per "anon" e "authenticated", cioè per il client
--    Supabase che gira nel browser (la cui chiave è nel bundle
--    pubblico). Solo le Edge Function, che usano la service role key
--    lato server, possono leggerla o scriverla. Se in futuro capita di
--    "sistemare" le policy di tutte le tabelle in un colpo solo,
--    questa deve restare un'eccezione — altrimenti i token finiscono
--    leggibili da chiunque abbia la chiave anon.
--
-- 2) fatture_ricevute_fic — cache locale delle fatture ricevute (solo
--    metadati: fornitore, importi, numero, data — niente token).
--    Stessa policy "for all to anon" di tutte le altre tabelle
--    dell'app: non è più sensibile di una riga di "spese".
-- ---------------------------------------------------------

create table if not exists public.fatture_in_cloud_config (
  id uuid primary key default gen_random_uuid(),
  access_token text,
  refresh_token text,
  token_scade_il timestamptz,
  company_id integer,
  company_nome text,
  ultima_sincronizzazione timestamptz,
  ts timestamptz not null default now()
);
alter table public.fatture_in_cloud_config enable row level security;
-- nessuna policy qui di proposito, vedi commento sopra

create table if not exists public.fatture_ricevute_fic (
  id uuid primary key default gen_random_uuid(),
  fic_id bigint not null unique,
  tipo text, -- expense | passive_credit_note | passive_delivery_note | self_invoice
  fornitore_nome text,
  numero_documento text,
  data_documento date,
  descrizione text,
  categoria text,
  imponibile numeric,
  iva numeric,
  totale numeric,
  fattura_elettronica boolean,
  -- valorizzato quando l'utente clicca "Importa come spesa": impedisce
  -- un doppio import e fa vedere in UI che è già stata registrata
  spesa_id uuid references public.spese(id) on delete set null,
  payload_raw jsonb,
  ts timestamptz not null default now()
);
create index if not exists fatture_ricevute_fic_data_documento_idx on public.fatture_ricevute_fic(data_documento);
alter table public.fatture_ricevute_fic enable row level security;
drop policy if exists "accesso interno fatture_ricevute_fic" on public.fatture_ricevute_fic;
create policy "accesso interno fatture_ricevute_fic" on public.fatture_ricevute_fic for all to anon using (true) with check (true);

notify pgrst, 'reload schema';
