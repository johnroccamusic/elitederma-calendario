-- ---------------------------------------------------------
-- Una master può essere anche un venditore (stessa persona, due profili):
-- il collegamento va scelto esplicitamente da Password menù > Password
-- Master > "Venditore collegato", non dedotto dal caso che le due
-- password coincidano. Entrando con la password della master o con quella
-- del venditore, l'app riconosce entrambi i ruoli e sblocca sia
-- "Dashboard master" sia "Dashboard venditori", ciascuna bloccata sui
-- propri dati.
-- ---------------------------------------------------------
alter table public.master add column if not exists venditore_id uuid references public.venditori(id) on delete set null;

notify pgrst, 'reload schema';
