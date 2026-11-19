-- «Solo il nome, senza cognome» non e' un motivo per verificare un contatto
-- (deciso dal titolare il 30/10/2026, dopo il giro di prova: 52 su 300 lo
-- avevano, e il flag «da verificare» perdeva senso). Resta un'informazione,
-- e sta in una colonna sua: da_verificare_motivo tiene solo i motivi veri
-- (nome vuoto, nome di attivita', nome senza lettere, senza email ne' telefono).
alter table public.crm_contatti
  add column if not exists nome_nota text;

comment on column public.crm_contatti.nome_nota is
  'Nota informativa sul nome, es. «solo il nome, senza cognome». Non e'' un motivo di verifica.';
