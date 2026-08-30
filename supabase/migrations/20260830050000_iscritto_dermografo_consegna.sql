-- Come arriva all'allievo il dermografo comprato a parte:
--   corso = lo ritira al corso, quindi va messo nel pacco e scaricato dal
--           magazzino quando il pacco parte;
--   casa  = lo ha già ricevuto a casa (comprato dal sito), quindi non va
--           preparato e non scala niente dal magazzino.
--
-- Chi prepara i pacchi legge questa differenza sulla riga dell'allievo, e
-- il conteggio dei dermografi per l'edizione conta solo i "corso".
alter table public.iscritti
  add column if not exists dermografo_consegna text;

comment on column public.iscritti.dermografo_consegna is
  'corso | casa — dove l''allievo riceve il dermografo comprato a parte.';
