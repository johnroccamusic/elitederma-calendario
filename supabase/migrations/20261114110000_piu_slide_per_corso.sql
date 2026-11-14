-- Più di una slide per corso (14/11/2026).
--
-- Il titolare: «in associa slide al corso avrei bisogno, una volta
-- inserita la prima slide del corso, di un segno + che permetta di
-- caricare una seconda slide per lo stesso corso».
--
-- Com'era: UNA slide per corso, e per giunta scritta in due posti
-- diversi secondo il tipo — il PDF in tre colonne di `corsi`
-- (slide_pdf_path/nome/caricato_il), il link in una riga di
-- `impostazioni_layout_tabelle` (chiave `slide_link_corsi`, una mappa
-- corso -> indirizzo). Due posti, e un corso poteva avere l'uno o
-- l'altro ma mai tutti e due: era una regola scritta nel browser per
-- nascondere il fatto che il posto era uno solo per tipo.
--
-- Adesso le slide sono RIGHE: una tabella, una riga per slide, PDF e
-- link insieme nella stessa lista e nello stesso ordine. Un corso ne può
-- avere quante ne servono, e di tutti e due i tipi.
--
-- Il titolo è facoltativo ed è il prezzo di ammissione della richiesta:
-- con due link accanto, due tasti «Apri link» identici sulla scheda
-- della master non dicono quale sia quale. Vuoto, la master legge
-- «Slide 1», «Slide 2».
--
-- Rollback (il file lo scrive per intero, perché tornare indietro vuol
-- dire PERDERE le slide oltre la prima):
--   alter table public.corsi
--     add column if not exists slide_pdf_path text,
--     add column if not exists slide_pdf_nome text,
--     add column if not exists slide_caricato_il timestamptz;
--   update public.corsi c set slide_pdf_path = s.percorso, slide_pdf_nome = s.nome, slide_caricato_il = s.caricato_il
--     from (select distinct on (corso_id) corso_id, percorso, nome, caricato_il
--             from public.corsi_slide where tipo = 'pdf' order by corso_id, ordine, caricato_il) s
--    where s.corso_id = c.id;
--   insert into public.impostazioni_layout_tabelle (chiave, valore)
--     select 'slide_link_corsi', coalesce(jsonb_object_agg(corso_id::text, url), '{}'::jsonb)
--       from (select distinct on (corso_id) corso_id, url
--               from public.corsi_slide where tipo = 'link' order by corso_id, ordine, caricato_il) l
--     on conflict (chiave) do update set valore = excluded.valore;
--   drop table public.corsi_slide;

create table if not exists public.corsi_slide (
  id uuid primary key default gen_random_uuid(),
  corso_id uuid not null references public.corsi(id) on delete cascade,
  -- 'pdf' = un file nel secchio privato slide-corsi; 'link' = un
  -- indirizzo (Canva, Presentazioni, un video)
  tipo text not null check (tipo in ('pdf', 'link')),
  titolo text,
  percorso text,
  nome text,
  url text,
  ordine integer not null default 0,
  caricato_il timestamptz not null default now(),
  -- una riga è un PDF o un link, mai tutti e due e mai nessuno dei due:
  -- senza questo vincolo una riga a metà esiste e non si vede da nessuna
  -- parte, che è il modo in cui una slide sparisce senza errori
  constraint corsi_slide_pdf_o_link check (
    (tipo = 'pdf'  and percorso is not null and url is null) or
    (tipo = 'link' and url is not null and percorso is null)
  )
);

create index if not exists corsi_slide_corso_idx on public.corsi_slide (corso_id, ordine);

comment on table public.corsi_slide is
  'Le slide che la master proietta in aula, una riga per slide: PDF (nel secchio privato slide-corsi) o link. Un corso ne può avere più di una, in ordine. Sostituisce corsi.slide_pdf_path e la chiave slide_link_corsi delle impostazioni condivise.';
comment on column public.corsi_slide.titolo is
  'Facoltativo, lo scrive chi carica: serve a distinguere due slide dello stesso corso sulla scheda della master. Vuoto = «Slide 1», «Slide 2».';

alter table public.corsi_slide enable row level security;

drop policy if exists "corsi_slide accesso staff" on public.corsi_slide;
create policy "corsi_slide accesso staff" on public.corsi_slide
  for all to authenticated using (true) with check (true);

-- I 4 PDF già caricati.
insert into public.corsi_slide (corso_id, tipo, percorso, nome, ordine, caricato_il)
select c.id, 'pdf', c.slide_pdf_path, c.slide_pdf_nome, 0, coalesce(c.slide_caricato_il, now())
  from public.corsi c
 where c.slide_pdf_path is not null
   and not exists (select 1 from public.corsi_slide s where s.corso_id = c.id and s.percorso = c.slide_pdf_path);

-- I 14 link, dalla mappa delle impostazioni condivise.
insert into public.corsi_slide (corso_id, tipo, url, ordine)
select (m.key)::uuid, 'link', m.value #>> '{}', 1
  from public.impostazioni_layout_tabelle i,
       lateral jsonb_each(i.valore) m
 where i.chiave = 'slide_link_corsi'
   and m.value #>> '{}' is not null
   and exists (select 1 from public.corsi c where c.id = (m.key)::uuid)
   and not exists (select 1 from public.corsi_slide s where s.corso_id = (m.key)::uuid and s.url = m.value #>> '{}');

-- E i due posti di prima si chiudono, nello stesso giro: una colonna che
-- sembra viva e non lo è è peggio di una che manca, e due posti in cui
-- leggere la stessa cosa sono due risposte diverse fra sei mesi.
alter table public.corsi
  drop column if exists slide_pdf_path,
  drop column if exists slide_pdf_nome,
  drop column if exists slide_caricato_il;

delete from public.impostazioni_layout_tabelle where chiave = 'slide_link_corsi';
