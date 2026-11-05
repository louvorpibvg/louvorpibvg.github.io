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
const ROMANOS = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };
export function transporProgressao(texto, tom) {
  const a = analisar(tom);
  if (!a || !texto) return '';
  const escala = a.menor ? MENOR : MAIOR;
  return texto.replace(/\b(b|#)?(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(°|ø|maj7|m7|7|sus4|sus2|add9|9)?(?![A-Za-z])/g,
    (todo, acid, rom, ext) => {
      const grau = ROMANOS[rom.toUpperCase()];
      let semitom = escala.intervalos[grau] + (acid === 'b' ? -1 : acid === '#' ? 1 : 0);
      const raiz = a.nomes[(a.idx + semitom + 12) % 12];
      const menor = rom === rom.toLowerCase();
      let sufixo = menor ? 'm' : '';
      if (ext === '°') sufixo = 'm(b5)';
      else if (ext === 'ø') sufixo = 'm7(b5)';
      else if (ext) sufixo += ext;
      return raiz + sufixo;
    });
}
