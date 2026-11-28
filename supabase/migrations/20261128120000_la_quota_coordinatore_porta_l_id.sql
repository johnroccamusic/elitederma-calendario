-- LA QUOTA COORDINATORE PORTA L'ID DI CHI LA PRENDE (28/11/2026).
--
-- Il titolare: «le commissioni sui corsi di Elena le vedono tutti».
-- Era vero: la scheda in «Commissioni sui corsi» non aveva nessuna
-- condizione, e quella linguetta ce l'hanno quattordici venditori.
-- La serratura e' nel codice (`vedeQuotaCoordinatore`): la vede chi la
-- prende, o chi amministra.
--
-- PERCHE' SERVE ANCHE QUESTA RIGA. L'impostazione ha sempre salvato il
-- solo NOME del coordinatore, e da oggi quel nome decide anche chi vede
-- la scheda. Un nome non e' un'identita': Elena ne ha due — il venditore
-- «ELENA» e l'utenza d'ufficio «Elena Rocca», collegate dallo stesso
-- `venditori.id` — e due persone possono chiamarsi allo stesso modo.
-- Quindi accanto al nome si scrive `personaId`, che e' l'id del
-- venditore, cioe' l'identita' che la Dashboard venditori conosce.
--
-- Il nome NON si tocca: resta il ripiego per il giorno in cui il
-- coordinatore e' qualcuno che fra i venditori non c'e'. Da Setting, da
-- oggi, l'id si scrive da se' a ogni salvataggio.
--
-- Non cambia nessun importo e non cambia chi prende la quota: cambia
-- solo da cosa si riconosce la persona che la legge.
--
-- SI SCRIVE SOLO SE IL NOME COMBACIA CON UN VENDITORE SOLO. Con due
-- omonimi l'id resterebbe ambiguo, e un id sbagliato non e' un id
-- mancante: nasconderebbe la scheda proprio a chi la prende, e la
-- mostrerebbe a un'altra persona. In quel caso si lascia il nome e la
-- pagina di Setting lo dice in giallo.

update impostazioni_layout_tabelle i
   set valore = i.valore || jsonb_build_object('personaId', v.id::text)
  from venditori v
 where i.chiave = 'quota_coordinatore'
   and i.valore ? 'personaNome'
   and not (i.valore ? 'personaId')
   and upper(btrim(v.nome)) = upper(btrim(i.valore->>'personaNome'))
   and (
     select count(*) from venditori v2
      where upper(btrim(v2.nome)) = upper(btrim(i.valore->>'personaNome'))
   ) = 1;

-- ROLLBACK (toglie l'id e torna al riconoscimento per nome, che
-- continua a funzionare: la scheda resta chiusa a chi non la prende)
--
-- update impostazioni_layout_tabelle
--    set valore = valore - 'personaId'
--  where chiave = 'quota_coordinatore';
