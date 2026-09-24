/**
 * sales.ts — vendas, recebíveis, devoluções (§7) + idempotência e concorrência.
 *
 * Princípios (§7):
 *  - Reconhecimento de receita ≠ movimento de caixa. Por padrão, receita é
 *    reconhecida na ENTREGA/conclusão. Pedido antes disso é "em carteira".
 *  - Uma venda de R$300 em 3x é UMA venda com três recebíveis, não três vendas.
 *  - Bruto recebido e líquido creditado aparecem separados.
 *  - Devolução reverte receita/custo/estoque conforme o evento real; repõe
 *    estoque só se a mercadoria voltou e está revendável; estorno de taxa segue
 *    o valor efetivamente recuperado. Cancelamento de pedido não recebido não
 *    cria saída de caixa.
 */

import { Cents, MoneyError, allocateProportional, roundCents } from './money';

// ─────────────────────── Reconhecimento de receita ──────────────────────────

export type OrderStatus = 'RASCUNHO' | 'CONFIRMADO' | 'ENTREGUE' | 'CANCELADO';

export interface RevenueRecognition {
  recognizedCents: Cents; // receita realizada no período
  inCarteiraCents: Cents; // venda contratada, ainda não realizada
}

/** Política padrão: reconhece na ENTREGA. Configurável no futuro por loja. */
export function recognizeRevenue(status: OrderStatus, productRevenueCents: Cents): RevenueRecognition {
  if (status === 'ENTREGUE') return { recognizedCents: productRevenueCents, inCarteiraCents: 0 };
  if (status === 'CANCELADO') return { recognizedCents: 0, inCarteiraCents: 0 };
  // RASCUNHO/CONFIRMADO → em carteira
  return { recognizedCents: 0, inCarteiraCents: productRevenueCents };
}

// ──────────────────────────────── Recebíveis ────────────────────────────────

export type ReceivableStatus = 'PENDENTE' | 'PARCIAL' | 'RECEBIDO' | 'ESTORNADO';

export interface Receivable {
  seq: number;
  grossCents: Cents; // valor bruto da parcela
  feesCents: Cents; // taxas previstas sobre a parcela
  netExpectedCents: Cents; // líquido creditado esperado
  receivedCents: Cents; // bruto efetivamente recebido
  status: ReceivableStatus;
  dueDate?: string; // ISO
}

/**
 * Gera os recebíveis de uma venda. `grossTotal` = receita de produto (após
 * desconto) + frete cobrado. `feesTotal` = taxas do pedido. As parcelas somam
 * exatamente o total; as taxas são rateadas proporcionalmente ao bruto.
 */
export function buildReceivables(
  grossTotal: Cents,
  feesTotal: Cents,
  installments: number,
  dueDates?: string[],
): Receivable[] {
  if (installments <= 0) throw new MoneyError('Parcelas devem ser > 0');
  const grossParts = allocateProportional(grossTotal, new Array(installments).fill(1));
  const feeParts = allocateProportional(feesTotal, grossParts);
  return grossParts.map((g, i) => {
    const fee = feeParts[i] ?? 0;
    return {
      seq: i + 1,
      grossCents: g,
      feesCents: fee,
      netExpectedCents: g - fee,
      receivedCents: 0,
      status: 'PENDENTE' as ReceivableStatus,
      dueDate: dueDates?.[i],
    };
  });
}

/** Liquida (recebe) um valor num recebível. Bloqueia recebimento além do bruto. */
export function liquidate(r: Receivable, amountCents: Cents): Receivable {
  if (amountCents <= 0) throw new MoneyError('Valor recebido deve ser > 0');
  if (r.status === 'ESTORNADO') throw new MoneyError('Recebível estornado');
  const received = r.receivedCents + amountCents;
  if (received > r.grossCents) throw new MoneyError('Recebimento acima do valor bruto do recebível');
  const status: ReceivableStatus = received === r.grossCents ? 'RECEBIDO' : 'PARCIAL';
  return { ...r, receivedCents: received, status };
}

