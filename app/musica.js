// Teoria musical simples: campo harmônico e transposição de progressões em graus.
const SUSTENIDOS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BEMOIS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const USA_BEMOL = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

export const TONS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
  'Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];

const MAIOR = { intervalos: [0, 2, 4, 5, 7, 9, 11], qualidades: ['', 'm', 'm', '', '', 'm', 'm(b5)'], graus: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] };
const MENOR = { intervalos: [0, 2, 3, 5, 7, 8, 10], qualidades: ['m', 'm(b5)', '', 'm', 'm', '', ''], graus: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'] };

export function tomValido(t) { return /^[A-G](#|b)?m?$/.test(t || ''); }

function analisar(tom) {
  const m = /^([A-G](?:#|b)?)(m?)$/.exec(tom || '');
  if (!m) return null;
  const raiz = m[1];
  const idx = SUSTENIDOS.indexOf(raiz) >= 0 ? SUSTENIDOS.indexOf(raiz) : BEMOIS.indexOf(raiz);
  return { idx, menor: m[2] === 'm', nomes: USA_BEMOL.has(tom) || raiz.includes('b') ? BEMOIS : SUSTENIDOS };
}

export function campoHarmonico(tom) {
  const a = analisar(tom);
  if (!a) return [];
  const escala = a.menor ? MENOR : MAIOR;
  return escala.intervalos.map((iv, i) => ({ grau: escala.graus[i], acorde: a.nomes[(a.idx + iv) % 12] + escala.qualidades[i] }));
}

// Converte "I – V – vi – IV" no tom escolhido. Mantém o que não reconhecer.
// Aceita várias linhas ("Verso: I V vi IV") e baixo invertido ("I/III").
const ROMANOS = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };
const RE_GRAU = /(^|[^A-Za-z0-9])(b|#)?(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(°|ø|maj7|7|sus4|sus2|add9|9|6)?(?![A-Za-z0-9])/g;
export function transporProgressao(texto, tom) {
  const a = analisar(tom);
  if (!a || !texto) return '';
  const escala = a.menor ? MENOR : MAIOR;
  return texto.replace(RE_GRAU, (todo, antes, acid, rom, ext) => {
    const grau = ROMANOS[rom.toUpperCase()];
    const semitom = escala.intervalos[grau] + (acid === 'b' ? -1 : acid === '#' ? 1 : 0);
    const nomes = acid === 'b' ? BEMOIS : acid === '#' ? SUSTENIDOS : a.nomes;
    const raiz = nomes[(a.idx + semitom + 12) % 12];
    const menor = rom === rom.toLowerCase();
    let sufixo = menor ? 'm' : '';
    if (ext === '°') sufixo = 'm(b5)';
    else if (ext === 'ø') sufixo = 'm7(b5)';
    else if (ext === 'maj7') sufixo += '7M';
    else if (ext) sufixo += ext;
    return antes + raiz + sufixo;
  });
}

// Converte acordes escritos num tom ("Verso: G D/F# Em C") para graus ("Verso: I V/VII vi IV").
// Só converte o que vem depois do ":" de cada linha (o nome da seção fica intacto).
const RE_CIFRA = /^([(\[]*)([A-G](?:#|b)?)(m7\(b5\)|m\(b5\)|7M|maj7|m7|m6|m|°|dim|7|6|sus4|sus2|add9|9|4|2)?(?:\/([A-G](?:#|b)?))?([)\],.]*)$/;
const RE_SEPARADOR = /^(\||-|–|—|,|\.|%|:|x\d+|\d+x|\(x?\d+x?\))$/i;
const NUM = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
function grauDe(nota, a) {
  const esc = (a.menor ? MENOR : MAIOR).intervalos;
  const o = (NUM[nota] - a.idx + 12) % 12;
  const i = esc.indexOf(o);
  if (i >= 0) return ROM[i];
  const acima = esc.indexOf((o + 1) % 12), abaixo = esc.indexOf((o + 11) % 12);
  if (a.menor ? abaixo >= 0 : acima >= 0 && o !== 6) return a.menor ? '#' + ROM[abaixo] : 'b' + ROM[acima];
  return acima >= 0 ? 'b' + ROM[acima] : '#' + ROM[abaixo];
}
export function acordesParaGraus(texto, tom) {
  const a = analisar(tom);
  const desconhecidos = [];
  if (!a) return { texto: '', desconhecidos: ['tom'] };
  const linhas = (texto || '').split(/\r?\n/).map((linha) => {
    const k = linha.indexOf(':');
    const rotulo = k >= 0 ? linha.slice(0, k + 1) : '';
    const corpo = k >= 0 ? linha.slice(k + 1) : linha;
    const novo = corpo.split(/(\s+)/).map((tok) => {
      if (!tok.trim() || RE_SEPARADOR.test(tok)) return tok;
      const m = RE_CIFRA.exec(tok);
      if (!m) { desconhecidos.push(tok); return tok; }
      const [, ab, raiz, suf = '', baixo, fe] = m;
      const menor = /^m(?!aj)|^°|^dim/.test(suf);
      let g = grauDe(raiz, a);
      g = g.replace(/[IV]+/, (r) => (menor ? r.toLowerCase() : r));
      const ext = { 'm7(b5)': 'ø', 'm(b5)': '°', '°': '°', dim: '°', m: '', m7: '7', m6: '6', '7M': 'maj7', maj7: 'maj7', 7: '7', 6: '6',
        sus4: 'sus4', 4: 'sus4', sus2: 'sus2', 2: 'sus2', add9: 'add9', 9: '9' }[suf] ?? '';
      return ab + g + ext + (baixo ? '/' + grauDe(baixo, a) : '') + fe;
    }).join('');
    return rotulo + novo;
  });
  return { texto: linhas.join('\n').trim(), desconhecidos };
}

// Lista os acordes (como aparecem) de um texto já transposto, sem repetir.
export function acordesDoTexto(texto) {
  const vistos = [];
  for (const linha of (texto || '').split(/\r?\n/)) {
    const k = linha.indexOf(':');
    for (const tok of (k >= 0 ? linha.slice(k + 1) : linha).split(/\s+/)) {
      const m = RE_CIFRA.exec(tok);
      if (m) { const ac = m[2] + (m[3] || '') + (m[4] ? '/' + m[4] : ''); if (!vistos.includes(ac)) vistos.push(ac); }
    }
  }
  return vistos;
}

// Forma dos acordes no violão com capotraste: tom real menos as casas do capo.
// Ex.: Bbm com capo na 1ª casa → forma de Am.
const FORMAS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
export function formaComCapo(tom, capo) {
  const a = analisar(tom);
  if (!a || !capo) return tom;
  return FORMAS[((a.idx - Number(capo)) % 12 + 12) % 12] + (a.menor ? 'm' : '');
}
