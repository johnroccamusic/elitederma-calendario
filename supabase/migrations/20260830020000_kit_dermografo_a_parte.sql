-- Il kit dichiara che il dermografo NON è compreso: l'allievo lo compra a
-- parte. È una proprietà del pacchetto (vale per chiunque lo scelga), non
-- del singolo iscritto, e da qui la scheda dell'allievo sa che deve
-- chiedere modello, pagamento e prezzo.
alter table public.kit_definizioni
  add column if not exists dermografo_a_parte boolean not null default false;

comment on column public.kit_definizioni.dermografo_a_parte is
  'Il dermografo non è compreso nel pacchetto: l''allievo lo acquista a parte (vedi la scheda iscritto).';
