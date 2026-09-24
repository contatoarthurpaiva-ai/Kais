/**
 * reporting.ts — consolidação para dashboard e relatórios (§8).
 *
 * Invariantes (§8, §11):
 *  - Receita reconhecida (por padrão, só ENTREGUE) ≠ pedidos em carteira.
 *  - Bruto recebido ≠ líquido creditado.
 *  - Transferências e aportes NÃO elevam faturamento.
 *  - Pró-labore registrado como despesa não é contado de novo como retirada.
 *  - Compra de estoque NÃO é deduzida junto com o CMV (só o CMV entra no resultado).
 *  - Saldo bancário não é lucro; contribuição unitária não é lucro líquido.
 *
 * Tudo em centavos inteiros.
 */
import { Cents } from './money';
import type { OrderStatus } from './sales';

// ─────────────────────────────── Vendas ─────────────────────────────────────

export interface SaleRecord {
  status: OrderStatus;
  productRevenueCents: Cents; // receita de produto após desconto de item
  discountsCents: Cents; // descontos concedidos (para "após descontos")
  cmvCents: Cents; // custo das peças vendidas (snapshot)
  variableCents: Cents; // despesas variáveis do pedido (taxas, frete pago)
  returnedRevenueCents?: Cents; // devoluções: receita revertida
  returnedCostCents?: Cents; // devoluções: custo revertido
}

export interface RevenueSummary {
  recognizedCents: Cents; // realizada (entregue)
  inCarteiraCents: Cents; // contratada, não realizada
  discountsCents: Cents;
  returnsCents: Cents;
  netRevenueCents: Cents; // reconhecida − devoluções (descontos já estão fora da receita de produto)
}

export function revenueSummary(sales: SaleRecord[]): RevenueSummary {
  let recognized = 0;
  let carteira = 0;
  let discounts = 0;
  let returns = 0;
  for (const s of sales) {
    discounts += s.discountsCents;
    returns += s.returnedRevenueCents ?? 0;
    if (s.status === 'ENTREGUE') recognized += s.productRevenueCents;
    else if (s.status !== 'CANCELADO') carteira += s.productRevenueCents;
  }
  return {
    recognizedCents: recognized,
    inCarteiraCents: carteira,
    discountsCents: discounts,
    returnsCents: returns,
    netRevenueCents: recognized - returns,
  };
}

// ─────────────────────────────── Recebíveis ─────────────────────────────────

export interface ReceivableRecord {
  grossCents: Cents;
  feesCents: Cents;
  receivedCents: Cents;
  status: 'PENDENTE' | 'PARCIAL' | 'RECEBIDO' | 'ESTORNADO';
  overdue: boolean;
}

export interface CashSummary {
  grossReceivedCents: Cents; // bruto efetivamente recebido
  netCreditedCents: Cents; // líquido creditado (bruto − taxas proporcionais)
  toReceiveCents: Cents; // ainda a receber
  overdueReceivableCents: Cents; // vencido a receber
}

export function cashSummary(recs: ReceivableRecord[]): CashSummary {
  let gross = 0;
  let net = 0;
  let toReceive = 0;
  let overdue = 0;
  for (const r of recs) {
    if (r.status === 'ESTORNADO') continue;
    gross += r.receivedCents;
    // taxa proporcional ao que já foi recebido
    const feeOnReceived = r.grossCents > 0 ? Math.round((r.feesCents * r.receivedCents) / r.grossCents) : 0;
    net += r.receivedCents - feeOnReceived;
    const remaining = r.grossCents - r.receivedCents;
    toReceive += remaining;
    if (r.overdue) overdue += remaining; // parcela vencida continua a receber até confirmação (§11)
  }
  return {
    grossReceivedCents: gross,
    netCreditedCents: net,
    toReceiveCents: toReceive,
    overdueReceivableCents: overdue,
  };
}

// ─────────────────────────────── Despesas ───────────────────────────────────

export interface ExpenseRecord {
  amountCents: Cents;
  fixed: boolean; // fixa/variável
  status: 'PREVISTO' | 'EM_ABERTO' | 'PARCIALMENTE_PAGO' | 'PAGO' | 'VENCIDO' | 'CANCELADO';
  inPeriod: boolean; // competência no período do relatório
}

