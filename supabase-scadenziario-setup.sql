-- ---------------------------------------------------------
-- Scadenziario: elenco unico dei bonifici da pagare su tutti i corsi
-- conclusi, con archivio "Evase".
--
-- "Quota venditore" entra nello Scadenziario come le altre voci
-- (Master/Assistenti/Hotel/Location): serve la stessa categoria di
-- gruppo già usata per quelle.
-- ---------------------------------------------------------
alter table public.impostazioni_categorie_gruppi
  add column if not exists venditori_categoria_spesa_id text references public.costi_sottocategorie(id) on delete set null;

-- Le righe "virtuali" del Riepilogo Amministrativo (Compenso Master,
-- Costo Location, Costo Alloggio, Compenso Assistenti, Quota
-- venditore, Commissione ricerca modelle) non esistono come riga in
-- "spese" finché non vengono pagate dallo Scadenziario: questa chiave
-- (tipo + "_" + rigaId, la stessa usata come React key nel Riepilogo)
-- evita di farle ricomparire come "da pagare" una volta già evase.
alter table public.spese
  add column if not exists origine_scadenziario_chiave text;
create unique index if not exists spese_origine_scadenziario_chiave_key
  on public.spese (origine_scadenziario_chiave) where origine_scadenziario_chiave is not null;

notify pgrst, 'reload schema';
