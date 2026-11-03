-- «STAMPE» (3/11/2026): la tessera e' per Raffaele, e per il profilo
-- Programmatore che serve a verificarla. A nessun altro — chi amministra
-- entra nelle classi e stampa da dentro, questa pagina esiste per chi non
-- ci deve entrare.
--
-- Le sue righe sono due: l'utenza ridotta in utenti_app e la riga
-- venditore. Si accende su tutte e due, perche' da quale delle due entri
-- lo decide la password che usa.
update public.utenti_app
   set permessi = coalesce(permessi, '[]'::jsonb) || '["stampe"]'::jsonb
 where (nome ilike '%raffael%' or chiave_sistema = '__programmatore')
   and not coalesce(permessi, '[]'::jsonb) ? 'stampe';

update public.venditori
   set permessi = coalesce(permessi, '[]'::jsonb) || '["stampe"]'::jsonb
 where nome ilike '%raffael%'
   and not coalesce(permessi, '[]'::jsonb) ? 'stampe';
