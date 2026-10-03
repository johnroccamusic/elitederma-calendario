-- Lo scarico dei punti di una master, e le stagioni.
--
-- SCARICARE non azzera niente: segna una DATA. I punti "da pagare" sono
-- quelli delle vendite fatte dopo l'ultimo scarico; lo storico resta
-- intero e si puo' sempre rileggere. Un contatore azzerato perde il
-- motivo per cui un numero era quello che era.
--
-- Nello scarico si scrive anche QUANTO si e' scaricato, non solo quando:
-- ricalcolarlo a posteriori darebbe un numero diverso il giorno che
-- cambia un costo d'acquisto, perche' i punti seguono lo sconto massimo
-- che segue il costo.
--
-- LA STAGIONE va da settembre ad agosto dell'anno dopo, perche' e' il
-- ciclo dei corsi: gli obiettivi annuali si fissano sull'anno di lavoro,
-- non sull'anno solare.
create table if not exists punti_master_scarichi (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references master(id) on delete cascade,
  scaricato_fino_a timestamptz not null default now(),
  punti_shop_pos numeric not null default 0,
  punti_cash numeric not null default 0,
  punti_totali numeric not null default 0,
  stagione text not null,
  nota text,
  creato_da text,
  created_at timestamptz not null default now()
);

create index if not exists punti_master_scarichi_master_idx
  on punti_master_scarichi (master_id, scaricato_fino_a desc);

alter table punti_master_scarichi enable row level security;
drop policy if exists "accesso interno punti_master_scarichi" on punti_master_scarichi;
create policy "accesso interno punti_master_scarichi" on punti_master_scarichi
  for all to anon, authenticated using (true) with check (true);

create or replace function stagione_punti(d timestamptz)
returns text language sql immutable as $$
  select case when extract(month from d) >= 9
              then to_char(d, 'YYYY') || '/' || to_char(d + interval '1 year', 'YY')
              else to_char(d - interval '1 year', 'YYYY') || '/' || to_char(d, 'YY')
         end;
$$;

-- v_punti_master: solo i punti NON ancora scaricati (vedi il file
-- 20261004090000 per il corpo completo, qui cambia solo il filtro sulla
-- data dell'ultimo scarico).
-- v_punti_master_stagioni: tutti i punti per stagione, scaricati o no.
