-- spese-allegati: fatture e ricevute dei fornitori. Il codice apre gli
-- allegati con link a scadenza (apriAllegato), quindi il secchio si chiude.
update storage.buckets set public = false where id = 'spese-allegati';
