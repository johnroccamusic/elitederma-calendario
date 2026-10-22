-- I DOCUMENTI ORGANIZZATIVI DI UN EVENTO.
--
-- Le certificazioni, il regolamento della fiera, le planimetrie, i
-- permessi: la roba che serve averla sottomano il giorno che qualcuno
-- la chiede in loco, e che oggi sta nelle chat di chi l'ha ricevuta.
--
-- IL SECCHIO E' PRIVATO, e non e' una formalita'. Degli attuali 21, solo
-- tre lo sono. «Pubblico» e' un'impostazione del secchio: chi conosce
-- l'indirizzo di un file lo scarica, policy o non policy — e qui dentro
-- finiscono certificazioni aziendali e contratti di fiera. Si legge con
-- `createSignedUrl`, come `moduli-iscrizione`.
create table if not exists eventi_documenti (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventi(id) on delete cascade,
  nome text not null,
  percorso text not null,
  tipo text,
  dimensione bigint,
  ordine int not null default 0,
  caricato_il timestamptz not null default now(),
  caricato_da text
);

create index if not exists eventi_documenti_evento
  on eventi_documenti (evento_id, ordine, caricato_il);

alter table eventi_documenti enable row level security;

drop policy if exists eventi_documenti_staff on eventi_documenti;
create policy eventi_documenti_staff on eventi_documenti
  for all to authenticated using (true) with check (true);

comment on table eventi_documenti is
  'Documenti organizzativi di un evento: certificazioni, regolamento fiera, permessi. Il file sta nel secchio privato eventi-documenti, qui c''e'' il percorso.';

-- il secchio, privato
insert into storage.buckets (id, name, public)
values ('eventi-documenti', 'eventi-documenti', false)
on conflict (id) do nothing;

drop policy if exists eventi_documenti_carica on storage.objects;
create policy eventi_documenti_carica on storage.objects
  for insert to authenticated
  with check (bucket_id = 'eventi-documenti');

drop policy if exists eventi_documenti_leggi on storage.objects;
create policy eventi_documenti_leggi on storage.objects
  for select to authenticated
  using (bucket_id = 'eventi-documenti');

-- si cancella il documento sbagliato, non solo la sua riga: un file
-- orfano in un secchio privato non lo ritrova piu' nessuno, ma resta
drop policy if exists eventi_documenti_cancella on storage.objects;
create policy eventi_documenti_cancella on storage.objects
  for delete to authenticated
  using (bucket_id = 'eventi-documenti');
