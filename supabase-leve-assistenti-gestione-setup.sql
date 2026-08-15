-- ---------------------------------------------------------
-- Gestione Leve e Gestione Assistenti diventano pagine complete come
-- Gestione Master: foto, note, riepilogo calendario. Le assistenti in
-- più si associano ai corsi con un compenso giornaliero fisso (non a
-- fasce per numero di allievi come le master: qui l'importo non
-- dipende da quanti allievi ci sono al corso).
--
-- Le policy sono "to anon", come tutte le altre di questo file: la
-- migrazione RLS verso "authenticated" (supabase/migrations/) non è
-- ancora stata applicata in produzione, l'app oggi si autentica solo
-- con la chiave anon. "to authenticated" qui bloccherebbe l'app
-- (verificato: causa "row-level security policy" su ogni scrittura).
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
create policy "accesso interno assistente_corsi" on public.assistente_corsi for all to anon using (true) with check (true);
create index if not exists assistente_corsi_assistente_idx on public.assistente_corsi (assistente_id);

insert into storage.buckets (id, name, public) values ('leve-assistenti-foto', 'leve-assistenti-foto', true) on conflict (id) do nothing;
drop policy if exists "accesso interno leve-assistenti-foto" on storage.objects;
create policy "accesso interno leve-assistenti-foto" on storage.objects for all to anon
  using (bucket_id = 'leve-assistenti-foto') with check (bucket_id = 'leve-assistenti-foto');

insert into storage.buckets (id, name, public) values ('leve-assistenti-documenti', 'leve-assistenti-documenti', true) on conflict (id) do nothing;
drop policy if exists "accesso interno leve-assistenti-documenti" on storage.objects;
create policy "accesso interno leve-assistenti-documenti" on storage.objects for all to anon
  using (bucket_id = 'leve-assistenti-documenti') with check (bucket_id = 'leve-assistenti-documenti');

notify pgrst, 'reload schema';
