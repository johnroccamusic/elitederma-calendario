-- ---------------------------------------------------------
-- Chiusura corso — le fondamenta.
--
-- Il sistema nuovo poggia su una sola formula:
--   atteso in rientro = spedito da Raf − consumato dichiarato
-- perché regga servono tre cose che oggi non ci sono.
--
-- 1) UN LEGAME VERO FRA ALLIEVO E KIT. iscritti.pacchetto_kit è una COPIA
--    del nome del kit, scritta all'iscrizione: il collegamento si rifà ogni
--    volta cercando un kit con lo stesso nome nello stesso corso. Oggi
--    funziona (164 iscritti su 164 si risolvono), ma basta spostare un kit
--    di corso e l'allievo resta senza distinta — e nel sistema nuovo, dove
--    il rientro è una sottrazione, un nome che non si risolve azzera in
--    silenzio il kit di quell'allievo e falsa la bolla. Il testo resta:
--    è la memoria di cosa fu venduto, e non deve cambiare se il kit viene
--    rinominato domani.
--
-- 2) UNA FOTOGRAFIA DI COSA È PARTITO. Il numero di kit oggi si ricalcola
--    dal vivo sugli iscritti: un allievo aggiunto dopo la partenza del
--    pacco cambia retroattivamente anche "quanto era stato spedito". La
--    bolla di rientro non può poggiare su un numero che si muove: alla
--    partenza si scatta una fotografia e da lì in poi quella vale.
--
-- 3) LA MERCE DA VENDITA, DISTINTA DAL MATERIALE DIDATTICO. Raf spedisce
--    al corso anche pigmenti e accessori destinati alla vendita. Oggi
--    finiscono fra i "prodotti extra kit", indistinguibili dal resto: senza
--    quella distinzione non si può far scendere l'atteso a ogni incasso.
--    Sono pezzi che restano NOSTRI finché non si vendono — quindi non
--    scaricano il magazzino alla spedizione, lo scaricano alla vendita.
-- ---------------------------------------------------------

-- 1) allievo → kit
alter table public.iscritti
  add column if not exists kit_id uuid references public.kit_definizioni(id) on delete set null;

comment on column public.iscritti.kit_id is
  'il kit scelto dall''allievo. pacchetto_kit resta il nome com''era al momento della vendita';

create index if not exists idx_iscritti_kit on public.iscritti (kit_id) where kit_id is not null;

-- riempie il legame per chi ce l'ha già, senza inventare: solo dove il nome
-- corrisponde esattamente a un kit dello stesso corso
update public.iscritti i
   set kit_id = k.id
  from public.corsi_date cd, public.kit_definizioni k
 where cd.id = i.corso_data_id
   and k.corso_id = cd.corso_id
   and k.nome = i.pacchetto_kit
   and i.kit_id is null;

-- 2) e 3) sull'edizione
alter table public.logistica_kit_edizioni
  add column if not exists extra_da_vendita jsonb not null default '{}'::jsonb,
  add column if not exists dermografi_riserva jsonb not null default '{}'::jsonb,
  add column if not exists spedizione_snapshot jsonb,
  add column if not exists spedizione_snapshot_ts timestamptz;

comment on column public.logistica_kit_edizioni.extra_da_vendita is
  'prodottoId -> true per gli extra destinati alla vendita al corso: non scaricano alla spedizione, scaricano alla vendita';
comment on column public.logistica_kit_edizioni.dermografi_riserva is
  'modello -> quantità di dermografi spediti in più rispetto a quelli assegnati agli allievi';
comment on column public.logistica_kit_edizioni.spedizione_snapshot is
  'cosa è partito davvero: kit, allievi, dermografi, accessori, merce da vendita. Congelato quando il pacco parte';

-- 4) le due indicazioni sulle vendite al corso
alter table public.vendite_shop
  add column if not exists prelevato_dai_kit boolean not null default false,
  add column if not exists consegnato_in_aula boolean;

comment on column public.vendite_shop.prelevato_dai_kit is
  'il pezzo venduto è stato preso da un kit presente in aula: era già uscito dal magazzino con la spedizione, quindi non si scarica di nuovo — si toglie dall''atteso di rientro';
comment on column public.vendite_shop.consegnato_in_aula is
  'true consegnato subito, false da spedire (finisce in spedizioni_pos). null per le vendite che non nascono a un corso';
