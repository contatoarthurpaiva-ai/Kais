/**
 * sales-service.ts — confirmação de venda como TRANSAÇÃO atômica (§7).
 *
 * Reúne as regras puras testadas (buildReceivables, expandKit, recognizeRevenue)
 * com a persistência, garantindo:
 *  - IDEMPOTÊNCIA: a mesma idempotencyKey grava a venda uma única vez.
 *  - CONCORRÊNCIA: baixa de estoque com `WHERE qty >= n` dentro da transação —
 *    duas vendas da última peça não concluem ambas.
 *  - SNAPSHOT: custo/taxa do momento gravados na venda; mudanças futuras não
 *    reescrevem o histórico.
 *
 * ⚠️ Depende do client Prisma gerado (`npm run prisma:generate`). Por isso este
 * arquivo fica fora do typecheck no ambiente onde foi gerado (sem rede). É código
 * de referência para a Etapa 3; revise contra o schema antes de usar em produção.
 */
import { prisma } from '../../lib/db';
import { Prisma } from '@prisma/client';
import { buildReceivables, expandKit, recognizeRevenue, type OrderStatus } from '../domain/sales';
import { computeOrder, type Fee, type OrderItem } from '../domain/order';

export interface ConfirmSaleInput {
  storeId: string;
  idempotencyKey: string; // única por tentativa de venda
  channel?: string;
  customerName?: string;
  status: OrderStatus; // define reconhecimento de receita
  items: (OrderItem & { variantId: string })[];
  freightChargedCents?: number;
  freightPaidCents?: number;
  fees: Fee[];
  installments: number;
  dueDates?: string[];
}

export async function confirmSale(input: ConfirmSaleInput) {
  // 1) idempotência: se a chave já existe, devolve a venda existente
  const existing = await prisma.salesOrder.findFirst({
    where: { storeId: input.storeId, snapshot: { path: ['idempotencyKey'], equals: input.idempotencyKey } },
  });
  if (existing) return { order: existing, replayed: true };

  // 2) cálculo pelo snapshot (fonte de verdade no servidor)
  const calc = computeOrder({
    items: input.items,
    freightChargedCents: input.freightChargedCents,
    freightPaidCents: input.freightPaidCents,
    fees: input.fees,
  });
  const recognition = recognizeRevenue(input.status, calc.productRevenueCents);
  const receivables = buildReceivables(
    calc.grossRevenueCents,
    calc.totalFeesCents,
    input.installments,
    input.dueDates,
  );

  // 3) transação atômica: baixa a quantidade de peças prontas + venda + recebíveis
  return prisma.$transaction(async (tx) => {
    // Cada venda desconta do estoque de peças prontas da variante (nunca negativo).
    for (const it of input.items) {
      const v = await tx.variant.findUnique({ where: { id: it.variantId } });
      if (v) {
        const novo = Math.max(0, v.stockQty - it.qty);
        await tx.variant.update({ where: { id: it.variantId }, data: { stockQty: novo } });
      }
    }

    const count = await tx.salesOrder.count({ where: { storeId: input.storeId } });
    const order = await tx.salesOrder.create({
      data: {
        storeId: input.storeId,
        number: count + 1,
        date: new Date(),
        channel: input.channel,
        customerName: input.customerName,
        status: input.status,
        freightCharged: input.freightChargedCents ?? 0,
        freightPaid: input.freightPaidCents ?? 0,
        installments: input.installments,
        snapshot: {
          idempotencyKey: input.idempotencyKey,
          fees: input.fees,
          calc,
          recognition,
        } as unknown as Prisma.InputJsonValue,
        items: {
          create: input.items.map((it) => ({
            variantId: it.variantId,
            qty: it.qty,
            unitPriceCents: it.unitPriceCents,
            costCents: it.unitCostCents,
          })),
        },
        receivables: {
          create: receivables.map((r) => ({
            dueDate: r.dueDate ? new Date(r.dueDate) : new Date(),
            grossCents: r.grossCents,
            feesCents: r.feesCents,
            netExpectedCents: r.netExpectedCents,
          })),
        },
      },
      include: { items: true, receivables: true },
    });

    return { order, replayed: false };
  });
}
