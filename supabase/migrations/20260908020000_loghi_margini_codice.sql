-- Il codice progressivo aveva solo un punto (pos_x, pos_y): si poteva
-- spostare, non contenere. Su un logo stretto una sigla lunga usciva dal
-- disegno e non c'era modo di dirle "stai dentro qui".
--
-- Ora ha due margini come il nome: si centra fra i due e rimpicciolisce se
-- non ci sta. I margini nascono a cavallo del punto gia' scelto, dieci
-- punti percentuali per lato, cosi' i loghi gia' calibrati restano dove
-- sono.
alter table public.loghi_categorie
  add column if not exists nero_numero_limite_sx numeric not null default 30,
  add column if not exists nero_numero_limite_dx numeric not null default 70,
  add column if not exists bianco_numero_limite_sx numeric not null default 30,
  add column if not exists bianco_numero_limite_dx numeric not null default 70;

comment on column public.loghi_categorie.nero_numero_limite_sx is
  'Margine sinistro entro cui sta il codice progressivo, in % della larghezza del logo. Il codice è centrato fra i due margini e rimpicciolisce se non ci sta, come il nome.';

update public.loghi_categorie set
  nero_numero_limite_sx = greatest(0, nero_numero_pos_x - 10),
  nero_numero_limite_dx = least(100, nero_numero_pos_x + 10),
  bianco_numero_limite_sx = greatest(0, bianco_numero_pos_x - 10),
  bianco_numero_limite_dx = least(100, bianco_numero_pos_x + 10);
