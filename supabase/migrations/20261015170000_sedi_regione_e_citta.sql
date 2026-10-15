-- REGIONE E CITTA', SU OGNI CORSO.
--
-- L'obiettivo e' una statistica per zona: dove c'e' piu' richiesta, dove
-- conviene aprire. Oggi non si puo' fare — della sede si sa solo
-- `location.nome`, che *e'* la citta' (ROMA, BARI) ma e' testo libero, e
-- di regione non c'e' traccia.
--
-- E serve anche alla master: citta', indirizzo e telefono del referente
-- sulla scheda del corso, per arrivarci e per chiamare se non ci arriva.
--
-- DUE POSTI, NON UNO.
--
-- Su `location` perche' una sede registrata il suo dato pulito ce l'ha
-- una volta sola, e lo eredita ogni edizione.
--
-- Su `corsi_date` perche' quello e' il dato DI QUEL CORSO, e non deve
-- cambiare piu'. Se fra un anno PUGLIAFORM trasloca, le edizioni del
-- 2026 devono continuare a dire dov'erano davvero: e' la stessa regola
-- degli importi congelati. Si riempie sempre, anche con una sede
-- registrata.
--
-- LE SEDI OCCASIONALI RESTANO RIGHE `location`, ma nascoste.
-- `location_id` su `corsi_date` e' NOT NULL ed e' letto in 124 punti —
-- costi di sala, magazzino locale, inventari, riepiloghi. Renderlo
-- facoltativo voleva dire rivederli tutti. `solo_edizione` dice "nata
-- per una volta sola": la riga esiste e tiene in piedi costi e
-- statistiche, ma non compare nell'elenco delle sedi.

alter table location
  add column if not exists regione text,
  add column if not exists citta text,
  add column if not exists solo_edizione boolean not null default false;

alter table corsi_date
  add column if not exists regione text,
  add column if not exists citta text,
  add column if not exists indirizzo text,
  add column if not exists telefono text,
  add column if not exists sede_occasionale boolean not null default false;

-- La citta' delle sedi esistenti e' gia' in `nome`.
update location set citta = nome where citta is null and nome is not null;

-- La regione delle venti sedi di oggi, scritta a mano una volta.
-- Non si deduce in SQL: la tabella comune->regione vive nel bundle
-- (src/comuni-regioni.js) e di qui non si raggiunge. Da qui in avanti la
-- compila l'app, che quella tabella ce l'ha.
-- Le grafie sono quelle di REGIONI, o la tendina non ritroverebbe il
-- valore salvato.
update location set regione = m.reg from (values
  ('BARI','Puglia'), ('BOLOGNA','Emilia-Romagna'), ('CAGLIARI','Sardegna'),
  ('CATANIA','Sicilia'), ('CIVITELLA ROVETO','Abruzzo'), ('FIRENZE','Toscana'),
  ('GENOVA','Liguria'), ('MILANO','Lombardia'), ('NAPOLI','Campania'),
  ('PALERMO','Sicilia'), ('PESCARA','Abruzzo'), ('REGGIO CALABRIA','Calabria'),
  ('ROMA','Lazio'), ('UDINE','Friuli-Venezia Giulia'), ('VELLETRI','Lazio'),
  ('VERONA','Veneto')
) as m(citta, reg)
where regione is null and upper(trim(location.nome)) = m.citta;

-- Le edizioni gia' a calendario prendono il dato dalla loro sede: senza,
-- la scheda della master resterebbe vuota su tutto lo storico e la
-- statistica per zona partirebbe da domani invece che da sempre.
update corsi_date cd set
  regione = coalesce(cd.regione, l.regione),
  citta = coalesce(cd.citta, l.citta),
  indirizzo = coalesce(cd.indirizzo, l.indirizzo),
  telefono = coalesce(cd.telefono, l.telefono)
from location l
where l.id = cd.location_id
  and (cd.regione is null or cd.citta is null or cd.indirizzo is null or cd.telefono is null);

create index if not exists corsi_date_regione on corsi_date (regione);
create index if not exists corsi_date_citta on corsi_date (citta);
