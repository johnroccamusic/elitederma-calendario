-- IL TEST DI SISTEMA GIRA DA SOLO OGNI NOTTE (24/11/2026).
--
-- Il titolare, poche ore dopo averlo chiesto a mano: «fallo girare da
-- solo ogni notte».
--
-- PERCHE' LO STORICO VIENE PRIMA DELL'AVVISO. Un sorvegliante che avvisa
-- e non scrive niente lascia una domanda senza risposta — «da quando e'
-- cosi'?» — che e' la prima che si fa davanti a un guasto. Qui il referto
-- di ogni notte resta: da li' si vede il giorno in cui un controllo e'
-- passato da verde a rotto, e quello e' il giorno in cui qualcosa e'
-- cambiato.
--
-- E L'AVVISO PARTE SOLO PER QUELLO CHE E' NUOVO. La lezione e' di
-- `sync-shop-vigilanza` (2/11/2026): «un avviso ripetuto ogni quarto
-- d'ora e' un avviso che si spegne». Dieci scostamenti di magazzino che
-- durano da una settimana non devono svegliare nessuno ogni mattina:
-- si avvisa quando un controllo DIVENTA rotto, e si ricorda una volta a
-- settimana se e' ancora rotto.
--
-- ALLE 06:20, e l'ora non e' casuale: dopo il controllo dei saldi
-- (05:15), il riallineamento del sito (05:30) e il termometro (05:45),
-- perche' sono loro a produrre i numeri che il test legge. Girando prima
-- leggerebbe la fotografia di ieri e direbbe «a posto» su un magazzino
-- che nessuno ha ancora ricontato.

create table if not exists public.test_sistema_esiti (
  id bigserial primary key,
  ts timestamptz not null default now(),
  -- il referto intero: una riga per controllo, come l'ha prodotto
  -- `test_di_sistema()` quella notte
  referto jsonb not null,
  quanti_ok integer not null default 0,
  quanti_guarda integer not null default 0,
  quanti_rotti integer not null default 0,
  -- i controlli rotti che la notte prima NON lo erano: sono quelli per
  -- cui vale la pena svegliare qualcuno
  rotti_nuovi text[] not null default '{}',
  avvisato boolean not null default false,
  avviso_errore text
);

alter table public.test_sistema_esiti enable row level security;
drop policy if exists "test_sistema_esiti accesso staff" on public.test_sistema_esiti;
create policy "test_sistema_esiti accesso staff" on public.test_sistema_esiti
  for select to authenticated using (true);

create index if not exists test_sistema_esiti_ts on public.test_sistema_esiti (ts desc);

-- IL GIRO NOTTURNO.
--
-- Scrive il referto PRIMA di provare ad avvisare: se la mail non parte, il
-- referto c'e' comunque — e il contrario (avvisare e non registrare)
-- lascerebbe un allarme senza niente da guardare.
create or replace function public.test_di_sistema_notturno()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_referto jsonb;
  n_ok integer; n_guarda integer; n_rotti integer;
  rotti text[]; rotti_prima text[]; nuovi text[];
  ultimo_avviso timestamptz;
  chiave text; gettone text;
  id_riga bigint;
begin
  -- LE VARIABILI NON SI CHIAMANO COME LE COLONNE, e in questa giornata
  -- l'ho imparato due volte: «esito» nel test e «referto» qui rendono la
  -- query ambigua (42702) e la funzione si rifiuta di girare — non alla
  -- scrittura, al primo giro. Da cui il prefisso `v_`.
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_referto from test_di_sistema() t;

  select count(*) filter (where x->>'esito' = 'ok'),
         count(*) filter (where x->>'esito' = 'guarda'),
         count(*) filter (where x->>'esito' = 'rotto'),
         coalesce(array_agg(x->>'controllo') filter (where x->>'esito' = 'rotto'), '{}')
    into n_ok, n_guarda, n_rotti, rotti
    from jsonb_array_elements(v_referto) x;

  -- quello che era rotto l'ultima volta: un guasto che dura non e' una
  -- notizia nuova
  select coalesce(array_agg(x->>'controllo') filter (where x->>'esito' = 'rotto'), '{}')
    into rotti_prima
    from (select e.referto as r from test_sistema_esiti e order by e.ts desc limit 1) z,
         jsonb_array_elements(z.r) x;

  select coalesce(array_agg(c), '{}') into nuovi
    from unnest(rotti) c where c <> all(coalesce(rotti_prima, '{}'));

  -- e se e' rotto da giorni si ricorda una volta a settimana, perche'
  -- tacere per sempre su un guasto aperto e' l'altro modo di sbagliare
  select max(e.ts) into ultimo_avviso from test_sistema_esiti e where e.avvisato;

  insert into test_sistema_esiti (referto, quanti_ok, quanti_guarda, quanti_rotti, rotti_nuovi)
  values (v_referto, n_ok, n_guarda, n_rotti, nuovi)
  returning id into id_riga;

  if n_rotti > 0 and (array_length(nuovi, 1) > 0
                      or ultimo_avviso is null
                      or ultimo_avviso < now() - interval '7 days') then
    select decrypted_secret into chiave from vault.decrypted_secrets where name = 'referral_cron_anon_key' limit 1;
    select decrypted_secret into gettone from vault.decrypted_secrets where name = 'email_cron_token' limit 1;
    if chiave is null or gettone is null then
      update test_sistema_esiti set avviso_errore = 'chiave o gettone non trovati nel vault' where id = id_riga;
    else
      perform net.http_post(
        url := 'https://snhvvipszhfllrgemsdu.supabase.co/functions/v1/test-di-sistema-avviso',
        headers := jsonb_build_object('Content-Type', 'application/json',
                                      'Authorization', 'Bearer ' || chiave,
                                      'x-cron-token', gettone),
        body := jsonb_build_object('esito_id', id_riga),
        timeout_milliseconds := 60000);
      update test_sistema_esiti set avvisato = true where id = id_riga;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'id', id_riga, 'rotti', n_rotti,
                            'rotti_nuovi', nuovi, 'guarda', n_guarda, 'a_posto', n_ok);
end;
$$;

comment on function public.test_di_sistema_notturno() is
  'Giro notturno del test di sistema: scrive il referto e avvisa solo per i controlli diventati rotti (o una volta a settimana se restano rotti).';

revoke all on function public.test_di_sistema_notturno() from public, anon;
grant execute on function public.test_di_sistema_notturno() to authenticated;

-- IL LAVORO NOTTURNO. Alle 06:20: dopo i saldi (05:15), il
-- riallineamento (05:30) e il termometro (05:45), che sono quelli che
-- producono i numeri che il test legge.
select cron.schedule('test-di-sistema-notturno', '20 6 * * *',
                     $$select public.test_di_sistema_notturno()$$);

-- ROLLBACK
--   select cron.unschedule('test-di-sistema-notturno');
--   drop function if exists public.test_di_sistema_notturno();
--   drop table if exists public.test_sistema_esiti;   -- ATTENZIONE: butta lo storico dei referti
