-- Chi sta in una sottocategoria sta anche nella categoria madre.
--
-- Dal 12 settembre 2026 l'app applica la regola da sola, in lettura e in
-- scrittura (vedi conCategoriePadre in src/App.jsx). Questo script allinea
-- l'archivio gia' esistente: per ogni prodotto collegato a una
-- sottocategoria aggiunge il collegamento alla madre, se manca. E'
-- idempotente: rieseguito non inserisce doppioni.
--
-- Eseguire una volta, a mano, sul database (MCP o editor SQL). Non usare
-- `supabase db push`.
insert into prodotti_categorie (prodotto_id, categoria_id)
select distinct pc.prodotto_id, c.categoria_padre_id
from prodotti_categorie pc
join categorie_prodotti c on c.id = pc.categoria_id
where c.categoria_padre_id is not null
  and not exists (
    select 1 from prodotti_categorie pc2
    where pc2.prodotto_id = pc.prodotto_id and pc2.categoria_id = c.categoria_padre_id
  );
