/**
 * order.ts — mecanismo geral por PEDIDO (§6.1, §7).
 *
 * O cálculo completo opera por pedido e só aloca custos para EXIBIÇÃO por item,
 * reconciliando os centavos. Cada taxa declara sua base — taxa sobre frete,
 * tarifa fixa por pedido e antecipação não são agrupadas indevidamente em "t".
 *
 * Frete cobrado (receita) e frete pago (custo) são separados e incidem nas bases
 * corretas. Tarifa fixa por pedido é contada UMA vez, independente de nº de itens.
 */

import { Cents, MoneyError, allocateProportional, roundCents } from './money';

export type FeeBase = 'produto' | 'produto_mais_frete' | 'frete' | 'fixa_por_pedido';

export interface Fee {
  id: string;
  base: FeeBase;
  /** percentual (decimal) — usado quando não é taxa fixa */
  pct?: number;
  /** valor fixo em centavos — usado quando base = 'fixa_por_pedido' */
  fixedCents?: Cents;
}

export interface OrderItem {
  sku: string;
  qty: number;
  /** preço unitário de produto após desconto de item (centavos) */
  unitPriceCents: Cents;
  /** custo direto unitário (centavos) — snapshot no momento da venda */
  unitCostCents: Cents;
  /** despesas variáveis unitárias já atribuídas ao item (centavos) */
  unitVariableCents?: Cents;
}

export interface OrderInputs {
  items: OrderItem[];
  /** frete cobrado do cliente (receita) */
  freightChargedCents?: Cents;
  /** frete pago à transportadora (custo) */
  freightPaidCents?: Cents;
  fees: Fee[];
}

export interface OrderResult {
  productRevenueCents: Cents;
  freightChargedCents: Cents;
  grossRevenueCents: Cents; // produto + frete cobrado
  totalCostCents: Cents; // custos diretos + variáveis + frete pago
  totalFeesCents: Cents;
  netExpectedCents: Cents; // receita bruta − taxas − custos
  contributionCents: Cents;
  feeBreakdown: { id: string; base: FeeBase; amountCents: Cents }[];
}

export function computeOrder(o: OrderInputs): OrderResult {
  const freightCharged = o.freightChargedCents ?? 0;
  const freightPaid = o.freightPaidCents ?? 0;

  const productRevenue = o.items.reduce((a, it) => {
    if (it.qty <= 0) throw new MoneyError(`Item ${it.sku}: quantidade deve ser > 0`);
    return a + it.unitPriceCents * it.qty;
  }, 0);

  const directCost = o.items.reduce((a, it) => a + it.unitCostCents * it.qty, 0);
  const variableCost = o.items.reduce((a, it) => a + (it.unitVariableCents ?? 0) * it.qty, 0);

  const grossRevenue = productRevenue + freightCharged;

  const feeBreakdown = o.fees.map((f) => {
    let amount: Cents;
    switch (f.base) {
      case 'fixa_por_pedido':
        // contada UMA vez, independente de nº de itens
        amount = f.fixedCents ?? 0;
        break;
      case 'produto':
        amount = roundCents((productRevenue * (f.pct ?? 0)) / 100);
        break;
      case 'produto_mais_frete':
        amount = roundCents(((productRevenue + freightCharged) * (f.pct ?? 0)) / 100);
        break;
      case 'frete':
        amount = roundCents((freightCharged * (f.pct ?? 0)) / 100);
        break;
      default:
        throw new MoneyError(`Base de taxa desconhecida: ${f.base}`);
    }
    return { id: f.id, base: f.base, amountCents: amount };
  });

  const totalFees = feeBreakdown.reduce((a, f) => a + f.amountCents, 0);
  const totalCost = directCost + variableCost + freightPaid;
  const netExpected = grossRevenue - totalFees - totalCost;
  // contribuição do pedido: receita de produto − taxas − custos diretos/variáveis
  // (frete cobrado e pago tratados como itens próprios de caixa; aqui a
  // contribuição gerencial considera receita bruta menos taxas e custos)
  const contribution = grossRevenue - totalFees - totalCost;

  return {
    productRevenueCents: productRevenue,
    freightChargedCents: freightCharged,
    grossRevenueCents: grossRevenue,
    totalCostCents: totalCost,
    totalFeesCents: totalFees,
    netExpectedCents: netExpected,
    contributionCents: contribution,
    feeBreakdown,
  };
}

/**
 * Aloca um encargo de pedido (desconto, frete, tarifa) entre os itens para
 * EXIBIÇÃO, proporcional ao valor de cada item, sem perder centavos.
 */
export function allocateOrderCharge(chargeCents: Cents, items: OrderItem[]): Cents[] {
  const weights = items.map((it) => it.unitPriceCents * it.qty);
  return allocateProportional(chargeCents, weights);
}

/**
 * Gera as parcelas de um recebível. Uma venda de R$300 em 3x é UMA venda com
 * três recebíveis, não três vendas (§7). A soma das parcelas = total exato.
 */
export function splitInstallments(totalCents: Cents, n: number): Cents[] {
  if (n <= 0) throw new MoneyError('Número de parcelas deve ser > 0');
  return allocateProportional(totalCents, new Array(n).fill(1));
}
