-- Prima nota come libro cassa: le entrate (acconto, pre corso, saldo)
-- entrano nel giorno in cui il cliente ha pagato davvero, cioe' quando in
-- contabilita' si mette "pagato". Finora c'era solo il flag, non la data.
--
-- Tre date, una per quota. Le riempie un trigger quando il flag passa a
-- vero e la data e' vuota (cosi' vale per ogni strada: scheda, master,
-- prossime contabilita'), e le azzera quando il flag torna falso: tolto
-- il pagamento l'entrata sparisce dalla prima nota e ricompare se lo si
-- ripristina. La scheda puo' scriverle a mano (data di accredito del
-- bonifico, data dell'incasso al corso).
alter table iscritti add column if not exists acconto_pagato_il date;
alter table iscritti add column if not exists precorso_pagato_il date;
alter table iscritti add column if not exists saldo_incassato_il date;

create or replace function iscritti_date_pagamenti() returns trigger
language plpgsql as $$
declare oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  if new.acconto_pagato is true then
    if new.acconto_pagato_il is null then new.acconto_pagato_il := oggi; end if;
  else
    new.acconto_pagato_il := null;
  end if;
  if new.precorso_pagato is true then
    if new.precorso_pagato_il is null then new.precorso_pagato_il := oggi; end if;
  else
    new.precorso_pagato_il := null;
  end if;
  if new.incassato is true then
    if new.saldo_incassato_il is null then new.saldo_incassato_il := oggi; end if;
  else
    new.saldo_incassato_il := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_iscritti_date_pagamenti on iscritti;
create trigger trg_iscritti_date_pagamenti
  before insert or update on iscritti
  for each row execute function iscritti_date_pagamenti();

-- Storico: tutto quello che oggi risulta pagato prende la data di
-- iscrizione (deciso il 16/09/2026). Si scrive direttamente, prima che il
-- trigger possa mettere "oggi".
update iscritti set acconto_pagato_il = (ts at time zone 'Europe/Rome')::date where acconto_pagato is true and acconto_pagato_il is null and ts is not null;
update iscritti set precorso_pagato_il = (ts at time zone 'Europe/Rome')::date where precorso_pagato is true and precorso_pagato_il is null and ts is not null;
update iscritti set saldo_incassato_il = (ts at time zone 'Europe/Rome')::date where incassato is true and saldo_incassato_il is null and ts is not null;
