-- Link della vista master: da indirizzo indovinabile a token, e da accesso
-- diretto alle tabelle a due funzioni con permessi propri.
--
-- Perche'. Il link era `?master=trico-base/roma/06-09-2026`: corso, citta' e
-- data, cioe' tre cose che chiunque conosce o indovina. E la pagina leggeva
-- `iscritti` direttamente con la chiave anon, che sta nel bundle pubblico:
-- una volta dentro non c'era niente che la fermasse su quella sola classe.
--
-- Dopo questa migrazione la pagina master non tocca piu' nessuna tabella.
-- Passa da due funzioni `security definer` che sanno fare esattamente due
-- cose e nient'altro: leggere i campi di UNA classe, e spuntare l'incassato
-- di UN iscritto di quella stessa classe. Il token non e' una password (chi
-- ha il link entra), ma e' lungo, non enumerabile e si revoca rigenerandolo.

-- ---------------------------------------------------------------------------
-- 1. il token
-- ---------------------------------------------------------------------------

-- 64 caratteri esadecimali da due uuid: niente pgcrypto, gen_random_uuid()
-- e' nativa dal Postgres 13 e qui siamo sul 17
alter table public.corsi_date
  add column if not exists token_master text
  default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

-- le date gia' esistenti nascono senza token: gliene diamo uno adesso, uno
-- diverso per ognuna
update public.corsi_date
   set token_master = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
 where token_master is null;

alter table public.corsi_date alter column token_master set not null;

create unique index if not exists corsi_date_token_master_idx
  on public.corsi_date (token_master);

-- ---------------------------------------------------------------------------
-- 2. lettura
-- ---------------------------------------------------------------------------

-- I campi elencati sono esattamente quelli che la pagina disegna (la card
-- dell'allievo piu' quelli letti da RiepilogoVenditaIscritto e
-- modelleTotaleDi). Tutto il resto della riga `iscritti` - residenza,
-- codice fiscale, email, documenti - non esce da qui: la pagina non lo
-- mostra, quindi non ha motivo di attraversare la rete.
create or replace function public.master_vista(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cd public.corsi_date%rowtype;
begin
  -- un token corto e' per forza un tentativo: si esce prima di interrogare
  if p_token is null or length(p_token) < 32 then
    return null;
  end if;

  select * into v_cd from public.corsi_date where token_master = p_token;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'corso_data', jsonb_build_object(
      'id', v_cd.id,
      'data_inizio', v_cd.data_inizio,
      'data_fine', v_cd.data_fine
    ),
    'corso', (select jsonb_build_object('nome', c.nome)
                from public.corsi c where c.id = v_cd.corso_id),
    'location', (select jsonb_build_object('nome', l.nome)
                   from public.location l where l.id = v_cd.location_id),
    'iscritti', coalesce((
      select jsonb_agg(riga order by riga->>'ts')
        from (
          select jsonb_build_object(
            'id', i.id,
            'ts', i.ts,
            'nome', i.nome,
            'cognome', i.cognome,
            'tutor', i.tutor,
            'telefono', i.telefono,
            'ricontattato', i.ricontattato,
            'note_ricontatto', i.note_ricontatto,
            'note', i.note,
            'incassato', i.incassato,
            'saldo_totale', i.saldo_totale,
            'saldo_metodo', i.saldo_metodo,
            'acconto_totale', i.acconto_totale,
            'acconto_pagato', i.acconto_pagato,
            'acconto_metodo', i.acconto_metodo,
            'acconto_interessi', i.acconto_interessi,
            'precorso_totale', i.precorso_totale,
            'precorso_pagato', i.precorso_pagato,
            'precorso_metodo', i.precorso_metodo,
            'precorso_interessi', i.precorso_interessi,
            'totale_pattuito', i.totale_pattuito,
            'quota_venditore', i.quota_venditore,
            'accordi_commerciali', i.accordi_commerciali,
            'pacchetto_kit', i.pacchetto_kit,
            'taglia_divisa', i.taglia_divisa,
            'richiede_modelle', i.richiede_modelle,
            'numero_modelle', i.numero_modelle,
            'prezzo_speciale_modelle', i.prezzo_speciale_modelle,
            'file_iscrizione', i.file_iscrizione,
            'file_screen_acconto', i.file_screen_acconto,
            'file_screen_recap', i.file_screen_recap
          ) as riga
            from public.iscritti i
           where i.corso_data_id = v_cd.id
        ) righe
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. l'unica scrittura concessa
-- ---------------------------------------------------------------------------

-- Il master spunta gli incassi, e questo e' tutto cio' che puo' scrivere.
-- Il vincolo `corso_data_id = v_cd_id` e' il punto della funzione: anche
-- conoscendo l'id di un iscritto di un'altra classe, il token in mano non
-- lo raggiunge.
create or replace function public.master_segna_incassato(
  p_token text,
  p_iscritto uuid,
  p_valore boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cd_id uuid;
begin
  if p_token is null or length(p_token) < 32 or p_iscritto is null then
    return false;
  end if;

  select id into v_cd_id from public.corsi_date where token_master = p_token;
  if v_cd_id is null then
    return false;
  end if;

  update public.iscritti
     set incassato = coalesce(p_valore, false)
   where id = p_iscritto
     and corso_data_id = v_cd_id;

  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. permessi
-- ---------------------------------------------------------------------------

-- `security definer` gira con i diritti del proprietario: senza revocare
-- l'esecuzione a public, chiunque potrebbe chiamarle. Si concede solo a chi
-- deve - il visitatore anonimo con il link, e lo staff autenticato.
revoke all on function public.master_vista(text) from public;
revoke all on function public.master_segna_incassato(text, uuid, boolean) from public;

grant execute on function public.master_vista(text) to anon, authenticated;
grant execute on function public.master_segna_incassato(text, uuid, boolean) to anon, authenticated;

comment on function public.master_vista(text) is
  'Vista pubblica della classe per il link master: solo i campi mostrati dalla pagina, solo la classe del token.';
comment on function public.master_segna_incassato(text, uuid, boolean) is
  'Unica scrittura concessa al link master: incassato si/no su un iscritto della classe del token.';
