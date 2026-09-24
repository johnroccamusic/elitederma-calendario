-- Un messaggio di benvenuto per ogni kit, non uno solo per tutta
-- l'accademia: il testo da mandare a chi ha comprato il kit base di
-- Hennè non è quello di chi ha preso il PMU completo.
--
-- Una riga per kit (unique su kit_id): il messaggio si riscrive, non se
-- ne accumulano versioni. Il kit cancellato si porta via il suo
-- messaggio (on delete cascade) — un testo agganciato a un kit che non
-- esiste più non lo cerca nessuno.
create table if not exists messaggi_kit (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null unique references kit_definizioni(id) on delete cascade,
  testo text not null default '',
  aggiornato_il timestamptz not null default now()
);

alter table messaggi_kit enable row level security;

drop policy if exists messaggi_kit_tutti on messaggi_kit;
create policy messaggi_kit_tutti on messaggi_kit for all to anon, authenticated using (true) with check (true);
