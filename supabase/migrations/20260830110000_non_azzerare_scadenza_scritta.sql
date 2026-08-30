-- ---------------------------------------------------------
-- Una scadenza scritta a mano non si cancella da sola.
--
-- La sincronizzazione da Fatture in Cloud riscrive documento_fornitore per
-- intero a ogni giro (upsert su fic_id). Da quando riconosce la scadenza
-- finta dell'importazione (fic-sync-documenti, scadenzaPrevistaVera) per
-- quei documenti manda null — e cancellerebbe la data che l'operatore ha
-- scritto al momento di riconciliare, quella da cui è nata la scadenza
-- passiva vera.
--
-- Stessa idea del trigger sui prezzi (protezione_prezzo_lordo): il dato
-- inserito a mano nell'app vince su quello che rimbalza da fuori.
-- Un null in arrivo su una scadenza già scritta viene ignorato; qualunque
-- data vera, invece, passa e aggiorna.
-- ---------------------------------------------------------

create or replace function public.protezione_scadenza_prevista()
returns trigger
language plpgsql
as $$
begin
  if new.data_scadenza_prevista is null and old.data_scadenza_prevista is not null then
    new.data_scadenza_prevista := old.data_scadenza_prevista;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protezione_scadenza_prevista on public.documento_fornitore;
create trigger trg_protezione_scadenza_prevista
  before update on public.documento_fornitore
  for each row execute function public.protezione_scadenza_prevista();
