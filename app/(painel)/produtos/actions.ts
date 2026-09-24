'use server';
/**
 * Ações de Produtos e custos (§4). Cria produto/variante e adiciona linhas de
 * ficha técnica. O custo da variante é calculado com o motor testado
 * (computeVariantCost) a partir da média do grupo de estoque de cada material.
 *
 * ⚠️ DB-facing (Prisma) — roda após `prisma generate`. Fora do typecheck no
 * ambiente sem rede.
 */
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { assertCan } from '@/src/auth/rbac';
import { computeVariantCost, type BomMaterialLine } from '@/src/domain/index';

function reais(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
const cents = (v: FormDataEntryValue | null) => Math.round(reais(v) * 100);

export async function criarProduto(form: FormData) {
  const s = requireSession();
  assertCan(s.role, 'product:manage');
  const name = String(form.get('name') ?? '').trim();
  if (!name) throw new Error('Nome do produto é obrigatório');
  await prisma.product.create({
    data: {
      storeId: s.storeId,
      name,
      category: String(form.get('category') ?? '') || null,
      origin: (String(form.get('origin') ?? 'PROPRIA') as 'PROPRIA' | 'TERCEIRIZADA' | 'REVENDA'),
    },
  });
  revalidatePath('/produtos');
}

export async function criarVariante(form: FormData) {
  const s = requireSession();
  assertCan(s.role, 'product:manage');
  const productId = String(form.get('productId') ?? '');
  const sku = String(form.get('sku') ?? '').trim();
  if (!productId || !sku) throw new Error('Produto e SKU são obrigatórios');
  await prisma.variant.create({
    data: {
      productId,
      sku,
      color: String(form.get('color') ?? '') || null,
      size: String(form.get('size') ?? '') || null,
      tablePriceCents: cents(form.get('tablePrice')),
      boms: { create: { version: 1, active: true } },
    },
  });
  revalidatePath('/produtos');
}

export async function adicionarLinhaFicha(form: FormData) {
  const s = requireSession();
  assertCan(s.role, 'product:manage');
  const variantId = String(form.get('variantId') ?? '');
  const materialId = String(form.get('materialId') ?? '');
  if (!variantId || !materialId) throw new Error('Variante e material são obrigatórios');
  const bom = await prisma.bom.findFirst({ where: { variantId, active: true } });
  if (!bom) throw new Error('Ficha ativa não encontrada');
  const method = String(form.get('wasteMethod') ?? '');
  await prisma.bomLine.create({
    data: {
      bomId: bom.id,
      materialId,
      consumption: reais(form.get('consumption')),
      wasteMethod: method || null,
      wasteValue: method ? reais(form.get('wasteValue')) : null,
      estimated: form.get('estimated') === 'on',
    },
  });
  revalidatePath('/produtos');
}

/** Custo da variante a partir da ficha ativa + média dos grupos de estoque. */
export async function custoDaVariante(variantId: string) {
  const bom = await prisma.bom.findFirst({
    where: { variantId, active: true },
    include: { lines: { include: { material: { include: { stockGroups: true } } } } },
  });
  if (!bom) return null;
  const materials: BomMaterialLine[] = bom.lines.map((l) => {
    const grp = l.material.stockGroups[0];
    const unit = grp && Number(grp.qty) > 0 ? grp.valueCents / Number(grp.qty) : 0;
    return {
      label: `${l.material.name}${l.material.color ? ' ' + l.material.color : ''}`,
      unitCostCentsPerBase: unit,
      consumption: Number(l.consumption),
      wasteMethod: (l.wasteMethod as 'CONSUMO_ADICIONAL' | 'RENDIMENTO' | null) ?? undefined,
      wasteValue: l.wasteValue !== null ? Number(l.wasteValue) : undefined,
      estimated: l.estimated,
    };
  });
  return computeVariantCost({ materials });
}
