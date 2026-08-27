-- ---------------------------------------------------------
-- Unificazione dello stock: da due contenitori a uno solo.
--
-- Fino ad oggi ogni prodotto aveva due numeri — "giacenza_magazzino"
-- (fisico, dato dell'app) e "giacenza" (copia locale dello stock di
-- WooCommerce). Nella realtà i pezzi stanno sullo stesso scaffale: la
-- separazione non rispecchiava niente di fisico e produceva solo travasi
-- manuali e disallineamenti. Da qui in poi c'è un solo numero, "quantita",
-- e la fonte di verità è l'app: WooCommerce ne diventa lo specchio.
--
-- La scorta minima cambia nome in "soglia_riordino" e assume tre ruoli
-- insieme: fa scattare l'ordine, è esclusa dal calcolo di autonomia dei
-- kit (i corsi attingono solo a quantita - soglia_riordino) ed è la
-- fascia di protezione dello shop. NON blocca le vendite online: lo shop
-- vende finché lo stock reale è sopra zero.
--
-- Questa migrazione è SOLO ADDITIVA. Le colonne vecchie restano al loro
-- posto e un trigger tiene allineate vecchie e nuove nei due sensi, così
-- l'app in produzione continua a funzionare mentre il codice nuovo viene
-- scritto e pubblicato. Le vecchie colonne si eliminano in una migrazione
-- successiva, solo dopo la verifica sui dati veri.
--
-- Lo stato precedente è fotografato in snapshot_giacenze_pre_unificazione
-- (240 righe, 829 magazzino + 14.238 shop = 15.067 pezzi).
-- ---------------------------------------------------------

alter table public.prodotti_shop add column if not exists quantita integer;
alter table public.prodotti_shop add column if not exists soglia_riordino integer;

-- popolamento: la somma dei due contenitori, i NULL valgono zero (9
-- prodotti avevano "giacenza" nulla invece di 0: nessun pezzo perso)
update public.prodotti_shop
   set quantita = coalesce(quantita, coalesce(giacenza_magazzino, 0) + coalesce(giacenza, 0)),
       soglia_riordino = coalesce(soglia_riordino, scorta_minima);

alter table public.prodotti_shop alter column quantita set default 0;
update public.prodotti_shop set quantita = 0 where quantita is null;

-- nessuna giacenza può andare sotto zero: stessa garanzia che avevamo su
-- giacenza_magazzino, ora sul campo unico
alter table public.prodotti_shop drop constraint if exists prodotti_shop_quantita_non_negativa;
alter table public.prodotti_shop
  add constraint prodotti_shop_quantita_non_negativa check (quantita is null or quantita >= 0);
alter table public.prodotti_shop
  drop constraint if exists prodotti_shop_soglia_riordino_non_negativa;
alter table public.prodotti_shop
  add constraint prodotti_shop_soglia_riordino_non_negativa check (soglia_riordino is null or soglia_riordino >= 0);

-- ponte fra vecchio e nuovo, attivo solo durante la transizione: chi
-- scrive alla vecchia maniera (il codice in produzione adesso, le edge
-- function non ancora aggiornate) aggiorna anche "quantita"; chi scrive
-- alla nuova aggiorna anche le vecchie colonne, tenendo tutto il totale
-- su "giacenza" — che è quella sincronizzata con WooCommerce.
create or replace function public.ponte_unificazione_stock()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.quantita is null then
      new.quantita := coalesce(new.giacenza_magazzino, 0) + coalesce(new.giacenza, 0);
    end if;
    if new.soglia_riordino is null then new.soglia_riordino := new.scorta_minima; end if;
    return new;
  end if;

  if new.quantita is distinct from old.quantita then
    new.giacenza := new.quantita;
    new.giacenza_magazzino := 0;
  elsif (new.giacenza is distinct from old.giacenza)
     or (new.giacenza_magazzino is distinct from old.giacenza_magazzino) then
    new.quantita := coalesce(new.giacenza_magazzino, 0) + coalesce(new.giacenza, 0);
  end if;

  if new.soglia_riordino is distinct from old.soglia_riordino then
    new.scorta_minima := new.soglia_riordino;
  elsif new.scorta_minima is distinct from old.scorta_minima then
    new.soglia_riordino := new.scorta_minima;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ponte_unificazione_stock on public.prodotti_shop;
create trigger trg_ponte_unificazione_stock
  before insert or update on public.prodotti_shop
  for each row execute function public.ponte_unificazione_stock();

-- storico movimenti: un solo delta (i due vecchi restano per le righe
-- già scritte) e chi ha fatto l'operazione, come da specifica
alter table public.movimenti_magazzino add column if not exists delta integer;
alter table public.movimenti_magazzino add column if not exists utente text;
alter table public.movimenti_magazzino add column if not exists riferimento text;
update public.movimenti_magazzino
   set delta = coalesce(delta, coalesce(delta_magazzino, 0) + coalesce(delta_shop, 0))
 where delta is null;

notify pgrst, 'reload schema';
