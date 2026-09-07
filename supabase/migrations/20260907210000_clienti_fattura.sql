-- La fattura al banco si poteva chiedere solo dentro "Aggiungi spese di
-- spedizione": chi comprava di persona e voleva la fattura non aveva dove
-- dirlo. Le due cose non c'entrano niente l'una con l'altra — si spedisce
-- senza fatturare e si fattura senza spedire.
--
-- E soprattutto: i dati di fatturazione si riscrivevano ogni volta.
-- Un'anagrafica risolve il problema alla radice — la prima volta si
-- scrivono, dalla seconda si scelgono da una tendina.
create table if not exists public.clienti_fattura (
  id uuid primary key default gen_random_uuid(),
  nome text, cognome text, ditta text,
  piva text, codice_fiscale text, cod_dest text, pec text,
  indirizzo text, civico text, cap text, citta text, provincia text,
  email text, telefono text,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

-- si cerca per partita IVA (l'identificativo vero) e per nome scritto:
-- chi vende al banco si ricorda "Rossi", non undici cifre
create index if not exists clienti_fattura_piva_idx on public.clienti_fattura (lower(piva));
create index if not exists clienti_fattura_nome_idx on public.clienti_fattura (lower(coalesce(ditta, '') || ' ' || coalesce(cognome, '') || ' ' || coalesce(nome, '')));

alter table public.clienti_fattura enable row level security;
drop policy if exists "staff clienti_fattura" on public.clienti_fattura;
create policy "staff clienti_fattura" on public.clienti_fattura
  for all to anon, authenticated using (true) with check (true);

-- sulla vendita resta scritto che la fattura e' stata chiesta e a chi va
-- intestata, senza ricopiarne i dati: quelli stanno nell'anagrafica
alter table public.vendite_shop
  add column if not exists richiede_fattura boolean not null default false,
  add column if not exists cliente_fattura_id uuid references public.clienti_fattura(id) on delete set null;

comment on table public.clienti_fattura is
  'Chi ha già chiesto una fattura al banco: si sceglie da una tendina invece di riscrivere ogni volta indirizzo, P.IVA e PEC.';
