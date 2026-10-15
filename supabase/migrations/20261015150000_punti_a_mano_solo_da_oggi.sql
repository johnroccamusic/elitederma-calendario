-- I PUNTI SCRITTI A MANO VALGONO, MA SOLO DA OGGI.
--
-- In "Prezzi e listini" si puo' fissare quanti punti vale un prodotto,
-- al posto della formula. Dal 15/10/2026 il banco legge quel numero
-- (prima leggeva la formula e quello che si scriveva non arrivava mai),
-- ma i punti MATURATI continuavano a ricalcolarsi dalla formula: la
-- stessa vendita faceva 405 punti sulla riga del carrello e 403,28 nella
-- dashboard della master.
--
-- Ora coincidono. Ma solo da oggi in avanti: quello che e' gia' stato
-- maturato resta com'e'. Un punto gia' dato e' un punto gia' dato, e
-- cambiarlo a mesi di distanza perche' oggi si e' corretto un listino
-- vorrebbe dire muovere il saldo di qualcuno senza che abbia fatto
-- niente.
--
-- La data e' scritta qui dentro e non in un'impostazione perche' e' un
-- confine, non una manopola: si attraversa una volta sola.
--
-- Sui dati di oggi non cambia NIENTE: le uniche cinque righe storiche
-- che toccano un prodotto con punti scritti a mano sono tutte di
-- "Arizona" e tutte precedenti a oggi.
--
-- Il valore scritto a mano e' per PEZZO, quindi si moltiplica per la
-- quantita'. La quota degli scaglioni needling resta: e' una regola sul
-- carrello, non sul prodotto, e vale comunque.
do $$
declare
  def text;
  vecchio text;
  nuovo text;
begin
  def := pg_get_viewdef('v_punti_master_righe'::regclass, true);
  vecchio := 'round(segno::numeric * quantita * netto_allora * (sconto_max_pct / 100.0) * 2::numeric * (quota_punti_pct / 100.0), 2) AS punti';
  nuovo := '
        CASE
            WHEN data_ordine::date >= DATE ''2026-10-15''
             AND (SELECT ps.punti_prodotto FROM prodotti_shop ps WHERE ps.id = prodotto_id) IS NOT NULL
            THEN round(segno::numeric * quantita
                   * (SELECT ps.punti_prodotto FROM prodotti_shop ps WHERE ps.id = prodotto_id)
                   * (quota_punti_pct / 100.0), 2)
            ELSE round(segno::numeric * quantita * netto_allora * (sconto_max_pct / 100.0) * 2::numeric * (quota_punti_pct / 100.0), 2)
        END AS punti';
  if position(vecchio in def) = 0 then
    raise exception 'v_punti_master_righe: non trovo la formula dei punti, non tocco niente';
  end if;
  execute 'create or replace view v_punti_master_righe as ' || replace(def, vecchio, nuovo);
end $$;
