-- «ALTRO MATERIALE»: QUELLO CHE L'ALLIEVA COMPRA INSIEME AL CORSO (25/11/2026)
--
-- Il titolare, subito dopo il lavoro sul dermografo: «nella stessa
-- casella dove si imposta la prenotazione del dermografo si deve poter
-- aggiungere anche "altro materiale", che sarebbe il materiale che
-- l'allieva decide di acquistare insieme con il corso. La creazione
-- della lista avviene con una casella di ricerca con la lente in cui si
-- trova il prodotto voluto fra tutti quelli in magazzino, si seleziona,
-- e sotto si crea un elenco: "Aghi 1RL x 2, Lampada da
-- dermopigmentazione", totale da pagare, metodo di pagamento (come se
-- fosse un mini POS), e anche questo si somma nelle cifre da ricevere al
-- corso nella contabilita'. In piu' in logistica appare una nuova
-- casella, dopo quella dei dermografi, "MATERIALE PRENOTATO".»
--
-- E' il fratello del dermografo pagato col corso, e segue le stesse tre
-- decisioni prese quella mattina: UNA SPUNTA SOLA al corso, i soldi in
-- contabilita' come il saldo, e un materiale non pagato che avvisa senza
-- bloccare la consegna.
--
-- UNA COLONNA jsonb E NON UNA TABELLA, ed e' una scelta: queste righe
-- non vivono di vita propria: nascono, si leggono e muoiono con la
-- scheda dell'allieva, nessuno le interroga per conto loro, e sono due o
-- tre per iscritto. E' la stessa forma di `tipi_modelle`, che fa lo
-- stesso mestiere da sempre. Il giorno in cui servisse incrociarle con
-- il magazzino per conto loro, diventeranno una tabella.
--
-- Ogni riga: { prodotto_id, nome, quantita, prezzo }
--   * `prodotto_id` lega al magazzino, ed e' quello che la logistica
--     usa per preparare il pezzo;
--   * `nome` e' il nome del giorno in cui si e' prenotato, e resta come
--     ripiego se quel prodotto viene rinominato o tolto dal listino —
--     ma i conti e le liste passano dall'id, mai dal nome (la regola del
--     22/10/2026);
--   * `prezzo` e' il LORDO per pezzo, congelato alla prenotazione: il
--     listino cambia, e quello che l'allieva paga al corso e' il prezzo
--     che le e' stato detto quando ha prenotato.

alter table public.iscritti
  add column if not exists materiale_prenotato jsonb,
  add column if not exists materiale_metodo text,
  add column if not exists materiale_pagato boolean not null default false;

comment on column public.iscritti.materiale_prenotato is
  'Materiale che l''allieva compra col corso: [{prodotto_id, nome, quantita, prezzo}]. Il prezzo e'' il lordo per pezzo, congelato alla prenotazione. Si paga al corso insieme al saldo.';
comment on column public.iscritti.materiale_metodo is
  'Come si incassa al corso il materiale prenotato: uno dei metodi del saldo (si incassa di persona).';
comment on column public.iscritti.materiale_pagato is
  'Gia'' pagato PRIMA del corso. Al corso vale la spunta «incassato» della classe, che copre saldo, modelle, dermografo e materiale insieme.';

-- ROLLBACK
--   alter table public.iscritti
--     drop column if exists materiale_prenotato,
--     drop column if exists materiale_metodo,
--     drop column if exists materiale_pagato;
-- ATTENZIONE: il rollback porta via le prenotazioni gia' scritte, cioe'
-- del materiale che qualcuno ha promesso a un'allieva. Prima di tornare
-- indietro si esporta la colonna.
