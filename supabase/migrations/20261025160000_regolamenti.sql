-- REGOLAMENTI (25/10/2026).
--
-- Le decisioni prese nel tempo — prezzi, sconti, procedure, cosa fare
-- quando — finora vivevano nelle chat e nella testa di chi c'era. Qui
-- diventano schede scritte dal titolare, lette da chi ha la tessera
-- «Regolamenti» in Home, e sono l'UNICA fonte da cui l'assistente
-- (edge function assistente-regole) risponde: se una scheda non c'e',
-- risponde che la decisione non e' scritta, e la domanda finisce in
-- regolamenti_domande perche' qualcuno la scriva.
--
-- Nasce vuota, per scelta del titolare: la riempie lui, scheda per scheda.
create table if not exists public.regolamenti (
  id            uuid primary key default gen_random_uuid(),
  titolo        text not null,
  argomento     text,                       -- Prezzi, Sconti, Modelle, Kit, Spedizioni…
  testo         text not null,
  -- a chi vale: 'tutti' oppure uno o piu' fra venditori, master,
  -- assistenti, amministrazione. Il filtro lo applica la funzione prima
  -- di passare le schede al modello: una regola per i soli venditori non
  -- deve uscire a una master che fa la domanda giusta.
  visibile_a    text[] not null default '{tutti}',
  decisa_il     date,
  attivo        boolean not null default true,
  ordine        integer not null default 0,
  creato_da     text,
  creato_il     timestamptz not null default now(),
  aggiornato_da text,
  aggiornato_il timestamptz not null default now()
);
alter table public.regolamenti enable row level security;
drop policy if exists "regolamenti interni" on public.regolamenti;
create policy "regolamenti interni" on public.regolamenti for all to authenticated using (true) with check (true);

-- Il registro delle domande: chi ha chiesto cosa, cosa gli e' stato
-- risposto, quali schede sono state citate. `senza_risposta` e' l'elenco
-- da cui nascono le schede che mancano.
create table if not exists public.regolamenti_domande (
  id             uuid primary key default gen_random_uuid(),
  ts             timestamptz not null default now(),
  chi            text,
  ruolo          text,
  domanda        text not null,
  risposta       text,
  citati         uuid[],
  senza_risposta boolean not null default false,
  modello        text,
  uso            jsonb
);
alter table public.regolamenti_domande enable row level security;
drop policy if exists "regolamenti_domande lettura interna" on public.regolamenti_domande;
create policy "regolamenti_domande lettura interna" on public.regolamenti_domande for select to authenticated using (true);
-- la scrive solo la funzione (service_role); l'app puo' solo leggerla e
-- cancellare una domanda dall'elenco quando la scheda e' stata scritta
drop policy if exists "regolamenti_domande archivia" on public.regolamenti_domande;
create policy "regolamenti_domande archivia" on public.regolamenti_domande for delete to authenticated using (true);
