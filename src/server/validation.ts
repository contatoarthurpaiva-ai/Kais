/**
 * validation.ts — validação de entrada do servidor (fonte de verdade).
 * A UI faz prévia; o servidor revalida e recalcula ao salvar (§1.1, §6).
 * Nada de "campo desconhecido = 0 silenciosamente" (§3): faltando dado essencial,
 * apontamos o que falta.
 */

export interface RawPricingBody {
  C?: unknown; // custo direto unitário (centavos)
  E?: unknown; // despesas variáveis unitárias (centavos)
  t?: unknown; // taxa total (decimal 0..1)
  goalMargin?: unknown; // meta (decimal)
  minMargin?: unknown; // mínimo (decimal)
  desiredPriceCents?: unknown; // preço pretendido para avaliar (opcional)
}

export interface PricingRequest {
  C: number;
  E: number;
  t: number;
  goalMargin: number;
  minMargin: number;
  desiredPriceCents?: number;
}

export type ValidationResult =
  | { ok: true; value: PricingRequest }
  | { ok: false; missing: string[]; errors: string[] };

function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && Number.isFinite(v);
}
function isRate(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1;
}

export function validatePricing(body: RawPricingBody): ValidationResult {
  const missing: string[] = [];
  const errors: string[] = [];

  if (body.C === undefined || body.C === null) missing.push('C (custo direto)');
  else if (!isInt(body.C) || body.C < 0) errors.push('C deve ser inteiro em centavos ≥ 0');

  if (body.E === undefined || body.E === null) missing.push('E (despesas variáveis)');
  else if (!isInt(body.E) || body.E < 0) errors.push('E deve ser inteiro em centavos ≥ 0');

  if (body.t === undefined || body.t === null) missing.push('t (taxa)');
  else if (!isRate(body.t)) errors.push('t deve ser decimal 0 ≤ t < 1');

  if (body.goalMargin === undefined || body.goalMargin === null) missing.push('meta de margem');
  else if (!isRate(body.goalMargin)) errors.push('meta deve ser decimal 0 ≤ m < 1');

  if (body.minMargin === undefined || body.minMargin === null) missing.push('margem mínima');
  else if (!isRate(body.minMargin)) errors.push('mínimo deve ser decimal 0 ≤ m < 1');

  if (body.desiredPriceCents !== undefined && body.desiredPriceCents !== null) {
    if (!isInt(body.desiredPriceCents) || body.desiredPriceCents < 0) {
      errors.push('preço pretendido deve ser inteiro em centavos ≥ 0');
    }
  }

  if (
    isRate(body.t) &&
    isRate(body.goalMargin) &&
    (body.t as number) + (body.goalMargin as number) >= 1
  ) {
    errors.push('taxa + meta ≥ 1: preço-alvo indefinido para essa combinação');
  }

  if (missing.length || errors.length) return { ok: false, missing, errors };

  return {
    ok: true,
    value: {
      C: body.C as number,
      E: body.E as number,
      t: body.t as number,
      goalMargin: body.goalMargin as number,
      minMargin: body.minMargin as number,
      desiredPriceCents:
        body.desiredPriceCents === undefined || body.desiredPriceCents === null
          ? undefined
          : (body.desiredPriceCents as number),
    },
  };
}
