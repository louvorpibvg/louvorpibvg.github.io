// Dicionário de acordes calculado: encontra posições no violão a partir das notas do acorde.
// Não depende de uma lista fixa; cada posição é validada pelas notas que soa.
const NUM = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const SUST = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BEM = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const AFINACAO = [4, 9, 2, 7, 11, 4]; // E A D G B E (6ª → 1ª corda)

// Qualidades reconhecidas: intervalos obrigatórios e opcionais (a partir da tônica)
const QUAL = {
  '': { req: [0, 4], opt: [7], nome: 'maior' },
  m: { req: [0, 3], opt: [7], nome: 'menor' },
  5: { req: [0, 7], opt: [], nome: 'quinta (power chord)' },
  7: { req: [0, 4, 10], opt: [7], nome: 'com sétima' },
  '7M': { req: [0, 4, 11], opt: [7], nome: 'com sétima maior' },
  m7: { req: [0, 3, 10], opt: [7], nome: 'menor com sétima' },
  m7M: { req: [0, 3, 11], opt: [7], nome: 'menor com sétima maior' },
  6: { req: [0, 4, 9], opt: [7], nome: 'com sexta' },
  m6: { req: [0, 3, 9], opt: [7], nome: 'menor com sexta' },
  add9: { req: [0, 4, 2], opt: [7], nome: 'com nona' },
  madd9: { req: [0, 3, 2], opt: [7], nome: 'menor com nona' },
  sus4: { req: [0, 5], opt: [7], nome: 'com quarta (suspenso)' },
  sus2: { req: [0, 2], opt: [7], nome: 'com segunda (suspenso)' },
  '7sus4': { req: [0, 5, 10], opt: [7], nome: 'com sétima e quarta' },
  '7(9)': { req: [0, 4, 10, 2], opt: [7], nome: 'com sétima e nona' },
  '7M(9)': { req: [0, 4, 11, 2], opt: [7], nome: 'com sétima maior e nona' },
  'm7(9)': { req: [0, 3, 10, 2], opt: [7], nome: 'menor com sétima e nona' },
  '5(7M)': { req: [0, 7, 11], opt: [], nome: 'quinta com sétima maior' },
  '°': { req: [0, 3, 6], opt: [], nome: 'diminuto' },
  'm7(b5)': { req: [0, 3, 6, 10], opt: [], nome: 'meio-diminuto' },
  '+': { req: [0, 4, 8], opt: [], nome: 'aumentado' },
};
// Grafias aceitas → qualidade canônica
const ALIAS = [
  [/^(maj7|7M|M7)$/, '7M'], [/^(m7M|mmaj7|m\(7M\))$/, 'm7M'], [/^(m9|m\(add9\)|madd9|m\(9\))$/, 'madd9'],
  [/^(9|add9|\(9\)|2\(9\)|add2)$/, 'add9'], [/^(4|sus4|sus)$/, 'sus4'], [/^(2|sus2)$/, 'sus2'],
  [/^(7\(4\)|7sus4|74|7\/4)$/, '7sus4'], [/^(7\(9\)|79|7\/9)$/, '7(9)'], [/^(7M\(9\)|maj9|7M9)$/, '7M(9)'],
  [/^(m7\(9\)|m79|m7\/9)$/, 'm7(9)'], [/^(°|º|dim|o)$/, '°'], [/^(m7\(b5\)|m7b5|ø|m\(b5\)|mb5)$/, 'm7(b5)'],
  [/^(\+|aug|\(#5\)|5\+)$/, '+'], [/^(5\(7M\)|5\(maj7\))$/, '5(7M)'],
];
// "m(b5)" no campo harmônico é a tríade diminuta
const TRIADE_DIM = /^m\(b5\)$/;

export function lerAcorde(nome) {
  const m = /^([A-G](?:#|b)?)(.*?)(?:\/([A-G](?:#|b)?))?$/.exec((nome || '').trim());
  if (!m) return null;
  let suf = m[2] || '';
  let q = Object.prototype.hasOwnProperty.call(QUAL, suf) ? suf : null;
  if (q === null && TRIADE_DIM.test(suf)) q = '°';
  if (q === null) for (const [re, c] of ALIAS) if (re.test(suf)) { q = c; break; }
  if (q === null) return null;
  const raiz = NUM[m[1]];
  return { raiz, nomeRaiz: m[1], qual: q, baixo: m[3] ? NUM[m[3]] : raiz, nomeBaixo: m[3] || null, def: QUAL[q] };
}
export const descreverQualidade = (nome) => lerAcorde(nome)?.def.nome || '';

const bemol = (nomeRaiz) => nomeRaiz.includes('b') || nomeRaiz === 'F';
export function notasDoAcorde(nome) {
  const a = lerAcorde(nome);
  if (!a) return [];
  const ints = [...new Set([...a.def.req, ...a.def.opt])].sort((x, y) => x - y);
  const nomes = bemol(a.nomeRaiz) ? BEM : SUST;
  const lista = ints.map((i) => nomes[(a.raiz + i) % 12]);
  if (a.nomeBaixo && !lista.includes(a.nomeBaixo)) lista.unshift(a.nomeBaixo);
  return lista;
}

// ---------------------------------------------------------------- busca de posições
function avaliar(casas, a) {
  const tocadas = casas.map((f, i) => (f < 0 ? null : (AFINACAO[i] + f) % 12));
  const idx = tocadas.map((p, i) => (p === null ? -1 : i)).filter((i) => i >= 0);
  if (idx.length < 4 && !(idx.length === 3 && a.def.req.length <= 2)) return null;
  // cordas abafadas só nas pontas (no máximo 1 no agudo), sem buracos no meio
  const primeira = idx[0], ultima = idx[idx.length - 1];
  for (let i = primeira; i <= ultima; i++) if (casas[i] < 0) return null;
  if (5 - ultima > 1) return null;
  if (tocadas[primeira] !== a.baixo) return null;
  const pcs = new Set(tocadas.filter((p) => p !== null));
  for (const r of a.def.req) if (!pcs.has((a.raiz + r) % 12)) return null;
  const permitidas = new Set([...a.def.req, ...a.def.opt].map((x) => (a.raiz + x) % 12));
  permitidas.add(a.baixo);
  for (const p of pcs) if (!permitidas.has(p)) return null;
  const presas = casas.map((f, i) => [f, i]).filter(([f]) => f > 0);
  if (!presas.length) return { casas, dedos: 0, pestana: null, nivel: 0, base: 1, pontos: -idx.length * 0.3 + Math.max(0, 5 - idx.length) * 1.3 };
  const fs = presas.map(([f]) => f), min = Math.min(...fs), max = Math.max(...fs);
  if (max - min > 3) return null;
  let dedos = presas.length, pestana = null;
  if (dedos > 4) {
    // pestana: dedo 1 deitado na menor casa, da primeira corda presa nessa casa até a última tocada,
    // sem cordas soltas por baixo dela
    const ini = presas.find(([f]) => f === min)[1];
    let ok = true;
    for (let i = ini; i <= ultima; i++) if (casas[i] === 0 || casas[i] < min) ok = false;
    if (!ok) return null;
    const naCasa = presas.filter(([f, i]) => f === min && i >= ini).length;
    dedos = presas.length - naCasa + 1;
    if (dedos > 4) return null;
    pestana = { casa: min, de: ini, ate: ultima };
  }
  const faltando = a.def.opt.filter((o) => !pcs.has((a.raiz + o) % 12)).length;
  const fino = Math.max(0, 5 - idx.length) * 1.3 + faltando * 1.5;
  const soltas = casas.filter((f) => f === 0).length;
  const tamPestana = pestana ? pestana.ate - pestana.de + 1 : 0;
  const nivel = pestana ? (tamPestana >= 4 ? 3 : 2) : soltas && max <= 4 ? 0 : 1;
  const pontos = dedos * 1.2 + (pestana ? (tamPestana >= 4 ? 7 : 3.5) : 0) + min * 0.45 + (max - min) * 0.8
    - soltas * 0.4 - idx.length * 0.35 + (casas[5] < 0 ? 0.3 : 0) + fino + (max > 5 ? soltas * 1.2 : 0);
  return { casas, dedos, pestana, nivel, base: max <= 4 ? 1 : min, pontos };
}

const cache = new Map();
export function posicoes(nome) {
  if (cache.has(nome)) return cache.get(nome);
  const a = lerAcorde(nome);
  if (!a) return [];
  const notas = new Set([...a.def.req, ...a.def.opt].map((x) => (a.raiz + x) % 12));
  notas.add(a.baixo);
  const achadas = new Map();
  for (let p = 1; p <= 12; p++) {
    const opcoes = AFINACAO.map((corda) => {
      const o = [-1];
      if (notas.has(corda)) o.push(0);
      for (let f = p; f <= p + 3; f++) if (notas.has((corda + f) % 12)) o.push(f);
      return o;
    });
    const atual = [];
    const rec = (i) => {
      if (i === 6) {
        const r = avaliar(atual.slice(), a);
        if (r) { const k = r.casas.join(','); if (!achadas.has(k)) achadas.set(k, r); }
        return;
      }
      for (const f of opcoes[i]) { atual[i] = f; rec(i + 1); }
    };
    rec(0);
  }
  const lista = [...achadas.values()].sort((x, y) => x.pontos - y.pontos);
  cache.set(nome, lista);
  return lista;
}

// Posições variadas: a mais fácil de cada região do braço, sem repetir formatos parecidos
export function posicoesVariadas(nome, max = 6) {
  const todas = posicoes(nome);
  const escolhidas = [];
  const regiao = (p) => (p.base <= 3 ? 0 : p.base <= 6 ? 1 : p.base <= 9 ? 2 : 3);
  const semPestana = todas.find((p) => !p.pestana);
  if (semPestana) escolhidas.push(semPestana);
  const comPestana = todas.find((p) => p.pestana && p.pestana.ate - p.pestana.de >= 4);
  for (const r of [0, 1, 2, 3]) {
    const p = todas.find((x) => regiao(x) === r && !escolhidas.includes(x));
    if (p) escolhidas.push(p);
  }
  if (comPestana && !escolhidas.includes(comPestana)) escolhidas.push(comPestana);
  for (const p of todas) { if (escolhidas.length >= max) break; if (!escolhidas.includes(p)) escolhidas.push(p); }
  return escolhidas.slice(0, max).sort((x, y) => x.base - y.base || x.pontos - y.pontos);
}
export function melhorPosicao(nome, semPestana) {
  const todas = posicoes(nome);
  return (semPestana && todas.find((p) => !p.pestana)) || todas[0] || null;
}

// Variações úteis para usar no lugar do acorde (mesma função harmônica)
export function variacoes(nome) {
  const a = lerAcorde(nome);
  if (!a) return [];
  const r = a.nomeRaiz;
  const b = a.nomeBaixo ? '/' + a.nomeBaixo : '';
  const nomes = bemol(r) ? BEM : SUST;
  const terca = (semitons) => nomes[(a.raiz + semitons) % 12];
  const menor = ['m', 'm7', 'm7M', 'm6', 'madd9', 'm7(9)'].includes(a.qual);
  const dim = ['°', 'm7(b5)'].includes(a.qual);
  let lista;
  if (dim) lista = [r + '°', r + 'm7(b5)'];
  else if (menor) lista = [r + 'm', r + 'm7', r + 'm(add9)', r + 'm7(9)', r + 'sus2', r + 'sus4', r + 'm6', r + 'm/' + terca(3)];
  else lista = [r, r + 'add9', r + 'sus2', r + 'sus4', r + '7M', r + '6', r + '7', r + '/' + terca(4)];
  return lista.map((n) => (b && !n.includes('/') ? n + b : n)).filter((n) => n !== nome && lerAcorde(n) && posicoes(n).length);
}

// ---------------------------------------------------------------- desenhos
export function svgBraco(p, rotulo, cor = '#3BA285') {
  const tocadas = p.casas.filter((c) => c > 0);
  const max = Math.max(0, ...tocadas);
  const base = max <= 4 ? 1 : Math.min(...tocadas);
  const x = (i) => 14 + i * 12, y = (f) => 22 + (f - base) * 16 + 8;
  const naPestana = (c, i) => p.pestana && c === p.pestana.casa && i >= p.pestana.de && i <= p.pestana.ate;
  let s = `<svg viewBox="0 0 100 112" width="91" height="102" role="img" aria-label="Violão: ${rotulo}">`;
  for (let f = 0; f <= 5; f++) s += `<line x1="14" x2="74" y1="${22 + f * 16}" y2="${22 + f * 16}" stroke="currentColor" stroke-opacity="${f === 0 && base === 1 ? 1 : 0.4}" stroke-width="${f === 0 && base === 1 ? 3 : 1}"/>`;
  for (let i = 0; i < 6; i++) s += `<line x1="${x(i)}" x2="${x(i)}" y1="22" y2="102" stroke="currentColor" stroke-opacity=".4"/>`;
  if (base > 1) s += `<text x="82" y="${y(base) + 4}" font-size="10" fill="currentColor">${base}ª</text>`;
  if (p.pestana) s += `<rect x="${x(p.pestana.de) - 5}" y="${y(p.pestana.casa) - 5}" width="${x(p.pestana.ate) - x(p.pestana.de) + 10}" height="10" rx="5" fill="${cor}"/>`;
  p.casas.forEach((c, i) => {
    if (c === -1) s += `<text x="${x(i)}" y="16" font-size="11" text-anchor="middle" fill="currentColor" fill-opacity=".7">×</text>`;
    else if (c === 0) s += `<circle cx="${x(i)}" cy="12" r="3.5" fill="none" stroke="currentColor"/>`;
    else if (!naPestana(c, i)) s += `<circle cx="${x(i)}" cy="${y(c)}" r="5" fill="${cor}"/>`;
  });
  return s + '</svg>';
}
export function rotuloPosicao(p) {
  const casa = p.base > 1 ? ` · ${p.base}ª casa` : '';
  return (p.nivel === 0 ? 'aberto' : p.nivel === 1 ? 'sem pestana' : p.nivel === 2 ? 'pestana pequena' : 'pestana') + casa;
}
export function svgTecladoAcorde(nome) {
  const a = lerAcorde(nome);
  if (!a) return '';
  // Voz fechada a partir da tônica (baixo separado, se houver)
  const ints = [...new Set([...a.def.req, ...a.def.opt])].sort((x, y) => x - y);
  const temBaixo = a.nomeBaixo && a.baixo !== a.raiz;
  const desloc = temBaixo ? 12 : 0; // com baixo invertido, o baixo fica na primeira oitava e o acorde na seguinte
  const notas = new Set(ints.map((i) => a.raiz + i + desloc));
  if (temBaixo) notas.add(a.baixo);
  const brancas = [0, 2, 4, 5, 7, 9, 11], pretas = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 };
  const L = 11, H = 46, oit = 3;
  let s = `<svg viewBox="0 0 ${7 * oit * L + 2} ${H + 2}" width="${7 * oit * L + 2}" height="${H + 2}" role="img" aria-label="Teclado: ${nome}">`;
  for (let o = 0; o < oit; o++) brancas.forEach((n, i) => {
    s += `<rect x="${1 + (o * 7 + i) * L}" y="1" width="${L}" height="${H}" rx="2" fill="${notas.has(n + 12 * o) ? '#3BA285' : '#FFFFFF'}" stroke="#8A9AA3"/>`;
  });
  for (let o = 0; o < oit; o++) Object.entries(pretas).forEach(([n, i]) => {
    s += `<rect x="${1 + (o * 7 + i) * L + L * 0.65}" y="1" width="${L * 0.7}" height="${H * 0.6}" rx="1.5" fill="${notas.has(Number(n) + 12 * o) ? '#2E8A70' : '#1F2A30'}" stroke="#1F2A30"/>`;
  });
  return s + '</svg>';
}
