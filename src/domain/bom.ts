/**
 * bom.ts — custo direto de uma variante a partir da ficha técnica (§4, §4.1).
 *
 * Junta materiais (com consumo e perdas), mão de obra por lote e outros custos
 * diretos num custo unitário C, com a decomposição "De onde vem este custo?".
 *
 * Perdas (§4.1) — método declarado, nunca os dois na mesma linha:
 *   - CONSUMO_ADICIONAL: consumo efetivo = consumo + wasteValue (unidades extras/peça)
 *   - RENDIMENTO: fração aproveitável (0<y≤1) → consumo efetivo = consumo / y
 * Materiais compartilhados sem medição entram como `estimated` (identificados como tais).
 */
import { Cents, MoneyError, roundCents } from './money';
import { componentCostPerPiece, costPerPieceFromBatch } from './costing';

export type WasteMethod = 'CONSUMO_ADICIONAL' | 'RENDIMENTO';

export interface BomMaterialLine {
  label: string; // "tecido vermelho", "linha"
  unitCostCentsPerBase: number; // custo por unidade-base do grupo de estoque da variante
  consumption: number; // consumo por peça (unidade-base)
  wasteMethod?: WasteMethod;
  wasteValue?: number; // CONSUMO_ADICIONAL: extra/peça; RENDIMENTO: fração aproveitável 0<y≤1
  estimated?: boolean; // consumo padrão/estimado (não medido)
}

export interface BomLaborLine {
  label: string; // "costura", "acabamento"
  batchCents: Cents; // custo do lote
  goodPieces: number; // peças boas do lote
}

export interface VariantCostInput {
  materials: BomMaterialLine[];
  labor?: BomLaborLine[];
  otherDirectCents?: Cents; // outros custos diretos por peça
}

export interface CostComponent {
  label: string;
  cents: Cents;
  estimated: boolean;
  detail: string; // ex.: "0,5 m × R$ 30,00/base"
}

export interface VariantCost {
  unitCostCents: Cents; // C
  components: CostComponent[];
  hasEstimates: boolean;
}

function effectiveConsumption(l: BomMaterialLine): number {
  if (!l.wasteMethod) return l.consumption;
  if (l.wasteValue === undefined) {
    throw new MoneyError(`Linha "${l.label}": método de perda sem valor declarado`);
  }
  if (l.wasteMethod === 'CONSUMO_ADICIONAL') {
    if (l.wasteValue < 0) throw new MoneyError(`Linha "${l.label}": consumo adicional negativo`);
    return l.consumption + l.wasteValue;
  }
  // RENDIMENTO
  if (l.wasteValue <= 0 || l.wasteValue > 1) {
    throw new MoneyError(`Linha "${l.label}": rendimento deve estar em (0, 1]`);
  }
  return l.consumption / l.wasteValue;
}

const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;

export function computeVariantCost(input: VariantCostInput): VariantCost {
  const components: CostComponent[] = [];

  for (const m of input.materials) {
    const eff = effectiveConsumption(m);
    const cents = componentCostPerPiece(m.unitCostCentsPerBase, eff);
    const perda =
      m.wasteMethod === 'CONSUMO_ADICIONAL'
        ? ` (+${m.wasteValue} perda)`
        : m.wasteMethod === 'RENDIMENTO'
          ? ` (rend. ${(m.wasteValue! * 100).toFixed(0)}%)`
          : '';
    components.push({
      label: m.label,
      cents,
      estimated: !!m.estimated,
      detail: `${eff} × ${brl(m.unitCostCentsPerBase)}/base${perda}`,
    });
  }

  for (const lb of input.labor ?? []) {
    const cents = costPerPieceFromBatch(lb.batchCents, lb.goodPieces);
    components.push({
      label: lb.label,
      cents,
      estimated: false,
      detail: `${brl(lb.batchCents)} ÷ ${lb.goodPieces} peças`,
    });
  }

  if (input.otherDirectCents && input.otherDirectCents > 0) {
    components.push({
      label: 'Outros custos diretos',
      cents: roundCents(input.otherDirectCents / 100),
      estimated: false,
      detail: 'informado',
    });
  }

  const unitCostCents = components.reduce((a, c) => a + c.cents, 0);
  return {
    unitCostCents,
    components,
    hasEstimates: components.some((c) => c.estimated),
  };
}
