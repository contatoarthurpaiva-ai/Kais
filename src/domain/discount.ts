/**
 * discount.ts — desconto seguro segundo a política configurada (§6.2).
 *
 * Para preço de tabela P_tabela > 0 e preço mínimo P_min da modalidade:
 *   d_max = 1 − P_min / P_tabela
 *
 * Se P_min > P_tabela: "preço atual abaixo do mínimo definido" — não há desconto
 * disponível; exige reajuste. O limite é sempre conservador (para baixo) e o
 * preço final arredondado é revalidado contra a margem mínima.
 */

import { Cents, floorCents, MoneyError } from './money';
import { evaluateContribution, PriceInputs, targetPrice } from './pricing';

export type DiscountState =
  | 'dentro_da_meta' // contribuição atinge a meta configurada
  | 'abaixo_da_meta' // respeita o mínimo, mas não a meta
  | 'abaixo_do_minimo' // exige confirmação da administradora + justificativa
  | 'contribuicao_negativa' // receita não cobre custos e despesas variáveis
  | 'incompleto'; // faltam custo/taxa/quantidade → não é "desconto seguro"

export interface MaxDiscount {
  available: boolean;
  /** valor máximo de desconto em centavos (0 se indisponível) */
  valueCents: Cents;
  /** percentual máximo (decimal 0..1), conservador para baixo */
  pct: number;
  reason?: string;
}

/**
 * Limite de desconto a partir de tabela e preço mínimo.
 * Conservador: arredonda o valor de desconto PARA BAIXO em centavos.
 */
export function maxDiscount(tableCents: Cents, minCents: Cents): MaxDiscount {
  if (tableCents <= 0) {
    return { available: false, valueCents: 0, pct: 0, reason: 'Preço de tabela deve ser > 0' };
  }
  if (minCents > tableCents) {
    return {
      available: false,
      valueCents: 0,
      pct: 0,
      reason: 'Preço atual abaixo do mínimo definido — exige reajuste.',
    };
  }
  // desconto máximo em centavos = tabela − mínimo (ambos já em centavos inteiros)
  const valueCents = tableCents - minCents;
  const pct = valueCents / tableCents;
  return { available: true, valueCents, pct };
}

export interface DiscountEvaluation {
  finalPriceCents: Cents;
  discountValueCents: Cents;
  discountPct: number;
  contributionCents: Cents;
  contributionPct: number | null;
  state: DiscountState;
  /** distância até a meta, em pontos percentuais (negativo = abaixo) */
  distanceToGoalPP: number | null;
}

export interface DiscountPolicy {
  /** margem de contribuição mínima (decimal) — separada da meta */
  minMargin: number;
  /** meta de margem de contribuição (decimal) */
  goalMargin: number;
  /** true quando faltam dados (custo/taxa/qtd) → resultado não é "seguro" */
  incomplete?: boolean;
}

/**
 * Avalia um preço final (após desconto) contra a política.
 * Valida o preço ARREDONDADO contra a margem mínima, não só o percentual.
 */
export function evaluateDiscount(
  tableCents: Cents,
  finalCents: Cents,
  inputs: PriceInputs,
  policy: DiscountPolicy,
): DiscountEvaluation {
  if (finalCents < 0) throw new MoneyError('Preço final não pode ser negativo');
  if (tableCents <= 0) throw new MoneyError('Preço de tabela deve ser > 0');

  const discountValueCents = tableCents - finalCents;
  const discountPct = discountValueCents / tableCents;
  if (discountPct > 1) throw new MoneyError('Desconto acima de 100% não é permitido');

  const { contributionCents, contributionPct } = evaluateContribution(finalCents, inputs);

  let state: DiscountState;
  if (policy.incomplete) {
    state = 'incompleto';
  } else if (contributionCents < 0) {
    state = 'contribuicao_negativa';
  } else if (contributionPct !== null && contributionPct + 1e-9 >= policy.goalMargin) {
    state = 'dentro_da_meta';
  } else if (contributionPct !== null && contributionPct + 1e-9 >= policy.minMargin) {
    state = 'abaixo_da_meta';
  } else {
    state = 'abaixo_do_minimo';
  }

  return {
    finalPriceCents: finalCents,
    discountValueCents,
    discountPct,
    contributionCents,
    contributionPct,
    state,
    distanceToGoalPP:
      contributionPct !== null ? (contributionPct - policy.goalMargin) * 100 : null,
  };
}

/** Preço mínimo da modalidade a partir da margem mínima (arredonda p/ cima). */
export function minimumPrice(inputs: PriceInputs, minMargin: number): Cents {
  return targetPrice({ C: inputs.C, E: inputs.E, t: inputs.t, m: minMargin });
}
