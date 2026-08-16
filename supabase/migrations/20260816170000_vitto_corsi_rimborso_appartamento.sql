-- ---------------------------------------------------------
-- Vitto e ospitalità dei corsi: nuova sotto-voce "Rimborso spesa per
-- appartamento" (spesa/generi alimentari per l'appartamento dove
-- alloggiano master/assistenti, distinta dal rimborso colazioni già
-- esistente).
-- ---------------------------------------------------------
insert into public.costi_sottocategorie (id, categoria_id, nome, ordine, automatico, campo_automatico) values
  ('vitto_corsi__rimborso_spesa_appartamento', 'vitto_corsi', 'Rimborso spesa per appartamento', 7, false, null)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
