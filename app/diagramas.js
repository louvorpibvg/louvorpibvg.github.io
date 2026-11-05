// Diagramas de acordes (violão e teclado) em SVG.
// Violão: prioriza formas abertas e sem pestana (pedido do Pedro, por dor na mão).
// Níveis: 0 = aberto · 1 = fechado sem pestana · 2 = pestana pequena · 3 = pestana completa.
import { campoHarmonico, formaComCapo } from './musica.js?v=5';

const NOTAS = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const SUST = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BEM = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const FORMAS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];

// Aceita sufixos comuns e reduz à tríade (maior, menor ou diminuta).
const RE_ACORDE = /^([A-G](?:#|b)?)(m7\(b5\)|m\(b5\)|m7M|7M|maj7|m7|m6|m9|m|°|dim|7|6|sus4|sus2|add9|9|4|2)?(?:\/([A-G](?:#|b)?))?$/;
export function analisarAcorde(nome) {
  const m = RE_ACORDE.exec((nome || '').trim());
  if (!m) return null;
  const s = m[2] || '';
  const tipo = /^m\(b5\)|^m7\(b5\)|^°|^dim/.test(s) ? 'dim' : /^m(?!aj)/.test(s) ? 'menor' : 'maior';
  return { raiz: NOTAS[m[1]], nomeRaiz: m[1], tipo };
}
export function triade(nome) {
  const a = analisarAcorde(nome);
  return a ? a.nomeRaiz + (a.tipo === 'menor' ? 'm' : a.tipo === 'dim' ? '°' : '') : null;
}
// Transpõe um acorde (tríade) por N semitons. Usado para a forma com capotraste.
export function transporAcorde(nome, semitons) {
  const a = analisarAcorde(nome);
  if (!a) return nome;
  return FORMAS[((a.raiz + semitons) % 12 + 12) % 12] + (a.tipo === 'menor' ? 'm' : a.tipo === 'dim' ? '°' : '');
}

// ---------------------------------------------------------------- violão
// Cordas da 6ª (Mi grave) para a 1ª (Mi agudo); -1 = não tocar
const CURADOS = {
  'maior:0': { casas: [-1, 3, 2, 0, 1, 0], nivel: 0 },                                   // C
  'maior:2': { casas: [-1, -1, 0, 2, 3, 2], nivel: 0 },                                  // D
  'maior:4': { casas: [0, 2, 2, 1, 0, 0], nivel: 0 },                                    // E
  'maior:5': { casas: [-1, -1, 3, 2, 1, 1], nivel: 2, pestana: { casa: 1, de: 4, ate: 5 } }, // F (pestana em 2 cordas)
  'maior:7': { casas: [3, 2, 0, 0, 0, 3], nivel: 0 },                                    // G
  'maior:9': { casas: [-1, 0, 2, 2, 2, 0], nivel: 0 },                                   // A
  'menor:2': { casas: [-1, -1, 0, 2, 3, 1], nivel: 0 },                                  // Dm
  'menor:4': { casas: [0, 2, 2, 0, 0, 0], nivel: 0 },                                    // Em
  'menor:7': { casas: [-1, -1, 0, 3, 3, 3], nivel: 2, pestana: { casa: 3, de: 3, ate: 5 } }, // Gm
  'menor:9': { casas: [-1, 0, 2, 2, 1, 0], nivel: 0 },                                   // Am
};
// Alternativas sem pestana que mudam levemente o acorde (aceitas na maioria das músicas)
const ALTERNATIVAS = {
  'maior:5': { nome: 'Fmaj7', casas: [-1, -1, 3, 2, 1, 0], nivel: 0 },
  'maior:11': { nome: 'B7', casas: [-1, 2, 1, 2, 0, 2], nivel: 0 },
  'menor:6': { nome: 'F#m7', casas: [2, 0, 2, 2, 2, 0], nivel: 0 },
  'menor:1': { nome: 'C#m7', casas: [-1, 4, 2, 1, 0, 0], nivel: 1 },
  'maior:10': { nome: 'Bbmaj7', casas: [-1, 1, 3, 2, 3, -1], nivel: 1 },
};

function candidatos(raiz, tipo) {
  const lista = [];
  const cur = CURADOS[tipo + ':' + raiz];
  if (cur) lista.push(cur);
  const fa = (raiz - 9 + 12) % 12, fd = (raiz - 2 + 12) % 12, fe = (raiz - 4 + 12) % 12;
  const ok = (f) => f >= 1 && f <= 7;
  if (tipo === 'maior') {
    if (ok(fa)) lista.push({ casas: [-1, -1, fa + 2, fa + 2, fa + 2, fa], nivel: 1 });
    if (ok(fd)) lista.push({ casas: [-1, -1, fd, fd + 2, fd + 3, fd + 2], nivel: 1 });
    if (fe) lista.push({ casas: [fe, fe + 2, fe + 2, fe + 1, fe, fe], nivel: 3, pestana: { casa: fe, de: 0, ate: 5 } });
    if (fa) lista.push({ casas: [-1, fa, fa + 2, fa + 2, fa + 2, fa], nivel: 3, pestana: { casa: fa, de: 1, ate: 5 } });
  } else if (tipo === 'menor') {
    if (ok(fa)) lista.push({ casas: [-1, -1, fa + 2, fa + 2, fa + 1, fa], nivel: 1 });
    if (ok(fd)) lista.push({ casas: [-1, -1, fd, fd + 2, fd + 3, fd + 1], nivel: 1 });
    if (fe) lista.push({ casas: [fe, fe + 2, fe + 2, fe, fe, fe], nivel: 3, pestana: { casa: fe, de: 0, ate: 5 } });
    if (fa) lista.push({ casas: [-1, fa, fa + 2, fa + 2, fa + 1, fa], nivel: 3, pestana: { casa: fa, de: 1, ate: 5 } });
  } else {
    if (fa <= 9) lista.push({ casas: [-1, fa, fa + 1, fa + 2, fa + 1, -1], nivel: fa ? 1 : 0 });
    if (fe <= 9) lista.push({ casas: [fe, fe + 1, fe + 2, fe, -1, -1], nivel: fe ? 1 : 0 });
  }
  const maxCasa = (c) => Math.max(0, ...c.casas);
  // Formas fechadas muito no alto do braço contam como mais difíceis
  for (const c of lista) if (c.nivel === 1 && maxCasa(c) > 5) { c.nivel = 2; c.alto = true; }
  return lista.sort((a, b) => a.nivel - b.nivel || maxCasa(a) - maxCasa(b));
}
export function posicaoViolao(nome) {
  const a = analisarAcorde(nome);
  if (!a) return null;
  const p = candidatos(a.raiz, a.tipo)[0];
  return p ? { ...p, alternativa: p.nivel >= 2 ? ALTERNATIVAS[a.tipo + ':' + a.raiz] || null : null } : null;
}
export const NIVEIS = ['aberto', 'sem pestana', 'pestana pequena', 'pestana'];
export const descricao = (p) => (p.alto ? 'sem pestana, no alto do braço' : NIVEIS[p.nivel]);

export function desenharBraco(p, rotulo) {
  const tocadas = p.casas.filter((c) => c > 0);
  const max = Math.max(0, ...tocadas);
  const base = max <= 5 ? 1 : Math.min(...tocadas);
  const x = (i) => 14 + i * 12, y = (f) => 22 + (f - base) * 16 + 8;
  const naPestana = (c, i) => p.pestana && c === p.pestana.casa && i >= p.pestana.de && i <= p.pestana.ate;
  let s = `<svg viewBox="0 0 100 112" width="91" height="102" role="img" aria-label="Violão: ${rotulo}">`;
  for (let f = 0; f <= 5; f++) s += `<line x1="14" x2="74" y1="${22 + f * 16}" y2="${22 + f * 16}" stroke="currentColor" stroke-opacity="${f === 0 && base === 1 ? 1 : 0.4}" stroke-width="${f === 0 && base === 1 ? 3 : 1}"/>`;
  for (let i = 0; i < 6; i++) s += `<line x1="${x(i)}" x2="${x(i)}" y1="22" y2="102" stroke="currentColor" stroke-opacity=".4"/>`;
  if (base > 1) s += `<text x="82" y="${y(base) + 4}" font-size="10" fill="currentColor">${base}ª</text>`;
  if (p.pestana) s += `<rect x="${x(p.pestana.de) - 5}" y="${y(p.pestana.casa) - 5}" width="${x(p.pestana.ate) - x(p.pestana.de) + 10}" height="10" rx="5" fill="#3BA285"/>`;
  p.casas.forEach((c, i) => {
    if (c === -1) s += `<text x="${x(i)}" y="16" font-size="11" text-anchor="middle" fill="currentColor" fill-opacity=".7">×</text>`;
    else if (c === 0) s += `<circle cx="${x(i)}" cy="12" r="3.5" fill="none" stroke="currentColor"/>`;
    else if (!naPestana(c, i)) s += `<circle cx="${x(i)}" cy="${y(c)}" r="5" fill="#3BA285"/>`;
  });
  return s + '</svg>';
}

// Pontuação de dificuldade de um conjunto de acordes no violão (menor = mais fácil)
const PESO = [0, 1, 2, 5];
export function dificuldade(acordes) {
  const dificeis = [], trocas = [];
  let total = 0;
  for (const nome of acordes) {
    const p = posicaoViolao(nome);
    if (!p) continue;
    total += p.alternativa ? 1 : PESO[p.nivel];
    if (p.alternativa) trocas.push(nome + '→' + p.alternativa.nome);
    else if (p.nivel >= 2) dificeis.push(nome);
  }
  return { total, dificeis, trocas };
}

// Sugere casas de capotraste que deixam os acordes mais fáceis (sem pestana).
// "acordes" = acordes reais da música; se vazio, usa o campo harmônico sem o diminuto.
export function sugerirCapo(tom, acordes = []) {
  const base = acordes.length ? acordes : campoHarmonico(tom).filter((x) => !x.acorde.includes('b5')).map((x) => x.acorde);
  const opcoes = [];
  for (let capo = 0; capo <= 7; capo++) {
    const formas = base.map((a) => transporAcorde(a, -capo));
    const d = dificuldade(formas);
    opcoes.push({ capo, forma: capo ? formaComCapo(tom, capo) : tom, ...d, pontos: d.total + capo * 0.15 });
  }
  return opcoes.sort((a, b) => a.pontos - b.pontos);
}

// ---------------------------------------------------------------- teclado
export function notasAcorde(nome) {
  const a = analisarAcorde(nome);
  if (!a) return [];
  const terca = a.tipo === 'maior' ? 4 : 3, quinta = a.tipo === 'dim' ? 6 : 7;
  return [a.raiz, a.raiz + terca, a.raiz + quinta];
}
export function nomesNotas(nome) {
  const a = analisarAcorde(nome);
  if (!a) return [];
  const bemol = a.nomeRaiz.includes('b') || (a.nomeRaiz === 'F') || (a.tipo !== 'maior' && ['C', 'D', 'G', 'F'].includes(a.nomeRaiz));
  return notasAcorde(nome).map((n) => (bemol ? BEM : SUST)[n % 12]);
}
export function svgTeclado(nome) {
  const notas = new Set(notasAcorde(nome));
  if (!notas.size) return '';
  const brancas = [0, 2, 4, 5, 7, 9, 11], pretas = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 };
  const L = 11, H = 46;
  let s = `<svg viewBox="0 0 ${14 * L + 2} ${H + 2}" width="${14 * L + 2}" height="${H + 2}" role="img" aria-label="Teclado: ${nome}">`;
  for (let o = 0; o < 2; o++) brancas.forEach((n, i) => {
    s += `<rect x="${1 + (o * 7 + i) * L}" y="1" width="${L}" height="${H}" rx="2" fill="${notas.has(n + 12 * o) ? '#3BA285' : '#FFFFFF'}" stroke="#8A9AA3"/>`;
  });
  for (let o = 0; o < 2; o++) Object.entries(pretas).forEach(([n, i]) => {
    s += `<rect x="${1 + (o * 7 + i) * L + L * 0.65}" y="1" width="${L * 0.7}" height="${H * 0.6}" rx="1.5" fill="${notas.has(Number(n) + 12 * o) ? '#2E8A70' : '#1F2A30'}" stroke="#1F2A30"/>`;
  });
  return s + '</svg>';
}
