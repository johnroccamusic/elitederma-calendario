-- I CARRELLI SOSPESI NON HANNO MAI AVUTO UNO STORICO (7/11/2026, sera).
--
-- Dalla fiera di Napoli: «stanno sparendo i carrelli memorizzati, tra cui
-- uno molto importante di Ingrid che superava i 1200 euro». La lista dei
-- carrelli sospesi non e' una tabella: e' UNA riga di
-- `impostazioni_layout_tabelle` (chiave `pos_carrelliSospesi`) con dentro
-- tutti i carrelli di tutti gli operatori, riscritta per intero a ogni
-- salvataggio. Quindi una scrittura che arriva da un dispositivo con una
-- copia incompleta — o un salvataggio che non e' mai arrivato al database
-- e vive solo nel telefono finche' la pagina non si ricarica — fa sparire
-- un carrello SENZA LASCIARE NIENTE: niente riga cancellata, niente
-- movimento di magazzino (i pezzi promessi non si scaricano), niente log.
-- Il carrello di Ingrid non si e' potuto ritrovare per questo.
--
-- Questo file non corregge la causa (sta nell'app, va pubblicata): mette
-- la rete sotto. Da adesso ogni versione di quella riga resta scritta, con
-- quanti carrelli aveva prima e quanti dopo: un carrello perso stasera lo
-- si ripesca da qui, riga per riga, invece di chiederlo alla cliente.
--
-- Si archivia SOLO `pos_carrelliSospesi`: le altre chiavi della tabella
-- sono impaginazioni e preferenze, si riscrivono cento volte al giorno e
-- perderne una non costa niente.

create table if not exists carrelli_sospesi_storico (
  id bigserial primary key,
  scritto_il timestamptz not null default now(),
  quanti_prima integer,
  quanti_dopo integer,
  -- gli id che questa scrittura ha fatto sparire: e' la colonna da
  -- guardare per prima quando qualcuno dice «e' sparito un carrello»
  id_spariti text[],
  valore_prima jsonb,
  valore_dopo jsonb
);

comment on table carrelli_sospesi_storico is
  'Ogni versione della riga pos_carrelliSospesi di impostazioni_layout_tabelle. Nata il 7/11/2026 perche un carrello da 1.200 euro e sparito senza lasciare traccia: quella lista si riscrive per intero a ogni salvataggio.';

create index if not exists carrelli_sospesi_storico_quando on carrelli_sospesi_storico (scritto_il desc);

create or replace function public.carrelli_sospesi_archivia()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_prima jsonb;
  v_spariti text[];
begin
  if new.chiave <> 'pos_carrelliSospesi' then return new; end if;
  -- `old` si tocca SOLO dentro un ramo che gira per forza su un UPDATE:
  -- su un INSERT quella variabile non e' assegnata, e nominarla — anche
  -- dentro un `case when tg_op = 'UPDATE'`, che plpgsql valuta comunque
  -- passando la riga — fa fallire la scrittura. Qui dentro vorrebbe dire
  -- rifiutare l'inserimento di una chiave nuova di
  -- impostazioni_layout_tabelle, cioe' rompere un salvataggio qualunque
  -- dell'app per colpa di un archivio.
  if tg_op = 'UPDATE' then v_prima := old.valore; end if;
  -- una scrittura che non cambia niente (succede: il debounce manda la
  -- stessa lista due volte) non vale una riga di storico
  if v_prima is not null and v_prima = new.valore then return new; end if;

  if jsonb_typeof(v_prima) = 'array' and jsonb_typeof(new.valore) = 'array' then
    select coalesce(array_agg(x), '{}')
      into v_spariti
      from (select jsonb_array_elements(v_prima)->>'id' as x) p
     where x is not null
       and not exists (
         select 1 from jsonb_array_elements(new.valore) d where d->>'id' = p.x
       );
  end if;

  insert into carrelli_sospesi_storico (quanti_prima, quanti_dopo, id_spariti, valore_prima, valore_dopo)
  values (
    case when jsonb_typeof(v_prima) = 'array' then jsonb_array_length(v_prima) end,
    case when jsonb_typeof(new.valore) = 'array' then jsonb_array_length(new.valore) end,
    v_spariti, v_prima, new.valore
  );
  return new;
end;
$$;

drop trigger if exists impostazioni_layout_archivia_carrelli on impostazioni_layout_tabelle;
create trigger impostazioni_layout_archivia_carrelli
  before insert or update on impostazioni_layout_tabelle
  for each row execute function public.carrelli_sospesi_archivia();

-- Lo storico si legge da dentro l'app (una sessione), non da fuori.
alter table carrelli_sospesi_storico enable row level security;
drop policy if exists "storico carrelli: solo chi ha una sessione" on carrelli_sospesi_storico;
create policy "storico carrelli: solo chi ha una sessione"
  on carrelli_sospesi_storico for select to authenticated using (true);
revoke all on carrelli_sospesi_storico from anon;
-- scrive solo il trigger (security definer, proprietario della funzione)
revoke insert, update, delete on carrelli_sospesi_storico from authenticated;
revoke execute on function public.carrelli_sospesi_archivia() from public, anon, authenticated;

-- La fotografia di adesso, per avere un punto di partenza invece del
-- primo salvataggio che capitera'.
insert into carrelli_sospesi_storico (quanti_prima, quanti_dopo, id_spariti, valore_prima, valore_dopo)
select null, jsonb_array_length(valore), '{}', null, valore
  from impostazioni_layout_tabelle
 where chiave = 'pos_carrelliSospesi' and jsonb_typeof(valore) = 'array';
