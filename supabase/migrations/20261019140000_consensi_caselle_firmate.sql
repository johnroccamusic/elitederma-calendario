-- LE DICHIARAZIONI SPUNTATE, UNA PER UNA.
--
-- Fino a oggi un consenso aveva due booleani: `consenso_trattamento`,
-- sempre vero, e `consenso_foto_video`. La casella che li produceva era
-- una sola e diceva tre cose insieme — «ho letto e compreso, le
-- informazioni sulla mia salute sono vere, e acconsento al trattamento».
--
-- Tre consensi distinti dentro una spunta sola sono esattamente cio' che
-- il GDPR non vuole: non si puo' dire a quale dei tre la persona abbia
-- davvero aderito, e manca del tutto quello che qui serve di piu' —
-- l'art. 9, il consenso esplicito al trattamento dei dati sulla SALUTE,
-- che e' proprio quello che il questionario raccoglie.
--
-- Da adesso ogni casella ha la sua chiave e il suo istante:
--   { "trattamento": {"r": true, "il": "..."}, "dati_salute": {...}, ... }
--
-- I due booleani restano, scritti come prima: li legge l'archivio, e
-- ventisei consensi gia' raccolti non hanno altro. Non si tocca cio' che
-- e' gia' stato firmato.
alter table public.consensi_modelle
  add column if not exists consensi jsonb;

comment on column public.consensi_modelle.consensi is
  'Le caselle spuntate, una per una, con il loro istante. Prima erano una spunta sola che ne diceva tre.';
