-- Regole di contabilizzazione automatica dei movimenti banca.
--
-- Quando un movimento importato dall'estratto conto viene contabilizzato
-- a mano (Contabilizza -> modulo della spesa), si puo' chiedere di
-- ricordarsi la scelta: da li' in poi ogni movimento con lo stesso
-- importo (piu' o meno una tolleranza) e, se indicato, con quel testo
-- nella descrizione, diventa da solo una spesa pagata con la stessa
-- categoria e la stessa imputazione, e il movimento risulta gia'
-- contabilizzato. L'esempio tipico: la commissione da 1 euro di ogni
-- bonifico.
create table if not exists regole_banca (
  id uuid primary key default gen_random_uuid(),
  descrizione_contiene text,
  importo numeric not null,
  tolleranza_pct numeric not null default 5,
  solo_uscite boolean not null default true,
  spesa_descrizione text,
  categoria_id text,
  sottocategoria_id text,
  fornitore_id uuid,
  tipo_ambito text not null default 'generale',
  sede_id uuid,
  corso_id uuid,
  classe_id uuid,
  evento_id uuid,
  iva_percentuale numeric not null default 0,
  metodo_pagamento text,
  attiva boolean not null default true,
  usata_volte integer not null default 0,
  creata_il timestamptz not null default now()
);
alter table regole_banca enable row level security;
drop policy if exists "accesso interno regole_banca" on regole_banca;
create policy "accesso interno regole_banca" on regole_banca
  for all to anon, authenticated using (true) with check (true);
