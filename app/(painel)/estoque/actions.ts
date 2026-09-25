'use server';
/**
 * Ações de Materiais (§4.1). Um fluxo só: registrar a compra de um material,
 * criando o material na hora se for novo. Sem exigir cadastro em duas etapas.
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

/** Registra a compra de um material. Cria o material se for novo. */
export async function registrarCompraMaterial(form: FormData) {
  const s = requireSession();
  assertCan(s.role, 'product:manage');

  let materialId = String(form.get('materialId') ?? '');
  const ehNovo = materialId === '__novo__' || materialId === '';

  if (ehNovo) {
    const nome = String(form.get('novoNome') ?? '').trim();
    if (!nome) throw new Error('Dê um nome para o material');
    const m = await prisma.material.create({
      data: {
        storeId: s.storeId,
        name: nome,
        color: String(form.get('cor') ?? '').trim() || null,
        unit: String(form.get('unit') ?? 'metro'),
      },
    });
    materialId = m.id;
  }

  const qty = reais(form.get('qty'));
  const totalCents = cents(form.get('total'));
  if (qty <= 0) throw new Error('Informe quanto você comprou');
  if (totalCents <= 0) throw new Error('Informe quanto você pagou');

  // um material comprado normalmente serve a vários modelos → grupo compartilhado
  const destination = 'COMPARTILHADO';

  await prisma.$transaction(async (tx) => {
    const compra = await tx.purchase.create({
      data: {
        storeId: s.storeId,
        date: new Date(),
        paidCents: totalCents,
        items: { create: { materialId, qty, totalCents, destination } },
      },
    });

    // custo médio ponderado dentro do grupo (material + destino) — nunca global
    const grupo = await tx.stockGroup.findFirst({ where: { materialId, destination } });
    const g = grupo
      ? await tx.stockGroup.update({
          where: { id: grupo.id },
          data: { valueCents: grupo.valueCents + totalCents, qty: { increment: qty } },
        })
      : await tx.stockGroup.create({ data: { materialId, destination, valueCents: totalCents, qty } });

    await tx.stockMovement.create({
      data: { groupId: g.id, kind: 'COMPRA', qty, valueCents: totalCents, refId: compra.id },
    });
  });

  revalidatePath('/estoque');
  revalidatePath('/produtos');
}
