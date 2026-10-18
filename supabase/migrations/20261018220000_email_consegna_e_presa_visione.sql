-- LA RICEVUTA DI UNA MAIL, IN DUE MODI CHE NON SI SOSTITUISCONO.
--
-- 1) QUELLO CHE DICE IL POSTINO. Resend sa se il messaggio e' stato
--    consegnato alla casella, se e' stato aperto, se e' rimbalzato: sono
--    fatti tecnici, arrivano da soli e nessuno deve fare niente. Dicono
--    che la mail e' arrivata, non che qualcuno l'abbia letta — l'apertura
--    si misura con un'immagine invisibile, che molti programmi bloccano:
--    "non aperta" non vuol dire "non letta".
--
-- 2) QUELLO CHE DICE L'ALLIEVA. Un tasto nella mail, che lei preme: da
--    quel momento c'e' scritto che ha dichiarato di aver ricevuto il
--    modulo firmato. Questa e' l'unica delle due che vale davanti a una
--    contestazione, ed e' il motivo per cui ce ne vogliono due.
--
-- Il gettone sta sulla RIGA DELL'INVIO, non sull'iscritto: se la mail si
-- rimanda, il nuovo invio ha il suo gettone e la sua conferma, e si
-- vede quale delle due copie e' stata presa in carico.
alter table public.email_inviate
  add column if not exists consegnata_il   timestamptz,
  add column if not exists aperta_il       timestamptz,
  add column if not exists rimbalzata_il   timestamptz,
  add column if not exists ultimo_evento   text,
  add column if not exists token_conferma  text,
  add column if not exists confermata_il   timestamptz;

comment on column public.email_inviate.consegnata_il is 'Resend: accettata dal server di posta del destinatario';
comment on column public.email_inviate.aperta_il is 'Resend: pixel aperto. Un mancato valore NON significa non letta';
comment on column public.email_inviate.confermata_il is 'L''allieva ha premuto il tasto di presa visione: e'' questa che vale';

-- un gettone per riga, e si cerca per gettone quando torna la conferma
create unique index if not exists email_inviate_token_conferma_idx
  on public.email_inviate (token_conferma) where token_conferma is not null;
