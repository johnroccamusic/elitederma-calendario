-- L'email di accesso accanto ai permessi (17/09/2026).
--
-- Dove stiamo andando. Oggi chi apre l'app fa due porte: prima email e
-- password di Supabase (il cancello, acceso ieri), poi la password interna
-- che decide chi sei e cosa vedi. Sono due identita' separate: il database
-- sa che sei "elitederma@europe.com", l'app sa che sei "GIORGIA", e
-- nessuno dei due sa dell'altro.
--
-- Questa colonna e' il filo che li lega. Una volta che ogni persona ha la
-- sua email scritta qui accanto ai suoi permessi, l'app potra' riconoscerla
-- dal cancello e caricare i suoi permessi da sola: la password interna
-- diventa superflua e si spegne. Fino ad allora non cambia niente — la
-- colonna sta li' e basta, chi non ce l'ha entra come sempre.
--
-- Perche' una colonna nuova e non la "email" che master e venditori hanno
-- gia'. Quella e' l'email dell'anagrafica: ci finisce l'indirizzo del
-- commercialista, quello dello studio, quello che si usa per le fatture, e
-- cambia quando cambia il commercialista. Farne la chiave di accesso
-- vorrebbe dire che il giorno in cui si aggiorna un dato fiscale qualcuno
-- resta fuori dall'app. Restano due cose diverse: nel pannello c'e' un
-- tasto per ricopiare l'una nell'altra quando davvero coincidono.

alter table public.utenti_app add column if not exists email_accesso text;
alter table public.master     add column if not exists email_accesso text;
alter table public.venditori  add column if not exists email_accesso text;

-- Scritta sempre in minuscolo e senza spazi: chi la digita non deve
-- preoccuparsi di come la scrive, e "Mario@Gmail.com " con lo spazio in
-- fondo non deve diventare una seconda persona
create or replace function public.normalizza_email_accesso()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.email_accesso := nullif(lower(trim(new.email_accesso)), '');
  return new;
end;
$$;

drop trigger if exists normalizza_email_accesso on public.utenti_app;
drop trigger if exists normalizza_email_accesso on public.master;
drop trigger if exists normalizza_email_accesso on public.venditori;
create trigger normalizza_email_accesso before insert or update of email_accesso
  on public.utenti_app for each row execute function public.normalizza_email_accesso();
create trigger normalizza_email_accesso before insert or update of email_accesso
  on public.master for each row execute function public.normalizza_email_accesso();
create trigger normalizza_email_accesso before insert or update of email_accesso
  on public.venditori for each row execute function public.normalizza_email_accesso();

-- La stessa email non puo' stare su due righe: ne' nella stessa tabella
-- (l'indice), ne' in una delle altre due (il controllo). Altrimenti al
-- momento di riconoscere chi entra ci sarebbero due risposte, e l'app
-- caricherebbe i permessi di una persona a caso fra le due
create unique index if not exists utenti_app_email_accesso_unica on public.utenti_app (email_accesso) where email_accesso is not null;
create unique index if not exists master_email_accesso_unica     on public.master     (email_accesso) where email_accesso is not null;
create unique index if not exists venditori_email_accesso_unica  on public.venditori  (email_accesso) where email_accesso is not null;

create or replace function public.email_accesso_non_duplicata()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_dove text;
begin
  if new.email_accesso is null then return new; end if;

  select nome into v_dove from public.utenti_app
   where email_accesso = new.email_accesso and (tg_table_name <> 'utenti_app' or id is distinct from new.id) limit 1;
  if v_dove is null then
    select nome into v_dove from public.master
     where email_accesso = new.email_accesso and (tg_table_name <> 'master' or id is distinct from new.id) limit 1;
  end if;
  if v_dove is null then
    select nome into v_dove from public.venditori
     where email_accesso = new.email_accesso and (tg_table_name <> 'venditori' or id is distinct from new.id) limit 1;
  end if;

  if v_dove is not null then
    raise exception 'Questa email di accesso e'' gia'' assegnata a %', v_dove
      using errcode = 'unique_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists email_accesso_non_duplicata on public.utenti_app;
drop trigger if exists email_accesso_non_duplicata on public.master;
drop trigger if exists email_accesso_non_duplicata on public.venditori;
create trigger email_accesso_non_duplicata before insert or update of email_accesso
  on public.utenti_app for each row execute function public.email_accesso_non_duplicata();
create trigger email_accesso_non_duplicata before insert or update of email_accesso
  on public.master for each row execute function public.email_accesso_non_duplicata();
create trigger email_accesso_non_duplicata before insert or update of email_accesso
  on public.venditori for each row execute function public.email_accesso_non_duplicata();

-- Chi e' chi entra. Non legge la email dal di fuori: la prende dal
-- gettone di chi sta chiamando (auth.jwt()), quindi nessuno puo' chiedere
-- "e se fossi tizio?" e vedersi rispondere con i permessi di tizio.
-- Serve alla fase 2, quando il cancello caricherà i permessi da solo.
create or replace function public.identita_da_accesso()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_r     jsonb;
begin
  if v_email is null then return null; end if;

  select jsonb_build_object('tipo', 'utente', 'id', u.id, 'nome', u.nome, 'permessi', coalesce(u.permessi, '[]'::jsonb),
                            'amministratore', coalesce(u.amministratore, false), 'solo_calendario', coalesce(u.solo_calendario, false),
                            'venditore_id', u.venditore_id)
    into v_r from public.utenti_app u where u.email_accesso = v_email limit 1;
  if v_r is not null then return v_r; end if;

  select jsonb_build_object('tipo', 'master', 'id', m.id, 'nome', m.nome, 'permessi', coalesce(m.permessi, '[]'::jsonb),
                            'amministratore', false, 'solo_calendario', false, 'venditore_id', m.venditore_id)
    into v_r from public.master m where m.email_accesso = v_email limit 1;
  if v_r is not null then return v_r; end if;

  select jsonb_build_object('tipo', 'venditore', 'id', v.id, 'nome', v.nome, 'permessi', coalesce(v.permessi, '[]'::jsonb),
                            'amministratore', false, 'solo_calendario', false, 'venditore_id', v.id)
    into v_r from public.venditori v where v.email_accesso = v_email limit 1;
  return v_r;
end;
$$;

revoke all on function public.identita_da_accesso() from public;
grant execute on function public.identita_da_accesso() to authenticated;