export interface PayablesSummary {
  toPayCents: Cents; // contas a pagar (em aberto/parcial/vencido)
  overduePayableCents: Cents;
  fixedInPeriodCents: Cents; // despesas fixas por competência no período
}

export function payablesSummary(exps: ExpenseRecord[]): PayablesSummary {
  let toPay = 0;
  let overdue = 0;
  let fixed = 0;
  for (const e of exps) {
    if (e.status === 'CANCELADO') continue;
    if (e.status !== 'PAGO') toPay += e.amountCents;
    if (e.status === 'VENCIDO') overdue += e.amountCents;
    if (e.fixed && e.inPeriod) fixed += e.amountCents;
  }
  return { toPayCents: toPay, overduePayableCents: overdue, fixedInPeriodCents: fixed };
}

// ──────────────────────── Resultado gerencial ──────────────────────────────

export interface ManagerialInput {
  recognizedRevenueCents: Cents;
  returnsCents: Cents;
  cmvCents: Cents;
  variableExpensesCents: Cents; // taxas, frete pago etc. (não recontar o que já está no CMV)
  fixedExpensesCents: Cents;
}

export interface ManagerialResult {
  recognizedRevenueCents: Cents;
  returnsCents: Cents;
  cmvCents: Cents;
  variableExpensesCents: Cents;
  contributionCents: Cents; // receita líquida − CMV − variáveis
  fixedExpensesCents: Cents;
  resultCents: Cents; // contribuição − fixas
}

/**
 * Reconcilia sem dupla contagem:
 *   contribuição = (receita reconhecida − devoluções) − CMV − despesas variáveis
 *   resultado    = contribuição − despesas fixas
 * Compra de estoque NÃO entra aqui (só o CMV). Aportes/transferências/retiradas
 * tampouco — não são resultado.
 */
export function managerialResult(i: ManagerialInput): ManagerialResult {
  const netRevenue = i.recognizedRevenueCents - i.returnsCents;
  const contribution = netRevenue - i.cmvCents - i.variableExpensesCents;
  const result = contribution - i.fixedExpensesCents;
  return {
    recognizedRevenueCents: i.recognizedRevenueCents,
    returnsCents: i.returnsCents,
    cmvCents: i.cmvCents,
    variableExpensesCents: i.variableExpensesCents,
    contributionCents: contribution,
    fixedExpensesCents: i.fixedExpensesCents,
    resultCents: result,
  };
}

// ──────────────────────────── Caixa / saldo ────────────────────────────────

export type LedgerKind =
  | 'RECEITA'
  | 'DESPESA'
  | 'APORTE'
  | 'RETIRADA'
  | 'TRANSFERENCIA'
  | 'PRO_LABORE';

export interface LedgerRecord {
  kind: LedgerKind;
  amountCents: Cents; // sempre positivo; o sinal vem do tipo
}

/**
 * Faturamento vem das VENDAS, nunca do caixa: aportes e transferências não
 * elevam faturamento. Esta função soma só o que é receita de venda registrada
 * como movimento de caixa do tipo RECEITA — e existe para provar o invariante.
 */
export function faturamentoFromLedger(ledger: LedgerRecord[]): Cents {
  return ledger.filter((l) => l.kind === 'RECEITA').reduce((a, l) => a + l.amountCents, 0);
}

/** Saldo realizado = saldo inicial + entradas de caixa − saídas de caixa. */
export function realizedBalance(openingCents: Cents, ledger: LedgerRecord[]): Cents {
  let bal = openingCents;
  for (const l of ledger) {
    switch (l.kind) {
      case 'RECEITA':
      case 'APORTE':
        bal += l.amountCents;
        break;
      case 'DESPESA':
      case 'RETIRADA':
      case 'PRO_LABORE':
        bal -= l.amountCents;
        break;
      case 'TRANSFERENCIA':
        // entre contas próprias: neutro no saldo consolidado da loja
        break;
    }
  }
  return bal;
}
