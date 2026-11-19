-- IL COSTO DI UN KIT, E UN CORSO CHE MANCAVA SU DUE RIGHE SU TRE (3/11/2026).
--
-- Il titolare, provando l'assistente: «se gli dico di cercare quanto costa
-- il kit di un corso non va a guardare bene nell'app e non scopre che
-- esiste un'area costi kit… è molto meccanico, non ragiona». Guardando il
-- registro delle domande, il modello aveva ragionato benissimo: aveva
-- scritto da solo la query giusta (kit, articoli, pezzi, somma dei costi,
-- quanti senza costo) e il database gli ha risposto ZERO RIGHE. Poi ha
-- detto l'unica cosa che poteva dire: «per PMU Base non ho trovato nessun
-- kit».
--
-- IL DIFETTO ERA NELLA VISTA, non nel modello. In `analisi_kit_prodotti`
-- il corso veniva letto da `corsi_kit_prodotti.corso_id`, che e'
-- valorizzato solo sulle righe degli ACCESSORI: per il contenuto dei kit
-- il corso sta sulla definizione del kit. Risultato: corso nullo su 957
-- righe su 1565, e «dammi il kit di PMU BASE» tornava 34 righe (i soli
-- accessori) invece di 270. Una vista che perde il 61% del collegamento
-- non fa sbagliare il modello: lo fa mentire.
--
-- La lezione, che vale oltre questo caso: quando l'assistente «non
-- ragiona», prima di riscrivere il prompt si guarda la query che ha
-- scritto e si esegue a mano. Qui la query era giusta.
create or replace view public.analisi_kit_prodotti as
select p.id,
  k.nome as kit,
  -- il corso di una riga di kit e' quello del KIT; solo gli accessori
  -- della didattica lo portano scritto sulla riga
  coalesce(ck.nome, cp.nome) as corso,
  p.tipo,
  pr.nome as prodotto, pr.sku, p.quantita
from public.corsi_kit_prodotti p
left join public.kit_definizioni k on k.id = p.kit_id
left join public.corsi ck on ck.id = k.corso_id
left join public.corsi cp on cp.id = p.corso_id
left join public.prodotti_shop pr on pr.id = p.prodotto_id;

-- E LA DOMANDA «QUANTO COSTA QUEL KIT» HA UNA VISTA SUA. Si potrebbe
-- comporre unendo il contenuto dei kit ai costi dei prodotti, ma sono due
-- aree con due permessi diversi e il conto andrebbe rifatto a ogni
-- domanda: una vista sola risponde in una riga, e soprattutto risponde
-- SEMPRE ALLO STESSO MODO di «Costo dei kit» in Gestione magazzino
-- (`SezioneCostoKit` + `costoUnitario`), che e' il numero che il titolare
-- vede in app. Due conti diversi sullo stesso materiale darebbero due
-- cifre, e quella sbagliata sarebbe sempre quella che si guarda.
--
-- Un prodotto senza costo d'acquisto NON vale zero: resta fuori dal
-- totale, si conta e si nomina. Sommare zeri farebbe sembrare il kit piu'
-- economico di quello che e' — lo stesso errore che il Bilancio del corso
-- ha gia' imparato a non fare.
create or replace view public.analisi_kit_costi as
select k.id,
  k.nome as kit,
  c.nome as corso,
  count(p.id) as articoli,
  coalesce(sum(p.quantita), 0) as pezzi,
  round(sum(pr.costo_acquisto * p.quantita) filter (where pr.costo_acquisto is not null), 2) as costo_materiale,
  round(sum(pr.costo_acquisto * (1 + coalesce(pr.aliquota_iva_acquisto, 22) / 100.0) * p.quantita)
        filter (where pr.costo_acquisto is not null), 2) as costo_materiale_ivato,
  count(p.id) filter (where pr.costo_acquisto is null) as articoli_senza_costo,
  string_agg(pr.nome, ' · ' order by pr.nome) filter (where pr.costo_acquisto is null) as senza_costo
from public.kit_definizioni k
left join public.corsi c on c.id = k.corso_id
left join public.corsi_kit_prodotti p on p.kit_id = k.id
left join public.prodotti_shop pr on pr.id = p.prodotto_id
where coalesce(k.tipo, 'kit') = 'kit'
group by k.id, k.nome, c.nome;

grant select on public.analisi_kit_costi to analisi_lettore;
revoke all on public.analisi_kit_costi from anon, authenticated;
