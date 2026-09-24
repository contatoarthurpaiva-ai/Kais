/**
 * money.ts — aritmética monetária em centavos inteiros.
 *
 * Regra do sistema (§6): valores monetários em centavos inteiros; nada de ponto
 * flutuante sem controle. Arredondamos apenas nos pontos documentados, com o
 * MODO explícito:
 *
 *  - ceilCents  → usado em PREÇOS MÍNIMOS e pisos (nunca subestimar → protege margem)
 *  - floorCents → usado em LIMITES DE DESCONTO (nunca exceder o permitido)
 *  - roundCents → arredondamento comercial padrão (metade para cima)
 *
 * O epsilon absorve ruído de ponto flutuante do cálculo intermediário
 * (ex.: 100.00000000001) sem mascarar diferenças reais de centavo.
 */

export type Cents = number; // inteiro, sempre >= 0 exceto onde explicitado

const EPS = 1e-6;

export function reaisToCents(reais: number): Cents {
  return Math.round(reais * 100);
}

export function centsToReais(c: Cents): number {
  return c / 100;
}

/** Converte um valor em reais (possivelmente fracionário) para centavos, para cima. */
export function ceilCents(reais: number): Cents {
  return Math.ceil(reais * 100 - EPS);
}

/** Converte um valor em reais (possivelmente fracionário) para centavos, para baixo. */
export function floorCents(reais: number): Cents {
  return Math.floor(reais * 100 + EPS);
}

/** Arredondamento comercial padrão (metade para cima) a partir de reais. */
export function roundCents(reais: number): Cents {
  return Math.round(reais * 100 - EPS + 0.5) - 0; // half-up estável
}

/** Formata centavos como BRL (pt-BR). */
export function formatBRL(c: Cents): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(centsToReais(c));
}

/**
 * Rateio proporcional de um total (em centavos) entre pesos, garantindo que a
 * soma das partes seja EXATAMENTE o total (método do maior resto). Usado para
 * alocar desconto/frete entre itens de um kit sem perder centavos (§11).
 */
export function allocateProportional(totalCents: Cents, weights: number[]): Cents[] {
  const sumW = weights.reduce((a, b) => a + b, 0);
  if (sumW <= 0) {
    // sem base de rateio: distribui igualmente, ainda somando o total
    const n = weights.length;
    const base = Math.floor(totalCents / n);
    const parts: number[] = new Array(n).fill(base);
    let rem = totalCents - base * n;
    for (let i = 0; rem > 0; i = (i + 1) % n, rem--) parts[i] = (parts[i] ?? 0) + 1;
    return parts;
  }
  const raw = weights.map((w) => (totalCents * w) / sumW);
  const floor = raw.map((x) => Math.floor(x));
  let remainder = totalCents - floor.reduce((a, b) => a + b, 0);
  // distribui o resto para os maiores restos fracionários
  const order = raw
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);
  const parts = [...floor];
  for (let k = 0; k < remainder; k++) {
    const target = order[k % order.length];
    if (target) parts[target.i] = (parts[target.i] ?? 0) + 1;
  }
  return parts;
}

export class MoneyError extends Error {}
