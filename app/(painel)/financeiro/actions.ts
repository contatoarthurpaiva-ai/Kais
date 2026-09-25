'use server';
/**
 * Ações de Financeiro (§5). Categorias, despesas (com status) e contas.
 * Transferência/aporte/retirada não são faturamento; pró-labore não é recontado.
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

export async function criarCategoria(form: FormData) {
  const s = requireSession();
  assertCan(s.role, 'expense:manage');
  const name = String(form.get('name') ?? '').trim();
  if (!name) throw new Error('Nome da categoria é obrigatório');
  await prisma.expenseCategory.create({
    data: {
      storeId: s.storeId,
      name,
      fixed: form.get('fixed') === 'on',
      nature: String(form.get('nature') ?? 'operacional'),
    },
  });
  revalidatePath('/financeiro');
}

export async function registrarDespesa(form: FormData) {
  const s = requireSession();
  assertCan(s.role, 'expense:manage');
  const categoryId = String(form.get('categoryId') ?? '');
  const description = String(form.get('description') ?? '').trim();
  const amountCents = cents(form.get('amount'));
  if (!categoryId || !description || amountCents <= 0) {
    throw new Error('Categoria, descrição e valor são obrigatórios');
  }
  const comp = String(form.get('competence') ?? '');
  await prisma.expense.create({
    data: {
      categoryId,
      description,
      amountCents,
      competence: comp ? new Date(comp) : new Date(),
      dueDate: form.get('dueDate') ? new Date(String(form.get('dueDate'))) : null,
      status: 'EM_ABERTO',
      supplier: String(form.get('supplier') ?? '') || null,
    },
  });
  revalidatePath('/financeiro');
}

export async function marcarPaga(form: FormData) {
  const s = requireSession();
  assertCan(s.role, 'expense:manage');
  const id = String(form.get('id') ?? '');
  const exp = await prisma.expense.findUnique({ where: { id } });
  if (!exp) throw new Error('Despesa não encontrada');
  await prisma.$transaction([
    prisma.expensePayment.create({
      data: { expenseId: id, amountCents: exp.amountCents, paidDate: new Date() },
    }),
    prisma.expense.update({ where: { id }, data: { status: 'PAGO' } }),
  ]);
  revalidatePath('/financeiro');
}

export async function criarConta(form: FormData) {
  const s = requireSession();
  assertCan(s.role, 'expense:manage');
  const name = String(form.get('name') ?? '').trim();
  if (!name) throw new Error('Nome da conta é obrigatório');
  await prisma.financialAccount.create({
    data: { storeId: s.storeId, name, openingCents: cents(form.get('opening')), openingDate: new Date() },
  });
  revalidatePath('/financeiro');
}

export async function excluirGasto(form: FormData) {
  const s = requireSession();
  assertCan(s.role, 'expense:manage');
  const id = String(form.get('id') ?? '');
  if (!id) return;
  await prisma.$transaction([
    prisma.expensePayment.deleteMany({ where: { expenseId: id } }),
    prisma.expense.delete({ where: { id } }),
  ]);
  revalidatePath('/financeiro');
  revalidatePath('/visao-geral');
}
