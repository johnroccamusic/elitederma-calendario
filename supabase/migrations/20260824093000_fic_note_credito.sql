-- ============================================================================
-- Riconciliazione note di credito <-> fatture dello stesso fornitore
--
-- Regola contabile: una nota di credito NON cancella la fattura. Restano
-- entrambi i documenti; quello che cambia e' l'IMPORTO NETTO dovuto.
-- Qui teniamo traccia di quale NC abbatte quale fattura, e di quanto.
-- ============================================================================

create table if not exists fic_riconciliazioni (
  id              bigserial primary key,
  company_id      bigint not null,
  direzione       fic_direzione not null,
  nota_credito_id bigint not null,          -- fic_id della nota di credito
  fattura_id      bigint not null,          -- fic_id della fattura abbattuta
  importo         numeric(14,2) not null check (importo > 0),
  origine         text not null default 'auto'
                  check (origine in ('auto','manuale')),
  confidenza      text not null default 'da_verificare'
                  check (confidenza in ('certa','probabile','da_verificare')),
  nota            text,
  creata_il       timestamptz not null default now(),
  unique (company_id, direzione, nota_credito_id, fattura_id),
  foreign key (company_id, direzione, nota_credito_id)
    references fic_documenti (company_id, direzione, fic_id) on delete cascade,
  foreign key (company_id, direzione, fattura_id)
    references fic_documenti (company_id, direzione, fic_id) on delete cascade,
  check (nota_credito_id <> fattura_id)
);
create index if not exists fic_ric_fattura on fic_riconciliazioni (company_id, direzione, fattura_id);
create index if not exists fic_ric_nc      on fic_riconciliazioni (company_id, direzione, nota_credito_id);

alter table fic_riconciliazioni enable row level security;

-- ---------------------------------------------------------------------------
-- Viste: quanto resta davvero da pagare
-- ---------------------------------------------------------------------------

-- Residuo di ogni fattura, al netto delle note di credito gia' abbinate
create or replace view fic_fatture_residuo as
select d.company_id, d.direzione, d.fic_id, d.numero, d.data, d.controparte, d.piva,
       d.totale,
       coalesce(r.abbattuto, 0)          as abbattuto,
       d.totale - coalesce(r.abbattuto, 0) as residuo
from fic_documenti d
left join lateral (
  select sum(importo) as abbattuto
  from fic_riconciliazioni r
  where r.company_id = d.company_id and r.direzione = d.direzione
    and r.fattura_id = d.fic_id
) r on true
where d.tipo in ('invoice','expense');

-- Note di credito non ancora (o solo parzialmente) abbinate
create or replace view fic_note_credito_aperte as
select d.company_id, d.direzione, d.fic_id, d.numero, d.data, d.controparte, d.piva,
       d.totale,
       coalesce(r.usato, 0)           as usato,
       d.totale - coalesce(r.usato, 0) as da_abbinare,
       d.raw->>'description'          as descrizione,
       d.raw->>'invoice_number'       as riferimento_fattura
from fic_documenti d
left join lateral (
  select sum(importo) as usato
  from fic_riconciliazioni r
  where r.company_id = d.company_id and r.direzione = d.direzione
    and r.nota_credito_id = d.fic_id
) r on true
where d.tipo = 'credit_note'
  and d.totale - coalesce(r.usato, 0) > 0.009;

-- Saldo per fornitore: fatture meno note di credito. E' QUESTO il numero vero.
create or replace view fic_saldo_controparti as
select company_id, direzione, coalesce(piva, controparte) as chiave, controparte,
       sum(case when tipo = 'credit_note' then -totale else totale end) as saldo,
       count(*) filter (where tipo <> 'credit_note') as documenti,
       count(*) filter (where tipo  = 'credit_note') as note_credito
from fic_documenti
group by 1,2,3,4;

-- ---------------------------------------------------------------------------
-- Abbinamento automatico
--
-- Fatture in Cloud NON espone un collegamento strutturato fra nota di credito
-- e fattura originale: va ricostruito. Tre livelli, dal piu' sicuro al meno:
--   certa       -> il numero della fattura compare nella NC (invoice_number
--                  o descrizione) e il fornitore coincide
--   probabile   -> stesso fornitore, un'unica fattura aperta con residuo
--                  esattamente pari all'importo della NC
--   nessun match-> resta in fic_note_credito_aperte, la abbini a mano
--
-- Non abbina MAI parzialmente da sola: se non e' sicura, lascia stare.
-- ---------------------------------------------------------------------------
create or replace function fic_abbina_note_credito(
  p_company bigint,
  p_direzione fic_direzione default 'ricevuto'
) returns int language plpgsql as $$
declare
  nc        record;
  candidata record;
  n_trovate int;
  abbinate  int := 0;
