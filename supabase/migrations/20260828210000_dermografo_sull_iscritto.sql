-- ---------------------------------------------------------
-- Il dermografo esce dai kit e diventa una scelta dell'iscritto.
--
-- Perché. Non tutti gli allievi prendono il dermografo e i modelli sono
-- due: tenerlo dentro il kit obbligava a un kit per ogni combinazione
-- (pro con Tekna, pro con Horus, pro senza…), e infatti i doppioni erano
-- già nati — "Pacchetto Pro vecchio con dermografo Tekna" e "…Horus",
-- "Kit Trico con dermografo Tekna", "…Horus" e "…senza dermografo".
-- La scelta sta sull'iscrizione, il kit resta uno solo.
--
-- Il dermografo NON è un componente del kit: resta una voce a sé in ogni
-- punto (preparazione, scarico, Advisor). È l'oggetto più costoso che
-- esce dal magazzino e non deve mai essere sottinteso.
--
-- Applicata il 28/08/2026. Le 16 righe di distinta tolte sono conservate
-- in corsi_kit_prodotti_dermografi_rimossi.
-- ---------------------------------------------------------

alter table public.iscritti add column if not exists dermografo text
  check (dermografo is null or dermografo in ('tekna', 'horus', 'nessuno'));

comment on column public.iscritti.dermografo is
  'Quale dermografo riceve questo allievo: tekna | horus | nessuno. Vuoto solo sulle iscrizioni storiche mai riaperte; sulle nuove è obbligatorio.';

-- le iscrizioni già in archivio prendono il modello dato di norma. Le
-- eccezioni (chi non lo riceve, chi ha l'Horus) si riconoscono dal nome
-- del pacchetto e si correggono a mano
update public.iscritti set dermografo = 'tekna' where dermografo is null;

-- copia di sicurezza delle righe di distinta che stiamo per togliere:
-- se la scelta si rivelasse sbagliata, si rimettono da qui
create table if not exists public.corsi_kit_prodotti_dermografi_rimossi as
  select ckp.*, now() as rimosso_il
  from public.corsi_kit_prodotti ckp
  join public.prodotti_shop p on p.id = ckp.prodotto_id
  where p.nome ilike '%dermografo%';

-- il dermografo esce dalle distinte: da qui in poi lo porta l'iscritto.
-- Senza questa cancellazione ogni allievo ne genererebbe due, uno dal kit
-- e uno dalla sua scheda
delete from public.corsi_kit_prodotti ckp
using public.prodotti_shop p
where p.id = ckp.prodotto_id and p.nome ilike '%dermografo%';

notify pgrst, 'reload schema';
