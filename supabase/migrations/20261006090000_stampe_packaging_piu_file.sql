-- Applicata via MCP il 06/10/2026.
--
-- Una scheda di stampa ha quasi sempre PIU' di un file: la copertina e le
-- pagine interne viaggiano separate in tipografia, e finora ce ne stava
-- uno solo. Invece di aggiungere "file2" — che fra un mese diventa
-- "file3" — i file diventano un elenco, come le righe dei dati.
--
-- L'etichetta e' libera e serve a dire che pezzo e': "Copertina",
-- "Pagine interne", "Fustella".
create table if not exists stampe_packaging_file (
  id uuid primary key default gen_random_uuid(),
  stampa_id uuid not null references stampe_packaging(id) on delete cascade,
  percorso text not null,
  nome text not null default '',
  etichetta text not null default '',
  ordine numeric not null default 0,
  creato_il timestamptz not null default now()
);
create index if not exists stampe_packaging_file_idx on stampe_packaging_file(stampa_id, ordine);
alter table stampe_packaging_file enable row level security;
drop policy if exists stampe_packaging_file_tutti on stampe_packaging_file;
create policy stampe_packaging_file_tutti on stampe_packaging_file for all to anon, authenticated using (true) with check (true);

-- I file gia' caricati entrano nell'elenco come primo file. Le colonne
-- file_path/file_nome restano dove sono: non si butta via una colonna
-- piena finche' non e' sicuro che nessuno la legga piu'.
insert into stampe_packaging_file (stampa_id, percorso, nome, ordine)
select s.id, s.file_path, coalesce(s.file_nome, ''), 10
from stampe_packaging s
where s.file_path is not null
  and not exists (select 1 from stampe_packaging_file f where f.stampa_id = s.id and f.percorso = s.file_path);
