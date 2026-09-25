-- L'indirizzo lungo di Stripe sta qui, e nel QR ci va solo il codice
-- corto: e' tutto il senso dell'indirizzo accorciato.
alter table pagamenti_pos add column if not exists stripe_session_url text;