/**
 * Antecipação: muda data e taxa SEM duplicar receita nem recebimento. O bruto
 * permanece; some-se a taxa de antecipação (líquido esperado cai).
 */
export function anticipate(r: Receivable, newDueDate: string, extraFeeCents: Cents): Receivable {
  if (extraFeeCents < 0) throw new MoneyError('Taxa de antecipação não pode ser negativa');
  const fees = r.feesCents + extraFeeCents;
  return { ...r, dueDate: newDueDate, feesCents: fees, netExpectedCents: r.grossCents - fees };
}

// ──────────────────────────────── Devoluções ────────────────────────────────

export interface ReturnLine {
  qty: number;
  unitPriceCents: Cents; // preço praticado (para reverter receita)
  unitCostCents: Cents; // custo (snapshot) para reverter CMV
  restockable: boolean; // mercadoria voltou e está revendável?
}

export interface ReturnResult {
  revenueReversedCents: Cents;
  costReversedCents: Cents; // CMV revertido (só do que repõe estoque)
  restockQty: number; // quantidade que volta ao estoque
  feeRefundCents: Cents; // estorno de taxa: valor efetivamente recuperado
}

/**
 * Processa uma devolução parcial/total. `feeActuallyRecovered` é o valor de taxa
 * de fato recuperado (não uma suposição automática).
 */
export function processReturn(lines: ReturnLine[], feeActuallyRecovered: Cents = 0): ReturnResult {
  let revenue = 0;
  let cost = 0;
  let restock = 0;
  for (const l of lines) {
    if (l.qty <= 0) throw new MoneyError('Quantidade devolvida deve ser > 0');
    revenue += l.unitPriceCents * l.qty;
    if (l.restockable) {
      cost += l.unitCostCents * l.qty; // só repõe custo do que volta ao estoque
      restock += l.qty;
    }
  }
  if (feeActuallyRecovered < 0) throw new MoneyError('Estorno de taxa não pode ser negativo');
  return {
    revenueReversedCents: revenue,
    costReversedCents: cost,
    restockQty: restock,
    feeRefundCents: feeActuallyRecovered,
  };
}

// ─────────────────────────────────── Kits ───────────────────────────────────

export interface KitComponent {
  sku: string;
  qtyPerKit: number;
}

/** Expande um kit em baixas de componentes (não baixa um "conjunto fictício"). */
export function expandKit(components: KitComponent[], kitQty: number): { sku: string; qty: number }[] {
  if (kitQty <= 0) throw new MoneyError('Quantidade do kit deve ser > 0');
  return components.map((c) => ({ sku: c.sku, qty: c.qtyPerKit * kitQty }));
}

// ────────────────────────── Idempotência (§7, §11.10) ───────────────────────

/**
 * Registro de idempotência: a mesma chave executa a operação UMA vez e devolve
 * o mesmo resultado nas repetições (evita venda/estoque/recebível duplicados).
 * Em produção, a chave é persistida numa tabela única; aqui, o contrato lógico.
 */
export class IdempotencyStore<T> {
  private readonly seen = new Map<string, T>();
  run(key: string, fn: () => T): { result: T; replayed: boolean } {
    if (this.seen.has(key)) return { result: this.seen.get(key) as T, replayed: true };
    const result = fn();
    this.seen.set(key, result);
    return { result, replayed: false };
  }
}

// ─────────────────── Concorrência: reserva da última peça ────────────────────

/**
 * Reserva de estoque com invariante de não-negatividade. Modela a trava que, no
 * banco, é feita com `UPDATE ... SET qty = qty - :n WHERE qty >= :n` (ou
 * SELECT ... FOR UPDATE) dentro da transação: duas vendas concorrentes da última
 * peça não podem ambas concluir.
 */
export class StockReservation {
  constructor(private available: number) {}
  get qty(): number {
    return this.available;
  }
  /** Retorna true se conseguiu reservar; false se não há saldo (não vai negativo). */
  reserve(n: number): boolean {
    if (n <= 0) throw new MoneyError('Reserva deve ser > 0');
    if (this.available < n) return false;
    this.available -= n;
    return true;
  }
  release(n: number): void {
    this.available += n;
  }
}
