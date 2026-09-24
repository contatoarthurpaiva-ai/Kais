/**
 * acceptance.test.ts — critérios de aceite obrigatórios (§11).
 * Cada teste referencia o exemplo numérico correspondente do spec.
 * Rodar: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  targetPrice,
  zeroContributionFloor,
  evaluateContribution,
  contribution,
  plannedPrice,
} from '../src/domain/pricing.ts';
import { maxDiscount, minimumPrice, evaluateDiscount } from '../src/domain/discount.ts';
import { breakEvenFromPct } from '../src/domain/breakeven.ts';
import {
  componentCostPerPiece,
  costPerPieceFromBatch,
  unitCostFromPurchase,
  StockGroup,
} from '../src/domain/costing.ts';
import { computeOrder, allocateOrderCharge, splitInstallments } from '../src/domain/order.ts';
import { MoneyError } from '../src/domain/money.ts';

// C=50, E=10, t=10%, m=30% → alvo R$100; contribuição R$30; margem 30%
test('§11.1 preço-alvo, contribuição e margem', () => {
  const i = { C: 5000, E: 1000, t: 0.1, m: 0.3 };
  const P = targetPrice(i);
  assert.equal(P, 10000);
  assert.equal(contribution(P, i), 3000);
  const ev = evaluateContribution(P, i);
  assert.equal(ev.contributionPct, 0.3);
});

// margem mínima 20% → P_min conservador R$85,72; desconto máx R$14,28 (14,28%); R$85,71 rejeitado
test('§11.2 preço mínimo conservador e desconto máximo', () => {
  const i = { C: 5000, E: 1000, t: 0.1 };
  const pmin = minimumPrice(i, 0.2);
  assert.equal(pmin, 8572); // ceil de 85,714285… → 85,72
  const d = maxDiscount(10000, pmin);
  assert.equal(d.valueCents, 1428);
  assert.ok(Math.abs(d.pct - 0.1428) < 1e-9);
  // R$85,71 fica abaixo da política → deve ser reprovado
  const below = evaluateDiscount(10000, 8571, i, { minMargin: 0.2, goalMargin: 0.3 });
  assert.equal(below.state, 'abaixo_do_minimo');
});

// piso de contribuição zero: exato 66,666… → 66,67 conservador
test('§11.3 piso sem contribuição para fixos', () => {
  const i = { C: 5000, E: 1000, t: 0.1 };
  assert.equal(zeroContributionFloor(i), 6667);
});

// F=3000, margem ponderada 30% → PE R$10.000
test('§11.4 ponto de equilíbrio', () => {
  const be = breakEvenFromPct(300000, 0.3);
  assert.equal(be.finite, true);
  assert.equal(be.revenueCents, 1000000);
});

// venda R$300 em 3x → 3 recebíveis de R$100; soma exata
test('§11.5 parcelamento sem perder centavos', () => {
  const parts = splitInstallments(30000, 3);
  assert.deepEqual(parts, [10000, 10000, 10000]);
  assert.equal(
    parts.reduce((a, b) => a + b, 0),
    30000,
  );
  // caso com resto: R$100 em 3x
  const p2 = splitInstallments(10000, 3);
  assert.equal(
    p2.reduce((a, b) => a + b, 0),
    10000,
  );
});

// fluxo sem contas: material R$200/10m, 0,5m/peça → R$10; costura R$100/20 → R$5; subtotal R$15
test('§11.13 custo por peça a partir de consumo e lote', () => {
  const cmPorMetro = unitCostFromPurchase(20000, 10); // 2000 c/m
  const material = componentCostPerPiece(cmPorMetro, 0.5);
  assert.equal(material, 1000); // R$10
  const costura = costPerPieceFromBatch(10000, 20);
  assert.equal(costura, 500); // R$5
  assert.equal(material + costura, 1500); // R$15
});

// vermelho R$300/10m e azul R$200/10m; 0,5m/peça → R$15 na vermelha, R$10 na azul
test('§11.14 custos por variante não se contaminam', () => {
  const vermelho = componentCostPerPiece(unitCostFromPurchase(30000, 10), 0.5);
  const azul = componentCostPerPiece(unitCostFromPurchase(20000, 10), 0.5);
  assert.equal(vermelho, 1500);
  assert.equal(azul, 1000);
});

// usar 4 de 10m (R$300) consome R$120 e deixa R$180
test('§11.15 compra ≠ consumo', () => {
  const g = new StockGroup('tecido-vermelho');
  g.addPurchase(30000, 10);
  const consumido = g.consume(4);
  assert.equal(consumido, 12000); // R$120
  assert.equal(g.valueCents, 18000); // R$180 restantes
  assert.equal(g.qty, 6);
});

// 100 alças R$200; 20 em A, 30 em B → R$40, R$60, restante R$100
test('§11.16 material compartilhado por consumo real', () => {
  const g = new StockGroup('alcas');
  g.addPurchase(20000, 100);
  assert.equal(g.consume(20), 4000); // A: R$40
  assert.equal(g.consume(30), 6000); // B: R$60
  assert.equal(g.valueCents, 10000); // restante R$100
  assert.equal(g.qty, 50);
});

// grupos exclusivos não viram média global; transferência transporta custo
test('§11.17 grupos exclusivos e transferência', () => {
  const A = new StockGroup('A');
  A.addPurchase(20000, 10); // R$20/m
  const B = new StockGroup('B');
  B.addPurchase(30000, 10); // R$30/m
  // sem média global de R$25/m
  assert.equal(A.avgCents, 2000);
  assert.equal(B.avgCents, 3000);
  const carried = A.transferTo(B, 2);
  assert.equal(carried, 4000); // transporta R$40
  assert.equal(B.valueCents, 34000); // R$340
  assert.equal(B.qty, 12);
  assert.ok(Math.abs(B.avgCents - 34000 / 12) < 1e-9); // 2833,33… preservado
  assert.equal(A.valueCents, 16000);
  assert.equal(A.qty, 8);
});

// tarifa fixa por pedido com vários itens: conta uma vez; frete cobrado ≠ pago
test('§11.8 taxa fixa uma vez e frete separado', () => {
  const r = computeOrder({
    items: [
      { sku: 'TOP', qty: 1, unitPriceCents: 8000, unitCostCents: 3000 },
      { sku: 'CALC', qty: 1, unitPriceCents: 6000, unitCostCents: 2500 },
    ],
    freightChargedCents: 2000,
    freightPaidCents: 1800,
    fees: [{ id: 'tarifa', base: 'fixa_por_pedido', fixedCents: 100 }],
  });
  assert.equal(r.totalFeesCents, 100); // uma única vez
  assert.equal(r.freightChargedCents, 2000);
  assert.equal(r.productRevenueCents, 14000);
  assert.equal(r.grossRevenueCents, 16000);
  // custo = 3000+2500 + frete pago 1800 = 7300
  assert.equal(r.totalCostCents, 7300);
});

// kit: alocar desconto/frete entre componentes sem perder centavos
test('§11.7 alocação de kit sem perder centavos', () => {
  const items = [
    { sku: 'TOP', qty: 1, unitPriceCents: 8000, unitCostCents: 0 },
    { sku: 'CALC', qty: 1, unitPriceCents: 6001, unitCostCents: 0 },
  ];
  const alloc = allocateOrderCharge(1000, items); // R$10 de desconto
  assert.equal(
    alloc.reduce((a, b) => a + b, 0),
    1000,
  ); // soma exata, sem centavo perdido
});

// guardas: denominador ≤ 0, P=0 em margem %, desconto > 100%
test('§11.12 guardas de invariantes', () => {
  assert.throws(() => targetPrice({ C: 5000, E: 1000, t: 0.5, m: 0.6 }), MoneyError);
  const ev = evaluateContribution(0, { C: 100, E: 0, t: 0.1 });
  assert.equal(ev.contributionPct, null);
  assert.throws(
    () => evaluateDiscount(10000, -100, { C: 100, E: 0, t: 0.1 }, { minMargin: 0.2, goalMargin: 0.3 }),
    MoneyError,
  );
});

// planejamento com alocação de fixos: preço planejado > preço-alvo de contribuição
test('§6.1 preço planejado com cobertura de fixos', () => {
  const alvo = targetPrice({ C: 5000, E: 1000, t: 0.1, m: 0.3 });
  const planejado = plannedPrice({ C: 5000, E: 1000, t: 0.1, A: 500, l: 0.3 });
  assert.ok(planejado > alvo); // A>0 eleva o preço planejado
});
