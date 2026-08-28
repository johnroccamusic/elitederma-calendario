-- ---------------------------------------------------------
-- Quali corsi prevedono il dermografo.
--
-- La scelta del dermografo (iscritti.dermografo) ha senso solo dove il
-- dermografo fa parte del percorso: su Laminazione, Extension, Gemme,
-- Henné, IKE e Micro non c'entra nulla, e chiederlo al venditore sarebbe
-- una domanda a cui rispondere per forza — con il rischio di lasciare il
-- valore di norma (Tekna) su un corso che un dermografo non lo consegna
-- affatto. Sono più di cento iscrizioni, e il dermografo è l'oggetto più
-- costoso che esce dal magazzino.
--
-- Acceso di default: un corso nuovo lo prevede, salvo dire il contrario.
-- Applicata il 28/08/2026: 14 corsi lo prevedono, 14 no.
-- ---------------------------------------------------------

alter table public.corsi add column if not exists prevede_dermografo boolean not null default true;

comment on column public.corsi.prevede_dermografo is
  'Se falso, la scheda iscritto non chiede il dermografo e il corso non ne genera fabbisogno.';

-- spento sulle famiglie che non lo prevedono, di gruppo o individuali
update public.corsi set prevede_dermografo = false
where nome ~* 'lamin|exten|gemme|henn|\mike\M|micro';

-- gli iscritti di quei corsi non hanno un dermografo da ricevere: il
-- valore messo d'ufficio dalla migrazione precedente (tekna) va tolto,
-- altrimenti l'Advisor conterebbe un dermografo per ciascuno di loro
update public.iscritti i set dermografo = null
from public.corsi_date cd, public.corsi c
where cd.id = i.corso_data_id and c.id = cd.corso_id and c.prevede_dermografo = false;

notify pgrst, 'reload schema';
