/**
 * bom.test.ts — custo direto de variante a partir da ficha técnica (§4.1).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeVariantCost } from '../src/domain/index.ts';

// ficha completa: tecido + costura + outros → C com decomposição
test('custo da variante soma materiais, mão de obra e outros', () => {
  const r = computeVariantCost({
    materials: [{ label: 'tecido', unitCostCentsPerBase: 3000, consumption: 0.5 }], // R$15
    labor: [{ label: 'costura', batchCents: 10000, goodPieces: 20 }], // R$5
    otherDirectCents: 300, // R$3
  });
  assert.equal(r.unitCostCents, 2300); // R$23
  assert.equal(r.components.length, 3);
  assert.equal(r.hasEstimates, false);
});

// perda por consumo adicional: consumo efetivo = 0,5 + 0,1
test('perda por consumo adicional', () => {
  const r = computeVariantCost({
    materials: [
      { label: 'tecido', unitCostCentsPerBase: 3000, consumption: 0.5, wasteMethod: 'CONSUMO_ADICIONAL', wasteValue: 0.1 },
    ],
  });
  assert.equal(r.unitCostCents, 1800); // 3000 × 0,6
});

// perda por rendimento: consumo efetivo = 0,5 / 0,8
test('perda por rendimento', () => {
  const r = computeVariantCost({
    materials: [
      { label: 'tecido', unitCostCentsPerBase: 3000, consumption: 0.5, wasteMethod: 'RENDIMENTO', wasteValue: 0.8 },
    ],
  });
  assert.equal(r.unitCostCents, 1875); // 3000 × 0,625
});

// material estimado é sinalizado (linha, elástico sem medição)
test('materiais estimados sinalizam hasEstimates', () => {
  const r = computeVariantCost({
    materials: [
      { label: 'tecido', unitCostCentsPerBase: 3000, consumption: 0.5 },
      { label: 'linha', unitCostCentsPerBase: 200, consumption: 0.2, estimated: true },
    ],
  });
  assert.equal(r.hasEstimates, true);
  const linha = r.components.find((c) => c.label === 'linha');
  assert.equal(linha?.estimated, true);
});

// variantes não se contaminam: vermelho usa tecido vermelho, azul o azul
test('§4.1 variantes independentes (vermelho vs azul)', () => {
  const vermelha = computeVariantCost({
    materials: [{ label: 'tecido vermelho', unitCostCentsPerBase: 3000, consumption: 0.5 }],
  });
  const azul = computeVariantCost({
    materials: [{ label: 'tecido azul', unitCostCentsPerBase: 2000, consumption: 0.5 }],
  });
  assert.equal(vermelha.unitCostCents, 1500);
  assert.equal(azul.unitCostCents, 1000);
});

// guardas: rendimento fora de (0,1]; método sem valor
test('guardas de perda', () => {
  assert.throws(() =>
    computeVariantCost({
      materials: [{ label: 'x', unitCostCentsPerBase: 3000, consumption: 0.5, wasteMethod: 'RENDIMENTO', wasteValue: 1.5 }],
    }),
  );
  assert.throws(() =>
    computeVariantCost({
      materials: [{ label: 'x', unitCostCentsPerBase: 3000, consumption: 0.5, wasteMethod: 'CONSUMO_ADICIONAL' }],
    }),
  );
});
