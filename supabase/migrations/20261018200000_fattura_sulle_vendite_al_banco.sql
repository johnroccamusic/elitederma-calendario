-- 18/10/2026 — La fattura di una vendita col terminale fisico.
--
-- Fino a oggi l'unica strada per emettere una fattura dall'app passava
-- da `pagamenti_pos`, che e' la tabella dei pagamenti col QR di Stripe:
-- una vendita pagata col terminale al banco non arrivava in nessuna
-- lista, anche con "richiede fattura" spuntato. Da qui in avanti ci
-- arriva, e il documento emesso resta scritto sulla vendita come gia'
-- succede per i pagamenti Stripe.
--
-- Contanti e buono Amazon restano fuori per decisione del titolare: in
-- quella lista entrano solo gli incassi a carta.
alter table public.vendite_shop
  add column if not exists fattura_fic_id bigint,
  add column if not exists fattura_numero text,
  add column if not exists fattura_emessa_il timestamptz,
  add column if not exists fattura_errore text,
  add column if not exists fattura_manuale boolean not null default false;

comment on column public.vendite_shop.fattura_numero is
  'Numero della fattura emessa per questa vendita al banco. Nullo = non ancora fatturata.';
comment on column public.vendite_shop.fattura_manuale is
  'true se il numero e'' stato trascritto a mano perche'' la fattura e'' stata fatta fuori dall''app.';
