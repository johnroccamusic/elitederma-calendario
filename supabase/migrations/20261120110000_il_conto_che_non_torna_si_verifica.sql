-- «VERIFICATO»: IL CONTO CHE NON TORNA SI CHIUDE CONTANDO LO SCAFFALE.
-- 20/11/2026.
--
-- Il titolare, davanti alle 84 righe di «I conti non tornano»: «metti un
-- tasto verificato vicino a ciascun prodotto per eliminare il prodotto
-- dalla lista una volta verificato il quantitativo in magazzino».
--
-- PERCHE' NON BASTA CANCELLARE LA RIGA. `controlla_saldi_magazzino()`
-- riscrive quell'elenco ogni notte alle 05:15 con un upsert: finche'
-- `saldo di partenza + somma dei movimenti` non coincide con la
-- giacenza, la riga torna il giorno dopo identica. Un tasto che cancella
-- e basta sarebbe un tasto che non fa niente, e il peggio e' che per una
-- notte sembrerebbe aver funzionato.
--
-- E C'E' DI PEGGIO, ED E' IL MOTIVO PER CUI QUESTA FUNZIONE ESISTE: una
-- rettifica normale NON chiude uno scostamento. `muoviStock` scrive la
-- giacenza E il movimento con lo stesso delta, quindi alza tutti e due i
-- numeri della stessa cifra e la differenza resta identica. Chi andava a
-- contare e correggeva il numero si ritrovava la riga ancora li', senza
-- capire perche'. Oggi non esiste nessun gesto che chiuda una di quelle
-- 84 righe.
--
-- COSA VUOL DIRE «VERIFICATO», ALLORA. Vuol dire: sono andato allo
-- scaffale e ho contato N pezzi. Da li' discendono due scritture, e una
-- sola delle due tocca il magazzino:
--
--   * la giacenza diventa N — e se N e' quella che c'era gia', non si
--     muove di un pezzo. E' il caso normale: si conferma il numero;
--   * a registro si scrive il movimento MANCANTE, `N - atteso`. Non e'
--     un movimento di merce: e' la riga che qualcuno non ha scritto
--     quando ha toccato quel numero da fuori, messa li' adesso con nome
--     e data. Da quel momento i due conti tornano e la riga sparisce per
--     sempre, non per una notte.
--
-- E' l'unico modo di chiudere uno scostamento, e non contraddice «il
-- controllo non corregge» della migrazione del 19/10: li' si vietava di
-- scrivere LA GIACENZA da un quarto punto, di nascosto, per far tacere
-- un allarme. Qui la giacenza la scrive una persona che ha contato, e
-- quello che si aggiunge e' una riga di REGISTRO, che e' esattamente il
-- pezzo che mancava.
--
-- L'ATTESO SI RICALCOLA QUI, NON ARRIVA DAL BROWSER. La riga che si
-- legge in pagina e' la fotografia delle 05:15: durante la giornata
-- vendite e corsi muovono tutti e due i numeri. Fidarsi di quella cifra
-- vorrebbe dire scrivere un movimento sbagliato — e sarebbe uno
-- scostamento nuovo creato dal tasto che serve a toglierli. Si blocca
-- prima la riga del prodotto (come fa `stock_muovi`), poi si somma.
--
-- Nessun dato toccato da questa migrazione: crea solo la funzione.
--
-- ROLLBACK:
--   drop function if exists public.magazzino_verifica(uuid, integer, text);
-- (i movimenti gia' scritti con origine 'verifica_magazzino' restano, e
--  devono restare: sono la storia di chi ha contato cosa.)

create or replace function public.magazzino_verifica(
  p_prodotto_id uuid,
  p_contato integer,
  p_chi text default null
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_nome text;
  v_quantita integer;
  v_base_quantita integer;
  v_base_il timestamptz;
  v_atteso integer;
  v_delta integer;
begin
  if p_contato is null or p_contato < 0 then
    return jsonb_build_object('ok', false, 'motivo', 'conteggio_non_valido');
  end if;

  -- si blocca il prodotto PRIMA di sommare i movimenti: cosi' una vendita
  -- che sta scrivendo adesso o e' gia' dentro il conto, o aspetta noi
  select p.nome, coalesce(p.quantita, 0) into v_nome, v_quantita
    from prodotti_shop p where p.id = p_prodotto_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'non_trovato');
  end if;

  select b.quantita, b.fissato_il into v_base_quantita, v_base_il
    from magazzino_saldi_base b where b.prodotto_id = p_prodotto_id;

  if not found then
    -- il controllo notturno non ha ancora visto questo prodotto. Un
    -- conteggio vero e' il miglior saldo di partenza che possa avere:
    -- si fissa su di lui, e non c'e' nessun movimento da recuperare.
    insert into magazzino_saldi_base (prodotto_id, quantita, fissato_il, nota)
    values (p_prodotto_id, p_contato, now(),
            'contato in magazzino' || coalesce(' da ' || p_chi, ''));
    if p_contato <> v_quantita then
      update prodotti_shop set quantita = p_contato where id = p_prodotto_id;
    end if;
    delete from magazzino_scostamenti where prodotto_id = p_prodotto_id;
    return jsonb_build_object('ok', true, 'nome', v_nome, 'atteso', p_contato,
      'quantita_prima', v_quantita, 'contato', p_contato, 'delta', 0,
      'giacenza_cambiata', p_contato <> v_quantita, 'saldo_fissato', true);
  end if;

  v_atteso := v_base_quantita + coalesce((
    select sum(m.delta) from movimenti_magazzino m
     where m.prodotto_id = p_prodotto_id and m.ts > v_base_il), 0);

  v_delta := p_contato - v_atteso;

  if p_contato <> v_quantita then
    update prodotti_shop set quantita = p_contato where id = p_prodotto_id;
  end if;

  if v_delta <> 0 then
    insert into movimenti_magazzino (prodotto_id, delta, origine, nota, utente)
    values (p_prodotto_id, v_delta, 'verifica_magazzino',
            'Contati ' || p_contato || ' pezzi in magazzino. A registro ne risultavano '
              || v_atteso || ', in giacenza ' || v_quantita
              || '. Questo movimento e'' la riga che mancava, non merce che si muove.',
            p_chi);
  end if;

  delete from magazzino_scostamenti where prodotto_id = p_prodotto_id;

  return jsonb_build_object('ok', true, 'nome', v_nome, 'atteso', v_atteso,
    'quantita_prima', v_quantita, 'contato', p_contato, 'delta', v_delta,
    'giacenza_cambiata', p_contato <> v_quantita, 'saldo_fissato', false);
end;
$$;

-- i grant di default su `public` danno EXECUTE ad `anon`: va tolto a mano,
-- e la migrazione che lo dichiara non basta — si rilegge `pg_proc.proacl`
revoke execute on function public.magazzino_verifica(uuid, integer, text) from public, anon;
grant  execute on function public.magazzino_verifica(uuid, integer, text) to authenticated;

comment on function public.magazzino_verifica(uuid, integer, text) is
  'Chiude uno scostamento contando lo scaffale: scrive la giacenza contata e, a registro, il movimento che mancava. L''atteso si ricalcola qui dentro, non arriva dal chiamante.';
