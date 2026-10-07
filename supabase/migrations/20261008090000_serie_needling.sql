-- Una seconda serie di regole per i codici d'aula: quella dei corsi di
-- needling.
--
-- Fino a oggi "regole_referral_automatico" era una riga sola, letta con
-- .limit(1): le regole dei codici generati quando comincia un corso. I
-- corsi di needling vogliono le loro — percentuali diverse, e soprattutto
-- l'eccezione sui prodotti del reparto Needling, che sugli altri corsi
-- non deve valere.
--
-- Invece di una tabella gemella, una colonna che dice di quale serie e'
-- la riga, e una riga per serie. L'unico vincolo e' che non ce ne siano
-- due uguali: chi legge chiede la serie che gli serve, non la prima che
-- capita.
alter table regole_referral_automatico
  add column if not exists serie text not null default 'corsi';

create unique index if not exists regole_referral_automatico_serie_unica
  on regole_referral_automatico (serie);

-- la riga del needling nasce copiando quella dei corsi normali: da li'
-- si regola, e finche' nessuno la tocca si comporta uguale
insert into regole_referral_automatico (
  serie, percentuale_sconto, giorni_validita_dopo_corso, valido_durante_corso,
  non_cumulabile, utilizzi_max, utilizzi_max_per_cliente, spesa_minima,
  base_sconto, tipo_regola_sconto, fasce_sconto, aggiornato_ts
)
select 'needling', percentuale_sconto, giorni_validita_dopo_corso, valido_durante_corso,
       non_cumulabile, utilizzi_max, utilizzi_max_per_cliente, spesa_minima,
       base_sconto, tipo_regola_sconto, fasce_sconto, now()
from regole_referral_automatico where serie = 'corsi'
on conflict (serie) do nothing;

-- Di quale serie e' nato un codice. Serve a due cose che senza di lei non
-- si possono fare:
--  - il POS deve sapere quali fasce applicare, e sono due tabelle diverse;
--  - "_ed_needling", l'eccezione che il sito legge dal coupon, deve
--    viaggiare SOLO sui codici dei corsi di needling. Finora partiva con
--    tutti, ed e' il motivo per cui sullo shop un codice normale faceva
--    ancora il 30% sui needling mentre al banco non lo faceva piu'.
-- Vuoto = un codice dei corsi normali, com'erano tutti fino a ieri.
alter table coupon
  add column if not exists serie_regole text;

comment on column coupon.serie_regole is
  'Da quale serie di regole e'' nato il codice: null/corsi = corsi normali, needling = corsi di needling.';
