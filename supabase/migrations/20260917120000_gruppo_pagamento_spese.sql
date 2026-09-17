-- Una fattura del fornitore puo' coprire piu' costi: la sala, l'alloggio e
-- il compenso della master della stessa classe, o tre classi diverse dello
-- stesso fornitore. Chi paga fa UN bonifico, non tre.
--
-- Le spese restano tre righe, una per costo, perche' ogni classe deve
-- continuare a sapere quanto le e' costata la sua sala e il suo hotel: e'
-- la base di tutti i riepiloghi per corso. Quello che si unisce e' il
-- PAGAMENTO — e per unirlo basta un nome comune.
--
-- gruppo_pagamento: lo stesso uuid su tutte le righe coperte dalla stessa
-- fattura. Nullo quando la spesa sta per conto suo, che e' il caso normale.
alter table public.spese add column if not exists gruppo_pagamento uuid;
create index if not exists spese_gruppo_pagamento_idx on public.spese (gruppo_pagamento) where gruppo_pagamento is not null;
comment on column public.spese.gruppo_pagamento is
  'Spese coperte dalla stessa fattura e saldate con un unico bonifico: nello Scadenzario si leggono come una riga sola, in prima nota come un movimento solo, ma restano righe distinte per l''attribuzione al corso.';
