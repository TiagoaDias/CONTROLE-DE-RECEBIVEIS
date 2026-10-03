/**
 * Converte valores numéricos em moeda Real (BRL) por extenso em língua portuguesa.
 * Exemplo: 4121.48 -> "Quatro mil, cento e vinte e um reais e quarenta e oito centavos"
 */

const UNIDADES = [
  '',
  'um',
  'dois',
  'três',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
];

const ESPECIAIS_10 = [
  'dez',
  'onze',
  'doze',
  'treze',
  'quatorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
];

const DEZENAS = [
  '',
  '',
  'vinte',
  'trinta',
  'quarenta',
  'cinquenta',
  'sessenta',
  'setenta',
  'oitenta',
  'noventa',
];

const CENTENAS = [
  '',
  'cento',
  'duzentos',
  'trezentos',
  'quatrocentos',
  'quinhentos',
  'seiscentos',
  'setecentos',
  'oitocentos',
  'novecentos',
];

function converterTresDigitos(n: number): string {
  if (n <= 0 || isNaN(n)) return '';
  if (n === 100) return 'cem';

  const c = Math.floor(n / 100);
  const d = Math.floor((n % 100) / 10);
  const u = Math.floor(n % 10);

  const partes: string[] = [];

  if (c > 0 && c < CENTENAS.length && CENTENAS[c]) {
    partes.push(CENTENAS[c]);
  }

  const resto = Math.floor(n % 100);
  if (resto >= 10 && resto <= 19) {
    if (ESPECIAIS_10[resto - 10]) {
      partes.push(ESPECIAIS_10[resto - 10]);
    }
  } else {
    if (d > 0 && d < DEZENAS.length && DEZENAS[d]) {
      partes.push(DEZENAS[d]);
    }
    if (u > 0 && u < UNIDADES.length && UNIDADES[u]) {
      partes.push(UNIDADES[u]);
    }
  }

  return partes.filter(Boolean).join(' e ');
}

export function valorPorExtenso(valorTotal: number): string {
  try {
    if (!valorTotal || isNaN(valorTotal) || valorTotal <= 0) {
      return 'Zero reais';
    }

    const valorFixado = Number(valorTotal).toFixed(2);
    const [inteiroStr, centavosStr] = valorFixado.split('.');
    const valorInteiro = parseInt(inteiroStr, 10) || 0;
    const valorCentavos = parseInt(centavosStr, 10) || 0;

    const partesTexto: string[] = [];

    if (valorInteiro === 0) {
      // Apenas centavos
      if (valorCentavos > 0) {
        const centExtenso = converterTresDigitos(valorCentavos);
        return `${centExtenso} ${valorCentavos === 1 ? 'centavo' : 'centavos'}`.replace(
          /^./,
          (s) => s.toUpperCase()
        );
      }
      return 'Zero reais';
    }

    // Milhões
    const milhoes = Math.floor(valorInteiro / 1000000);
    const milhares = Math.floor((valorInteiro % 1000000) / 1000);
    const unidades = valorInteiro % 1000;

    if (milhoes > 0) {
      if (milhoes === 1) {
        partesTexto.push('um milhão');
      } else {
        partesTexto.push(`${converterTresDigitos(milhoes)} milhões`);
      }
    }

    if (milhares > 0) {
      if (milhares === 1) {
        partesTexto.push('um mil');
      } else {
        partesTexto.push(`${converterTresDigitos(milhares)} mil`);
      }
    }

    if (unidades > 0) {
      const uTxt = converterTresDigitos(unidades);
      if (uTxt) partesTexto.push(uTxt);
    }

    let textoReais = '';
    if (partesTexto.length === 1) {
      textoReais = partesTexto[0];
    } else if (partesTexto.length === 2) {
      textoReais = partesTexto.join(', ');
    } else if (partesTexto.length > 2) {
      textoReais = `${partesTexto.slice(0, -1).join(', ')} e ${partesTexto[partesTexto.length - 1]}`;
    } else {
      textoReais = `${valorInteiro}`;
    }

    // Ajuste do substantivo "real" ou "reais"
    const sufixoReal = valorInteiro === 1 ? 'real' : 'reais';
    let resultadoFinal = `${textoReais} ${sufixoReal}`;

    // Centavos
    if (valorCentavos > 0) {
      const textoCentavos = converterTresDigitos(valorCentavos);
      const sufixoCentavo = valorCentavos === 1 ? 'centavo' : 'centavos';
      resultadoFinal += ` e ${textoCentavos} ${sufixoCentavo}`;
    }

    // Primeira letra maiúscula
    return resultadoFinal.charAt(0).toUpperCase() + resultadoFinal.slice(1);
  } catch (err) {
    console.warn('Erro ao converter valor por extenso:', err);
    return `R$ ${(Number(valorTotal) || 0).toFixed(2)}`;
  }
}
