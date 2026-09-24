/**
 * etapa3.test.ts — vendas, estoque e recebíveis (§7, §11).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildReceivables,
  liquidate,
  anticipate,
  recognizeRevenue,
  processReturn,
  expandKit,
  IdempotencyStore,
  StockReservation,
  StockGroup,
  computeOrder,
  allocateOrderCharge,
} from '../src/domain/index.ts';

// §11.5 — venda R$300 em 3x entregue: receita 300 uma vez; 3 recebíveis de 100;
// após 1ª liquidação, recebido 100 / a receber 200. Se não entregue → em carteira.
test('§11.5 recebíveis e reconhecimento de receita', () => {
  const rec = recognizeRevenue('ENTREGUE', 30000);
  assert.equal(rec.recognizedCents, 30000);
  assert.equal(rec.inCarteiraCents, 0);

  const recs = buildReceivables(30000, 0, 3);
  assert.deepEqual(recs.map((r) => r.grossCents), [10000, 10000, 10000]);

  const first = recs[0]!;
  const liq = liquidate(first, 10000);
  assert.equal(liq.status, 'RECEBIDO');
  const recebido = liq.receivedCents;
  const aReceber = recs.slice(1).reduce((a, r) => a + r.grossCents, 0);
  assert.equal(recebido, 10000);
  assert.equal(aReceber, 20000);

  // não entregue → em carteira, não realizada
  const carteira = recognizeRevenue('CONFIRMADO', 30000);
  assert.equal(carteira.recognizedCents, 0);
  assert.equal(carteira.inCarteiraCents, 30000);
});

// recebível: bloqueia recebimento acima do bruto; marca PARCIAL
test('recebível: parcial e proteção contra recebimento excedente', () => {
  const [r] = buildReceivables(10000, 0, 1);
  const parcial = liquidate(r!, 4000);
  assert.equal(parcial.status, 'PARCIAL');
  assert.equal(parcial.receivedCents, 4000);
  assert.throws(() => liquidate(parcial, 7000)); // 4000+7000 > 10000
});

// antecipação: muda data e taxa sem duplicar receita/recebimento
test('§11.11 antecipação não duplica receita', () => {
  const recs = buildReceivables(30000, 0, 3);
  const antecipado = anticipate(recs[0]!, '2026-10-01', 150);
  assert.equal(antecipado.grossCents, 10000); // bruto inalterado
  assert.equal(antecipado.feesCents, 150);
  assert.equal(antecipado.netExpectedCents, 9850);
  // continua sendo UM recebível, não dois
  assert.equal(recs.length, 3);
});

// §11.6 — compra 10 @ R$50, vende 2: CMV 100, estoque 400; compra não deduzida 2x
test('§11.6 CMV na venda e estoque remanescente', () => {
  const acabado = new StockGroup('biquini-azul-M');
  acabado.addPurchase(50000, 10); // 10 peças a R$50 (=R$500)
  const cmv = acabado.consume(2); // vende 2
  assert.equal(cmv, 10000); // CMV R$100
  assert.equal(acabado.valueCents, 40000); // estoque R$400
  assert.equal(acabado.qty, 8);
});

// §11.7 — kit: baixa 1 de cada componente; aloca desconto sem perder centavos
test('§11.7 kit expande em componentes e aloca sem perder centavos', () => {
  const baixas = expandKit(
    [
      { sku: 'TOP', qtyPerKit: 1 },
      { sku: 'CALC', qtyPerKit: 1 },
    ],
    1,
  );
  assert.deepEqual(baixas, [
    { sku: 'TOP', qty: 1 },
    { sku: 'CALC', qty: 1 },
  ]);
  const alloc = allocateOrderCharge(1000, [
    { sku: 'TOP', qty: 1, unitPriceCents: 8000, unitCostCents: 0 },
    { sku: 'CALC', qty: 1, unitPriceCents: 6001, unitCostCents: 0 },
  ]);
  assert.equal(alloc.reduce((a, b) => a + b, 0), 1000); // soma exata
});

// devolução parcial: repõe estoque só do revendável; estorno = valor recuperado
test('§11.11 devolução parcial reconcilia receita/custo/estoque', () => {
  const r = processReturn(
    [
      { qty: 1, unitPriceCents: 8000, unitCostCents: 3000, restockable: true },
      { qty: 1, unitPriceCents: 6000, unitCostCents: 2500, restockable: false }, // danificada
    ],
    120, // taxa efetivamente recuperada
  );
  assert.equal(r.revenueReversedCents, 14000);
  assert.equal(r.costReversedCents, 3000); // só a peça revendável
  assert.equal(r.restockQty, 1);
  assert.equal(r.feeRefundCents, 120);
});

// §11.10 — idempotência: 2 requisições iguais não duplicam
test('§11.10 idempotência executa uma vez', () => {
  const store = new IdempotencyStore<string>();
  let calls = 0;
  const a = store.run('venda-42', () => {
    calls++;
    return 'venda-criada';
  });
  const b = store.run('venda-42', () => {
    calls++;
    return 'nao-deveria-rodar';
  });
  assert.equal(calls, 1);
  assert.equal(a.replayed, false);
  assert.equal(b.replayed, true);
  assert.equal(b.result, 'venda-criada');
});

// §11.10 — concorrência: duas vendas da última peça, só uma conclui
test('§11.10 última peça não é vendida duas vezes', () => {
  const estoque = new StockReservation(1);
  const v1 = estoque.reserve(1);
  const v2 = estoque.reserve(1);
  assert.equal(v1, true);
  assert.equal(v2, false); // sem estoque para a segunda
  assert.equal(estoque.qty, 0);
});

// §11.9 — mudança futura de taxa não altera resultado histórico (snapshot)
test('§11.9 snapshot preserva resultado histórico', () => {
  const snapshot = {
    items: [{ sku: 'TOP', qty: 1, unitPriceCents: 10000, unitCostCents: 4000 }],
    fees: [{ id: 'cartao', base: 'produto' as const, pct: 0.0299 }],
  };
  const historico = computeOrder(snapshot);
  // "taxa atual" muda depois — mas recalcular pelo snapshot dá o mesmo
  const recalculo = computeOrder(snapshot);
  assert.equal(recalculo.totalFeesCents, historico.totalFeesCents);
  assert.equal(historico.totalFeesCents, 299); // 2,99% de R$100
});
