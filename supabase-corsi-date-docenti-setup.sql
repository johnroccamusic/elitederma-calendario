-- ---------------------------------------------------------
-- Assegnazione Master: da campi condivisi (un solo stato di viaggio
-- per il master, uno condiviso per tutti gli assistenti, un solo
-- alloggio per l'intera edizione) a una riga per persona — master,
-- assistente o leva — ciascuna con i propri biglietti di viaggio e il
-- proprio hotel.
--
-- La riga "principale" (la prima master) resta sui campi già esistenti
-- di corsi_date (master_id, note, viaggio_prenotato, viaggio_file,
-- alloggio_id, note_viaggio): nessuna migrazione necessaria lì, e la
-- Dashboard Master continua a leggerli senza modifiche. Questa tabella
-- copre solo le persone "extra": altre master, assistenti, leve.
-- ---------------------------------------------------------
create table if not exists public.corsi_date_docenti (
  id uuid primary key default gen_random_uuid(),
  corso_data_id uuid not null references public.corsi_date(id) on delete cascade,
  tipo text not null check (tipo in ('master','assistente','leva')),
  persona_id uuid,
  viaggio_prenotato boolean not null default false,
  viaggio_file text[] not null default '{}',
  alloggio_id uuid references public.hotel(id) on delete set null,
  ordine integer not null default 0,
  ts timestamptz not null default now(),
  unique (corso_data_id, tipo, persona_id)
);
alter table public.corsi_date_docenti enable row level security;
drop policy if exists "accesso interno corsi_date_docenti" on public.corsi_date_docenti;
create policy "accesso interno corsi_date_docenti" on public.corsi_date_docenti for all to anon using (true) with check (true);
create index if not exists corsi_date_docenti_corso_data_idx on public.corsi_date_docenti (corso_data_id);

-- Migrazione dei dati esistenti: gli elenchi assistente_ids/leva_ids
-- diventano righe proprie. Lo stato di viaggio condiviso degli
-- assistenti (viaggio_assistente_*) viene copiato su ciascuna riga
-- assistente migrata, come miglior approssimazione dei dati passati —
-- le leve non avevano nessun campo di viaggio, restano a false/vuoto.
-- Idempotente: "on conflict do nothing" sulla unique qui sopra, sicura
-- da rieseguire.
insert into public.corsi_date_docenti (corso_data_id, tipo, persona_id, viaggio_prenotato, viaggio_file)
select cd.id, 'assistente', unnest(cd.assistente_ids), coalesce(cd.viaggio_assistente_prenotato, false), coalesce(cd.viaggio_assistente_file, '{}')
from public.corsi_date cd
where cd.assistente_ids is not null and array_length(cd.assistente_ids, 1) > 0
on conflict (corso_data_id, tipo, persona_id) do nothing;

insert into public.corsi_date_docenti (corso_data_id, tipo, persona_id)
select cd.id, 'leva', unnest(cd.leva_ids)
from public.corsi_date cd
where cd.leva_ids is not null and array_length(cd.leva_ids, 1) > 0
on conflict (corso_data_id, tipo, persona_id) do nothing;

-- Le colonne vecchie (assistente_ids, leva_ids, viaggio_assistente_prenotato,
-- viaggio_assistente_file) NON vengono droppate: restano in tabella,
-- inutilizzate, per sicurezza e reversibilità.

notify pgrst, 'reload schema';
