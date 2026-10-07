-- Applicata via MCP il 07/10/2026.
--
-- UN CODICE CON LE SUE REGOLE.
--
-- Fino a oggi lo sconto di un codice lo decidevano le tabelle generali:
-- quella dei corsi o quella del referral, con la loro serie per la carta e
-- quella per i contanti. Il codice portava scritta una copia delle fasce,
-- ma al banco vinceva sempre la tabella di oggi — ed e' giusto, perche'
-- una regola cambiata vale per tutti.
--
-- Serve pero' anche il contrario: un codice che fa storia a se'. Le sue
-- due tabelle — carta/shop e contanti — e le sue eccezioni per categoria,
-- tipo "sui needling 30% e basta".
--
-- `regole_proprie` e' l'interruttore: finche' e' falso non cambia niente
-- per nessuno, e il codice continua a seguire le tabelle generali.
alter table coupon
  add column if not exists regole_proprie boolean not null default false,
  add column if not exists fasce_sconto_contanti jsonb,
  add column if not exists eccezioni_categoria jsonb;

comment on column coupon.regole_proprie is
  'Se vero, al banco valgono le tabelle scritte su QUESTO codice e non quelle generali di Gestione punti.';
comment on column coupon.fasce_sconto_contanti is
  'La serie per contanti e buono Amazon, nella stessa forma di fasce_sconto: {soglie:[3], gruppi:[4 x 6]}. Vuota = si usa quella della carta.';
comment on column coupon.eccezioni_categoria is
  'Eccezioni per categoria: [{categoria_id, percentuale}]. Sui prodotti di quella categoria vale quella percentuale e le fasce non si guardano.';
