-- =====================================================================
-- Plataforma do Ministério de Louvor – PIB Vila Garrido
-- 01_estrutura.sql — tabelas, permissões (RLS), gatilhos e funções
-- Banco: Supabase (PostgreSQL). Executar uma única vez, na ordem.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.perfil_acesso as enum ('admin', 'lider', 'membro');
create type public.status_integrante as enum ('pendente', 'ativo', 'inativo');
create type public.nivel_funcao as enum ('titular', 'substituto', 'aprendendo');
create type public.modo_escala as enum ('fixa', 'disponibilidade');

-- ---------------------------------------------------------------------
-- Cadastros básicos
-- ---------------------------------------------------------------------
create table public.funcoes (
  id     smallint generated always as identity primary key,
  nome   text not null unique,
  ordem  smallint not null default 0,
  ativa  boolean not null default true
);

create table public.tipos_evento (
  id     smallint generated always as identity primary key,
  nome   text not null unique,
  ordem  smallint not null default 0,
  ativo  boolean not null default true
);

-- Integrante = pessoa do ministério (nome, perfil, situação).
-- Não guarda e-mail: o e-mail fica em "acessos", visível só para quem gerencia.
create table public.integrantes (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (length(trim(nome)) between 2 and 60),
  perfil        public.perfil_acesso not null default 'membro',
  status        public.status_integrante not null default 'pendente',
  pode_aprovar  boolean not null default false,
  criado_em     timestamptz not null default now()
);

-- Acesso = vínculo entre o integrante, o e-mail de login e a conta do Supabase Auth.
create table public.acessos (
  integrante_id  uuid primary key references public.integrantes(id) on delete cascade,
  email          text not null unique check (email = lower(trim(email)) and email like '%_@_%._%'),
  user_id        uuid unique references auth.users(id) on delete set null,
  vinculado_em   timestamptz
);

create table public.integrante_funcoes (
  integrante_id  uuid not null references public.integrantes(id) on delete cascade,
  funcao_id      smallint not null references public.funcoes(id),
  nivel          public.nivel_funcao not null default 'titular',
  validado       boolean not null default false,
  primary key (integrante_id, funcao_id)
);

-- ---------------------------------------------------------------------
-- Agenda e escalas
-- ---------------------------------------------------------------------
-- Programação = o dia (ex.: domingo 08/11). Guarda o repertório do dia.
create table public.programacoes (
  id               uuid primary key default gen_random_uuid(),
  data             date not null,
  titulo           text,
  link_cifraclub   text check (link_cifraclub is null or link_cifraclub ~* '^https://'),
  observacoes      text,
  criado_em        timestamptz not null default now()
);
create index on public.programacoes (data);

-- Culto/evento = horário dentro da programação. Guarda a escala.
create table public.cultos (
  id               uuid primary key default gen_random_uuid(),
  programacao_id   uuid not null references public.programacoes(id) on delete cascade,
  tipo_id          smallint not null references public.tipos_evento(id),
  horario          time not null,
  modo             public.modo_escala not null default 'fixa',
  observacoes      text
);
create index on public.cultos (programacao_id);

create table public.escala_posicoes (
  id              uuid primary key default gen_random_uuid(),
  culto_id        uuid not null references public.cultos(id) on delete cascade,
  funcao_id       smallint not null references public.funcoes(id),
  integrante_id   uuid references public.integrantes(id) on delete set null,
  apoio           boolean not null default false,
  ordem           smallint not null default 0
);
create index on public.escala_posicoes (culto_id);
create index on public.escala_posicoes (integrante_id);

-- "Posso participar" em eventos por disponibilidade
create table public.disponibilidades (
  culto_id        uuid not null references public.cultos(id) on delete cascade,
  integrante_id   uuid not null references public.integrantes(id) on delete cascade,
  funcao_id       smallint not null references public.funcoes(id),
  criado_em       timestamptz not null default now(),
  primary key (culto_id, integrante_id, funcao_id)
);

-- ---------------------------------------------------------------------
-- Repertório
-- ---------------------------------------------------------------------
-- Tom no formato de cifra: C, C#, Db, Dm, F#m, Bb...
create domain public.tom as text check (value ~ '^[A-G](#|b)?m?$');

