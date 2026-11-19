-- =====================================================================
-- 05_manter_ativo.sql — consulta "de verdade" para o plano gratuito não pausar
-- O Supabase pausou o projeto em 11/2026 por inatividade mesmo com o ping diário
-- (a função ping() só devolve 'ok' e não lê nenhuma tabela).
-- Esta função lê a tabela funcoes e devolve só a quantidade de linhas: nenhum dado
-- pessoal é exposto e as tabelas continuam fechadas para visitantes (RLS e grants).
-- Usada pela rotina .github/workflows/manter-ativo.yml.
-- =====================================================================
create or replace function public.manter_ativo()
returns integer
language sql
stable
security definer
set search_path = public
as $$ select count(*)::integer from public.funcoes $$;

revoke all on function public.manter_ativo() from public;
grant execute on function public.manter_ativo() to anon, authenticated;
