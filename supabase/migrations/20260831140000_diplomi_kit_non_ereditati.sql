-- ---------------------------------------------------------
-- Annulla l'eredità: ogni pacchetto si sceglie il suo diploma.
--
-- La migrazione 20260831130000 aveva copiato il diploma del corso su TUTTI
-- i suoi pacchetti, per non perdere i file già caricati. Sbagliato: in un
-- corso PMU il pacchetto "solo sopracciglia", quello "labbra" e quello
-- "eyeliner" si sono ritrovati lo stesso foglio, e caricandone uno sembrava
-- che si propagasse a tutti gli altri. È esattamente il contrario di quello
-- per cui il diploma è stato spostato sul pacchetto.
--
-- Qui si toglie quell'eredità, e solo quella: si azzerano i pacchetti il
-- cui diploma è ancora, identico, quello del loro corso. Chi ne ha uno
-- caricato davvero sul pacchetto (percorso che comincia per "kit-") non si
-- tocca.
--
-- I file restano tutti nel bucket, e corsi.diploma_template_path resta
-- dov'era: finché un pacchetto non ha il suo diploma, la stampa continua a
-- usare quello del corso, come faceva prima. Cambia solo che adesso la
-- pagina dice la verità su quali pacchetti un diploma ce l'hanno davvero.
-- ---------------------------------------------------------

update public.kit_definizioni k
   set diploma_path = null, diploma_nome = null
  from public.corsi c
 where c.id = k.corso_id
   and k.diploma_path is not null
   and k.diploma_path = c.diploma_template_path;
