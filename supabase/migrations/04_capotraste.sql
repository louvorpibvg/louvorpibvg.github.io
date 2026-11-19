-- 04_capotraste.sql — aplicado em 04/11/2026
-- Casa do capotraste usada no violão para cada música do repertório do dia.
-- A forma dos acordes (ex.: Bbm com capo 1 = forma de Am) é calculada no app.
alter table public.repertorio_itens add column if not exists capo smallint check (capo between 0 and 11);
