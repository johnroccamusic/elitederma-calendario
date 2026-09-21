-- Un kit allievo dichiarato "non consegnato" diventa una scatola gestibile
-- come un kit di riserva: puo' essere aperto, chiuso o dato a un'altra
-- allieva, e ci si possono associare le vendite del POS. Per distinguerlo da
-- un vero kit di riserva serve un'etichetta d'origine; per dire a chi e'
-- finito, quando non e' una delle iscritte, serve un nome libero.
alter table kit_riserva_istanze
  add column if not exists origine text not null default 'riserva',
  add column if not exists consegnato_a_nome text;

comment on column kit_riserva_istanze.origine is
  'riserva = kit di riserva vero; allievo_non_consegnato = kit di un''allieva materializzato quando dichiarato non consegnato';
comment on column kit_riserva_istanze.consegnato_a_nome is
  'nome libero di chi ha ricevuto il kit intero, quando non e'' un''iscritta del corso';
