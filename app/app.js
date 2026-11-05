// =====================================================================
// Plataforma do Ministério de Louvor — PIB Vila Garrido
// HTML, CSS e JavaScript puros + Supabase (login por código e banco com RLS)
// =====================================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_CHAVE_PUBLICA } from './config.js';
import { TONS, campoHarmonico, transporProgressao, tomValido } from './musica.js';

const sb = createClient(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'louvor-pibvg-sessao' }
});

const app = document.getElementById('app');
const E = {
  eu: null,            // { integrante_id, nome, perfil, situacao }
  email: '',
  funcoes: [], tipos: [], integrantes: [], ifuncoes: [], musicas: [],
};

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
function dataBR(iso, comDia = true) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  const dia = DIAS[new Date(a, m - 1, d).getDay()];
  return (comDia ? dia + ', ' : '') + String(d).padStart(2, '0') + '/' + String(m).padStart(2, '0') + '/' + a;
}
const hora = (h) => (h || '').slice(0, 5);
function hojeISO() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
const ordenar = (arr, f) => [...arr].sort((a, b) => (f(a) < f(b) ? -1 : f(a) > f(b) ? 1 : 0));
const porId = (lista, id) => lista.find((x) => x.id === id);
const nomeIntegrante = (id) => porId(E.integrantes, id)?.nome || '';
const nomeFuncao = (id) => porId(E.funcoes, id)?.nome || '';
const nomeTipo = (id) => porId(E.tipos, id)?.nome || '';
// Integrantes que podem ser escalados: ativos, exceto contas só administrativas (admin sem funções)
const escalaveis = () => E.integrantes.filter((i) => i.status === 'ativo' && (i.perfil !== 'admin' || E.ifuncoes.some((f) => f.integrante_id === i.id)));
const sou = {
  admin: () => E.eu?.perfil === 'admin',
  lider: () => ['admin', 'lider'].includes(E.eu?.perfil),
  aprovador: () => sou.lider() || !!porId(E.integrantes, E.eu?.integrante_id)?.pode_aprovar,
};
const PERFIS = { admin: 'Administrador', lider: 'Líder', membro: 'Membro' };
const NIVEIS = { titular: 'Titular', substituto: 'Substituto', aprendendo: 'Aprendendo' };
const STATUS = { ativo: 'Ativo', pendente: 'Aguardando aprovação', inativo: 'Inativo' };

let avisoTimer;
function aviso(msg) {
  const el = document.getElementById('aviso');
  el.textContent = msg; el.hidden = false;
  clearTimeout(avisoTimer); avisoTimer = setTimeout(() => (el.hidden = true), 3500);
}
function erroAmigavel(e) {
  const m = (e?.message || String(e || '')).toLowerCase();
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com a internet. Tente de novo.';
  if (m.includes('rate limit') || m.includes('security purposes')) return 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.';
  if (m.includes('expired') || m.includes('invalid') && m.includes('token')) return 'Código inválido ou expirado. Peça um novo código.';
  if (m.includes('row-level security') || m.includes('sem permissão') || m.includes('permission')) return 'Você não tem permissão para esta ação.';
  if (m.includes('administrador')) return e.message;
  return 'Algo deu errado: ' + (e?.message || e);
}
async function exec(promessa) {
  const { data, error } = await promessa;
  if (error) throw error;
  return data;
}

