-- Fra l'incasso e la fattura ci va una persona.
--
-- Una fattura emessa non si annulla: si fa una nota di credito. Se la
-- cliente sbaglia a digitare il codice destinatario e la fattura parte
-- da sola, il pasticcio e' gia' fatto. Quindi il pagamento arriva,
-- porta con se' i dati che ha scritto lei, e si ferma in
-- "da_verificare" finche' qualcuno non li guarda e conferma dall'app.
--
-- Gli stati: in_attesa (QR mostrato, nessuno ha ancora pagato) →
-- da_verificare (pagato, dati raccolti, fattura da emettere) →
-- fatturato. Fuori strada: scaduto, annullato.
alter table pagamenti_pos
  add column if not exists verificato_il timestamptz,
  add column if not exists verificato_da text;

alter table pagamenti_pos drop constraint if exists pagamenti_pos_stato_valido;
alter table pagamenti_pos add constraint pagamenti_pos_stato_valido
  check (stato in ('in_attesa', 'da_verificare', 'fatturato', 'scaduto', 'annullato'));

comment on column pagamenti_pos.stato is
  'in_attesa → da_verificare (pagato, dati raccolti) → fatturato. Fuori strada: scaduto, annullato.';
