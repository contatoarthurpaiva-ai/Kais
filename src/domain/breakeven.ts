/**
 * breakeven.ts — ponto de equilíbrio gerencial (§6.3).
 *
 *   PE (receita) = F / MC%_ponderada
 *
 * MC%_ponderada é ponderada pelo FATURAMENTO de cada produto no mix — nunca uma
 * média simples de margens. Se MC%_ponderada ≤ 0, não existe PE finito.
 */

import { Cents, MoneyError, roundCents, centsToReais } from './money';

export interface MixItem {
  /** faturamento previsto do item no período (centavos) */
  revenueCents: Cents;
  /** margem de contribuição percentual do item (decimal) */
  contributionPct: number;
}

/** Margem de contribuição percentual ponderada pelo faturamento do mix. */
export function weightedContributionPct(mix: MixItem[]): number {
  const totalRev = mix.reduce((a, x) => a + x.revenueCents, 0);
  if (totalRev <= 0) throw new MoneyError('Faturamento total do mix deve ser > 0');
  const weightedMC = mix.reduce((a, x) => a + x.revenueCents * x.contributionPct, 0);
  return weightedMC / totalRev;
}

export interface BreakEvenResult {
  finite: boolean;
  revenueCents: Cents; // faturamento de equilíbrio
  weightedPct: number;
  reason?: string;
}

/** PE a partir de despesas fixas F e de uma margem ponderada já conhecida. */
export function breakEvenFromPct(fixedCents: Cents, weightedPct: number): BreakEvenResult {
  if (weightedPct <= 0) {
    return {
      finite: false,
      revenueCents: 0,
      weightedPct,
      reason: 'Margem de contribuição ponderada ≤ 0: não existe ponto de equilíbrio finito.',
    };
  }
  const reais = centsToReais(fixedCents) / weightedPct;
  return { finite: true, revenueCents: roundCents(reais), weightedPct };
}

/** PE a partir do mix de produtos. */
export function breakEven(fixedCents: Cents, mix: MixItem[]): BreakEvenResult {
  return breakEvenFromPct(fixedCents, weightedContributionPct(mix));
}
