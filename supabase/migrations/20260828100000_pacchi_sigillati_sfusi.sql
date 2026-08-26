-- ---------------------------------------------------------
-- Pacchi sigillati e pezzi sfusi.
--
-- Alcuni articoli (es. aghi) si comprano e si vendono in box da N pezzi,
-- ma i kit dei corsi consumano pezzi singoli. In magazzino esistono due
-- scaffali reali: i pacchi sigillati e i pezzi sfusi già aperti. L'app
-- li rispecchia con DUE prodotti collegati:
--   - il pezzo singolo (tipo_prodotto='componente', giacenza propria =
--     scaffale sfusi, consumato dai kit, mai sullo shop);
--   - il box (tipo_prodotto='bundle' con bundle_con_giacenza_fisica=true,
--     giacenza propria = scaffale sigillati, venduto sullo shop e
--     acquistato dal produttore).
-- A differenza del bundle "virtuale" già esistente (che non ha giacenza
-- e si calcola dai componenti), il box ha uno stock suo: box e sfusi
-- sono due giacenze indipendenti, collegate solo dall'operazione
-- "Apri confezione" (−1 box, +pezzi_per_confezione sfusi).
-- ---------------------------------------------------------

alter table public.prodotti_shop add column if not exists bundle_con_giacenza_fisica boolean not null default false;
alter table public.prodotti_shop add column if not exists prodotto_sfuso_id uuid references public.prodotti_shop(id) on delete set null;
alter table public.prodotti_shop add column if not exists pezzi_per_confezione integer;

-- Storico dei movimenti di magazzino: primo registro esplicito dell'app.
-- Per ora lo scrive solo "Apri confezione" (origine='apertura_confezione'),
-- ma la struttura è generica: delta su magazzino fisico e/o shop, con
-- causale e collegamento all'altro prodotto coinvolto quando il movimento
-- è a due gambe (box che si apre -> sfusi che si caricano).
create table if not exists public.movimenti_magazzino (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  prodotto_id uuid not null references public.prodotti_shop(id) on delete cascade,
  delta_magazzino integer not null default 0,
  delta_shop integer not null default 0,
  origine text not null,
  nota text,
  collegato_prodotto_id uuid references public.prodotti_shop(id) on delete set null
);
create index if not exists idx_movimenti_magazzino_prodotto on public.movimenti_magazzino(prodotto_id);

alter table public.movimenti_magazzino enable row level security;
drop policy if exists "accesso interno movimenti_magazzino" on public.movimenti_magazzino;
create policy "accesso interno movimenti_magazzino" on public.movimenti_magazzino for all to anon
  using (true) with check (true);
drop policy if exists "accesso staff movimenti_magazzino" on public.movimenti_magazzino;
create policy "accesso staff movimenti_magazzino" on public.movimenti_magazzino for all to authenticated
  using (true) with check (true);

-- "Apri confezione": spostamento fisico da uno scaffale all'altro, in una
-- SOLA transazione lato database (la prima funzione SQL del magazzino):
-- così −N box e +N×pezzi sfusi non possono mai restare a metà, e il
-- controllo di disponibilità è fatto sul valore reale con lock di riga,
-- non su quello (potenzialmente vecchio) in memoria nel browser.
create or replace function public.apri_confezione(p_box_id uuid, p_confezioni integer)
returns jsonb
language plpgsql
as $$
declare
  v_box public.prodotti_shop%rowtype;
  v_sfuso public.prodotti_shop%rowtype;
  v_pezzi integer;
begin
  if p_confezioni is null or p_confezioni <= 0 then
    raise exception 'Indica quante confezioni aprire (almeno 1).';
  end if;

  select * into v_box from public.prodotti_shop where id = p_box_id for update;
  if not found then
    raise exception 'Prodotto box non trovato.';
  end if;
  if v_box.prodotto_sfuso_id is null then
    raise exception 'Questo prodotto non ha un prodotto sfuso collegato: configuralo nella scheda prodotto.';
  end if;
  v_pezzi := coalesce(v_box.pezzi_per_confezione, 0);
  if v_pezzi <= 0 then
    raise exception 'Imposta "pezzi per confezione" nella scheda del box prima di aprirlo.';
  end if;
  if coalesce(v_box.giacenza_magazzino, 0) < p_confezioni then
    raise exception 'In magazzino ci sono solo % pacchi sigillati di "%": non posso aprirne %.',
      coalesce(v_box.giacenza_magazzino, 0), v_box.nome, p_confezioni;
  end if;

  select * into v_sfuso from public.prodotti_shop where id = v_box.prodotto_sfuso_id for update;
  if not found then
    raise exception 'Il prodotto sfuso collegato non esiste più.';
  end if;

  update public.prodotti_shop
    set giacenza_magazzino = coalesce(giacenza_magazzino, 0) - p_confezioni
    where id = v_box.id;
  update public.prodotti_shop
    set giacenza_magazzino = coalesce(giacenza_magazzino, 0) + p_confezioni * v_pezzi
    where id = v_sfuso.id;

  insert into public.movimenti_magazzino (prodotto_id, delta_magazzino, origine, nota, collegato_prodotto_id) values
    (v_box.id, -p_confezioni, 'apertura_confezione',
     format('Aperte %s confezioni da %s pezzi', p_confezioni, v_pezzi), v_sfuso.id),
    (v_sfuso.id, p_confezioni * v_pezzi, 'apertura_confezione',
     format('Da %s confezioni di "%s"', p_confezioni, v_box.nome), v_box.id);

  return jsonb_build_object(
    'box_rimasti', coalesce(v_box.giacenza_magazzino, 0) - p_confezioni,
    'sfusi_totali', coalesce(v_sfuso.giacenza_magazzino, 0) + p_confezioni * v_pezzi,
    'pezzi_caricati', p_confezioni * v_pezzi
  );
end;
$$;

grant execute on function public.apri_confezione(uuid, integer) to anon, authenticated;

notify pgrst, 'reload schema';