begin
  for nc in
    select * from fic_note_credito_aperte
    where company_id = p_company and direzione = p_direzione
    order by data
  loop
    -- 1) match forte: il numero fattura citato dalla nota di credito
    select f.* into candidata
    from fic_fatture_residuo f
    where f.company_id = nc.company_id
      and f.direzione  = nc.direzione
      and coalesce(f.piva, f.controparte) is not distinct from coalesce(nc.piva, nc.controparte)
      and f.residuo >= nc.da_abbinare - 0.01
      and f.data <= nc.data
      and (
        (nullif(nc.riferimento_fattura,'') is not null and f.numero like '%' || nc.riferimento_fattura || '%')
        or (nc.descrizione is not null and nullif(f.numero,'') is not null
            and nc.descrizione ilike '%' || f.numero || '%')
      )
    order by f.data desc
    limit 1;

    if found then
      insert into fic_riconciliazioni (company_id, direzione, nota_credito_id, fattura_id,
                                       importo, origine, confidenza, nota)
      values (nc.company_id, nc.direzione, nc.fic_id, candidata.fic_id,
              nc.da_abbinare, 'auto', 'certa',
              'numero fattura citato nella nota di credito')
      on conflict do nothing;
      abbinate := abbinate + 1;
      continue;
    end if;

    -- 2) match probabile: unica fattura aperta con residuo identico
    select count(*) into n_trovate
    from fic_fatture_residuo f
    where f.company_id = nc.company_id
      and f.direzione  = nc.direzione
      and coalesce(f.piva, f.controparte) is not distinct from coalesce(nc.piva, nc.controparte)
      and f.data <= nc.data
      and abs(f.residuo - nc.da_abbinare) < 0.01;

    if n_trovate = 1 then
      select f.* into candidata
      from fic_fatture_residuo f
      where f.company_id = nc.company_id
        and f.direzione  = nc.direzione
        and coalesce(f.piva, f.controparte) is not distinct from coalesce(nc.piva, nc.controparte)
        and f.data <= nc.data
        and abs(f.residuo - nc.da_abbinare) < 0.01;

      insert into fic_riconciliazioni (company_id, direzione, nota_credito_id, fattura_id,
                                       importo, origine, confidenza, nota)
      values (nc.company_id, nc.direzione, nc.fic_id, candidata.fic_id,
              nc.da_abbinare, 'auto', 'probabile',
              'unica fattura aperta dello stesso fornitore con importo identico')
      on conflict do nothing;
      abbinate := abbinate + 1;
    end if;
    -- 3) altrimenti non tocca niente: la nota resta da abbinare a mano
  end loop;

  return abbinate;
end $$;

-- Abbinamento manuale dall'interfaccia (accetta anche importi parziali)
create or replace function fic_abbina_manuale(
  p_company bigint, p_direzione fic_direzione,
  p_nota_credito bigint, p_fattura bigint, p_importo numeric
) returns void language plpgsql as $$
declare v_disponibile numeric; v_residuo numeric;
begin
  select da_abbinare into v_disponibile from fic_note_credito_aperte
   where company_id = p_company and direzione = p_direzione and fic_id = p_nota_credito;
  if v_disponibile is null then
    raise exception 'Nota di credito % gia'' abbinata per intero o inesistente', p_nota_credito;
  end if;
  if p_importo > v_disponibile + 0.01 then
    raise exception 'La nota di credito ha solo % disponibili, richiesti %', v_disponibile, p_importo;
  end if;

  select residuo into v_residuo from fic_fatture_residuo
   where company_id = p_company and direzione = p_direzione and fic_id = p_fattura;
  if v_residuo is null then
    raise exception 'Fattura % inesistente', p_fattura;
  end if;
  if p_importo > v_residuo + 0.01 then
    raise exception 'La fattura ha un residuo di %, non si puo'' abbattere di %', v_residuo, p_importo;
  end if;

  insert into fic_riconciliazioni (company_id, direzione, nota_credito_id, fattura_id,
                                   importo, origine, confidenza)
  values (p_company, p_direzione, p_nota_credito, p_fattura, p_importo, 'manuale', 'certa')
  on conflict (company_id, direzione, nota_credito_id, fattura_id)
  do update set importo = fic_riconciliazioni.importo + excluded.importo,
                origine = 'manuale', confidenza = 'certa';
end $$;
