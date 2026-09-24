'use server';
/**
 * Ações de Estoque (§4, §4.1). Cadastra material e registra compra, alimentando o
 * grupo de estoque correto (compra ≠ consumo; grupos preservam origem econômica).
 * ⚠️ DB-facing (Prisma). Fora do typecheck no ambiente sem rede.
 */
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { assertCan } from '@/src/auth/rbac';

function reais(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
const cents = (v: FormDataEntryValue | null) => Math.round(reais(v) * 100);

export async function criarMaterial(form: FormData) {
  const s = requireSession();
  assertCan(s.role, 'product:manage');
  const name = String(form.get('name') ?? '').trim();
  if (!name) throw new Error('Nome do material é obrigatório');
  await prisma.material.create({
    data: {
      storeId: s.storeId,
      name,
      color: String(form.get('color') ?? '') || null,
      unit: String(form.get('unit') ?? 'metro'),
    },
  });
  revalidatePath('/estoque');
}

export async function registrarCompra(form: FormData) {
  const s = requireSession();
  assertCan(s.role, 'product:manage');
  const materialId = String(form.get('materialId') ?? '');
  const qty = reais(form.get('qty'));
  const totalCents = cents(form.get('total'));
  const destination = String(form.get('destination') ?? 'COMPARTILHADO') as
    | 'MODELO'
    | 'COLECAO'
    | 'COMPARTILHADO'
    | 'INDEFINIDO';
  if (!materialId || qty <= 0 || totalCents <= 0) {
    throw new Error('Material, quantidade e valor são obrigatórios');
  }

  await prisma.$transaction(async (tx) => {
    const compra = await tx.purchase.create({
      data: {
        storeId: s.storeId,
        date: new Date(),
        supplier: String(form.get('supplier') ?? '') || null,
        paidCents: totalCents,
        items: { create: { materialId, qty, totalCents, destination } },
      },
    });

    // custo médio ponderado DENTRO do grupo (material + destino); nunca global
    const grupo = await tx.stockGroup.findFirst({ where: { materialId, destination } });
    if (grupo) {
      await tx.stockGroup.update({
        where: { id: grupo.id },
        data: { valueCents: grupo.valueCents + totalCents, qty: { increment: qty } },
      });
    } else {
      await tx.stockGroup.create({ data: { materialId, destination, valueCents: totalCents, qty } });
    }
    // movimento rastreável
    const g = await tx.stockGroup.findFirst({ where: { materialId, destination } });
    if (g) {
      await tx.stockMovement.create({
        data: { groupId: g.id, kind: 'COMPRA', qty, valueCents: totalCents, refId: compra.id },
      });
    }
  });
  revalidatePath('/estoque');
}
