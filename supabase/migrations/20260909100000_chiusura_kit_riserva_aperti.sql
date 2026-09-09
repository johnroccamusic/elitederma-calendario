-- Chiusura corso, passo 2: i kit di riserva.
--
-- Fino a ieri erano un numero: quanti ne sono partiti meno quanti ne sono
-- stati consegnati. Ma un kit di riserva che rientra puo' rientrare in due
-- modi diversi, e sono due cose diverse per il magazzino: sigillato torna
-- a scaffale com'e', aperto no — qualcosa dentro e' stato venduto, o e'
-- servito a sostituire un pezzo sbagliato o guasto in un altro kit.
--
-- Da qui in avanti la master lo dichiara: integro o aperto. E dei kit
-- aperti dice cosa ne e' stato dei pezzi, uno per uno.
create table if not exists public.chiusura_corso_kit_riserva (
  id uuid primary key default gen_random_uuid(),
  chiusura_id uuid not null references public.chiusura_corso(id) on delete cascade,
  kit_id uuid not null,
  -- 'integro' | 'aperto'; null = non ancora dichiarato
  stato text check (stato in ('integro', 'aperto')),
  ts timestamptz not null default now(),
  unique (chiusura_id, kit_id)
);

create table if not exists public.chiusura_corso_kit_componenti (
  id uuid primary key default gen_random_uuid(),
  chiusura_id uuid not null references public.chiusura_corso(id) on delete cascade,
  kit_id uuid not null,
  prodotto_id uuid not null,
  quantita integer not null default 1 check (quantita > 0),
  -- che fine ha fatto il pezzo uscito dal kit aperto
  destinazione text not null check (destinazione in (
    'venduto',
    'sostituito_errato',
    'integrato_mancante',
    'sostituito_guasto'
  )),
  ts timestamptz not null default now()
);

create index if not exists chiusura_corso_kit_componenti_chiusura_idx
  on public.chiusura_corso_kit_componenti (chiusura_id);

alter table public.chiusura_corso_kit_riserva enable row level security;
alter table public.chiusura_corso_kit_componenti enable row level security;

-- come le altre tabelle della chiusura: aperte ad anon, perche' l'app
-- parla al database come anon (vedi sezione 4 di CLAUDE.md)
drop policy if exists "staff chiusura_corso_kit_riserva" on public.chiusura_corso_kit_riserva;
create policy "staff chiusura_corso_kit_riserva"
  on public.chiusura_corso_kit_riserva for all to anon, authenticated using (true) with check (true);

drop policy if exists "staff chiusura_corso_kit_componenti" on public.chiusura_corso_kit_componenti;
create policy "staff chiusura_corso_kit_componenti"
  on public.chiusura_corso_kit_componenti for all to anon, authenticated using (true) with check (true);

comment on table public.chiusura_corso_kit_riserva is
  'Per ogni tipo di kit di riserva di una chiusura: rientra integro o aperto.';
comment on table public.chiusura_corso_kit_componenti is
  'Pezzi usciti dai kit di riserva aperti, con il motivo: venduti, o serviti a sostituire/integrare un altro kit.';

-- Poi: uno per uno, non un tipo per volta. Di tre kit di riserva uno puo'
-- tornare sigillato e due aperti, e una risposta sola per tre scatole non
-- lo direbbe.
alter table public.chiusura_corso_kit_riserva
  add column if not exists indice integer not null default 1;
alter table public.chiusura_corso_kit_riserva
  drop constraint if exists chiusura_corso_kit_riserva_chiusura_id_kit_id_key;
create unique index if not exists chiusura_corso_kit_riserva_unico
  on public.chiusura_corso_kit_riserva (chiusura_id, kit_id, indice);
comment on column public.chiusura_corso_kit_riserva.indice is
  'Quale dei kit di riserva di quel tipo: 1, 2, 3... Ognuno rientra integro o aperto per conto suo.';
