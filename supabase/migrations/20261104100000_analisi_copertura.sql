-- DA QUANDO ESISTONO I DATI, MISURATO E NON SCRITTO A MANO (4/11/2026).
--
-- Nasce da un caso vero. Chiara ha chiesto all'assistente quanti pigmenti
-- fossero stati venduti «da luglio» e si e' sentita rispondere «900 e
-- passa». Il conto non era sbagliato: 936 boccette e' il totale di
-- GENNAIO-NOVEMBRE, non di luglio in poi (da luglio sono 274). Sbagliava
-- il PERIODO, e non lo diceva — che e' il modo peggiore, perche' una
-- risposta plausibile con dentro il periodo sbagliato non la mette in
-- dubbio nessuno.
--
-- Il guaio piu' grosso, pero', e' che le fonti NON cominciano insieme:
--
--   shop online ............. dal 15/03/2022   (4.250 ordini)
--   incassi di prodotti ..... dal 15/03/2022
--   acconti dei corsi ....... dal 30/08/2025
--   spese ................... dal 02/07/2026
--   iscrizioni .............. dal 29/07/2026
--   classi in calendario .... dal 08/08/2026
--   pre corso e saldi ....... dal 16/09/2026
--   vendite al banco ........ dal 05/09/2026   (129 scontrini)
--
-- Quattro anni e mezzo fra la fonte piu' vecchia e la piu' giovane.
-- Chiedere oggi «com'e' andato maggio» restituisce una risposta che
-- SEMBRA completa e contiene solo lo shop; confrontare il 2024 col 2026
-- vuol dire confrontare un canale con sette.
--
-- PERCHE' UNA VISTA E NON UN ELENCO NEL PROMPT. Le date scritte a mano
-- in un prompt invecchiano senza che nessuno se ne accorga: il giorno
-- che si importa lo storico del banco, o che arriva una fonte nuova,
-- resterebbero quelle di oggi e l'assistente direbbe una cosa falsa con
-- l'aria di saperla. Qui si misurano a ogni domanda, dal dato stesso.
--
-- Non contiene nessun importo e nessun dato personale: solo nomi di
-- fonte, due date e un conteggio di righe. Per questo la vede chiunque
-- abbia fatto accesso (`permessi: []` in _shared/analisi.js).

create or replace view public.analisi_copertura as
  select
    'vendite al banco'::text as fonte,
    'analisi_vendite, analisi_vendite_righe (canale = ''banco'')'::text as viste,
    min(data)::date as dal,
    max(data)::date as al,
    count(*)::bigint as righe
  from public.analisi_vendite where canale = 'banco'

  union all
  select
    'vendite shop online',
    'analisi_vendite, analisi_vendite_righe (canale = ''shop online'')',
    min(data)::date, max(data)::date, count(*)::bigint
  from public.analisi_vendite where canale = 'shop online'

  -- gli incassi si spezzano per fonte perche' le quattro finestre sono
  -- lontanissime fra loro: i prodotti dal 2022, i saldi dei corsi da
  -- settembre 2026. Un unico «incassi dal 2022» sarebbe vero e
  -- ingannevole insieme.
  union all
  select
    'incassi — ' || fonte,
    'analisi_incassi (fonte = ''' || fonte || ''')',
    min(data)::date, max(data)::date, count(*)::bigint
  from public.analisi_incassi group by fonte

  union all
  select 'spese', 'analisi_spese', min(data)::date, max(data)::date, count(*)::bigint
  from public.analisi_spese

  union all
  select 'iscrizioni ai corsi', 'analisi_iscrizioni', min(data_iscrizione)::date, max(data_iscrizione)::date, count(*)::bigint
  from public.analisi_iscrizioni

  union all
  select 'classi in calendario', 'analisi_calendario, analisi_edizioni', min(data_inizio)::date, max(data_inizio)::date, count(*)::bigint
  from public.analisi_calendario;

-- security_invoker: la vista gira coi permessi di chi la interroga, come
-- le altre viste di analisi dopo il controllo del 31/10/2026. Niente
-- SELECT per `anon`.
alter view public.analisi_copertura set (security_invoker = true);

revoke all on public.analisi_copertura from anon;
grant select on public.analisi_copertura to authenticated;
-- la legge anche `analisi_esegui`, che gira come proprietario per conto
-- delle edge function
grant select on public.analisi_copertura to service_role;

comment on view public.analisi_copertura is
  'Da quando esistono i dati, fonte per fonte, misurato a ogni lettura. Serve all''assistente per dichiarare il periodo su cui ha contato e cosa resta fuori: le fonti non cominciano insieme (shop dal 2022, banco da settembre 2026) e un totale senza questa avvertenza sembra completo e non lo e''.';
