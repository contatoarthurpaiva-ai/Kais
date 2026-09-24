/**
 * pricing-service.ts — orquestra o motor de domínio para a UI e a API.
 * Recebe uma requisição já validada e devolve o resultado completo da simulação,
 * incluindo "como foi calculado" (premissas) para o botão explicativo (§1.1).
 */
import {
  targetPrice,
  zeroContributionFloor,
  minimumPrice,
  maxDiscount,
  evaluateDiscount,
  type PriceInputs,
  type DiscountEvaluation,
} from '../domain/index';
import type { PricingRequest } from './validation';

export interface PricingResult {
  inputs: PricingRequest;
  targetPriceCents: number;
  minPriceCents: number;
  zeroFloorCents: number;
  maxDiscount: { available: boolean; valueCents: number; pct: number; reason?: string };
  /** avaliação de um preço pretendido, quando informado */
  evaluation: DiscountEvaluation | null;
  assumptions: string[];
}

export function simulatePricing(req: PricingRequest): PricingResult {
  const inputs: PriceInputs = { C: req.C, E: req.E, t: req.t };

  const targetPriceCents = targetPrice({ ...inputs, m: req.goalMargin });
  const minPriceCents = minimumPrice(inputs, req.minMargin);
  const zeroFloorCents = zeroContributionFloor(inputs);
  const disc = maxDiscount(targetPriceCents, minPriceCents);

  let evaluation: DiscountEvaluation | null = null;
  if (req.desiredPriceCents !== undefined) {
    evaluation = evaluateDiscount(targetPriceCents, req.desiredPriceCents, inputs, {
      minMargin: req.minMargin,
      goalMargin: req.goalMargin,
    });
  }

  return {
    inputs: req,
    targetPriceCents,
    minPriceCents,
    zeroFloorCents,
    maxDiscount: disc,
    evaluation,
    assumptions: [
      `Preço-alvo = (C+E) / (1 − t − meta) = (${req.C}+${req.E})/(1 − ${req.t} − ${req.goalMargin})`,
      `Preço mínimo usa a margem mínima (${(req.minMargin * 100).toFixed(2)}%), arredondado para cima`,
      `Piso sem contribuição = (C+E)/(1 − t): cobre custos e taxas, não as despesas fixas`,
      `Limite de desconto = tabela − mínimo, arredondado para baixo`,
    ],
  };
}
