-- Il registro delle domande fatte ai dati (25/10/2026): cosa e' stato
-- chiesto, quale query ne e' uscita, quante righe, quanti token. Niente
-- righe di risultato. Serve a vedere cosa chiede la gente e quanto costa.
create table if not exists public.analisi_domande (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  chi text,
  domanda text not null,
  sql text,
  nota text,
  righe integer,
  modello text,
  uso jsonb
);
alter table public.analisi_domande enable row level security;
create policy "analisi_domande lettura interna" on public.analisi_domande for select to authenticated using (true);