const ICONES = {
  inicio: '<path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  escalas: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  repertorio: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  equipamentos: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="7" rx="1.5"/><rect x="17" y="14" width="4" height="7" rx="1.5"/>',
  perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  gestao: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  voltar: '<path d="m15 18-6-6 6-6"/>',
  externo: '<path d="M7 17 17 7M9 7h8v8"/>',
};
const icone = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[n]}</svg>`;

// ---------------------------------------------------------------------
// Diálogo genérico (formulários)
// ---------------------------------------------------------------------
function dialogo({ titulo, corpo, salvar = 'Salvar', perigo = null, aoSalvar, aoAbrir }) {
  const d = document.createElement('dialog');
  d.innerHTML = `<form method="dialog" novalidate>
    <div class="dlg-topo"><h2>${esc(titulo)}</h2><button type="button" class="btn btn-icone" data-fechar aria-label="Fechar">✕</button></div>
    <div class="dlg-corpo">${corpo}<div class="caixa-erro" data-erro hidden></div></div>
    <div class="dlg-acoes">
      ${perigo ? `<button type="button" class="btn perigo" data-perigo style="margin-right:auto">${esc(perigo.texto)}</button>` : ''}
      <button type="button" class="btn" data-fechar>Cancelar</button>
      ${aoSalvar ? `<button type="submit" class="btn primario" data-salvar>${esc(salvar)}</button>` : ''}
    </div></form>`;
  document.body.appendChild(d);
  const form = d.querySelector('form');
  const caixaErro = d.querySelector('[data-erro]');
  const fechar = () => { d.close(); d.remove(); };
  d.addEventListener('cancel', (ev) => { ev.preventDefault(); fechar(); });
  d.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', fechar));
  const rodar = async (fn) => {
    caixaErro.hidden = true;
    const botoes = d.querySelectorAll('button'); botoes.forEach((b) => (b.disabled = true));
    try { const r = await fn(form); if (r !== false) fechar(); }
    catch (e) { caixaErro.textContent = typeof e === 'string' ? e : erroAmigavel(e); caixaErro.hidden = false; }
    finally { botoes.forEach((b) => (b.disabled = false)); }
  };
  form.addEventListener('submit', (ev) => { ev.preventDefault(); if (aoSalvar) rodar(aoSalvar); });
  if (perigo) d.querySelector('[data-perigo]').addEventListener('click', () => { if (confirm(perigo.confirmar)) rodar(perigo.acao); });
  d.showModal();
  aoAbrir?.(form, d);
  return d;
}

// ---------------------------------------------------------------------
// Login por código no e-mail
// ---------------------------------------------------------------------
function telaLogin(etapa = 'email', email = '') {
  app.innerHTML = `<main class="login">
    <img class="logo" src="../img/logo-pibvg.svg" alt="Primeira Igreja Batista em Vila Garrido" width="648" height="285">
    <h1>Ministério de Louvor</h1>
    <p class="sub">${etapa === 'email' ? 'Entre com seu e-mail para receber um código de acesso.' : `Enviamos um código para <strong>${esc(email)}</strong>.`}</p>
    <div class="caixa-erro" id="erro" hidden></div>
    ${etapa === 'email' ? `
    <form id="f-email" novalidate>
      <label class="campo"><span>E-mail</span>
        <input type="email" name="email" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" required value="${esc(email)}"></label>
      <button class="btn primario bloco" type="submit">Receber código</button>
    </form>` : `
    <form id="f-codigo" novalidate>
      <label class="campo"><span>Código</span>
        <input class="codigo" type="text" name="codigo" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="8" required>
        <small>Confira também a caixa de spam. O código vale por 1 hora.</small></label>
      <button class="btn primario bloco" type="submit">Entrar</button>
      <div class="linha" style="justify-content:space-between;margin-top:12px">
        <button class="btn" type="button" id="trocar">Trocar e-mail</button>
        <button class="btn" type="button" id="reenviar">Reenviar código</button>
      </div>
    </form>`}
    <p class="pequeno suave" style="text-align:center;margin-top:24px"><a href="../">Página de links</a></p>
  </main>`;
  const erro = document.getElementById('erro');
  const mostrarErro = (e) => { erro.textContent = typeof e === 'string' ? e : erroAmigavel(e); erro.hidden = false; };
  const enviar = async (end) => {
    const { error } = await sb.auth.signInWithOtp({ email: end, options: { shouldCreateUser: true } });
    if (error) throw error;
  };
  if (etapa === 'email') {
    const f = document.getElementById('f-email');
    f.email.focus();
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const end = f.email.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(end)) return mostrarErro('Digite um e-mail válido.');
      const b = f.querySelector('button'); b.disabled = true; b.textContent = 'Enviando…';
      try { await enviar(end); telaLogin('codigo', end); }
      catch (e) { mostrarErro(e); b.disabled = false; b.textContent = 'Receber código'; }
    });
  } else {
    const f = document.getElementById('f-codigo');
    f.codigo.focus();
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const token = f.codigo.value.replace(/\D/g, '');
      if (token.length < 6) return mostrarErro('Digite o código completo recebido por e-mail.');
      const b = f.querySelector('button[type=submit]'); b.disabled = true; b.textContent = 'Entrando…';
      try {
        const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
        if (error) throw error;
        await entrar();
      } catch (e) { mostrarErro(e); b.disabled = false; b.textContent = 'Entrar'; }
    });
    document.getElementById('trocar').onclick = () => telaLogin('email', email);
    document.getElementById('reenviar').onclick = async () => {
      try { await enviar(email); aviso('Novo código enviado.'); } catch (e) { mostrarErro(e); }
    };
  }
}

function telaSimples(titulo, html) {
  app.innerHTML = `<main class="login">
    <img class="logo" src="../img/logo-pibvg.svg" alt="Primeira Igreja Batista em Vila Garrido" width="648" height="285">
    <h1>${esc(titulo)}</h1><div class="pilha" style="margin-top:16px">${html}</div>
    <button class="btn bloco" id="sair" style="margin-top:24px">Sair</button></main>`;
  document.getElementById('sair').onclick = sair;
}

function telaSolicitar() {
  telaSimples('Primeiro acesso', `
    <p class="sub">O e-mail <strong>${esc(E.email)}</strong> ainda não está cadastrado no ministério. Informe seu nome para pedir acesso à liderança.</p>
    <div class="caixa-erro" id="erro" hidden></div>
    <form id="f-sol" novalidate>
      <label class="campo"><span>Seu nome</span><input type="text" name="nome" autocomplete="name" maxlength="60" required></label>
      <button class="btn primario bloco" type="submit">Pedir acesso</button>
    </form>`);
  const f = document.getElementById('f-sol');
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const nome = f.nome.value.trim();
    const erro = document.getElementById('erro');
    if (nome.length < 2) { erro.textContent = 'Informe seu nome.'; erro.hidden = false; return; }
    try { await exec(sb.rpc('solicitar_acesso', { p_nome: nome })); await entrar(); }
    catch (e) { erro.textContent = erroAmigavel(e); erro.hidden = false; }
  });
}

async function sair() {
  await sb.auth.signOut();
  E.eu = null;
  location.hash = '';
  telaLogin();
}

async function entrar() {
  app.innerHTML = '<div class="carregando" role="status"><span class="spinner" aria-hidden="true"></span>Carregando…</div>';
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return telaLogin();
  E.email = session.user.email;
  let r;
  try { r = await exec(sb.rpc('vincular_conta')); }
  catch (e) { return telaSimples('Não foi possível entrar', `<div class="caixa-erro">${esc(erroAmigavel(e))}</div><button class="btn primario bloco" onclick="location.reload()">Tentar de novo</button>`); }
  if (r.situacao === 'sem_cadastro') return telaSolicitar();
  if (r.situacao === 'pendente') return telaSimples('Aguardando aprovação', `<p class="sub">Seu pedido de acesso com o e-mail <strong>${esc(E.email)}</strong> foi registrado. Assim que a liderança aprovar, é só entrar de novo.</p><button class="btn primario bloco" onclick="location.reload()">Verificar novamente</button>`);
  if (r.situacao === 'inativo') return telaSimples('Acesso desativado', `<p class="sub">Seu cadastro está inativo. Fale com a liderança do ministério.</p>`);
  E.eu = r;
  try { await carregarBase(); }
  catch (e) { return telaSimples('Não foi possível carregar', `<div class="caixa-erro">${esc(erroAmigavel(e))}</div><button class="btn primario bloco" onclick="location.reload()">Tentar de novo</button>`); }
  rotear();
}

async function carregarBase() {
  const [funcoes, tipos, integrantes, ifuncoes, musicas] = await Promise.all([
    exec(sb.from('funcoes').select('id,nome,ordem,ativa').order('ordem')),
    exec(sb.from('tipos_evento').select('id,nome,ordem,ativo').order('ordem')),
    exec(sb.from('integrantes').select('id,nome,perfil,status,pode_aprovar').order('nome')),
    exec(sb.from('integrante_funcoes').select('integrante_id,funcao_id,nivel,validado')),
    exec(sb.from('musicas').select('*').order('titulo')),
  ]);
  Object.assign(E, { funcoes, tipos, integrantes, ifuncoes, musicas });
}

// ---------------------------------------------------------------------
// Estrutura das páginas e rotas
// ---------------------------------------------------------------------
const ABAS = [
  ['inicio', 'Início'], ['escalas', 'Escalas'], ['repertorio', 'Repertório'],
  ['equipamentos', 'Equip.'], ['perfil', 'Perfil'],
];
function moldura(aba, html, { voltar = null } = {}) {
  const abas = sou.aprovador() ? [...ABAS, ['gestao', 'Gestão']] : ABAS;
  app.innerHTML = `
    <header class="topo">
      ${voltar ? `<a class="btn btn-icone" href="${voltar}" aria-label="Voltar">${icone('voltar')}</a>` : ''}
      <div class="marca"><img src="../img/apple-touch-icon.png" alt="" width="32" height="32"><strong>Ministério de Louvor</strong></div>
    </header>
    <main class="conteudo" id="conteudo">${html}</main>
    <nav class="barra" aria-label="Navegação principal">
      ${abas.map(([id, rot]) => `<a href="#/${id}" ${aba === id ? 'aria-current="page"' : ''}>${icone(id)}<span>${rot}</span></a>`).join('')}
    </nav>`;
  window.scrollTo(0, 0);
}
function carregando(aba) { moldura(aba, '<div class="carregando" role="status"><span class="spinner" aria-hidden="true"></span>Carregando…</div>'); }

async function rotear() {
  if (!E.eu) return;
  const [rota, id] = location.hash.replace(/^#\/?/, '').split('/');
  try {
    switch (rota) {
      case 'escalas': return await pgEscalas();
      case 'programacao': return await pgProgramacao(id);
      case 'repertorio': return pgRepertorio();
      case 'musica': return await pgMusica(id);
      case 'equipamentos': return await pgEquipamentos();
      case 'perfil': return pgPerfil();
      case 'gestao': return sou.aprovador() ? await pgGestao() : pgInicio();
      default: return await pgInicio();
    }
  } catch (e) {
    moldura(rota || 'inicio', `<div class="caixa-erro">${esc(erroAmigavel(e))}</div><button class="btn" onclick="location.reload()">Recarregar</button>`);
  }
}
window.addEventListener('hashchange', rotear);

// ---------------------------------------------------------------------
// Dados de programações (dia) → cultos (horário) → posições (escala)
// ---------------------------------------------------------------------
const SELECT_PROG = 'id,data,titulo,link_cifraclub,observacoes,cultos(id,horario,modo,observacoes,tipo_id,escala_posicoes(id,funcao_id,integrante_id,apoio,ordem),disponibilidades(integrante_id,funcao_id)),repertorio_itens(id,musica_id,ordem,tom_previsto,tom_tocado,ministro_id,observacoes)';
function normalizar(p) {
  p.cultos = ordenar(p.cultos || [], (c) => c.horario);
  p.cultos.forEach((c) => (c.escala_posicoes = ordenar(c.escala_posicoes || [], (x) => x.ordem)));
  p.repertorio_itens = ordenar(p.repertorio_itens || [], (x) => x.ordem);
  return p;
}
async function buscarProgramacoes(futuras = true, limite = 40) {
  let q = sb.from('programacoes').select(SELECT_PROG);
  q = futuras ? q.gte('data', hojeISO()).order('data') : q.lt('data', hojeISO()).order('data', { ascending: false });
  return (await exec(q.limit(limite))).map(normalizar);
}
const assinatura = (c) => c.escala_posicoes.map((x) => `${x.funcao_id}:${x.integrante_id}:${x.apoio}`).join('|');
// Agrupa cultos com a mesma equipe (ex.: 18:00 e 20:00) para mostrar uma vez só
function gruposDeCultos(p) {
  const grupos = [];
  for (const c of p.cultos) {
    const g = grupos.find((x) => c.modo === 'fixa' && x.modo === 'fixa' && x.tipo_id === c.tipo_id && assinatura(x.cultos[0]) === assinatura(c));
    if (g) g.cultos.push(c); else grupos.push({ modo: c.modo, tipo_id: c.tipo_id, cultos: [c] });
  }
  return grupos;
}
const horarios = (cs) => cs.map((c) => hora(c.horario)).join(' e ');
function listaPosicoes(c) {
  if (!c.escala_posicoes.length) return '<p class="suave pequeno">Escala ainda não montada.</p>';
  return `<ul class="posicoes">${c.escala_posicoes.map((x) => {
    const eu = x.integrante_id && x.integrante_id === E.eu.integrante_id;
    const nome = x.integrante_id ? esc(nomeIntegrante(x.integrante_id)) : '<span class="vaga">vaga em aberto</span>';
    return `<li><span class="funcao">${esc(nomeFuncao(x.funcao_id))}${x.apoio ? ' (apoio)' : ''}</span><span class="${eu ? 'eu' : ''}">${nome}${eu ? ' (você)' : ''}</span></li>`;
  }).join('')}</ul>`;
}
function minhaParticipacao(p) {
  const r = [];
  for (const c of p.cultos) for (const x of c.escala_posicoes) if (x.integrante_id === E.eu.integrante_id) r.push({ c, f: nomeFuncao(x.funcao_id) });
  return r;
}
const vagasAbertas = (p) => p.cultos.reduce((n, c) => n + c.escala_posicoes.filter((x) => !x.integrante_id).length, 0);
const ministrosDe = (p) => [...new Set(p.cultos.flatMap((c) => c.escala_posicoes.filter((x) => nomeFuncao(x.funcao_id) === 'Ministro' && x.integrante_id).map((x) => nomeIntegrante(x.integrante_id))))];
const souMinistroDe = (p) => p.cultos.some((c) => c.escala_posicoes.some((x) => nomeFuncao(x.funcao_id) === 'Ministro' && x.integrante_id === E.eu.integrante_id));

// ---------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------
async function pgInicio() {
  carregando('inicio');
  const progs = await buscarProgramacoes(true, 20);
  const minhas = progs.map((p) => ({ p, m: minhaParticipacao(p) })).filter((x) => x.m.length).slice(0, 4);
  const proxima = progs[0];
  const abertos = progs.filter((p) => p.cultos.some((c) => c.modo === 'disponibilidade'));
  let pendentes = 0;
  if (sou.aprovador()) pendentes = E.integrantes.filter((i) => i.status === 'pendente').length;
  const primeiroNome = E.eu.nome.split(' ')[0];
  moldura('inicio', `
    <h1>Olá, ${esc(primeiroNome)}!</h1>
    <p class="suave">${esc(PERFIS[E.eu.perfil])}</p>
    ${pendentes ? `<a class="cartao clicavel" href="#/gestao"><div class="entre"><strong>${pendentes} pedido(s) de acesso aguardando</strong><span class="etiqueta alerta">Aprovar</span></div></a>` : ''}
    ${!minhas.length && !E.ifuncoes.some((f) => f.integrante_id === E.eu.integrante_id) ? '' : '<div class="secao"><h2>Minhas próximas escalas</h2></div>'}
    ${minhas.length ? minhas.map(({ p, m }) => `
      <a class="cartao clicavel" href="#/programacao/${p.id}">
        <div class="entre"><span class="data-grande">${dataBR(p.data)}</span><span class="etiqueta">${esc([...new Set(m.map((x) => x.f))].join(', '))}</span></div>
        <p class="suave pequeno" style="margin:4px 0 0">${esc(p.titulo || '')} · ${horarios([...new Set(m.map((x) => x.c))])}</p>
      </a>`).join('') : (E.ifuncoes.some((f) => f.integrante_id === E.eu.integrante_id) ? '<div class="cartao vazio">Você não está em nenhuma escala futura.</div>' : '')}
    ${proxima ? `<div class="secao"><h2>Próxima programação</h2></div>
      <a class="cartao clicavel" href="#/programacao/${proxima.id}">
        <div class="entre"><span class="data-grande">${dataBR(proxima.data)}</span>${vagasAbertas(proxima) ? `<span class="etiqueta alerta">${vagasAbertas(proxima)} vaga(s)</span>` : ''}</div>
        <p class="pequeno" style="margin:6px 0 0"><strong>Ministro:</strong> ${esc(ministrosDe(proxima).join(', ') || 'a definir')}</p>
        <p class="pequeno suave" style="margin:2px 0 0">${proxima.repertorio_itens.length ? proxima.repertorio_itens.length + ' música(s) no repertório' : 'Repertório ainda não definido'}${proxima.link_cifraclub ? ' · lista do Cifra Club disponível' : ''}</p>
      </a>` : ''}
    ${abertos.length ? `<div class="secao"><h2>Eventos abertos</h2></div>
      ${abertos.map((p) => `<a class="cartao clicavel" href="#/programacao/${p.id}"><div class="entre"><span class="data-grande">${dataBR(p.data)}</span><span class="etiqueta">Marque se pode participar</span></div><p class="pequeno suave" style="margin:4px 0 0">${esc(p.titulo || '')}</p></a>`).join('')}` : ''}
  `);
}

// ---------------------------------------------------------------------
// Escalas
// ---------------------------------------------------------------------
const filtros = { periodo: 'proximas', integrante: '', funcao: '' };
async function pgEscalas() {
  carregando('escalas');
  const progs = await buscarProgramacoes(filtros.periodo === 'proximas', 60);
  const opcoesInt = escalaveis().map((i) => `<option value="${i.id}" ${filtros.integrante === i.id ? 'selected' : ''}>${esc(i.nome)}</option>`).join('');
  const opcoesFun = E.funcoes.map((f) => `<option value="${f.id}" ${String(filtros.funcao) === String(f.id) ? 'selected' : ''}>${esc(f.nome)}</option>`).join('');
  const filtrada = progs.filter((p) => {
    if (!filtros.integrante && !filtros.funcao) return true;
    return p.cultos.some((c) => c.escala_posicoes.some((x) =>
      (!filtros.integrante || x.integrante_id === filtros.integrante) && (!filtros.funcao || String(x.funcao_id) === String(filtros.funcao))));
  });
  moldura('escalas', `
    <div class="entre"><h1>Escalas</h1>${sou.lider() ? '<button class="btn primario compacto" id="novo">+ Novo evento</button>' : ''}</div>
    <div class="grade-2" style="margin-top:12px">
      <label class="campo"><span class="sr">Período</span><select id="f-per"><option value="proximas">Próximas</option><option value="anteriores" ${filtros.periodo === 'anteriores' ? 'selected' : ''}>Anteriores</option></select></label>
      <label class="campo"><span class="sr">Função</span><select id="f-fun"><option value="">Todas as funções</option>${opcoesFun}</select></label>
    </div>
    <label class="campo"><span class="sr">Integrante</span><select id="f-int"><option value="">Todos os integrantes</option><option value="${E.eu.integrante_id}" ${filtros.integrante === E.eu.integrante_id ? 'selected' : ''}>Somente as minhas</option>${opcoesInt}</select></label>
    ${filtrada.length ? filtrada.map(cartaoProgramacao).join('') : '<div class="cartao vazio">Nenhuma programação encontrada.</div>'}
  `);
  document.getElementById('f-per').onchange = (e) => { filtros.periodo = e.target.value; pgEscalas(); };
  document.getElementById('f-fun').onchange = (e) => { filtros.funcao = e.target.value; pgEscalas(); };
  document.getElementById('f-int').onchange = (e) => { filtros.integrante = e.target.value; pgEscalas(); };
  document.getElementById('novo')?.addEventListener('click', dlgNovoEvento);
}
function cartaoProgramacao(p) {
  const vagas = vagasAbertas(p);
  return `<a class="cartao clicavel" href="#/programacao/${p.id}">
    <div class="entre"><div><div class="data-grande">${dataBR(p.data)}</div><div class="suave pequeno">${esc(p.titulo || '')}</div></div>
      <div class="linha">${vagas ? `<span class="etiqueta alerta">${vagas} vaga(s)</span>` : ''}${p.repertorio_itens.length ? `<span class="etiqueta neutra">${p.repertorio_itens.length} música(s)</span>` : ''}</div></div>
    ${gruposDeCultos(p).map((g) => `<div class="culto"><strong class="pequeno">${esc(nomeTipo(g.tipo_id))} · ${horarios(g.cultos)}</strong>
      ${g.modo === 'disponibilidade' ? `<p class="pequeno suave" style="margin:4px 0 0">Escala por disponibilidade · ${new Set(g.cultos[0].disponibilidades.map((d) => d.integrante_id)).size} disponível(is)</p>` : ''}
      ${listaPosicoes(g.cultos[0])}</div>`).join('')}
  </a>`;
}

async function pgProgramacao(id) {
  carregando('escalas');
  const p = normalizar(await exec(sb.from('programacoes').select(SELECT_PROG).eq('id', id).single()));
  const podeRepertorio = sou.lider() || souMinistroDe(p);
  const grupos = gruposDeCultos(p);
  moldura('escalas', `
    <div class="entre"><div><h1>${dataBR(p.data)}</h1><p class="suave" style="margin:2px 0 0">${esc(p.titulo || '')}</p></div>
      ${sou.lider() ? '<button class="btn compacto" id="editar-prog">Editar</button>' : ''}</div>
    ${p.observacoes ? `<div class="cartao pequeno" style="margin-top:12px">${esc(p.observacoes)}</div>` : ''}
    <div class="secao"><h2>Escala</h2>${sou.lider() ? '<button class="btn compacto" id="add-culto">+ Horário</button>' : ''}</div>
    ${grupos.map((g) => blocoGrupo(p, g)).join('') || '<div class="cartao vazio">Nenhum horário cadastrado.</div>'}
    <div class="secao"><h2>Repertório do dia</h2>${podeRepertorio ? '<button class="btn compacto" id="add-musica">+ Música</button>' : ''}</div>
    <div class="cartao">
      <div class="entre"><div><strong>Lista do Cifra Club</strong><div class="pequeno suave">${p.link_cifraclub ? 'Definida pelo ministro' : 'Ainda não informada'}</div></div>
        <div class="linha">${p.link_cifraclub ? `<a class="btn compacto" href="${esc(p.link_cifraclub)}" target="_blank" rel="noopener">Abrir ${icone('externo')}</a>` : ''}
        ${podeRepertorio ? '<button class="btn compacto" id="link-cc">' + (p.link_cifraclub ? 'Trocar' : 'Informar') + '</button>' : ''}</div></div>
    </div>
    ${p.repertorio_itens.length ? `<div class="cartao"><ul class="itens">${p.repertorio_itens.map((it, i) => itemRepertorio(it, i, p, podeRepertorio)).join('')}</ul></div>`
      : '<div class="cartao vazio">Nenhuma música selecionada ainda.</div>'}
  `, { voltar: '#/escalas' });

  document.getElementById('editar-prog')?.addEventListener('click', () => dlgProgramacao(p));
  document.getElementById('add-culto')?.addEventListener('click', () => dlgCulto(p, null));
  document.getElementById('add-musica')?.addEventListener('click', () => dlgItemRepertorio(p, null));
  document.getElementById('link-cc')?.addEventListener('click', () => dlgLinkCifra(p));
  const c = document.getElementById('conteudo');
  c.querySelectorAll('[data-editar-culto]').forEach((b) => b.addEventListener('click', () => dlgEscala(p, b.dataset.editarCulto)));
  c.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', () => copiarEquipe(p, b.dataset.copiar)));
  c.querySelectorAll('[data-cfg-culto]').forEach((b) => b.addEventListener('click', () => dlgCulto(p, porId(p.cultos, b.dataset.cfgCulto))));
  c.querySelectorAll('[data-disp]').forEach((f) => f.addEventListener('submit', (ev) => marcarDisponibilidade(ev, p)));
  c.querySelectorAll('[data-item]').forEach((b) => b.addEventListener('click', () => dlgItemRepertorio(p, porId(p.repertorio_itens, b.dataset.item))));
  c.querySelectorAll('[data-mover]').forEach((b) => b.addEventListener('click', () => moverItem(p, b.dataset.mover, Number(b.dataset.dir))));
}

function blocoGrupo(p, g) {
  const c0 = g.cultos[0];
  const lider = sou.lider();
  let extra = '';
  if (g.modo === 'disponibilidade') {
    const minhas = new Set(c0.disponibilidades.filter((d) => d.integrante_id === E.eu.integrante_id).map((d) => d.funcao_id));
    const minhasFuncoes = E.ifuncoes.filter((f) => f.integrante_id === E.eu.integrante_id);
    const disp = {};
    c0.disponibilidades.forEach((d) => ((disp[d.funcao_id] ||= []).push(nomeIntegrante(d.integrante_id))));
    extra = `<form class="pilha" data-disp="${c0.id}" style="margin-top:12px">
      <p class="pequeno"><strong>Posso participar como:</strong></p>
      ${minhasFuncoes.length ? `<div class="linha">${minhasFuncoes.map((f) => `<label class="linha pequeno"><input type="checkbox" name="f" value="${f.funcao_id}" ${minhas.has(f.funcao_id) ? 'checked' : ''}>${esc(nomeFuncao(f.funcao_id))}</label>`).join('')}</div>
        <button class="btn compacto" type="submit">Salvar disponibilidade</button>` : '<p class="pequeno suave">Cadastre suas funções no Perfil para marcar disponibilidade.</p>'}
    </form>
    ${Object.keys(disp).length ? `<p class="pequeno" style="margin-top:12px"><strong>Disponíveis:</strong> ${Object.entries(disp).map(([f, ns]) => `${esc(nomeFuncao(Number(f)))}: ${esc(ns.join(', '))}`).join(' · ')}</p>` : ''}`;
  }
  const outros = p.cultos.filter((c) => !g.cultos.includes(c));
  return `<div class="cartao">
    <div class="entre"><strong>${esc(nomeTipo(g.tipo_id))} · ${horarios(g.cultos)}</strong>
      ${lider ? `<div class="linha">${g.cultos.map((c) => `<button class="btn compacto" data-cfg-culto="${c.id}" aria-label="Configurar horário ${hora(c.horario)}">⚙ ${hora(c.horario)}</button>`).join('')}</div>` : ''}</div>
    ${c0.observacoes ? `<p class="pequeno suave" style="margin:4px 0 0">${esc(c0.observacoes)}</p>` : ''}
    ${listaPosicoes(c0)}
    ${extra}
    ${lider ? `<div class="linha" style="margin-top:12px">
      ${g.cultos.map((c) => `<button class="btn compacto" data-editar-culto="${c.id}">Editar escala${g.cultos.length > 1 ? ' ' + hora(c.horario) : ''}</button>`).join('')}
      ${outros.length ? `<button class="btn compacto" data-copiar="${c0.id}">Copiar equipe para ${horarios(outros)}</button>` : ''}
    </div>` : ''}
  </div>`;
}

async function marcarDisponibilidade(ev, p) {
  ev.preventDefault();
  const cultoId = ev.target.dataset.disp;
  const marcadas = [...ev.target.querySelectorAll('input[name=f]:checked')].map((i) => Number(i.value));
  try {
    await exec(sb.from('disponibilidades').delete().eq('culto_id', cultoId).eq('integrante_id', E.eu.integrante_id));
    if (marcadas.length) await exec(sb.from('disponibilidades').insert(marcadas.map((f) => ({ culto_id: cultoId, integrante_id: E.eu.integrante_id, funcao_id: f }))));
    aviso('Disponibilidade salva.');
    pgProgramacao(p.id);
  } catch (e) { aviso(erroAmigavel(e)); }
}

async function copiarEquipe(p, origemId) {
  const origem = porId(p.cultos, origemId);
  const destinos = p.cultos.filter((c) => c.id !== origemId);
  if (!confirm(`Copiar a equipe de ${hora(origem.horario)} para ${horarios(destinos)}? A escala desses horários será substituída.`)) return;
  try {
    for (const d of destinos) {
      await exec(sb.from('escala_posicoes').delete().eq('culto_id', d.id));
      if (origem.escala_posicoes.length) await exec(sb.from('escala_posicoes').insert(origem.escala_posicoes.map((x) => ({ culto_id: d.id, funcao_id: x.funcao_id, integrante_id: x.integrante_id, apoio: x.apoio, ordem: x.ordem }))));
    }
    aviso('Equipe copiada.');
    pgProgramacao(p.id);
  } catch (e) { aviso(erroAmigavel(e)); }
}

// Editor de escala de um culto
function opcoesIntegrantes(funcaoId, selecionado) {
  const ativos = [...escalaveis(), ...E.integrantes.filter((i) => i.id === selecionado && !escalaveis().includes(i))];
  const nivelDe = (iid) => E.ifuncoes.find((f) => f.integrante_id === iid && f.funcao_id === Number(funcaoId));
  const comFuncao = ativos.filter((i) => nivelDe(i.id));
  const outros = ativos.filter((i) => !nivelDe(i.id));
  const opt = (i) => {
    const n = nivelDe(i.id);
    const rot = n ? ` — ${NIVEIS[n.nivel]}${n.validado ? '' : ' (não validado)'}` : '';
    return `<option value="${i.id}" ${i.id === selecionado ? 'selected' : ''}>${esc(i.nome)}${rot}</option>`;
  };
  return `<option value="">— vaga em aberto —</option>
    <optgroup label="Exercem esta função">${ordenar(comFuncao, (i) => ({ titular: 0, substituto: 1, aprendendo: 2 }[nivelDe(i.id).nivel] + i.nome)).map(opt).join('')}</optgroup>
    <optgroup label="Outros integrantes">${outros.map(opt).join('')}</optgroup>`;
}
function linhaPosicao(x) {
  return `<div class="cartao" data-pos style="padding:12px">
    <div class="grade-2">
      <label class="campo" style="margin:0"><span class="pequeno">Função</span>
        <select name="funcao">${E.funcoes.map((f) => `<option value="${f.id}" ${f.id === x.funcao_id ? 'selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></label>
      <label class="campo" style="margin:0"><span class="pequeno">Integrante</span>
        <select name="integrante">${opcoesIntegrantes(x.funcao_id, x.integrante_id)}</select></label>
    </div>
    <div class="entre" style="margin-top:8px"><label class="linha pequeno"><input type="checkbox" name="apoio" ${x.apoio ? 'checked' : ''}> Vaga de apoio (aprendiz)</label>
      <button type="button" class="btn compacto perigo" data-remover>Remover</button></div>
  </div>`;
}
function dlgEscala(p, cultoId) {
  const culto = porId(p.cultos, cultoId);
  const corpo = `<p class="pequeno suave">${dataBR(p.data)} · ${hora(culto.horario)}. A lista de integrantes mostra primeiro quem exerce a função.</p>
    <div class="caixa-aviso" data-alertas hidden></div>
    <div data-lista>${culto.escala_posicoes.map(linhaPosicao).join('')}</div>
    <button type="button" class="btn bloco" data-add>+ Adicionar posição</button>`;
  dialogo({
    titulo: 'Editar escala', corpo,
    aoAbrir: (form) => {
      const lista = form.querySelector('[data-lista]');
      const alertas = form.querySelector('[data-alertas]');
      const verificar = () => {
        const nomes = [...lista.querySelectorAll('select[name=integrante]')].map((s) => s.value).filter(Boolean);
        const dup = [...new Set(nomes.filter((v, i) => nomes.indexOf(v) !== i))];
        alertas.hidden = !dup.length;
        alertas.textContent = dup.length ? `Atenção: ${dup.map(nomeIntegrante).join(', ')} aparece(m) em mais de uma posição neste horário.` : '';
      };
      lista.addEventListener('change', (ev) => {
        if (ev.target.name === 'funcao') {
          const linha = ev.target.closest('[data-pos]');
          const sel = linha.querySelector('select[name=integrante]');
          sel.innerHTML = opcoesIntegrantes(Number(ev.target.value), sel.value);
        }
        verificar();
      });
      lista.addEventListener('click', (ev) => { if (ev.target.matches('[data-remover]')) { ev.target.closest('[data-pos]').remove(); verificar(); } });
      form.querySelector('[data-add]').addEventListener('click', () => {
        lista.insertAdjacentHTML('beforeend', linhaPosicao({ funcao_id: E.funcoes[1]?.id || E.funcoes[0].id, integrante_id: '', apoio: false }));
      });
      verificar();
    },
    aoSalvar: async (form) => {
      const linhas = [...form.querySelectorAll('[data-pos]')].map((el, i) => ({
        culto_id: cultoId, funcao_id: Number(el.querySelector('[name=funcao]').value),
        integrante_id: el.querySelector('[name=integrante]').value || null, apoio: el.querySelector('[name=apoio]').checked, ordem: i,
      }));
      await exec(sb.from('escala_posicoes').delete().eq('culto_id', cultoId));
      if (linhas.length) await exec(sb.from('escala_posicoes').insert(linhas));
      aviso('Escala salva.');
      pgProgramacao(p.id);
    },
  });
}

// Programação (dia): editar ou excluir
function dlgProgramacao(p) {
  dialogo({
    titulo: 'Editar programação',
    corpo: `<label class="campo"><span>Data</span><input type="date" name="data" value="${p.data}" required></label>
      <label class="campo"><span>Título</span><input type="text" name="titulo" value="${esc(p.titulo || '')}" maxlength="80"></label>
      <label class="campo"><span>Observações</span><textarea name="obs" maxlength="500">${esc(p.observacoes || '')}</textarea></label>`,
    perigo: sou.lider() ? { texto: 'Excluir', confirmar: 'Excluir esta programação com escalas e repertório?', acao: async () => {
      await exec(sb.from('programacoes').delete().eq('id', p.id)); aviso('Programação excluída.'); location.hash = '#/escalas';
    } } : null,
    aoSalvar: async (f) => {
      if (!f.data.value) throw 'Informe a data.';
      await exec(sb.from('programacoes').update({ data: f.data.value, titulo: f.titulo.value.trim() || null, observacoes: f.obs.value.trim() || null }).eq('id', p.id));
      aviso('Programação atualizada.'); pgProgramacao(p.id);
    },
  });
}

// Horário (culto/evento): criar, configurar ou excluir
function camposCulto(c = {}) {
  return `<div class="grade-2">
    <label class="campo"><span>Horário</span><input type="time" name="horario" value="${hora(c.horario) || '19:00'}" required></label>
    <label class="campo"><span>Tipo</span><select name="tipo">${E.tipos.filter((t) => t.ativo).map((t) => `<option value="${t.id}" ${t.id === c.tipo_id ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}</select></label></div>
    <label class="campo"><span>Como montar a escala</span><select name="modo">
      <option value="fixa" ${c.modo !== 'disponibilidade' ? 'selected' : ''}>Escala definida pela liderança</option>
      <option value="disponibilidade" ${c.modo === 'disponibilidade' ? 'selected' : ''}>Por disponibilidade ("quem puder")</option></select></label>
    <label class="campo"><span>Observações</span><input type="text" name="obs" value="${esc(c.observacoes || '')}" maxlength="200"></label>`;
}
function dlgCulto(p, c) {
  dialogo({
    titulo: c ? 'Configurar horário' : 'Novo horário',
    corpo: camposCulto(c || { tipo_id: p.cultos[0]?.tipo_id }),
    perigo: c ? { texto: 'Excluir horário', confirmar: 'Excluir este horário e sua escala?', acao: async () => {
      await exec(sb.from('cultos').delete().eq('id', c.id)); aviso('Horário excluído.'); pgProgramacao(p.id);
    } } : null,
    aoSalvar: async (f) => {
      const dados = { horario: f.horario.value, tipo_id: Number(f.tipo.value), modo: f.modo.value, observacoes: f.obs.value.trim() || null };
      if (c) await exec(sb.from('cultos').update(dados).eq('id', c.id));
      else await exec(sb.from('cultos').insert({ ...dados, programacao_id: p.id }));
      aviso('Horário salvo.'); pgProgramacao(p.id);
    },
  });
}
const FORMACAO_PADRAO = ['Ministro', 'Vocal', 'Vocal', 'Vocal', 'Violão', 'Baixo', 'Bateria', 'Teclado'];
function dlgNovoEvento() {
  const domingo = E.tipos.find((t) => t.nome === 'Culto de domingo');
  dialogo({
    titulo: 'Novo evento', salvar: 'Criar',
    corpo: `<label class="campo"><span>Data</span><input type="date" name="data" required></label>
      <label class="campo"><span>Título</span><input type="text" name="titulo" placeholder="Ex.: Culto de domingo, Culto de jovens" maxlength="80"></label>
      <label class="campo"><span>Tipo</span><select name="tipo">${E.tipos.filter((t) => t.ativo).map((t) => `<option value="${t.id}">${esc(t.nome)}</option>`).join('')}</select></label>
      <fieldset class="campo" style="border:0;padding:0"><legend style="font-weight:600;font-size:.9rem;margin-bottom:6px">Horários</legend>
        <div class="linha"><label class="linha"><input type="checkbox" name="h18" checked> 18:00</label><label class="linha"><input type="checkbox" name="h20" checked> 20:00</label>
        <label class="linha">Outro: <input type="time" name="houtro" style="width:auto"></label></div></fieldset>
      <label class="campo"><span>Como montar a escala</span><select name="modo"><option value="fixa">Escala definida pela liderança</option><option value="disponibilidade">Por disponibilidade ("quem puder")</option></select></label>
      <label class="linha campo"><input type="checkbox" name="padrao" checked> Criar posições da formação padrão (1 ministro, 3 vocais, violão, baixo, bateria, teclado)</label>`,
    aoAbrir: (f) => {
      if (domingo) f.tipo.value = domingo.id;
      f.tipo.addEventListener('change', () => {
        const dom = Number(f.tipo.value) === domingo?.id;
        f.h18.checked = dom; f.h20.checked = dom;
        f.modo.value = dom ? 'fixa' : 'disponibilidade';
      });
    },
    aoSalvar: async (f) => {
      if (!f.data.value) throw 'Informe a data.';
      const hs = [f.h18.checked && '18:00', f.h20.checked && '20:00', f.houtro.value].filter(Boolean);
      if (!hs.length) throw 'Escolha pelo menos um horário.';
      const tipo = Number(f.tipo.value);
      const prog = (await exec(sb.from('programacoes').insert({ data: f.data.value, titulo: f.titulo.value.trim() || nomeTipo(tipo) }).select('id').single()));
      const cultos = await exec(sb.from('cultos').insert([...new Set(hs)].map((h) => ({ programacao_id: prog.id, tipo_id: tipo, horario: h, modo: f.modo.value }))).select('id'));
      if (f.padrao.checked && f.modo.value === 'fixa') {
        const pos = cultos.flatMap((c) => FORMACAO_PADRAO.map((n, i) => ({ culto_id: c.id, funcao_id: E.funcoes.find((x) => x.nome === n)?.id, ordem: i })).filter((x) => x.funcao_id));
        await exec(sb.from('escala_posicoes').insert(pos));
      }
      aviso('Evento criado.');
      location.hash = '#/programacao/' + prog.id;
    },
  });
}

// Repertório do dia
function blocoCampo(tom) {
  const ch = campoHarmonico(tom);
  return ch.length ? `<div class="campo-harmonico" aria-label="Campo harmônico de ${esc(tom)}">${ch.map((x) => `<div><small>${x.grau}</small><strong>${esc(x.acorde)}</strong></div>`).join('')}</div>` : '';
}
function itemRepertorio(it, i, p, pode) {
  const m = porId(E.musicas, it.musica_id) || { titulo: '(música removida)' };
  const tom = it.tom_tocado || it.tom_previsto || m.tom_original;
  return `<li>
    <div class="entre">
      <div style="min-width:0"><a href="#/musica/${m.id}"><strong>${i + 1}. ${esc(m.titulo)}</strong></a>
        <div class="pequeno suave">${esc(m.artista || '')}${it.ministro_id ? ' · ' + esc(nomeIntegrante(it.ministro_id)) : ''}</div></div>
      <div class="linha" style="flex:none">${tom ? `<span class="tom" title="Tom">${esc(tom)}</span>` : '<span class="etiqueta neutra">Tom?</span>'}</div>
    </div>
    <div class="pequeno suave" style="margin-top:4px">${it.tom_previsto ? 'Previsto: ' + esc(it.tom_previsto) : ''}${it.tom_tocado ? ' · Tocado: ' + esc(it.tom_tocado) : ''}${it.observacoes ? ' · ' + esc(it.observacoes) : ''}</div>
    ${tom ? `<details style="margin-top:6px"><summary class="pequeno">Campo harmônico de ${esc(tom)}</summary>${blocoCampo(tom)}
      ${m.progressao ? `<p class="pequeno" style="margin:8px 0 0"><strong>Progressão:</strong> ${esc(transporProgressao(m.progressao, tom))}</p>` : ''}</details>` : ''}
    <div class="links-externos">
      ${m.link_cifraclub ? `<a class="btn compacto" href="${esc(m.link_cifraclub)}" target="_blank" rel="noopener">Cifra</a>` : ''}
      ${m.link_youtube ? `<a class="btn compacto" href="${esc(m.link_youtube)}" target="_blank" rel="noopener">YouTube</a>` : ''}
      ${m.link_spotify ? `<a class="btn compacto" href="${esc(m.link_spotify)}" target="_blank" rel="noopener">Spotify</a>` : ''}
      ${pode ? `<button class="btn compacto" data-item="${it.id}">Editar</button>
        ${i > 0 ? `<button class="btn compacto" data-mover="${it.id}" data-dir="-1" aria-label="Subir">↑</button>` : ''}
        ${i < p.repertorio_itens.length - 1 ? `<button class="btn compacto" data-mover="${it.id}" data-dir="1" aria-label="Descer">↓</button>` : ''}` : ''}
    </div></li>`;
}
async function moverItem(p, id, dir) {
  const itens = [...p.repertorio_itens];
  const i = itens.findIndex((x) => x.id === id);
  const j = i + dir;
  if (j < 0 || j >= itens.length) return;
  [itens[i], itens[j]] = [itens[j], itens[i]];
  try {
    await Promise.all(itens.map((x, k) => exec(sb.from('repertorio_itens').update({ ordem: k }).eq('id', x.id))));
    pgProgramacao(p.id);
  } catch (e) { aviso(erroAmigavel(e)); }
}
const selectTom = (nome, valor, vazio = 'Não definido') => `<select name="${nome}"><option value="">${vazio}</option>${TONS.map((t) => `<option ${t === valor ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
function dlgItemRepertorio(p, it) {
  const ministros = ministrosDe(p);
  const idsMinistros = E.integrantes.filter((i) => ministros.includes(i.nome)).map((i) => i.id);
  const minPadrao = it?.ministro_id || idsMinistros[0] || '';
  dialogo({
    titulo: it ? 'Editar música do dia' : 'Adicionar música',
    corpo: `${it ? `<p><strong>${esc(porId(E.musicas, it.musica_id)?.titulo)}</strong></p>` : `
      <label class="campo"><span>Buscar música</span><input type="search" name="busca" placeholder="Digite o título ou artista" autocomplete="off"></label>
      <input type="hidden" name="musica" value="">
      <div class="lista-escolha" data-resultados role="radiogroup" aria-label="Músicas"></div>
      <p class="pequeno suave" style="margin:4px 0 14px">Não achou? Cadastre-a em Repertório.</p>`}
      <div class="grade-2"><label class="campo"><span>Tom previsto</span>${selectTom('tom_previsto', it?.tom_previsto)}</label>
        <label class="campo"><span>Tom tocado</span>${selectTom('tom_tocado', it?.tom_tocado)}</label></div>
      <label class="campo"><span>Ministro</span><select name="ministro"><option value="">—</option>${escalaveis().map((i) => `<option value="${i.id}" ${i.id === minPadrao ? 'selected' : ''}>${esc(i.nome)}</option>`).join('')}</select></label>
      <label class="campo"><span>Observações</span><input type="text" name="obs" value="${esc(it?.observacoes || '')}" maxlength="200" placeholder="Ex.: começa só voz e violão"></label>`,
    aoAbrir: (f) => {
      if (!f.busca) return;
      const caixa = f.querySelector('[data-resultados]');
      const ativas = E.musicas.filter((m) => m.ativa);
      const desenhar = () => {
        const q = semAcento(f.busca.value);
        const lista = ativas.filter((m) => !q || semAcento(m.titulo + ' ' + (m.artista || '')).includes(q)).slice(0, 40);
        caixa.innerHTML = lista.length ? lista.map((m) => `<label class="opcao"><input type="radio" name="escolha" value="${m.id}" ${f.musica.value === m.id ? 'checked' : ''}><span><strong>${esc(m.titulo)}</strong><small>${esc(m.artista || '')}${m.tom_original ? ' · ' + esc(m.tom_original) : ''}</small></span></label>`).join('') : '<p class="pequeno suave" style="padding:12px;margin:0">Nenhuma música encontrada.</p>';
      };
      caixa.addEventListener('change', (ev) => {
        f.musica.value = ev.target.value;
        const m = porId(E.musicas, ev.target.value);
        if (m?.tom_original && !f.tom_previsto.value) f.tom_previsto.value = m.tom_original;
      });
      f.busca.addEventListener('input', desenhar);
      desenhar();
    },
    perigo: it ? { texto: 'Remover', confirmar: 'Remover esta música do repertório do dia?', acao: async () => {
      await exec(sb.from('repertorio_itens').delete().eq('id', it.id)); aviso('Música removida.'); pgProgramacao(p.id);
    } } : null,
    aoSalvar: async (f) => {
      const dados = { tom_previsto: f.tom_previsto.value || null, tom_tocado: f.tom_tocado.value || null, ministro_id: f.ministro.value || null, observacoes: f.obs.value.trim() || null };
      if (it) await exec(sb.from('repertorio_itens').update(dados).eq('id', it.id));
      else {
        if (!f.musica.value) throw 'Escolha uma música da lista.';
        await exec(sb.from('repertorio_itens').insert({ ...dados, programacao_id: p.id, musica_id: f.musica.value, ordem: p.repertorio_itens.length }));
      }
      aviso('Repertório atualizado.'); pgProgramacao(p.id);
    },
  });
}
function dlgLinkCifra(p) {
  dialogo({
    titulo: 'Lista do Cifra Club',
    corpo: `<label class="campo"><span>Link da lista</span><input type="url" name="link" inputmode="url" value="${esc(p.link_cifraclub || '')}" placeholder="https://www.cifraclub.com.br/…">
      <small>No Cifra Club, abra a lista, toque em Compartilhar e copie o link. Deixe em branco para remover.</small></label>`,
    aoSalvar: async (f) => {
      const link = f.link.value.trim();
      if (link && !/^https:\/\//i.test(link)) throw 'O link precisa começar com https://';
      await exec(sb.rpc('definir_lista_cifraclub', { p_programacao: p.id, p_link: link || null }));
      aviso('Lista salva.'); pgProgramacao(p.id);
    },
  });
}

// ---------------------------------------------------------------------
// Repertório (catálogo)
// ---------------------------------------------------------------------
const filtroRep = { busca: '', tom: '', situacao: 'ativas' };
const semAcento = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
function pgRepertorio() {
  moldura('repertorio', `
    <div class="entre"><h1>Repertório</h1>${sou.lider() ? '<button class="btn primario compacto" id="nova">+ Música</button>' : ''}</div>
    <label class="campo" style="margin-top:12px"><span class="sr">Buscar</span><input type="search" id="busca" placeholder="Buscar por título ou artista" value="${esc(filtroRep.busca)}"></label>
    <div class="grade-2">
      <label class="campo"><span class="sr">Tom</span><select id="f-tom"><option value="">Todos os tons</option><option value="sem" ${filtroRep.tom === 'sem' ? 'selected' : ''}>Sem tom definido</option>${TONS.map((t) => `<option ${filtroRep.tom === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="campo"><span class="sr">Situação</span><select id="f-sit"><option value="ativas">Ativas</option><option value="revisar" ${filtroRep.situacao === 'revisar' ? 'selected' : ''}>A revisar</option><option value="todas" ${filtroRep.situacao === 'todas' ? 'selected' : ''}>Todas</option></select></label>
    </div>
    <p class="pequeno suave" id="contagem"></p>
    <div id="lista"></div>`);
  const desenhar = () => {
    const q = semAcento(filtroRep.busca);
    const lista = E.musicas.filter((m) =>
      (filtroRep.situacao === 'todas' || (filtroRep.situacao === 'ativas' ? m.ativa : m.revisar)) &&
      (!filtroRep.tom || (filtroRep.tom === 'sem' ? !m.tom_original : m.tom_original === filtroRep.tom)) &&
      (!q || semAcento(m.titulo + ' ' + (m.artista || '')).includes(q)));
    document.getElementById('contagem').textContent = `${lista.length} música(s)`;
    document.getElementById('lista').innerHTML = lista.length ? `<div class="cartao"><ul class="itens">${lista.map((m) => `
      <li><a href="#/musica/${m.id}" class="entre" style="color:inherit;text-decoration:none">
        <span style="min-width:0"><strong>${esc(m.titulo)}</strong><span class="pequeno suave" style="display:block">${esc(m.artista || '—')}${m.revisar ? ' · a revisar' : ''}</span></span>
        ${m.tom_original ? `<span class="tom">${esc(m.tom_original)}</span>` : ''}</a></li>`).join('')}</ul></div>` : '<div class="cartao vazio">Nenhuma música encontrada.</div>';
  };
  desenhar();
  document.getElementById('busca').addEventListener('input', (e) => { filtroRep.busca = e.target.value; desenhar(); });
  document.getElementById('f-tom').onchange = (e) => { filtroRep.tom = e.target.value; desenhar(); };
  document.getElementById('f-sit').onchange = (e) => { filtroRep.situacao = e.target.value; desenhar(); };
  document.getElementById('nova')?.addEventListener('click', () => dlgMusica(null));
}

async function pgMusica(id) {
  const m = porId(E.musicas, id);
  if (!m) { location.hash = '#/repertorio'; return; }
  carregando('repertorio');
  const historico = ordenar(await exec(sb.from('repertorio_itens').select('tom_previsto,tom_tocado,ministro_id,programacoes(id,data)').eq('musica_id', id)), (h) => h.programacoes?.data || '').reverse();
  const tomInicial = m.tom_original || 'C';
  moldura('repertorio', `
    <div class="entre"><div><h1>${esc(m.titulo)}</h1><p class="suave" style="margin:2px 0 0">${esc(m.artista || 'Artista não informado')}</p></div>
      ${sou.lider() ? '<button class="btn compacto" id="editar">Editar</button>' : ''}</div>
    ${m.revisar ? '<div class="caixa-aviso" style="margin-top:12px">Cadastro a revisar: confira artista e referência.</div>' : ''}
    <div class="cartao" style="margin-top:12px">
      <div class="linha"><span class="etiqueta neutra">Tom original: ${esc(m.tom_original || 'não definido')}</span><span class="etiqueta neutra">BPM: ${m.bpm || 'não definido'}</span>${m.ativa ? '' : '<span class="etiqueta erro">Fora do repertório</span>'}</div>
      <div class="links-externos">
        ${m.link_cifraclub ? `<a class="btn compacto" href="${esc(m.link_cifraclub)}" target="_blank" rel="noopener">Cifra Club ${icone('externo')}</a>` : ''}
        ${m.link_youtube ? `<a class="btn compacto" href="${esc(m.link_youtube)}" target="_blank" rel="noopener">YouTube ${icone('externo')}</a>` : ''}
        ${m.link_spotify ? `<a class="btn compacto" href="${esc(m.link_spotify)}" target="_blank" rel="noopener">Spotify ${icone('externo')}</a>` : ''}
      </div>
      ${m.observacoes ? `<p class="pequeno" style="margin:12px 0 0">${esc(m.observacoes)}</p>` : ''}
    </div>
    <div class="secao"><h2>Campo harmônico</h2></div>
    <div class="cartao">
      <label class="campo" style="margin-bottom:4px"><span>Tom</span><select id="tom-ch">${TONS.map((t) => `<option ${t === tomInicial ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <div id="ch"></div>
      ${m.progressao ? `<p class="pequeno" style="margin:12px 0 0"><strong>Progressão em graus:</strong> ${esc(m.progressao)}</p><p class="pequeno" style="margin:4px 0 0"><strong>No tom escolhido:</strong> <span id="prog"></span></p>`
        : '<p class="pequeno suave" style="margin:12px 0 0">A progressão em graus ainda não foi cadastrada.</p>'}
    </div>
    <div class="secao"><h2>Histórico</h2></div>
    ${historico.length ? `<div class="cartao"><ul class="itens">${historico.map((h) => `<li class="entre"><a href="#/programacao/${h.programacoes?.id}">${dataBR(h.programacoes?.data)}</a>
      <span class="pequeno">${esc(h.tom_tocado || h.tom_previsto || '—')}${h.ministro_id ? ' · ' + esc(nomeIntegrante(h.ministro_id)) : ''}</span></li>`).join('')}</ul></div>`
      : '<div class="cartao vazio">Ainda não foi usada em nenhuma programação.</div>'}
  `, { voltar: '#/repertorio' });
  const desenharCH = () => {
    const t = document.getElementById('tom-ch').value;
    document.getElementById('ch').innerHTML = blocoCampo(t);
    const pr = document.getElementById('prog'); if (pr) pr.textContent = transporProgressao(m.progressao, t);
  };
  document.getElementById('tom-ch').onchange = desenharCH; desenharCH();
  document.getElementById('editar')?.addEventListener('click', () => dlgMusica(m));
}

function dlgMusica(m) {
  const url = (v) => { v = v.trim(); if (v && !/^https:\/\//i.test(v)) throw 'Os links precisam começar com https://'; return v || null; };
  dialogo({
    titulo: m ? 'Editar música' : 'Nova música',
    corpo: `<label class="campo"><span>Título</span><input type="text" name="titulo" value="${esc(m?.titulo || '')}" required maxlength="120"></label>
      <label class="campo"><span>Artista ou ministério</span><input type="text" name="artista" value="${esc(m?.artista || '')}" maxlength="120"></label>
      <div class="grade-2"><label class="campo"><span>Tom original</span>${selectTom('tom', m?.tom_original)}</label>
        <label class="campo"><span>BPM</span><input type="number" name="bpm" inputmode="numeric" min="30" max="250" value="${m?.bpm || ''}"></label></div>
      <label class="campo"><span>Link do Cifra Club</span><input type="url" name="cifra" inputmode="url" value="${esc(m?.link_cifraclub || '')}"></label>
      <label class="campo"><span>Link do YouTube</span><input type="url" name="yt" inputmode="url" value="${esc(m?.link_youtube || '')}"></label>
      <label class="campo"><span>Link do Spotify</span><input type="url" name="sp" inputmode="url" value="${esc(m?.link_spotify || '')}"></label>
      <label class="campo"><span>Progressão em graus</span><input type="text" name="prog" value="${esc(m?.progressao || '')}" placeholder="Ex.: Verso: I – V – vi – IV | Refrão: IV – V – vi">
        <small>Use I, ii, iii, IV, V, vi, vii° (maiúsculo = acorde maior; minúsculo = menor).</small></label>
      <label class="campo"><span>Observações</span><textarea name="obs" maxlength="500">${esc(m?.observacoes || '')}</textarea></label>
      <label class="linha campo"><input type="checkbox" name="ativa" ${m?.ativa === false ? '' : 'checked'}> Ativa no repertório</label>
      <label class="linha campo"><input type="checkbox" name="revisar" ${m?.revisar ? 'checked' : ''}> Marcar para revisar</label>`,
    aoSalvar: async (f) => {
      const titulo = f.titulo.value.trim();
      if (!titulo) throw 'Informe o título.';
      const bpm = f.bpm.value ? Number(f.bpm.value) : null;
      if (bpm && (bpm < 30 || bpm > 250)) throw 'BPM deve estar entre 30 e 250.';
      const dados = { titulo, artista: f.artista.value.trim() || null, tom_original: f.tom.value || null, bpm,
        link_cifraclub: url(f.cifra.value), link_youtube: url(f.yt.value), link_spotify: url(f.sp.value),
        progressao: f.prog.value.trim() || null, observacoes: f.obs.value.trim() || null, ativa: f.ativa.checked, revisar: f.revisar.checked };
      if (dados.tom_original && !tomValido(dados.tom_original)) throw 'Tom inválido.';
      const salvo = m ? await exec(sb.from('musicas').update(dados).eq('id', m.id).select().single())
        : await exec(sb.from('musicas').insert(dados).select().single());
      E.musicas = ordenar([...E.musicas.filter((x) => x.id !== salvo.id), salvo], (x) => semAcento(x.titulo));
      aviso('Música salva.');
      location.hash = '#/musica/' + salvo.id; rotear();
    },
  });
}

// ---------------------------------------------------------------------
// Equipamentos
// ---------------------------------------------------------------------
async function pgEquipamentos() {
  carregando('equipamentos');
  const lista = await exec(sb.from('equipamentos').select('*').order('ordem'));
  const visiveis = lista.filter((e) => e.ativo || sou.lider());
  moldura('equipamentos', `
    <div class="entre"><h1>Equipamentos</h1>${sou.lider() ? '<button class="btn primario compacto" id="novo">+ Item</button>' : ''}</div>
    <p class="suave pequeno">Indicações do ministério, não compras obrigatórias. Confira preço e compatibilidade antes de comprar.</p>
    ${visiveis.length ? visiveis.map((e) => `<div class="cartao">
      <div class="entre"><div><strong>${esc(e.nome)}</strong><div class="pequeno suave">${esc([e.categoria, e.loja].filter(Boolean).join(' · '))}</div></div>
        ${e.ativo ? '' : '<span class="etiqueta erro">Oculto</span>'}</div>
      ${e.descricao ? `<p class="pequeno" style="margin:8px 0 0">${esc(e.descricao)}</p>` : ''}
      ${e.verificado_em ? `<p class="pequeno suave" style="margin:4px 0 0">Verificado em ${dataBR(e.verificado_em, false)}</p>` : ''}
      <div class="links-externos">${e.link ? `<a class="btn compacto" href="${esc(e.link)}" target="_blank" rel="noopener">Ver produto ${icone('externo')}</a>` : ''}
        ${sou.lider() ? `<button class="btn compacto" data-eq="${e.id}">Editar</button>` : ''}</div>
    </div>`).join('') : '<div class="cartao vazio">Nenhum equipamento cadastrado.</div>'}`);
  document.getElementById('novo')?.addEventListener('click', () => dlgEquip(null, lista.length));
  document.querySelectorAll('[data-eq]').forEach((b) => b.addEventListener('click', () => dlgEquip(porId(lista, b.dataset.eq))));
}
function dlgEquip(e, ordem = 0) {
  dialogo({
    titulo: e ? 'Editar equipamento' : 'Novo equipamento',
    corpo: `<label class="campo"><span>Nome</span><input type="text" name="nome" value="${esc(e?.nome || '')}" required maxlength="120"></label>
      <div class="grade-2"><label class="campo"><span>Categoria</span><input type="text" name="cat" value="${esc(e?.categoria || '')}" placeholder="Ex.: Fones de retorno" maxlength="60"></label>
        <label class="campo"><span>Loja</span><input type="text" name="loja" value="${esc(e?.loja || '')}" maxlength="60"></label></div>
      <label class="campo"><span>Descrição</span><textarea name="desc" maxlength="500">${esc(e?.descricao || '')}</textarea></label>
      <label class="campo"><span>Link</span><input type="url" name="link" inputmode="url" value="${esc(e?.link || '')}"></label>
      <label class="campo"><span>Verificado em</span><input type="date" name="verif" value="${e?.verificado_em || ''}"></label>
      <label class="linha campo"><input type="checkbox" name="ativo" ${e?.ativo === false ? '' : 'checked'}> Visível para os integrantes</label>`,
    perigo: e ? { texto: 'Excluir', confirmar: 'Excluir este equipamento?', acao: async () => { await exec(sb.from('equipamentos').delete().eq('id', e.id)); aviso('Excluído.'); pgEquipamentos(); } } : null,
    aoSalvar: async (f) => {
      if (!f.nome.value.trim()) throw 'Informe o nome.';
      const link = f.link.value.trim();
      if (link && !/^https:\/\//i.test(link)) throw 'O link precisa começar com https://';
      const dados = { nome: f.nome.value.trim(), categoria: f.cat.value.trim() || null, loja: f.loja.value.trim() || null, descricao: f.desc.value.trim() || null, link: link || null, verificado_em: f.verif.value || null, ativo: f.ativo.checked };
      if (e) await exec(sb.from('equipamentos').update(dados).eq('id', e.id));
      else await exec(sb.from('equipamentos').insert({ ...dados, ordem: ordem + 1 }));
      aviso('Equipamento salvo.'); pgEquipamentos();
    },
  });
}

// ---------------------------------------------------------------------
// Perfil e funções
// ---------------------------------------------------------------------
function pgPerfil() {
  const minhas = E.ifuncoes.filter((f) => f.integrante_id === E.eu.integrante_id);
  const livres = E.funcoes.filter((f) => f.ativa && !minhas.some((m) => m.funcao_id === f.id));
  moldura('perfil', `
    <h1>${esc(E.eu.nome)}</h1>
    <p class="suave" style="margin:2px 0 0">${esc(E.email)} · ${esc(PERFIS[E.eu.perfil])}</p>
    <div class="secao"><h2>Minhas funções</h2></div>
    <div class="cartao">
      ${minhas.length ? `<ul class="itens">${minhas.map((m) => `<li class="entre"><span><strong>${esc(nomeFuncao(m.funcao_id))}</strong>
        <span class="pequeno suave" style="display:block">${NIVEIS[m.nivel]}${m.validado ? '' : ' · aguardando validação da liderança'}</span></span>
        <button class="btn compacto perigo" data-rem="${m.funcao_id}">Remover</button></li>`).join('')}</ul>` : '<p class="suave">Nenhuma função cadastrada.</p>'}
      ${livres.length ? `<form id="f-func" class="grade-2" style="margin-top:12px;align-items:end">
        <label class="campo" style="margin:0"><span class="pequeno">Função</span><select name="funcao">${livres.map((f) => `<option value="${f.id}">${esc(f.nome)}</option>`).join('')}</select></label>
        <label class="campo" style="margin:0"><span class="pequeno">Nível</span><select name="nivel"><option value="titular">Titular</option><option value="substituto">Substituto</option><option value="aprendendo">Aprendendo</option></select></label>
        <button class="btn primario" type="submit" style="grid-column:1/-1">Adicionar função</button></form>` : ''}
      <p class="pequeno suave" style="margin:12px 0 0"><strong>Titular:</strong> toca/canta com segurança. <strong>Substituto:</strong> consegue cobrir uma ausência. <strong>Aprendendo:</strong> em formação. A liderança valida o nível.</p>
    </div>
    <div class="secao"><h2>Aplicativo</h2></div>
    <div class="cartao pequeno">Para abrir como aplicativo: no iPhone, toque em <strong>Compartilhar → Adicionar à Tela de Início</strong>; no Android, no menu ⋮ escolha <strong>Adicionar à tela inicial</strong>.</div>
    <button class="btn bloco" id="sair" style="margin-top:12px">Sair</button>`);
  document.getElementById('sair').onclick = sair;
  document.getElementById('f-func')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    try {
      const novo = await exec(sb.from('integrante_funcoes').insert({ integrante_id: E.eu.integrante_id, funcao_id: Number(f.funcao.value), nivel: f.nivel.value }).select().single());
      E.ifuncoes.push(novo); aviso('Função adicionada.'); pgPerfil();
    } catch (e) { aviso(erroAmigavel(e)); }
  });
  document.querySelectorAll('[data-rem]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Remover esta função do seu perfil?')) return;
    try {
      await exec(sb.from('integrante_funcoes').delete().eq('integrante_id', E.eu.integrante_id).eq('funcao_id', Number(b.dataset.rem)));
      E.ifuncoes = E.ifuncoes.filter((x) => !(x.integrante_id === E.eu.integrante_id && x.funcao_id === Number(b.dataset.rem)));
      pgPerfil();
    } catch (e) { aviso(erroAmigavel(e)); }
  }));
}

// ---------------------------------------------------------------------
// Gestão: aprovações e integrantes
// ---------------------------------------------------------------------
async function pgGestao() {
  carregando('gestao');
  await carregarBase();
  const acessos = await exec(sb.from('acessos').select('integrante_id,email,user_id'));
  const emailDe = (id) => acessos.find((a) => a.integrante_id === id);
  const pendentes = E.integrantes.filter((i) => i.status === 'pendente');
  const demais = E.integrantes.filter((i) => i.status !== 'pendente');
  const naoValidadas = E.ifuncoes.filter((f) => !f.validado);
  moldura('gestao', `
    <div class="entre"><h1>Gestão</h1>${sou.lider() ? '<button class="btn primario compacto" id="novo">+ Integrante</button>' : ''}</div>
    <div class="secao"><h2>Pedidos de acesso</h2></div>
    ${pendentes.length ? pendentes.map((i) => `<div class="cartao"><div class="entre"><div><strong>${esc(i.nome)}</strong><div class="pequeno suave">${esc(emailDe(i.id)?.email || '')}</div></div></div>
      <div class="linha" style="margin-top:12px"><button class="btn primario compacto" data-aprovar="${i.id}">Aprovar</button><button class="btn compacto perigo" data-recusar="${i.id}">Recusar</button></div></div>`).join('')
      : '<div class="cartao vazio">Nenhum pedido aguardando.</div>'}
    ${sou.lider() && naoValidadas.length ? `<div class="secao"><h2>Funções para validar</h2></div>
      <div class="cartao"><ul class="itens">${naoValidadas.map((f) => `<li class="entre"><span><strong>${esc(nomeIntegrante(f.integrante_id))}</strong>
        <span class="pequeno suave" style="display:block">${esc(nomeFuncao(f.funcao_id))} · ${NIVEIS[f.nivel]}</span></span>
        <button class="btn compacto" data-validar="${f.integrante_id}|${f.funcao_id}">Validar</button></li>`).join('')}</ul></div>` : ''}
    <div class="secao"><h2>Integrantes (${demais.length})</h2></div>
    <div class="cartao"><ul class="itens">${demais.map((i) => {
      const fs = E.ifuncoes.filter((f) => f.integrante_id === i.id).map((f) => nomeFuncao(f.funcao_id));
      const ac = emailDe(i.id);
      return `<li><button class="entre" data-int="${i.id}" style="all:unset;display:flex;justify-content:space-between;gap:12px;width:100%;cursor:pointer">
        <span style="min-width:0"><strong>${esc(i.nome)}</strong><span class="pequeno suave" style="display:block">${esc(fs.join(', ') || 'sem funções')}${sou.lider() ? ' · ' + (ac ? (ac.user_id ? 'acessou' : 'e-mail cadastrado') : 'sem e-mail') : ''}</span></span>
        <span class="linha" style="flex:none">${i.perfil !== 'membro' ? `<span class="etiqueta">${PERFIS[i.perfil]}</span>` : ''}${i.pode_aprovar && i.perfil === 'membro' ? '<span class="etiqueta neutra">Aprova</span>' : ''}${i.status === 'inativo' ? '<span class="etiqueta erro">Inativo</span>' : ''}</span>
      </button></li>`;
    }).join('')}</ul></div>`);
  const c = document.getElementById('conteudo');
  const status = async (id, s) => { try { await exec(sb.rpc('definir_status', { p_integrante: id, p_status: s })); aviso(s === 'ativo' ? 'Acesso aprovado.' : 'Pedido recusado.'); pgGestao(); } catch (e) { aviso(erroAmigavel(e)); } };
  c.querySelectorAll('[data-aprovar]').forEach((b) => (b.onclick = () => status(b.dataset.aprovar, 'ativo')));
  c.querySelectorAll('[data-recusar]').forEach((b) => (b.onclick = () => confirm('Recusar este pedido?') && status(b.dataset.recusar, 'inativo')));
  c.querySelectorAll('[data-validar]').forEach((b) => (b.onclick = async () => {
    const [iid, fid] = b.dataset.validar.split('|');
    try { await exec(sb.from('integrante_funcoes').update({ validado: true }).eq('integrante_id', iid).eq('funcao_id', Number(fid))); aviso('Função validada.'); pgGestao(); } catch (e) { aviso(erroAmigavel(e)); }
  }));
  if (sou.lider()) {
    c.querySelectorAll('[data-int]').forEach((b) => (b.onclick = () => dlgIntegrante(porId(E.integrantes, b.dataset.int), emailDe(b.dataset.int))));
    document.getElementById('novo')?.addEventListener('click', () => dlgIntegrante(null, null));
  }
}

function dlgIntegrante(i, acesso) {
  const fs = i ? E.ifuncoes.filter((f) => f.integrante_id === i.id) : [];
  const editAdmin = sou.admin();
  dialogo({
    titulo: i ? 'Editar integrante' : 'Novo integrante',
    corpo: `<label class="campo"><span>Nome</span><input type="text" name="nome" value="${esc(i?.nome || '')}" required maxlength="60"></label>
      <label class="campo"><span>E-mail de acesso</span><input type="email" name="email" inputmode="email" autocapitalize="off" value="${esc(acesso?.email || '')}">
        <small>É com este e-mail que a pessoa recebe o código para entrar.${acesso?.user_id ? ' Já acessou a plataforma.' : ''}</small></label>
      <div class="grade-2">
        <label class="campo"><span>Situação</span><select name="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${(i?.status || 'ativo') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="campo"><span>Perfil</span><select name="perfil" ${editAdmin ? '' : 'disabled'}>${Object.entries(PERFIS).map(([k, v]) => `<option value="${k}" ${(i?.perfil || 'membro') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      </div>
      <label class="linha campo"><input type="checkbox" name="aprova" ${i?.pode_aprovar ? 'checked' : ''} ${editAdmin ? '' : 'disabled'}> Pode aprovar novos integrantes</label>
      ${editAdmin ? '' : '<p class="pequeno suave">Perfil e permissão de aprovar só podem ser alterados por administradores.</p>'}
      <fieldset style="border:0;padding:0;margin:8px 0 0"><legend style="font-weight:600;margin-bottom:6px">Funções</legend>
        ${E.funcoes.map((f) => { const x = fs.find((y) => y.funcao_id === f.id); return `<div class="grade-2" style="align-items:center;margin-bottom:6px">
          <label class="linha"><input type="checkbox" name="fun_${f.id}" ${x ? 'checked' : ''}> ${esc(f.nome)}</label>
          <select name="niv_${f.id}">${Object.entries(NIVEIS).map(([k, v]) => `<option value="${k}" ${(x?.nivel || 'titular') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`; }).join('')}
        <p class="pequeno suave">Funções salvas aqui ficam validadas.</p></fieldset>`,
    aoSalvar: async (f) => {
      const nome = f.nome.value.trim();
      if (nome.length < 2) throw 'Informe o nome.';
      const email = f.email.value.trim().toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw 'E-mail inválido.';
      const dados = { nome, status: f.status.value };
      if (editAdmin) Object.assign(dados, { perfil: f.perfil.value, pode_aprovar: f.aprova.checked });
      let id = i?.id;
      if (i) await exec(sb.from('integrantes').update(dados).eq('id', id));
      else id = (await exec(sb.from('integrantes').insert(dados).select('id').single())).id;
      if (email && email !== acesso?.email) {
        if (acesso) await exec(sb.from('acessos').update({ email, user_id: null, vinculado_em: null }).eq('integrante_id', id));
        else await exec(sb.from('acessos').insert({ integrante_id: id, email }));
      } else if (!email && acesso) {
        await exec(sb.from('acessos').delete().eq('integrante_id', id));
      }
      await exec(sb.from('integrante_funcoes').delete().eq('integrante_id', id));
      const novas = E.funcoes.filter((x) => f['fun_' + x.id].checked).map((x) => ({ integrante_id: id, funcao_id: x.id, nivel: f['niv_' + x.id].value, validado: true }));
      if (novas.length) await exec(sb.from('integrante_funcoes').insert(novas));
      aviso('Integrante salvo.'); pgGestao();
    },
  });
}

// ---------------------------------------------------------------------
// Início do aplicativo
// ---------------------------------------------------------------------
sb.auth.onAuthStateChange((evento) => { if (evento === 'SIGNED_OUT') telaLogin(); });
entrar();
