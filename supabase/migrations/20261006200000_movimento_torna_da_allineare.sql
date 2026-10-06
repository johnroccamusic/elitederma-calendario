-- Applicata via MCP il 06/10/2026.
--
-- Un movimento di banca "riconciliato" tiene l'id della spesa a cui e'
-- stato agganciato. Ma quella spesa si puo' cancellare, e il movimento
-- non se ne accorgeva: restava riconciliato con il nulla. Fuori da "Da
-- allineare", fuori da tutto, con un collegamento che punta a una riga
-- che non esiste. Oggi erano 72 su 277.
--
-- Non c'e' una chiave esterna che possa farlo da sola, perche' il
-- collegamento e' polimorfo (collegato_tipo + collegato_id). Ci pensa un
-- trigger: quando una spesa se ne va, i movimenti che la nominavano
-- tornano da sistemare, con scritto perche'.

create or replace function movimenti_banca_spesa_cancellata()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update movimenti_banca
     set stato = 'nuovo',
         collegato_tipo = null,
         collegato_id = null,
         nota = 'tornato da allineare: la spesa collegata e'' stata cancellata'
   where collegato_tipo = 'spesa' and collegato_id = old.id;
  return old;
end;
$$;

drop trigger if exists spesa_cancellata_libera_movimenti on spese;
create trigger spesa_cancellata_libera_movimenti
  after delete on spese
  for each row execute function movimenti_banca_spesa_cancellata();

-- E quelli gia' rimasti appesi: tornano da allineare adesso.
update movimenti_banca m
   set stato = 'nuovo',
       collegato_tipo = null,
       collegato_id = null,
       nota = 'tornato da allineare: la spesa collegata non esiste piu'''
 where m.collegato_tipo = 'spesa'
   and m.collegato_id is not null
   and not exists (select 1 from spese s where s.id = m.collegato_id);
