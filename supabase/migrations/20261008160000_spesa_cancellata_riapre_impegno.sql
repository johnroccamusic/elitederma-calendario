-- Cancellare la spesa che ha chiuso un impegno lo riapre.
--
-- Il giro era a senso unico. "Segna pagata" dallo scadenziario fa due
-- cose: scrive la spesa in prima nota e chiude l'impegno. Cancellando poi
-- quella spesa — da prima nota, dai doppioni di pagamento, da qualunque
-- punto — la spesa spariva e l'impegno restava chiuso: i soldi uscivano
-- dalla prima nota E dallo scadenziario, e non comparivano piu' da
-- nessuna parte. Nessuno se ne sarebbe accorto finche' non fosse mancato
-- un pagamento.
--
-- Sta qui e non nell'app perche' le spese si cancellano da nove punti
-- diversi, e il decimo lo scriveremo dimenticandoci di questo. Il
-- database e' l'unico posto da cui non si puo' passare per sbaglio.
--
-- Il controllo "non resta nessun'altra spesa con quella chiave" e' una
-- cintura in piu': la colonna ha un vincolo di unicita', quindi due spese
-- sulla stessa scadenza non possono esistere. Costa niente e resta buono
-- se un domani quel vincolo cadesse.
create or replace function riapri_impegno_se_spesa_cancellata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.origine_scadenziario_chiave is null then
    return old;
  end if;
  if exists (
    select 1 from spese s
    where s.origine_scadenziario_chiave = old.origine_scadenziario_chiave
      and s.id <> old.id
  ) then
    return old;
  end if;
  -- a ZERO, non a vuoto: la colonna non ammette il nulla, e scriverci
  -- dentro il nulla faceva fallire la cancellazione della spesa invece di
  -- riaprire l'impegno. Trovato provando il trigger, non rileggendolo.
  update impegno
     set stato = 'aperto',
         importo_effettivo = 0,
         updated_at = now()
   where chiave_origine = old.origine_scadenziario_chiave
     and stato = 'chiuso';
  return old;
end;
$$;

drop trigger if exists spesa_cancellata_riapre_impegno on spese;
create trigger spesa_cancellata_riapre_impegno
  after delete on spese
  for each row
  execute function riapri_impegno_se_spesa_cancellata();
