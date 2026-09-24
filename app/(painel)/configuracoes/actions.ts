'use server';
/**
 * Ações de Configurações (§2, §3, §10). Dados da loja, política de margem e taxas.
 * Alterar política exige perfil ADMIN (policy:edit). Alterar taxa/margem atualiza
 * simulações futuras, não vendas históricas (garantido pelos snapshots).
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
const pctDec = (v: FormDataEntryValue | null) => reais(v) / 100;

export async function salvarLoja(form: FormData) {
  const s = requireSession();
  assertCan(s.role, 'policy:edit');
  await prisma.store.update({
    where: { id: s.storeId },
    data: {
      name: String(form.get('name') ?? '').trim() || 'Kais',
      timezone: String(form.get('timezone') ?? 'America/Sao_Paulo'),
    },
  });
  revalidatePath('/configuracoes');
}

export async function salvarMargem(form: FormData) {
  const s = requireSession();
  assertCan(s.role, 'policy:edit');
  const minMargin = pctDec(form.get('minMargin'));
  const goalMargin = pctDec(form.get('goalMargin'));
  if (minMargin < 0 || minMargin >= 1 || goalMargin < 0 || goalMargin >= 1) {
    throw new Error('Margens devem estar entre 0% e 100%');
  }
  const existente = await prisma.marginPolicy.findFirst({ where: { storeId: s.storeId } });
  if (existente) {
    await prisma.marginPolicy.update({ where: { id: existente.id }, data: { minMargin, goalMargin } });
  } else {
    await prisma.marginPolicy.create({
      data: { storeId: s.storeId, name: 'Padrão', minMargin, goalMargin },
    });
  }
  revalidatePath('/configuracoes');
}

export async function criarTaxa(form: FormData) {
  const s = requireSession();
  assertCan(s.role, 'policy:edit');
  const name = String(form.get('name') ?? '').trim();
  const base = String(form.get('base') ?? 'produto');
  if (!name) throw new Error('Nome da taxa é obrigatório');
  await prisma.feePolicy.create({
    data: {
      storeId: s.storeId,
      name,
      base,
      pct: base === 'fixa_por_pedido' ? null : pctDec(form.get('pct')),
      fixedCents: base === 'fixa_por_pedido' ? cents(form.get('fixed')) : null,
      modality: String(form.get('modality') ?? '') || null,
    },
  });
  revalidatePath('/configuracoes');
}
