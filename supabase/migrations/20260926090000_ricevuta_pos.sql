-- La ricevuta che vede chi ha appena pagato col QR.
--
-- Nasce da una cosa vista dal vivo: finita la transazione, sul telefono
-- della cliente si scaricava un file col sorgente della pagina dentro —
-- i colori, i caratteri, il resto. Le edge function di Supabase
-- rispondono con "content-type: text/plain" e una CSP "sandbox", quindi
-- una pagina HTML servita da li' il browser non la disegna: la mostra
-- come testo o se la scarica.
--
-- Quindi la ricevuta la disegna l'app, e questi sono i soli campi che
-- servono a stamparla. Non esce niente di piu': non chi ha venduto, non
-- il carrello, non i dati di fatturazione che la cliente ha scritto.
create or replace function public.ricevuta_pos(p_codice text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'codice', p.codice,
    'stato', p.stato,
    'importo', p.importo,
    'pagato_il', p.pagato_il,
    'descrizione', p.descrizione,
    'righe', p.righe,
    'societa', (
      select jsonb_build_object(
        'nome', s.nome, 'indirizzo', s.indirizzo, 'indirizzo_2', s.indirizzo_2,
        'riga_4', s.riga_4, 'riga_5', s.riga_5, 'logo_path', s.logo_path
      ) from intestazione_societa s limit 1
    )
  )
  from pagamenti_pos p
  where upper(p.codice) = upper(trim(p_codice))
  limit 1
$$;

revoke all on function public.ricevuta_pos(text) from public;
grant execute on function public.ricevuta_pos(text) to anon, authenticated;
