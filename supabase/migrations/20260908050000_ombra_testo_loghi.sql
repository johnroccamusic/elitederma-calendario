-- L'ombra sotto il nome e sotto il codice era scritta nel codice, uguale
-- per tutti e due. Chi guarda il logo stampato vede subito se e' troppo
-- sfumata o troppo poca, ma per cambiarla serviva una riga di sorgente:
-- ora si regola da Setting loghi, e separatamente per le due scritte —
-- il nome e' grande e il codice piccolo, e la stessa ombra non sta bene
-- a tutti e due.
--
-- Le misure non sono pixel: sono unita' di larghezza dell'immagine (una
-- unita' = due decimillesimi), perche' lo stesso logo esiste a
-- risoluzioni diverse e un'ombra fissa sparirebbe sul file grande.
-- I default sono esattamente i valori che il codice usava finora, cosi'
-- i loghi non cambiano finche' non li si regola.
alter table public.loghi_impostazioni
  add column if not exists ombra_nome_x numeric not null default 6,
  add column if not exists ombra_nome_y numeric not null default 8,
  add column if not exists ombra_nome_sfocatura numeric not null default 11,
  add column if not exists ombra_nome_intensita numeric not null default 60,
  add column if not exists ombra_numero_x numeric not null default 6,
  add column if not exists ombra_numero_y numeric not null default 8,
  add column if not exists ombra_numero_sfocatura numeric not null default 11,
  add column if not exists ombra_numero_intensita numeric not null default 60;

comment on column public.loghi_impostazioni.ombra_nome_sfocatura is
  'Sfocatura dell''ombra del nome, in unita'' di larghezza immagine (1 = 0,02%).';
comment on column public.loghi_impostazioni.ombra_nome_intensita is
  'Quanto e'' scura l''ombra del nome: 0 = invisibile, 100 = nero pieno.';
