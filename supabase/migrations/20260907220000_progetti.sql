-- "Progetti in corso": il tasto in home c'era da tempo, spento, con scritto
-- "presto disponibile". Questa e' la tabella che lo accende.
--
-- Tre stati e basta: TO DO finche' nessuno l'ha preso, ON GOING quando
-- qualcuno ci sta lavorando, DONE quando e' finito. Un progetto finito non
-- sparisce da solo: si archivia a mano, perche' "fatto" e "non lo voglio
-- piu' vedere" sono due decisioni diverse e la seconda la prende una
-- persona.
--
-- L'incaricato si tiene per id E per nome: l'id serve a filtrare, il nome
-- a poter ancora leggere un progetto di due anni fa quando quella persona
-- non lavora piu' qui.
create table if not exists public.progetti (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  priorita text not null default 'normale' check (priorita in ('normale','intermedia','alta')),
  incaricato_id uuid references public.utenti_app(id) on delete set null,
  incaricato_nome text,
  scadenza date,
  stato text not null default 'todo' check (stato in ('todo','ongoing','done')),
  note_iniziali text,
  note_sviluppo text,
  archiviato_il timestamptz,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

create index if not exists progetti_aperti_idx on public.progetti (archiviato_il, scadenza);

alter table public.progetti enable row level security;
drop policy if exists "staff progetti" on public.progetti;
create policy "staff progetti" on public.progetti
  for all to anon, authenticated using (true) with check (true);

comment on table public.progetti is
  'Progetti in corso: nome, priorità, incaricato, scadenza, stato TO DO/ON GOING/DONE. archiviato_il valorizzato = finito nello storico.';
comment on column public.progetti.incaricato_nome is
  'Nome dell''incaricato al momento dell''assegnazione: se l''utente viene rinominato o cancellato, il progetto resta leggibile.';
