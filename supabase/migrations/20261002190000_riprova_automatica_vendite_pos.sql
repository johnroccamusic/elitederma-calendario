-- Applicata via MCP il 02/10/2026. Tre pezzi, in quest'ordine.
--
-- 1. IL VINCOLO. Il numero d'ordine identifica una vendita e deve essere
--    unico. Senza, un ritentativo automatico puo' sdoppiare una vendita
--    riuscita di cui si e' persa solo la risposta: incasso contato due
--    volte, e un ordine doppio — al contrario di uno mancante — non lo
--    nota nessuno. Verificato prima: 4.224 vendite, zero doppioni.
create unique index if not exists vendite_shop_numero_ordine_unico
  on vendite_shop(numero_ordine) where numero_ordine is not null;

-- 2. LA FUNZIONE DIVENTA IDEMPOTENTE. Se la vendita c'e' gia' non si
--    riscrive: si guarda se le manca l'ordine di spedizione e nel caso si
--    crea solo quello. Cosi' il ritentativo completa cio' che era rimasto
--    a meta' invece di raddoppiarlo. (Corpo completo applicato via MCP:
--    vedi registra_vendita_pos nel database.)

-- 3. IL RITENTATIVO. Una coda che aspetta che qualcuno la guardi non e'
--    una rete: e' cosi' che sono passati sei giorni. I tentativi si
--    diradano (1, 2, 5, 15, 60 minuti) e dopo sei la riga si arrende e lo
--    dice — una colonna che manca o una giacenza a zero che richiede un
--    inventario non si risolvono insistendo.
alter table spedizioni_pos_non_riuscite add column if not exists tentativi integer not null default 0;
alter table spedizioni_pos_non_riuscite add column if not exists prossimo_tentativo timestamptz default now();
alter table spedizioni_pos_non_riuscite add column if not exists arreso boolean not null default false;

-- riprova_vendite_pos_in_attesa() + cron ogni minuto: applicati via MCP.
-- select cron.schedule('riprova-vendite-pos', '* * * * *',
--                      'select public.riprova_vendite_pos_in_attesa()');