create table public.musicas (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null,
  artista         text,
  tom_original    public.tom,
  bpm             smallint check (bpm between 30 and 250),
  link_cifraclub  text check (link_cifraclub is null or link_cifraclub ~* '^https://'),
  link_youtube    text check (link_youtube is null or link_youtube ~* '^https://'),
  link_spotify    text check (link_spotify is null or link_spotify ~* '^https://'),
  progressao      text,
  observacoes     text,
  ativa           boolean not null default true,
  revisar         boolean not null default false,
  criado_em       timestamptz not null default now()
);
create index on public.musicas (lower(titulo));

create table public.repertorio_itens (
  id               uuid primary key default gen_random_uuid(),
  programacao_id   uuid not null references public.programacoes(id) on delete cascade,
  musica_id        uuid not null references public.musicas(id),
  ordem            smallint not null default 0,
  tom_previsto     public.tom,
  tom_tocado       public.tom,
  ministro_id      uuid references public.integrantes(id) on delete set null,
  observacoes      text
);
create index on public.repertorio_itens (programacao_id);
create index on public.repertorio_itens (musica_id);

-- ---------------------------------------------------------------------
-- Equipamentos
-- ---------------------------------------------------------------------
create table public.equipamentos (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  categoria      text,
  descricao      text,
  link           text check (link is null or link ~* '^https://'),
  loja           text,
  verificado_em  date,
  ordem          smallint not null default 0,
  ativo          boolean not null default true
);

-- =====================================================================
-- Funções auxiliares de permissão (usadas nas políticas RLS)
-- security definer: leem as tabelas sem passar pela própria RLS
-- =====================================================================
create or replace function public.meu_integrante_id()
returns uuid language sql stable security definer set search_path = public as $$
  select a.integrante_id from public.acessos a where a.user_id = auth.uid()
$$;

create or replace function public.sou_ativo()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.acessos a join public.integrantes i on i.id = a.integrante_id
    where a.user_id = auth.uid() and i.status = 'ativo'
  )
$$;

create or replace function public.sou_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.acessos a join public.integrantes i on i.id = a.integrante_id
    where a.user_id = auth.uid() and i.status = 'ativo' and i.perfil = 'admin'
  )
$$;

create or replace function public.sou_lider()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.acessos a join public.integrantes i on i.id = a.integrante_id
    where a.user_id = auth.uid() and i.status = 'ativo' and i.perfil in ('admin', 'lider')
  )
$$;

create or replace function public.posso_aprovar()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.acessos a join public.integrantes i on i.id = a.integrante_id
    where a.user_id = auth.uid() and i.status = 'ativo'
      and (i.perfil in ('admin', 'lider') or i.pode_aprovar)
  )
$$;

-- Ministro escalado em algum culto da programação
create or replace function public.sou_ministro_de(p_programacao uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.escala_posicoes ep
    join public.cultos c on c.id = ep.culto_id
    join public.funcoes f on f.id = ep.funcao_id
    where c.programacao_id = p_programacao
      and f.nome = 'Ministro'
      and ep.integrante_id = public.meu_integrante_id()
      and public.sou_ativo()
  )
$$;

-- =====================================================================
-- Gatilhos de proteção
-- =====================================================================
-- Regras:
--  * só administrador define perfil e permissão de aprovar;
--  * situação (status) só muda por líder/admin ou pela função definir_status;
--  * dados de um administrador só são alterados por administrador.
create or replace function public.trg_integrantes_protecao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new; -- execução administrativa (SQL Editor, carga inicial)
  end if;
  if tg_op = 'INSERT' then
    if not public.sou_admin() then
      new.perfil := 'membro';
      new.pode_aprovar := false;
    end if;
    return new;
  end if;
  if old.perfil = 'admin' and not public.sou_admin() then
    raise exception 'apenas administradores alteram outro administrador';
  end if;
  if not public.sou_admin() then
    new.perfil := old.perfil;
    new.pode_aprovar := old.pode_aprovar;
  end if;
  if not public.sou_lider() and coalesce(current_setting('app.aprovando', true), '') <> '1' then
    new.status := old.status;
  end if;
  return new;
end $$;
create trigger integrantes_protecao before insert or update on public.integrantes
for each row execute function public.trg_integrantes_protecao();

-- E-mail de login de um administrador só é alterado por administrador
create or replace function public.trg_acessos_protecao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce(current_setting('app.vinculando', true), '') = '1' then
    return coalesce(new, old);
  end if;
  if exists (select 1 from public.integrantes i
             where i.id = coalesce(new.integrante_id, old.integrante_id) and i.perfil = 'admin')
     and not public.sou_admin() then
    raise exception 'apenas administradores alteram o acesso de outro administrador';
  end if;
  return coalesce(new, old);
