-- Appendici vendite al corso: le buste dopo la prima.
--
-- Quando la busta di un corso e' gia' rientrata in cassa, il suo importo
-- e' congelato e non si riapre. Se dopo arrivano altre vendite in contanti
-- collegate a quel corso, finiscono in una busta successiva (la 2, poi la
-- 3...), che ha la sua lista di vendite, i suoi pagamenti in contanti, il
-- suo "Disponi pagamenti" e la sua spunta "in cassa".
--
-- La prima busta resta dov'e' (corsi_date.busta_rientrata_il / busta_importo).
-- Le successive stanno qui, una riga per busta chiusa.
create table if not exists corsi_date_buste (
  id uuid primary key default gen_random_uuid(),
  corso_data_id uuid not null references corsi_date(id) on delete cascade,
  numero smallint not null check (numero >= 2),
  rientrata_il date not null,
  importo numeric not null default 0,
  creato_il timestamptz not null default now(),
  unique (corso_data_id, numero)
);
alter table corsi_date_buste enable row level security;
drop policy if exists "accesso interno corsi_date_buste" on corsi_date_buste;
create policy "accesso interno corsi_date_buste" on corsi_date_buste
  for all to anon, authenticated using (true) with check (true);

-- In quale busta sta una vendita in contanti (1 = la prima; vuoto = corso
-- ancora aperto, oppure vendita arrivata dopo una chiusura e non ancora
-- in una busta) e da quale busta e' uscito un pagamento (vuoto = la prima).
-- Non si deduce dalle date: una vendita di ieri collegata oggi a un corso
-- gia' chiuso va nell'appendice, non nella busta gia' contata.
alter table vendite_shop add column if not exists busta_numero smallint;
alter table spese add column if not exists busta_numero smallint;

-- Corsi gia' chiusi: le vendite in contanti che c'erano stanno nella
-- prima busta, cosi' non ricompaiono come "arrivate dopo". Verificato il
-- 15/09/2026: nessuna vendita risulta collegata dopo un rientro.
update vendite_shop v
set busta_numero = 1
from corsi_date cd
where cd.id = v.corso_data_id
  and cd.busta_rientrata_il is not null
  and v.busta_numero is null
  and v.metodo_pagamento = 'contanti';
