-- «MODELLE FIERA» (7/11/2026)
--
-- Richiesta del titolare, con la fiera di Napoli aperta: «a quelli in
-- fiera nella home page devi mettere un tasto con i consensi informati
-- da poter far compilare alle modelle in fiera. Il tasto si chiama
-- Modelle fiera e lo posso sbloccare io agli utenti a richiesta. Per
-- adesso lo attivo di default a tutti quelli in fiera.»
--
-- DUE COSE, e la prima e' quella che conta.
--
-- 1. UN CONSENSO PUO' APPARTENERE A UN EVENTO. Fino a oggi il consenso
--    di una modella si legava a UNA CLASSE (`corso_data_id`), e basta.
--    In fiera una classe non c'e'. Senza un posto dove scrivere la
--    fiera, i consensi raccolti al banco sarebbero finiti nell'archivio
--    generale come "codici generici" — ed e' esattamente il guasto di
--    ottobre scritto in QrConsensi.jsx: sette consensi che non sapevano
--    a quale corso appartenessero, mentre giravano due PMU BASE con le
--    stesse date, e nessuno dei due poteva piu' rivendicarli. Qui
--    sarebbe peggio: in fiera le modelle sono molte e di nessuna classe,
--    e se domani una contesta un trattamento il consenso va ritrovato.
--
-- 2. IL PERMESSO, acceso adesso a chi sta al banco. Non e' una tessera
--    per tutti: la si sblocca a richiesta da Gestione utenti / Password
--    master / Password venditori / Password assistenti, come ogni altra
--    casella. Quindi NON va in `PERMESSI_DI_PARTENZA`: un utente nuovo
--    non la trova dentro da se'.
--
--    E NON si accende per nome. Le righe si ricavano da
--    `eventi_team.vende_al_banco` — la stessa spunta che decide da dove
--    parte il POS — e si risalgono PER ID attraverso i legami
--    (`master.venditore_id`, `utenti_app.venditore_id`,
--    `assistente.master_id`). La stessa persona ha due o tre identita' e
--    quale compare dipende dalla password battuta: ANDREA PAURA nel team
--    e' il venditore «ANDREA», entra come master e ha anche una riga
--    assistente; ELIA CITO il contrario. Accendere il permesso su una
--    sola identita' vuol dire che la tessera c'e' o non c'e' a seconda
--    di come si e' entrati, e nessuno capirebbe perche'.
--
-- ROLLBACK (in coda al file, commentato).

alter table public.consensi_modelle
  add column if not exists evento_id uuid references public.eventi(id) on delete set null;

create index if not exists consensi_modelle_evento on public.consensi_modelle (evento_id);

comment on column public.consensi_modelle.evento_id is
  'La fiera a cui appartiene questo consenso, quando e'' stato firmato al banco di un evento invece che in una classe. Lo scrive il QR della pagina «Modelle fiera» (?consenso=<codice>&evento=<id>). Resta nullo per i consensi di aula, che portano corso_data_id.';

-- IL PERMESSO, alle identita' di chi sta al banco.
--
-- `al_banco` sono le righe del team con la spunta, sulle fiere che hanno
-- un'ora del banco scritta. Da li' si risale a tutte le righe da cui
-- quelle persone possono entrare.
with al_banco as (
  select t.persona_tipo, t.persona_id
    from public.eventi_team t
    join public.eventi e on e.id = t.evento_id
   where t.vende_al_banco is true
     and e.pos_banco_fino_al is not null
     and t.persona_id is not null
),
mast as (
  select distinct m.id as master_id, m.venditore_id
    from public.master m
    join al_banco b
      on (b.persona_tipo = 'master' and b.persona_id = m.id)
      or (b.persona_tipo = 'venditore' and m.venditore_id = b.persona_id)
),
vend as (
  select persona_id as venditore_id from al_banco where persona_tipo = 'venditore'
  union
  select venditore_id from mast where venditore_id is not null
),
-- la riga master
m1 as (
  update public.master m
     set permessi = coalesce(m.permessi, '[]'::jsonb) || '["modellefiera"]'::jsonb
   where m.id in (select master_id from mast)
     and not coalesce(m.permessi, '[]'::jsonb) ? 'modellefiera'
  returning 1
),
-- la riga venditore (anche quella collegata a una master)
v1 as (
  update public.venditori v
     set permessi = coalesce(v.permessi, '[]'::jsonb) || '["modellefiera"]'::jsonb
   where v.id in (select venditore_id from vend)
     and not coalesce(v.permessi, '[]'::jsonb) ? 'modellefiera'
  returning 1
),
-- l'utenza dell'ufficio collegata a quel venditore (Elena Rocca, Stefano Di Napoli),
-- piu' il profilo Programmatore, che serve a verificare la tessera
u1 as (
  update public.utenti_app u
     set permessi = coalesce(u.permessi, '[]'::jsonb) || '["modellefiera"]'::jsonb
   where (u.venditore_id in (select venditore_id from vend) or u.chiave_sistema = '__programmatore')
     and not coalesce(u.permessi, '[]'::jsonb) ? 'modellefiera'
  returning 1
),
-- la riga assistente della stessa persona (ANDREA PAURA ne ha una)
a1 as (
  update public.assistente a
     set permessi = coalesce(a.permessi, '[]'::jsonb) || '["modellefiera"]'::jsonb
   where a.master_id in (select master_id from mast)
     and not coalesce(a.permessi, '[]'::jsonb) ? 'modellefiera'
  returning 1
)
select
  (select count(*) from m1) as master_accesi,
  (select count(*) from v1) as venditori_accesi,
  (select count(*) from u1) as utenti_accesi,
  (select count(*) from a1) as assistenti_accesi;

-- ROLLBACK
--
-- update public.master      set permessi = permessi - 'modellefiera' where permessi ? 'modellefiera';
-- update public.venditori   set permessi = permessi - 'modellefiera' where permessi ? 'modellefiera';
-- update public.utenti_app  set permessi = permessi - 'modellefiera' where permessi ? 'modellefiera';
-- update public.assistente  set permessi = permessi - 'modellefiera' where permessi ? 'modellefiera';
-- drop index if exists consensi_modelle_evento;
-- alter table public.consensi_modelle drop column if exists evento_id;
