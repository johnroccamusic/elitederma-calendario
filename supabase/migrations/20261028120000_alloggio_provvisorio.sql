-- L'ALLOGGIO PROVVISORIO (28/10/2026). Chiesto dal titolare: in Operativo
-- corsi, da «Gestisci» della colonna Hotel, anche su un corso gia'
-- stabilito, poter scrivere un alloggio ancora non definitivo — una
-- struttura non ancora in Gestione Hotel, un appunto «da confermare» —
-- senza dover prima creare l'hotel. Un testo libero accanto ad alloggio_id:
-- quando poi si sceglie l'hotel vero, il provvisorio si svuota.
alter table corsi_date add column if not exists alloggio_provvisorio text;
alter table corsi_date_docenti add column if not exists alloggio_provvisorio text;
