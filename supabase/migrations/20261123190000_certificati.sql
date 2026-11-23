-- I CERTIFICATI DI ABILITAZIONE (23/11/2026). Chiesto dal titolare:
-- «Assegna logo» diventa «Loghi e Certificati», e dentro c'e' «Crea
-- certificato» con il «Certificato 42 ore» (PMU). Si compilano i dati
-- dello studente, si preme «Genera Certificato» e nasce un PDF definitivo
-- identico al modello, firme comprese; sotto, l'elenco di quelli fatti.
--
-- Una riga per certificato, con i dati che ci sono stati scritti sopra
-- (cosi' fra un anno si sa cosa e' stato certificato a chi, senza dover
-- aprire il file), e il PDF nel secchio PRIVATO «certificati»: dentro ci
-- sono nome, nascita e residenza di una persona.
--
-- Nello stesso secchio, in _modelli/, sta il MODELLO vuoto con le firme.
-- Privato apposta: un foglio firmato e vuoto, scaricabile da chi conosce
-- l'indirizzo, e' un certificato che chiunque puo' riempire.
create table if not exists certificati_generati (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'pmu_42_ore',
  nome text not null,
  cognome text not null,
  luogo_nascita text,
  data_nascita date,
  indirizzo text,
  comune text,
  provincia text,
  corso_dal date,
  corso_al date,
  luogo_rilascio text,
  data_rilascio date,
  percorso text not null,
  iscritto_id uuid references iscritti(id) on delete set null,
  creato_il timestamptz not null default now(),
  creato_da text
);
create index if not exists certificati_generati_creato on certificati_generati (creato_il desc);
alter table certificati_generati enable row level security;
drop policy if exists certificati_generati_staff on certificati_generati;
create policy certificati_generati_staff on certificati_generati for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public) values ('certificati', 'certificati', false) on conflict (id) do nothing;
drop policy if exists certificati_carica on storage.objects;
create policy certificati_carica on storage.objects for insert to authenticated with check (bucket_id = 'certificati');
drop policy if exists certificati_leggi on storage.objects;
create policy certificati_leggi on storage.objects for select to authenticated using (bucket_id = 'certificati');
drop policy if exists certificati_aggiorna on storage.objects;
create policy certificati_aggiorna on storage.objects for update to authenticated using (bucket_id = 'certificati') with check (bucket_id = 'certificati');
drop policy if exists certificati_cancella on storage.objects;
create policy certificati_cancella on storage.objects for delete to authenticated using (bucket_id = 'certificati');

-- ROLLBACK
-- drop policy if exists certificati_carica on storage.objects;
-- drop policy if exists certificati_leggi on storage.objects;
-- drop policy if exists certificati_aggiorna on storage.objects;
-- drop policy if exists certificati_cancella on storage.objects;
-- ATTENZIONE: le due righe sotto portano via i certificati emessi.
-- delete from storage.buckets where id = 'certificati';  (prima vanno tolti i file)
-- drop table if exists certificati_generati;
