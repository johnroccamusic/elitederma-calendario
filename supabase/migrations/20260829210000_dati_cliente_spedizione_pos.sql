-- ---------------------------------------------------------
-- I dati del cliente sulla spedizione venduta al banco.
--
-- Finora bastavano destinatario, indirizzo, città e CAP: abbastanza per
-- scrivere un'etichetta, non per spedire davvero (manca il civico, manca
-- la provincia) né per fatturare a chi la chiede.
--
-- "destinatario_nome" resta il nome completo, così le pagine che già lo
-- mostrano non cambiano; nome e cognome si tengono anche separati perché
-- è così che vanno scritti su una bolla e su una fattura.
-- ---------------------------------------------------------

alter table public.spedizioni_pos
  add column if not exists nome text,
  add column if not exists cognome text,
  add column if not exists civico text,
  add column if not exists provincia text,
  add column if not exists richiede_fattura boolean not null default false,
  add column if not exists fattura_ditta text,
  add column if not exists fattura_piva text,
  add column if not exists fattura_cod_dest text,
  add column if not exists fattura_pec text;

comment on column public.spedizioni_pos.destinatario_nome is
  'Nome completo del destinatario (nome + cognome), tenuto per le viste che lo mostrano già.';
