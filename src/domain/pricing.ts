/**
 * pricing.ts — motor de precificação (§6.1).
 *
 * Cenário simplificado de uma peça:
 *   C = custo direto unitário (centavos)
 *   E = despesas variáveis em reais atribuídas à unidade (centavos)
 *   t = soma das taxas percentuais que incidem sobre a MESMA base P (decimal 0..1)
 *   P = receita de produto após desconto (centavos)
 *   m = margem de contribuição desejada sobre P (decimal)
 *   F = despesas fixas do período (centavos)
 *
 *   MC          = P·(1−t) − C − E
 *   MC%         = MC / P            (somente se P > 0)
 *   P_alvo      = (C+E) / (1−t−m)
 *   P_zero      = (C+E) / (1−t)     ("piso sem contribuição para despesas fixas")
 *   P_planejado = (C+E+A) / (1−t−l)
 *
 * As fórmulas simplificadas SÓ valem quando todas as taxas usam a mesma base P.
 * O mecanismo geral por pedido está em order.ts.
 */

import { Cents, ceilCents, centsToReais, MoneyError, reaisToCents } from './money';

export interface PriceInputs {
  C: Cents; // custo direto unitário
  E: Cents; // despesas variáveis em reais por unidade
  t: number; // taxa percentual total (decimal, ex.: 0.10)
  /** margem de contribuição desejada (decimal). Opcional para pisos. */
  m?: number;
}

function assertRate(name: string, v: number) {
  if (!Number.isFinite(v) || v < 0 || v >= 1) {
    throw new MoneyError(`${name} inválida: ${v} (esperado 0 ≤ ${name} < 1)`);
  }
}

/** Margem de contribuição em reais, dado um preço P. */
export function contribution(P: Cents, i: PriceInputs): Cents {
  if (P < 0) throw new MoneyError('P não pode ser negativo');
  assertRate('t', i.t);
  // MC = P(1−t) − C − E, tudo em centavos
  return Math.round(P * (1 - i.t)) - i.C - i.E;
}

export interface ContributionResult {
  contributionCents: Cents;
  /** decimal 0..1; null quando P = 0 (indefinido). */
  contributionPct: number | null;
}

export function evaluateContribution(P: Cents, i: PriceInputs): ContributionResult {
  const mc = contribution(P, i);
  return {
    contributionCents: mc,
    contributionPct: P > 0 ? mc / P : null,
  };
}

/**
 * Preço-alvo para atingir a margem de contribuição m.
 * Arredonda para CIMA (protege a margem). Lança se denominador ≤ 0.
 */
export function targetPrice(i: Required<PriceInputs>): Cents {
  assertRate('t', i.t);
  assertRate('m', i.m);
  const denom = 1 - i.t - i.m;
  if (denom <= 0) {
    throw new MoneyError(
      `Denominador (1−t−m)=${denom.toFixed(4)} ≤ 0: preço-alvo indefinido para essa combinação de taxa e margem.`,
    );
  }
  const reais = (centsToReais(i.C) + centsToReais(i.E)) / denom;
  return ceilCents(reais);
}

/**
 * Piso de contribuição zero: preço em que MC = 0.
 * NÃO significa cobrir despesas fixas nem lucro. Arredonda para cima.
 */
export function zeroContributionFloor(i: PriceInputs): Cents {
  assertRate('t', i.t);
  const denom = 1 - i.t;
  if (denom <= 0) throw new MoneyError('Denominador (1−t) ≤ 0');
  const reais = (centsToReais(i.C) + centsToReais(i.E)) / denom;
  return ceilCents(reais);
}

/**
 * Preço planejado com alocação gerencial A por unidade (cobertura de fixos) e
 * margem de resultado l após essa alocação. Cenário explícito e estimado.
 */
export function plannedPrice(i: PriceInputs & { A: Cents; l: number }): Cents {
  assertRate('t', i.t);
  assertRate('l', i.l);
  const denom = 1 - i.t - i.l;
  if (denom <= 0) {
    throw new MoneyError(`Denominador (1−t−l)=${denom.toFixed(4)} ≤ 0: preço planejado indefinido.`);
  }
  const reais = (centsToReais(i.C) + centsToReais(i.E) + centsToReais(i.A)) / denom;
  return ceilCents(reais);
}

/** Markup sobre a base de custo escolhida (NÃO é lucro). Ex.: 1.5 = +50%. */
export function markupFactor(priceCents: Cents, baseCostCents: Cents): number {
  if (baseCostCents <= 0) throw new MoneyError('Base de custo do markup deve ser > 0');
  return priceCents / baseCostCents;
}

export { reaisToCents };
