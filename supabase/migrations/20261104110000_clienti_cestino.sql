-- IL CESTINO DEI CLIENTI REGISTRATI (4/11/2026).
--
-- Chiesto dal titolare. Fino a oggi il cestino sulla riga di un cliente
-- cancellava e basta: nessuna copia, nessuna traccia di chi aveva
-- premuto. Era scritto nero su bianco nella pagina («non si recupera»),
-- ma e' la stessa forma del guasto del 26/10, quando tre vendite
-- incassate di Elia Cito sono sparite dal banco e l'unica traccia era il
-- magazzino.
--
-- LA REGOLA E' QUELLA DELLE VENDITE: una riga non si cancella, si mette
-- nel cestino, da cui si ripristina per sei mesi. Stesso impianto
-- (`vendite_cestino`, `vendita_cestina`, `vendita_ripristina`), stesse
-- parole, cosi' chi legge un pezzo ha capito anche l'altro.
--
-- LA COPIA E' LA RIGA INTERA IN JSONB, non colonna per colonna: il
-- giorno che `clienti_registrati` prende una colonna nuova, una copia
-- fatta a colonne la perderebbe in silenzio — e un ripristino che
-- restituisce una scheda incompleta e' peggio di nessun ripristino.
-- Accanto restano quattro campi in chiaro (nome, cognome, email,
-- telefono) perche' il cestino si deve poter leggere e cercare senza
-- aprire il jsonb.

create table if not exists public.clienti_cestino (
  -- lo stesso id dell'originale: ripristinando, la scheda torna con il
  -- suo identificativo, non con uno nuovo
  id uuid primary key,
  nome text,
  cognome text,
  email text,
  telefono text,
  riga jsonb not null,
  cestinato_il timestamptz not null default now(),
  cestinato_da text,
  motivo text
);

create index if not exists clienti_cestino_quando on public.clienti_cestino (cestinato_il desc);

alter table public.clienti_cestino enable row level security;
drop policy if exists "clienti cestino: accesso staff" on public.clienti_cestino;
create policy "clienti cestino: accesso staff" on public.clienti_cestino
  for all to authenticated using (true) with check (true);

-- CESTINA: copia e cancella, nella stessa transazione. Se la copia non
-- riesce la riga non si cancella, e viceversa: le due cose non possono
-- restare a meta' (vedi «Scritture in sequenza -> transazione»).
create or replace function public.cliente_cestina(p_id uuid, p_chi text default null, p_motivo text default null)
returns public.clienti_cestino
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_riga public.clienti_registrati;
  v_fuori public.clienti_cestino;
begin
  select * into v_riga from public.clienti_registrati where id = p_id;
  if not found then
    raise exception 'Questo cliente non c''e'' piu'': forse l''ha gia'' cancellato qualcun altro.';
  end if;

  insert into public.clienti_cestino (id, nome, cognome, email, telefono, riga, cestinato_da, motivo)
  values (
    v_riga.id, v_riga.nome, v_riga.cognome, v_riga.email, v_riga.telefono,
    to_jsonb(v_riga), nullif(btrim(coalesce(p_chi, '')), ''), nullif(btrim(coalesce(p_motivo, '')), '')
  )
  -- cestinato, ripristinato e ricestinato: la copia nuova sostituisce la
  -- vecchia, non fa fallire il gesto
  on conflict (id) do update set
    nome = excluded.nome, cognome = excluded.cognome, email = excluded.email,
    telefono = excluded.telefono, riga = excluded.riga,
    cestinato_il = now(), cestinato_da = excluded.cestinato_da, motivo = excluded.motivo
  returning * into v_fuori;

  delete from public.clienti_registrati where id = p_id;
  return v_fuori;
end;
$$;

-- RIPRISTINA: rimette la riga com'era e svuota la sua copia.
--
-- Il caso che conta: mentre la scheda era nel cestino, qualcuno ha
-- registrato di nuovo la stessa persona. L'indice unico sull'identita'
-- (nome + cognome + email + telefono) rifiuta il ripristino, ed e'
-- giusto: due schede della stessa persona sono il problema che quell
-- indice esiste per evitare. Qui l'errore si traduce in una frase che
-- dice cosa fare, invece di un codice.
create or replace function public.cliente_ripristina(p_id uuid)
returns public.clienti_registrati
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_copia public.clienti_cestino;
  v_tornata public.clienti_registrati;
begin
  select * into v_copia from public.clienti_cestino where id = p_id;
  if not found then
    raise exception 'Questa scheda non e'' nel cestino.';
  end if;

  begin
    insert into public.clienti_registrati
    select * from jsonb_populate_record(null::public.clienti_registrati, v_copia.riga)
    returning * into v_tornata;
  exception when unique_violation then
    raise exception 'Non la rimetto: % % risulta gia'' registrato con la stessa email e lo stesso telefono. Se sono due persone diverse, cambia un contatto; se e'' la stessa, la scheda in archivio e'' quella buona e questa si puo'' lasciare nel cestino.',
      coalesce(v_copia.nome, ''), coalesce(v_copia.cognome, '');
  end;

  delete from public.clienti_cestino where id = p_id;
  return v_tornata;
end;
$$;

revoke all on function public.cliente_cestina(uuid, text, text) from public, anon;
revoke all on function public.cliente_ripristina(uuid) from public, anon;
grant execute on function public.cliente_cestina(uuid, text, text) to authenticated;
grant execute on function public.cliente_ripristina(uuid) to authenticated;

comment on function public.cliente_cestina(uuid, text, text) is
  'Mette un cliente registrato nel cestino: copia la riga intera in clienti_cestino e la cancella, nella stessa transazione. Si ripristina con cliente_ripristina per sei mesi.';
comment on function public.cliente_ripristina(uuid) is
  'Rimette in archivio una scheda dal cestino. Se nel frattempo la stessa persona e'' stata registrata di nuovo, rifiuta e lo spiega: l''indice sull''identita'' esiste per non avere due schede della stessa persona.';

-- SI SVUOTA DA SE' DOPO SEI MESI, come il cestino delle vendite (che gira
-- alle 04:20). Sei mesi perche' e' la finestra che il titolare ha scelto
-- allora, e due cestini con due scadenze diverse sarebbero due regole da
-- ricordare.
select cron.schedule(
  'clienti-cestino-svuota',
  '25 4 * * *',
  $cron$delete from public.clienti_cestino where cestinato_il < now() - interval '6 months'$cron$
);
