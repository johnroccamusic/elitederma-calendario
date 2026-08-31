-- ---------------------------------------------------------
-- I diplomi passano dal corso al pacchetto.
--
-- Il modello del diploma stava sul corso: uno solo, uguale per tutti gli
-- allievi di quell'edizione. Ma nella stessa aula convivono pacchetti
-- diversi — chi ha fatto solo sopracciglia e chi ha fatto anche le labbra —
-- e il foglio che si stampa non e' lo stesso. Da qui il diploma si associa
-- al pacchetto, in "Tipologie di kit", accanto al suo contenuto.
--
-- Qui si porta avanti quello che c'e' gia': ogni pacchetto di un corso che
-- aveva un diploma eredita quel file. Sono 47 pacchetti su 56 (l'unico che
-- ne aveva gia' uno suo non si tocca, e gli altri appartengono a corsi che
-- un diploma non l'hanno mai avuto). Il nome mostrato si ricava dal
-- percorso: e' il nome con cui il file fu caricato.
--
-- corsi.diploma_template_path NON si cancella: resta come ripiego per i
-- pacchetti che un diploma proprio non ce l'hanno, e per gli allievi di cui
-- non si riesce a risalire al pacchetto.
-- ---------------------------------------------------------

update public.kit_definizioni k
   set diploma_path = c.diploma_template_path,
       diploma_nome = regexp_replace(c.diploma_template_path, '^.*/(template-[0-9]+-)?', '')
  from public.corsi c
 where c.id = k.corso_id
   and c.diploma_template_path is not null
   and k.diploma_path is null;
