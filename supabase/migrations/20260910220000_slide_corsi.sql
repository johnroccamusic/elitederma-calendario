-- Le slide che la master proietta in aula: un PDF per corso.
--
-- Sta sul CORSO e non sull'edizione perche' le slide sono del corso: la
-- stessa lezione di Milano e quella di Bari mostrano le stesse pagine.
-- Se un giorno servisse un PDF diverso per una singola data, si
-- aggiungera' li' una colonna che ha la precedenza su questa.
alter table public.corsi
  add column if not exists slide_pdf_path text,
  add column if not exists slide_pdf_nome text,
  add column if not exists slide_caricato_il timestamptz;

comment on column public.corsi.slide_pdf_path is
  'Percorso del PDF dentro il bucket slide-corsi. Il bucket NON e'' pubblico: il link si firma al momento del download e dura pochi minuti.';
comment on column public.corsi.slide_pdf_nome is
  'Il nome che aveva il file quando e'' stato caricato: serve solo a farlo riconoscere nell''elenco, il file sul disco ha un nome nostro.';

-- L'unico secchio non pubblico del progetto, e per una ragione precisa.
--
-- Le slide si scaricano solo da una settimana prima del corso alla sua
-- fine. Se l'indirizzo fosse pubblico e definitivo, far sparire il tasto
-- dalla scheda non impedirebbe niente a chi se l'e' salvato: la finestra
-- sarebbe una tendina davanti a una porta aperta. Cosi' invece il
-- collegamento nasce firmato al momento del clic e scade in cinque
-- minuti.
insert into storage.buckets (id, name, public)
values ('slide-corsi', 'slide-corsi', false)
on conflict (id) do update set public = false;

-- Stesso accesso delle altre tabelle dell'app finche' il lockdown non
-- arriva: chi usa l'app e' `anon`. La differenza che conta resta che il
-- file non ha un indirizzo pubblico permanente.
drop policy if exists "slide corsi accesso interno" on storage.objects;
create policy "slide corsi accesso interno"
  on storage.objects for all to anon, authenticated
  using (bucket_id = 'slide-corsi')
  with check (bucket_id = 'slide-corsi');
