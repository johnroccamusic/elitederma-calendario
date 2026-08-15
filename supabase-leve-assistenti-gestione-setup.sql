-- ---------------------------------------------------------
-- Gestione Leve e Gestione Assistenti diventano pagine complete come
-- Gestione Master: foto, note, riepilogo calendario. Le assistenti in
-- più si associano ai corsi con un compenso giornaliero fisso (non a
-- fasce per numero di allievi come le master: qui l'importo non
-- dipende da quanti allievi ci sono al corso).
--
-- Le policy qui sono "to authenticated" (non "to anon" come nelle
-- sezioni storiche precedenti di questo file): la RLS è già stata
-- corretta in produzione a favore di "authenticated" e non va
-- regredita da un nuovo pezzo di setup.
-- ---------------------------------------------------------
alter table public.leva add column if not exists foto_url text;
alter table public.leva add column if not exists note text;
alter table public.leva add column if not exists documento_file_path text;

alter table public.assistente add column if not exists foto_url text;
alter table public.assistente add column if not exists note text;
alter table public.assistente add column if not exists documento_file_path text;

create table if not exists public.assistente_corsi (
  id uuid primary key default gen_random_uuid(),
  assistente_id uuid not null references public.assistente(id) on delete cascade,
  corso_id uuid not null references public.corsi(id) on delete cascade,
  compenso_giornaliero numeric,
  ts timestamptz not null default now(),
  unique (assistente_id, corso_id)
);
alter table public.assistente_corsi enable row level security;
drop policy if exists "accesso interno assistente_corsi" on public.assistente_corsi;
create policy "accesso interno assistente_corsi" on public.assistente_corsi for all to authenticated using (true) with check (true);
create index if not exists assistente_corsi_assistente_idx on public.assistente_corsi (assistente_id);

insert into storage.buckets (id, name, public) values ('leve-assistenti-foto', 'leve-assistenti-foto', true) on conflict (id) do nothing;
drop policy if exists "accesso interno leve-assistenti-foto" on storage.objects;
create policy "accesso interno leve-assistenti-foto" on storage.objects for all to authenticated
  using (bucket_id = 'leve-assistenti-foto') with check (bucket_id = 'leve-assistenti-foto');

insert into storage.buckets (id, name, public) values ('leve-assistenti-documenti', 'leve-assistenti-documenti', true) on conflict (id) do nothing;
drop policy if exists "accesso interno leve-assistenti-documenti" on storage.objects;
create policy "accesso interno leve-assistenti-documenti" on storage.objects for all to authenticated
  using (bucket_id = 'leve-assistenti-documenti') with check (bucket_id = 'leve-assistenti-documenti');

notify pgrst, 'reload schema';
