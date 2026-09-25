'use server';
/**
 * Ações de Peças e custos (§4). Cria a peça (produto + 1 variante) num passo só,
 * com SKU gerado automaticamente. O custo vem da ficha técnica (motor testado).
 * ⚠️ DB-facing (Prisma). Fora do typecheck no ambiente sem rede.
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

function slug(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 12);
}

/** Gera um SKU legível e único automaticamente. */
async function gerarSku(nome: string, cor?: string | null, tam?: string | null): Promise<string> {
  const base = [slug(nome), slug(cor ?? ''), slug(tam ?? '')].filter(Boolean).join('-') || 'PECA';
  for (let i = 0; i < 25; i++) {
    const sfx = Math.random().toString(36).slice(2, 6).toUpperCase();
    const sku = `${base}-${sfx}`.slice(0, 40);
    const existe = await prisma.variant.findUnique({ where: { sku } });
    if (!existe) return sku;
  }
  return `PECA-${Date.now().toString(36).toUpperCase()}`;
}

/** Cria a peça inteira: produto + 1 variante (cor/tamanho/preço) + ficha vazia. */
export async function criarPeca(form: FormData) {
  const s = requireSession();
  assertCan(s.role, 'product:manage');
  const name = String(form.get('name') ?? '').trim();
  if (!name) throw new Error('Dê um nome para a peça');
  const color = String(form.get('color') ?? '').trim() || null;
  const size = String(form.get('size') ?? '').trim() || null;
  const sku = await gerarSku(name, color, size);
  await prisma.product.create({
    data: {
      storeId: s.storeId,
      name,
      category: String(form.get('category') ?? '').trim() || null,
      origin: String(form.get('origin') ?? 'PROPRIA') as 'PROPRIA' | 'TERCEIRIZADA' | 'REVENDA',
      variants: {
        create: {
          sku,
          color,
          size,
          tablePriceCents: cents(form.get('tablePrice')),
          directCostCents: cents(form.get('cost')),
          boms: { create: { version: 1, active: true } },
        },
      },
    },
  });
  revalidatePath('/produtos');
}

/** Adiciona outra variante (cor/tamanho) a uma peça existente. SKU automático. */
export async function adicionarVariante(form: FormData) {
  const s = requireSession();
  assertCan(s.role, 'product:manage');
  const productId = String(form.get('productId') ?? '');
  if (!productId) throw new Error('Peça não informada');
  const prod = await prisma.product.findUnique({ where: { id: productId } });
  const color = String(form.get('color') ?? '').trim() || null;
  const size = String(form.get('size') ?? '').trim() || null;
  const sku = await gerarSku(prod?.name ?? 'PECA', color, size);
  await prisma.variant.create({
    data: {
      productId,
      sku,
      color,
      size,
      tablePriceCents: cents(form.get('tablePrice')),
      directCostCents: cents(form.get('cost')),
      boms: { create: { version: 1, active: true } },
    },
  });
  revalidatePath('/produtos');
}

/** Custo da variante: usa o custo informado direto; senão, calcula pela ficha. */
export async function custoDaVariante(variantId: string) {
  const v = await prisma.variant.findUnique({ where: { id: variantId } });
  if (v && v.directCostCents > 0) {
    return { unitCostCents: v.directCostCents, components: [], hasEstimates: false };
  }
  const bom = await prisma.bom.findFirst({
    where: { variantId, active: true },
    include: { lines: { include: { material: { include: { stockGroups: true } } } } },
  });
  if (!bom || bom.lines.length === 0) return null;
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
