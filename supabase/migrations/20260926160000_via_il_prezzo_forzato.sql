-- Via il prezzo al pubblico forzato.
--
-- Serviva a scrivere a mano un prezzo tondo (39,90 invece di 39,89) e a
-- non farlo ricalcolare. Costava piu' di quanto rendeva: comandava su
-- sito, POS, fasce e punti, e chi cambiava il prezzo di vendita non
-- vedeva succedere niente — perche' quello vero era un altro.
--
-- Nessun prezzo si muove. Su 43 prodotti che ce l'avevano, 41 lo
-- avevano identico al calcolo (netto piu' IVA), quindi per loro non
-- cambia niente. Per i due che non tornavano il netto si riscrive con
-- la precisione che serve a tenere fermo il prezzo al pubblico:
--   Telini politenati       6,48 -> 5,655738   cliente paga sempre 6,90
--   Pelle sintetica Premium 8,11 -> 8,196721   cliente paga sempre 10,00
-- Senza questo passaggio il primo sarebbe salito a 7,91 e il secondo
-- sceso a 9,89, sul sito e alla cassa.
update prodotti_shop
set prezzo_vendita = round(prezzo_lordo_forzato / (1 + coalesce(aliquota_iva_vendita, 22) / 100.0), 6)
where prezzo_lordo_forzato is not null
  and prezzo_vendita is not null
  and abs(prezzo_lordo_forzato - round(prezzo_vendita * (1 + coalesce(aliquota_iva_vendita, 22) / 100.0), 2)) > 0.02;

update prodotti_shop set prezzo_lordo_forzato = null where prezzo_lordo_forzato is not null;

comment on column prodotti_shop.prezzo_lordo_forzato is
  'DISMESSA il 26/09/2026. Non la legge ne'' la scrive piu'' nessuno: il prezzo al pubblico e'' sempre netto piu'' IVA.';

-- Il prezzo forzato si puo' togliere perche' al suo posto c'e' la
-- precisione del netto: nettoDaLordo tiene sei decimali, non due. Se
-- scrivi 39,90 quel prezzo ricalcola SOLO il netto (32,704918), e il
-- netto rifa' 39,90. Con due decimali (32,70) rifaceva 39,89 — succedeva
-- in 54.098 casi su 300.000 al 22%, un prezzo su cinque, ed e' per
-- questo che il prezzo forzato era nato. Provato su tutti i 186 prodotti
-- in listino: un apri-e-salva della scheda non sposta un centesimo.
