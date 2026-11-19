-- LA BUSTA SI SPEDISCE, POI ARRIVA (11/11/2026)
--
-- Il titolare: «Elena dispone i pagamenti con i soldi contenuti nella busta
-- o rinvia in scadenziario passivo le spese che non ha potuto pagare. Da
-- quel momento chiude la busta e la porta via con sé. Non è possibile
-- aggiungere altro alla busta. La master che però resta in classe potrebbe
-- fare altre vendite in contanti che prima si andavano a sommare
-- erratamente alla busta che era stata portata via.»
--
-- Fino a oggi le tappe erano DUE — aperta, poi in cassa — e fra la mano di
-- chi la chiude e il cassetto di chi la riceve possono passare giorni. In
-- quei giorni ogni vendita in contanti della classe finiva dentro una busta
-- che era già partita: contante contato due volte da una parte e mai
-- arrivato dall'altra.
--
-- Le tappe diventano TRE, e ognuna ha la sua data:
--   busta_spedita_il    la busta è chiusa e in viaggio. Da qui la
--                       contabilità della classe non accetta più niente: le
--                       vendite che arrivano dopo aprono l'appendice.
--   busta_rientrata_il  la busta è arrivata in amministrazione: SOLO ADESSO
--                       quel contante entra nella cassa contanti.
--
-- busta_importo si congela alla SPEDIZIONE e non alla ricezione: è il
-- momento in cui qualcuno ha contato delle banconote e ha chiuso la busta.
-- Chi la riceve conferma quello che gli è stato consegnato, non un numero
-- ricalcolato nel frattempo.

alter table public.corsi_date
  add column if not exists busta_spedita_il date;

comment on column public.corsi_date.busta_spedita_il is
  'Giorno in cui la busta della prima contabilità è stata chiusa e spedita. Da qui la classe non accetta più contanti: le vendite successive vanno in appendice. I soldi entrano in cassa solo con busta_rientrata_il.';

-- Le 41 buste già in cassa sono per forza state spedite: senza questa riga
-- risulterebbero "mai partite" e la loro contabilità si riaprirebbe.
update public.corsi_date
   set busta_spedita_il = busta_rientrata_il
 where busta_rientrata_il is not null
   and busta_spedita_il is null;

-- Una busta non può essere arrivata senza essere partita. È l'invariante su
-- cui si appoggia tutto il resto: "spedita" vuol dire contabilità chiusa, e
-- ogni lettura la guarda da sola.
alter table public.corsi_date
  drop constraint if exists corsi_date_busta_arrivata_solo_se_partita;
alter table public.corsi_date
  add constraint corsi_date_busta_arrivata_solo_se_partita
  check (busta_rientrata_il is null or busta_spedita_il is not null);

-- LE APPENDICI (buste 2, 3…) hanno le stesse tre tappe. Fino a oggi una
-- riga di corsi_date_buste nasceva al momento della spunta "in cassa";
-- adesso nasce alla SPEDIZIONE, ed è quella riga a chiudere l'appendice e
-- ad aprire quella dopo. Quindi rientrata_il diventa facoltativa.
alter table public.corsi_date_buste
  add column if not exists spedita_il date;

update public.corsi_date_buste
   set spedita_il = rientrata_il
 where spedita_il is null;

alter table public.corsi_date_buste
  alter column rientrata_il drop not null;
alter table public.corsi_date_buste
  alter column spedita_il set not null;

comment on column public.corsi_date_buste.spedita_il is
  'Giorno in cui questa appendice è stata chiusa e spedita. La riga esiste da qui in poi: è lei a far nascere la busta successiva.';
comment on column public.corsi_date_buste.rientrata_il is
  'Giorno in cui l''appendice è arrivata in amministrazione. Vuoto = è in viaggio, e il suo importo non è ancora nella cassa contanti.';

-- ROLLBACK (da eseguire a mano, in quest'ordine):
--   alter table public.corsi_date_buste alter column spedita_il drop not null;
--   update public.corsi_date_buste set rientrata_il = coalesce(rientrata_il, spedita_il);
--   alter table public.corsi_date_buste alter column rientrata_il set not null;
--   alter table public.corsi_date_buste drop column spedita_il;
--   alter table public.corsi_date drop constraint corsi_date_busta_arrivata_solo_se_partita;
--   alter table public.corsi_date drop column busta_spedita_il;
