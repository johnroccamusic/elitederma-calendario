alter table public.location
  add column if not exists telefono text,
  add column if not exists email text,
  add column if not exists indirizzo text,
  add column if not exists partita_iva text,
  add column if not exists codice_fiscale text,
  add column if not exists categoria_id text references public.costi_categorie(id) on delete set null;

alter table public.location rename column categoria_spesa_id to sottocategoria_id;

alter table public.location
  add constraint location_sottocategoria_id_fkey foreign key (sottocategoria_id) references public.costi_sottocategorie(id) on delete set null;

notify pgrst, 'reload schema';