end $$;
create trigger acessos_protecao before insert or update or delete on public.acessos
for each row execute function public.trg_acessos_protecao();

-- Função declarada pelo próprio membro entra como "não validada"
create or replace function public.trg_funcoes_validacao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_lider() and auth.uid() is not null then
    new.validado := false;
  end if;
  return new;
end $$;
create trigger integrante_funcoes_validacao before insert or update on public.integrante_funcoes
for each row execute function public.trg_funcoes_validacao();

-- =====================================================================
-- Funções chamadas pelo app (RPC)
-- =====================================================================
-- Após o login: liga a conta ao integrante cadastrado com o mesmo e-mail
create or replace function public.vincular_conta()
returns json language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  perform set_config('app.vinculando', '1', true);
  update public.acessos set user_id = auth.uid(), vinculado_em = now()
   where email = v_email and (user_id is null or user_id = auth.uid())
  returning integrante_id into v_id;
  perform set_config('app.vinculando', '', true);
  if v_id is null then
    return json_build_object('situacao', 'sem_cadastro');
  end if;
  return (select json_build_object('situacao', i.status, 'integrante_id', i.id, 'nome', i.nome, 'perfil', i.perfil)
          from public.integrantes i where i.id = v_id);
end $$;

-- Pessoa nova pede acesso: cria cadastro pendente com o e-mail do login
create or replace function public.solicitar_acesso(p_nome text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if exists (select 1 from public.acessos where email = v_email) then
    return public.vincular_conta();
  end if;
  insert into public.integrantes (nome, status) values (trim(p_nome), 'pendente') returning id into v_id;
  insert into public.acessos (integrante_id, email, user_id, vinculado_em) values (v_id, v_email, auth.uid(), now());
  return json_build_object('situacao', 'pendente', 'integrante_id', v_id);
end $$;

-- Aprovar ou recusar acesso (líder, admin ou quem tem permissão de aprovar)
create or replace function public.definir_status(p_integrante uuid, p_status public.status_integrante)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.posso_aprovar() then raise exception 'sem permissão'; end if;
  if exists (select 1 from public.integrantes where id = p_integrante and perfil = 'admin')
     and not public.sou_admin() then
    raise exception 'apenas administradores alteram outro administrador';
  end if;
  perform set_config('app.aprovando', '1', true);
  update public.integrantes set status = p_status where id = p_integrante;
  perform set_config('app.aprovando', '', true);
end $$;

-- Ministro do dia define a lista do Cifra Club da programação
create or replace function public.definir_lista_cifraclub(p_programacao uuid, p_link text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.sou_lider() or public.sou_ministro_de(p_programacao)) then
    raise exception 'sem permissão';
  end if;
  if p_link is not null and p_link !~* '^https://' then raise exception 'link inválido'; end if;
  update public.programacoes set link_cifraclub = nullif(trim(p_link), '') where id = p_programacao;
end $$;

-- Lista de pessoas que podem cobrir uma função (titular ou substituto validado)
create or replace function public.quem_pode(p_funcao smallint)
returns table (integrante_id uuid, nome text, nivel public.nivel_funcao)
language sql stable security definer set search_path = public as $$
  select i.id, i.nome, f.nivel
  from public.integrante_funcoes f join public.integrantes i on i.id = f.integrante_id
  where public.sou_ativo() and f.funcao_id = p_funcao and i.status = 'ativo'
    and f.validado and f.nivel in ('titular', 'substituto')
  order by f.nivel, i.nome
$$;

-- Verificação de atividade (evita a pausa do plano gratuito). Não expõe dados.
create or replace function public.ping()
returns text language sql stable as $$ select 'ok'::text $$;

-- =====================================================================
-- Permissões de linha (RLS)
-- =====================================================================
alter table public.funcoes            enable row level security;
alter table public.tipos_evento       enable row level security;
alter table public.integrantes        enable row level security;
alter table public.acessos            enable row level security;
alter table public.integrante_funcoes enable row level security;
alter table public.programacoes       enable row level security;
alter table public.cultos             enable row level security;
alter table public.escala_posicoes    enable row level security;
alter table public.disponibilidades   enable row level security;
alter table public.musicas            enable row level security;
alter table public.repertorio_itens   enable row level security;
alter table public.equipamentos       enable row level security;

-- Cadastros básicos: membros ativos leem; líderes editam
create policy funcoes_ler on public.funcoes for select to authenticated using (public.sou_ativo());
create policy funcoes_editar on public.funcoes for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
create policy tipos_ler on public.tipos_evento for select to authenticated using (public.sou_ativo());
create policy tipos_editar on public.tipos_evento for all to authenticated using (public.sou_lider()) with check (public.sou_lider());

-- Integrantes
create policy integrantes_ler on public.integrantes for select to authenticated
  using (public.sou_ativo() or id = public.meu_integrante_id());
create policy integrantes_criar on public.integrantes for insert to authenticated with check (public.sou_lider());
create policy integrantes_editar on public.integrantes for update to authenticated
  using (public.sou_lider() or id = public.meu_integrante_id())
  with check (public.sou_lider() or id = public.meu_integrante_id());
create policy integrantes_excluir on public.integrantes for delete to authenticated using (public.sou_admin());

-- Acessos (e-mails): só o próprio, líderes e quem aprova
create policy acessos_ler on public.acessos for select to authenticated
  using (user_id = auth.uid() or public.posso_aprovar());
create policy acessos_editar on public.acessos for all to authenticated
  using (public.sou_lider()) with check (public.sou_lider());

-- Funções de cada integrante: todos os ativos leem; o próprio declara; líder valida
create policy ifuncoes_ler on public.integrante_funcoes for select to authenticated
  using (public.sou_ativo() or integrante_id = public.meu_integrante_id());
create policy ifuncoes_proprio on public.integrante_funcoes for all to authenticated
  using (public.sou_lider() or (integrante_id = public.meu_integrante_id() and public.sou_ativo()))
  with check (public.sou_lider() or (integrante_id = public.meu_integrante_id() and public.sou_ativo()));

-- Agenda e escalas
create policy prog_ler on public.programacoes for select to authenticated using (public.sou_ativo());
create policy prog_editar on public.programacoes for all to authenticated using (public.sou_lider()) with check (public.sou_lider());
create policy cultos_ler on public.cultos for select to authenticated using (public.sou_ativo());
create policy cultos_editar on public.cultos for all to authenticated using (public.sou_lider()) with check (public.sou_lider());
create policy escala_ler on public.escala_posicoes for select to authenticated using (public.sou_ativo());
create policy escala_editar on public.escala_posicoes for all to authenticated using (public.sou_lider()) with check (public.sou_lider());

create policy disp_ler on public.disponibilidades for select to authenticated using (public.sou_ativo());
create policy disp_propria on public.disponibilidades for all to authenticated
  using (public.sou_lider() or (integrante_id = public.meu_integrante_id() and public.sou_ativo()))
  with check (public.sou_lider() or (integrante_id = public.meu_integrante_id() and public.sou_ativo()));

-- Repertório
create policy musicas_ler on public.musicas for select to authenticated using (public.sou_ativo());
create policy musicas_editar on public.musicas for all to authenticated using (public.sou_lider()) with check (public.sou_lider());
create policy itens_ler on public.repertorio_itens for select to authenticated using (public.sou_ativo());
create policy itens_editar on public.repertorio_itens for all to authenticated
  using (public.sou_lider() or public.sou_ministro_de(programacao_id))
  with check (public.sou_lider() or public.sou_ministro_de(programacao_id));

-- Equipamentos
create policy equip_ler on public.equipamentos for select to authenticated using (public.sou_ativo());
create policy equip_editar on public.equipamentos for all to authenticated using (public.sou_lider()) with check (public.sou_lider());

-- Funções RPC: só usuários logados (ping também para visitantes)
revoke execute on all functions in schema public from public, anon;
grant execute on function public.vincular_conta(), public.solicitar_acesso(text),
  public.definir_status(uuid, public.status_integrante), public.definir_lista_cifraclub(uuid, text),
  public.quem_pode(smallint), public.meu_integrante_id(), public.sou_ativo(), public.sou_admin(),
  public.sou_lider(), public.posso_aprovar(), public.sou_ministro_de(uuid) to authenticated;
grant execute on function public.ping() to anon, authenticated;

-- =====================================================================
-- Privilégios explícitos (projeto criado com "Automatically expose new tables" desligado)
-- Visitantes (anon) não acessam nenhuma tabela; usuários logados passam pela RLS acima.
-- =====================================================================
grant usage on schema public to anon, authenticated;
grant usage on type public.perfil_acesso, public.status_integrante, public.nivel_funcao,
  public.modo_escala, public.tom to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
