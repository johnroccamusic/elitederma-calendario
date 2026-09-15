-- Diplomi: il modello sta SOLO sui pacchetti (kit_definizioni.diploma_path).
-- Il campo corsi.diploma_template_path era rimasto come ripiego e faceva
-- uscire il diploma vecchio a chi non aveva un pacchetto di quel corso.
-- 1) i pacchetti senza diploma ereditano il modello del proprio corso,
--    cosi' nessun corso resta senza; 2) il campo sul corso si svuota.
update kit_definizioni k
set diploma_path = c.diploma_template_path,
    diploma_nome = regexp_replace(c.diploma_template_path, '^.*/template-\d+-', '')
from corsi c
where k.corso_id = c.id and k.diploma_path is null and c.diploma_template_path is not null;

update corsi set diploma_template_path = null where diploma_template_path is not null;
