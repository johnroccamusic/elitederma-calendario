-- ---------------------------------------------------------
-- "Apri confezione" sullo stock unico.
--
-- Con due contenitori l'operazione spostava pezzi fra scaffali interni e
-- non toccava lo shop. Ora lo stock è uno solo: aprire un pacco è a tutti
-- gli effetti un movimento di magazzino su due prodotti — il box cala di
-- N, lo sfuso sale di N × pezzi_per_confezione — e va registrato come
-- tale. Il riallineamento di WooCommerce non può avvenire qui (una
-- funzione SQL non chiama il sito): lo fa il client subito dopo, con i
-- valori che questa funzione restituisce.
-- ---------------------------------------------------------

create or replace function public.apri_confezione(p_box_id uuid, p_confezioni integer)
returns jsonb
language plpgsql
as $$
declare
  v_box public.prodotti_shop%rowtype;
  v_sfuso public.prodotti_shop%rowtype;
  v_pezzi integer;
  v_box_rimasti integer;
  v_sfusi_totali integer;
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
  if coalesce(v_box.quantita, 0) < p_confezioni then
    raise exception 'Ci sono solo % pacchi sigillati di "%": non posso aprirne %.',
      coalesce(v_box.quantita, 0), v_box.nome, p_confezioni;
  end if;

  select * into v_sfuso from public.prodotti_shop where id = v_box.prodotto_sfuso_id for update;
  if not found then
    raise exception 'Il prodotto sfuso collegato non esiste più.';
  end if;

  v_box_rimasti := coalesce(v_box.quantita, 0) - p_confezioni;
  v_sfusi_totali := coalesce(v_sfuso.quantita, 0) + p_confezioni * v_pezzi;

  update public.prodotti_shop set quantita = v_box_rimasti where id = v_box.id;
  update public.prodotti_shop set quantita = v_sfusi_totali where id = v_sfuso.id;

  insert into public.movimenti_magazzino (prodotto_id, delta, delta_magazzino, origine, nota, collegato_prodotto_id) values
    (v_box.id, -p_confezioni, -p_confezioni, 'apertura_confezione',
     format('Aperte %s confezioni da %s pezzi', p_confezioni, v_pezzi), v_sfuso.id),
    (v_sfuso.id, p_confezioni * v_pezzi, p_confezioni * v_pezzi, 'apertura_confezione',
     format('Da %s confezioni di "%s"', p_confezioni, v_box.nome), v_box.id);

  return jsonb_build_object(
    'box_id', v_box.id,
    'sfuso_id', v_sfuso.id,
    'box_rimasti', v_box_rimasti,
    'sfusi_totali', v_sfusi_totali,
    'pezzi_caricati', p_confezioni * v_pezzi
  );
end;
$$;

grant execute on function public.apri_confezione(uuid, integer) to anon, authenticated;

notify pgrst, 'reload schema';
