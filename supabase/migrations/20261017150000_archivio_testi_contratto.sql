-- L'ARCHIVIO DELLE VERSIONI DEL CONTRATTO.
--
-- `modulo_iscrizione_testi` tiene UNA riga per pezzo: la correzione che
-- vale adesso. Chi la riscrive, o preme "Rimetti com'era", cancella
-- quella di prima e non resta niente. Per il regolamento e l'informativa
-- che le allieve FIRMANO questo non va bene: fra due anni, davanti a una
-- contestazione, serve poter dire cosa diceva il testo quel giorno.
--
-- Qui ogni versione superata viene messa da parte prima di sparire.
-- Additiva: non tocca niente di quello che c'e'.
create table if not exists public.modulo_iscrizione_testi_archivio (
  id            uuid primary key default gen_random_uuid(),
  chiave        text not null,
  corpo         jsonb not null,
  aggiornato_il timestamptz,
  aggiornato_da text,
  archiviato_il timestamptz not null default now(),
  perche        text
);

alter table public.modulo_iscrizione_testi_archivio enable row level security;

drop policy if exists "archivio_testi_leggi" on public.modulo_iscrizione_testi_archivio;
create policy "archivio_testi_leggi" on public.modulo_iscrizione_testi_archivio
  for select to authenticated using (true);

drop policy if exists "archivio_testi_scrivi" on public.modulo_iscrizione_testi_archivio;
create policy "archivio_testi_scrivi" on public.modulo_iscrizione_testi_archivio
  for insert to authenticated with check (true);

-- un archivio da cui si puo' cancellare non e' un archivio
create or replace function public.archivio_testi_non_si_tocca()
returns trigger language plpgsql as $$
begin
  raise exception 'L''archivio dei testi del contratto non si modifica e non si cancella.';
end;
$$;

drop trigger if exists archivio_testi_immutabile on public.modulo_iscrizione_testi_archivio;
create trigger archivio_testi_immutabile
  before update or delete on public.modulo_iscrizione_testi_archivio
  for each row execute function public.archivio_testi_non_si_tocca();

-- la versione in vigore fino a oggi, messa da parte
insert into public.modulo_iscrizione_testi_archivio (chiave, corpo, aggiornato_il, aggiornato_da, perche)
select t.chiave, t.corpo, t.aggiornato_il, t.aggiornato_da,
       'Regolamento a 9 punti, sostituito dalla revisione del 17/10/2026 a 11 punti'
  from public.modulo_iscrizione_testi t
 where t.chiave = 'regolamento'
   and not exists (
     select 1 from public.modulo_iscrizione_testi_archivio a
      where a.chiave = t.chiave and a.corpo = t.corpo
   );
