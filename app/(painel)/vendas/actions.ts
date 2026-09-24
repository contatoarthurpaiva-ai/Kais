'use server';
/**
 * Ação de Vendas (§7). Coleta o formulário e chama o serviço transacional
 * confirmSale (baixa de estoque condicional + recebíveis + idempotência).
 * ⚠️ DB-facing (Prisma). Fora do typecheck no ambiente sem rede.
 */
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { assertCan } from '@/src/auth/rbac';
import { confirmSale } from '@/src/server/sales-service';
import { custoDaVariante } from '../produtos/actions';

function reais(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
const cents = (v: FormDataEntryValue | null) => Math.round(reais(v) * 100);

export async function registrarVenda(form: FormData) {
  const s = requireSession();
  assertCan(s.role, 'sale:create');

  const variantId = String(form.get('variantId') ?? '');
  const qty = Math.max(1, Math.round(reais(form.get('qty'))));
  const unitPriceCents = cents(form.get('unitPrice'));
  if (!variantId || unitPriceCents <= 0) throw new Error('Variante e preço são obrigatórios');

  const variant = await prisma.variant.findUnique({ where: { id: variantId } });
  if (!variant) throw new Error('Variante não encontrada');
  const custo = await custoDaVariante(variantId);
  const unitCostCents = custo?.unitCostCents ?? 0;

  await confirmSale({
    storeId: s.storeId,
    idempotencyKey: String(form.get('idempotencyKey') ?? '') || randomUUID(),
    channel: String(form.get('channel') ?? '') || undefined,
    customerName: String(form.get('customerName') ?? '') || undefined,
    status: String(form.get('status') ?? 'CONFIRMADO') as 'RASCUNHO' | 'CONFIRMADO' | 'ENTREGUE' | 'CANCELADO',
    items: [{ sku: variant.sku, variantId, qty, unitPriceCents, unitCostCents }],
    freightChargedCents: cents(form.get('freightCharged')),
    freightPaidCents: cents(form.get('freightPaid')),
    fees: [],
    installments: Math.max(1, Math.round(reais(form.get('installments')) || 1)),
  });

  revalidatePath('/vendas');
  revalidatePath('/visao-geral');
}
