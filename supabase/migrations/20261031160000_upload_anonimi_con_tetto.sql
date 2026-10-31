-- 31/10/2026 — Controllo di sicurezza: i due secchi che accettano file da
-- anonimi (moduli di iscrizione e consensi delle modelle) non avevano tetto.
--  * consensi-documenti: nessun limite di peso ne' di tipo -> ora 5 MB e sole
--    immagini (l'app scrive JPEG/PNG/WebP).
--  * moduli-iscrizione: aveva gia' 10 MB e i tipi; mancava il PERCORSO. Ora un
--    anonimo scrive solo in <gettone>/..., dove il gettone e' quello di un
--    modulo non ancora tornato. Chi ha fatto accesso (staff) resta libero:
--    carica anche in _azienda/ e i PDF generati.
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg','image/png','image/webp']
 where id = 'consensi-documenti';

create or replace function public.modulo_cartella_valida(p_nome text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from iscritti i
     where i.token_modulo = split_part(p_nome, '/', 1)
       and i.modulo_ricevuto_il is null
  )
  and p_nome ~ '^[A-Za-z0-9]{16}/[a-z_]+-[0-9]+\.[A-Za-z0-9]{1,5}$';
$$;
revoke execute on function public.modulo_cartella_valida(text) from public;
grant execute on function public.modulo_cartella_valida(text) to anon, authenticated;

drop policy if exists moduli_iscrizione_carica on storage.objects;
create policy moduli_iscrizione_carica_staff on storage.objects for insert to authenticated
  with check (bucket_id = 'moduli-iscrizione');
create policy moduli_iscrizione_carica_anon on storage.objects for insert to anon
  with check (bucket_id = 'moduli-iscrizione' and public.modulo_cartella_valida(name));

drop policy if exists consensi_documenti_carica on storage.objects;
create policy consensi_documenti_carica_staff on storage.objects for insert to authenticated
  with check (bucket_id = 'consensi-documenti');
create policy consensi_documenti_carica_anon on storage.objects for insert to anon
  with check (bucket_id = 'consensi-documenti'
              and name ~ '^[A-Za-z0-9-]{8,60}/(fronte|retro|firma)\.(jpg|png|webp)$');
