-- Riconciliazione note di credito (spec-riconciliazione.md §9): quando una
-- nota di credito riduce la scadenza_passiva non pagata di una fattura già
-- riconciliata, serve un modo per ripristinare ESATTAMENTE importo e stato
-- precedenti se la riconciliazione della nota di credito viene annullata —
-- l'annullamento esistente (§8) sa solo cancellare scadenze non pagate, mai
-- ripristinare un importo ridotto: caso non previsto dallo schema originale.
create table if not exists public.rettifica_scadenza_nota_credito (
  id uuid primary key default gen_random_uuid(),
  nota_credito_id uuid not null references public.documento_fornitore(id) on delete restrict,
  scadenza_id uuid not null references public.scadenza_passiva(id) on delete restrict,
  importo_ridotto numeric(12,2) not null,
  stato_precedente text not null check (stato_precedente in ('da_pagare', 'pagata', 'annullata')),
  created_at timestamptz not null default now()
);
create index if not exists rettifica_scadenza_nota_credito_nc_idx on public.rettifica_scadenza_nota_credito(nota_credito_id);
create index if not exists rettifica_scadenza_nota_credito_scadenza_idx on public.rettifica_scadenza_nota_credito(scadenza_id);

alter table public.rettifica_scadenza_nota_credito enable row level security;
create policy "accesso interno rettifica_scadenza_nota_credito" on public.rettifica_scadenza_nota_credito for all to anon using (true) with check (true);

notify pgrst, 'reload schema';
