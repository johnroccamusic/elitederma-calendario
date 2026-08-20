-- Scheda completa per i venditori (come le master): stesso set di
-- colonne fiscali/gestionali, meno diploma_gia_firmato (specifico dei
-- diplomi, non pertinente ai venditori).

alter table venditori
  add column if not exists foto_url text,
  add column if not exists note text,
  add column if not exists documento_file_path text,
  add column if not exists regime_fiscale text,
  add column if not exists iban text,
  add column if not exists indirizzo text,
  add column if not exists civico text,
  add column if not exists citta text,
  add column if not exists partita_iva text,
  add column if not exists codice_destinatario text,
  add column if not exists pec text,
  add column if not exists diretto_indiretto text,
  add column if not exists fisso_variabile text,
  add column if not exists ricorrente_occasionale text,
  add column if not exists natura text,
  add column if not exists controllabilita text,
  add column if not exists riducibilita text,
  add column if not exists essenzialita text,
  add column if not exists origine text,
  add column if not exists ricorrenza text,
  add column if not exists bene_durevole boolean,
  add column if not exists includi_analisi_costi boolean,
  add column if not exists budget_previsto numeric,
  add column if not exists soglia_allerta_personalizzata numeric,
  add column if not exists responsabile_costo text;

-- stesso identico pattern già in uso per master-foto/master-documenti
insert into storage.buckets (id, name, public) values ('venditori-foto', 'venditori-foto', true) on conflict (id) do nothing;
drop policy if exists "accesso interno venditori-foto" on storage.objects;
create policy "accesso interno venditori-foto" on storage.objects for all to anon
  using (bucket_id = 'venditori-foto') with check (bucket_id = 'venditori-foto');

insert into storage.buckets (id, name, public) values ('venditori-documenti', 'venditori-documenti', true) on conflict (id) do nothing;
drop policy if exists "accesso interno venditori-documenti" on storage.objects;
create policy "accesso interno venditori-documenti" on storage.objects for all to anon
  using (bucket_id = 'venditori-documenti') with check (bucket_id = 'venditori-documenti');
