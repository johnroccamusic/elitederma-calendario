-- ---------------------------------------------------------
-- Categorie prodotto locali: prima ogni riga di categorie_prodotti
-- doveva avere un woo_category_id (arrivava solo da WooCommerce). Ora
-- da Gestione magazzino si possono creare anche categorie solo locali
-- (mai mandate online), quindi la colonna diventa facoltativa —
-- woo_category_id null distingue "locale" da "sincronizzata da Woo"
-- nell'interfaccia (sola lettura lì, modificabile qui).
--
-- location.magazzino_locale: spunta in Impostazioni > Sedi e corsi >
-- "Definisci magazzini distaccati" — solo le città spuntate compaiono
-- nella vista "Magazzini locali" e nell'Inventario post corso, non
-- tutte quelle con corsi (una sede occasionale non ha per forza un
-- magazzino locale da tracciare).
-- ---------------------------------------------------------
alter table public.categorie_prodotti alter column woo_category_id drop not null;
alter table public.location add column if not exists magazzino_locale boolean not null default false;

notify pgrst, 'reload schema';
