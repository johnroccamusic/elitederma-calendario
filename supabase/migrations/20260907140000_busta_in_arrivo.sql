-- Il viaggio della busta contanti ha tre momenti, non due: il corso
-- finisce, la busta parte, la busta arriva. Finora ce n'erano due soli
-- ("busta_rientrata_il" valorizzato o no), e "e' partita" non si poteva
-- dire da nessuna parte — chi guardava la cassa non sapeva distinguere una
-- busta che sta viaggiando da una di cui nessuno si e' ancora occupato.
--
-- Il flag e' solo il passo intermedio: quello che conta per i soldi resta
-- busta_rientrata_il, che e' l'unico a far entrare il contante in cassa.
alter table public.corsi_date
  add column if not exists busta_in_arrivo boolean not null default false;

comment on column public.corsi_date.busta_in_arrivo is
  'La busta contanti del corso è partita ed è in viaggio verso l''amministrazione: passo intermedio fra "corso finito" e "busta in cassa" (busta_rientrata_il).';
