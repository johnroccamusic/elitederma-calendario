-- IL RECESSO ONLINE: le fondamenta.
--
-- Tre cose, e una correzione.
--
-- 1. DOVE SI CAMBIANO GLI INDIRIZZI E I NUMERI. `impostazioni_recesso`
--    e' una riga sola. Ci stanno la PEC a cui arriva il recesso, la mail
--    dell'amministrazione, e i due numeri di legge: 14 giorni per
--    recedere, 15 giorni sotto i quali si chiede l'avvio immediato.
--    Stanno nel database e non nel codice perche' vanno confermati dal
--    legale e cambieranno senza passare da una pubblicazione.
--
-- 2. IL GETTONE DEL RECESSO. Separato da quello del modulo: sono due
--    diritti diversi e uno si deve poter rifare senza toccare l'altro.
--
--    E NASCE DA `gen_random_bytes`, NON DA `random()`. Il gettone del
--    modulo oggi usa random(), che e' un generatore prevedibile: chi ne
--    vedesse qualcuno in fila potrebbe calcolare gli altri. Per un link
--    che apre i dati di un'allieva e' gia' debole; per uno che scioglie
--    un contratto non va bene. Qui si usa il generatore crittografico, e
--    la funzione del modulo viene rifatta sulla stessa base.
--
-- 3. IL RECESSO E IL SUO RIMBORSO SONO DUE TABELLE, non una. L'atto non
--    si tocca piu': niente policy di update o delete e un trigger che
--    rifiuta comunque. Il rimborso invece e' lavoro d'ufficio e si
--    scrive e si corregge. Tenerli insieme avrebbe voluto dire o un
--    atto modificabile o un rimborso che non si puo' segnare.

create table if not exists public.impostazioni_recesso (
  id                     boolean primary key default true check (id),
  pec_recesso            text,
  email_amministrazione  text,
  giorni_recesso         int not null default 14,
  giorni_avvio_immediato int not null default 15,
  aggiornato_il          timestamptz not null default now(),
  aggiornato_da          text
);

insert into public.impostazioni_recesso (id, pec_recesso)
values (true, 'elitedermasrl.pec@legalmail.it')
on conflict (id) do nothing;

alter table public.impostazioni_recesso enable row level security;
drop policy if exists "impostazioni_recesso_staff" on public.impostazioni_recesso;
create policy "impostazioni_recesso_staff" on public.impostazioni_recesso
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------- gettoni

-- 16 caratteri su un alfabeto di 32 senza I, L, O, U: 80 bit, sta su una
-- riga in una mail, e nessuno lo sbaglia leggendolo al telefono.
create or replace function public.gettone_sicuro()
returns text language plpgsql volatile as $$
declare
  alfabeto constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  byte int; fuori text := ''; i int;
  casuale bytea := gen_random_bytes(16);
begin
  for i in 0..15 loop
    byte := get_byte(casuale, i);
    fuori := fuori || substr(alfabeto, 1 + (byte % 32), 1);
  end loop;
  return fuori;
end;
$$;

-- il gettone del modulo passa allo stesso generatore
create or replace function public.gettone_modulo()
returns text language sql volatile as $$ select public.gettone_sicuro() $$;

alter table public.iscritti
  add column if not exists token_recesso text;

update public.iscritti set token_recesso = public.gettone_sicuro()
 where token_recesso is null;

alter table public.iscritti alter column token_recesso set default public.gettone_sicuro();

create unique index if not exists iscritti_token_recesso_unico
  on public.iscritti (token_recesso);

-- ---------------------------------------------------------------- l'atto

create table if not exists public.recessi (
  id            uuid primary key default gen_random_uuid(),
  iscritto_id   uuid not null references public.iscritti(id) on delete restrict,
  avvenuto_il   timestamptz not null default now(),
  motivo        text,
  ip            text,
  user_agent    text,
  token_usato   text,
  -- la fotografia di cosa si stava sciogliendo: fra due anni la scheda
  -- puo' essere cambiata, l'atto no
  corso_nome    text,
  corso_inizio  date,
  corso_fine    date,
  corso_citta   text,
  firmato_il    timestamptz,
  importo       numeric(12,2),
  dettaglio     jsonb
);

create unique index if not exists recessi_uno_per_iscritto
  on public.recessi (iscritto_id);

alter table public.recessi enable row level security;
drop policy if exists "recessi_leggi" on public.recessi;
create policy "recessi_leggi" on public.recessi for select to authenticated using (true);
-- nessuna policy di insert: ci scrive solo la funzione security definer.
-- nessuna di update o delete: non e' una dimenticanza.

create or replace function public.recesso_non_si_tocca()
returns trigger language plpgsql as $$
begin
  raise exception 'Un recesso registrato non si modifica e non si cancella.';
end;
$$;

drop trigger if exists recessi_immutabili on public.recessi;
create trigger recessi_immutabili
  before update or delete on public.recessi
  for each row execute function public.recesso_non_si_tocca();

-- ------------------------------------------------------------- il rimborso

create table if not exists public.recessi_rimborsi (
  recesso_id      uuid primary key references public.recessi(id) on delete restrict,
  effettuato_il   date,
  importo         numeric(12,2),
  metodo          text,
  note            text,
  segnato_da      text,
  aggiornato_il   timestamptz not null default now()
);

alter table public.recessi_rimborsi enable row level security;
drop policy if exists "recessi_rimborsi_staff" on public.recessi_rimborsi;
create policy "recessi_rimborsi_staff" on public.recessi_rimborsi
  for all to authenticated using (true) with check (true);

-- Applicate via MCP il 17/10/2026, nello stesso giro:
--   recesso_importo(iscritti)  l'importo da rimborsare, con le sue voci
--   recesso_vista(text)        quello che la pagina pubblica disegna
--   recesso_registra(...)      l'atto + il cambio di stato, in una
--                              transazione sola; eseguibile SOLO da
--                              service_role, cioe' solo dalla edge
--                              function: dal browser non si registra un
--                              recesso senza far partire gli avvisi.
--
-- 17/10/2026, dopo le risposte del titolare:
--   recesso_importo  guarda anche la DATA del pagamento: si rimborsa
--                    quello che e' entrato fino al recesso. Kit,
--                    materiali e dermografo si consegnano in aula,
--                    quindi al momento del recesso non c'e' niente di
--                    consegnato da scalare.
--   la terza mail al venditore e' stata tolta: lo avvisa
--   l'amministrazione, che e' gia' fra i destinatari.
