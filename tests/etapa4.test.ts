/**
 * etapa4.test.ts — dashboard, resultado gerencial e CSV (§8, §11).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  revenueSummary,
  cashSummary,
  payablesSummary,
  managerialResult,
  faturamentoFromLedger,
  realizedBalance,
  csvCell,
  toCSV,
  type SaleRecord,
  type ReceivableRecord,
  type LedgerRecord,
} from '../src/domain/index.ts';

test('receita: reconhecida (entregue) separada de em carteira', () => {
  const sales: SaleRecord[] = [
    { status: 'ENTREGUE', productRevenueCents: 20000, discountsCents: 1000, cmvCents: 8000, variableCents: 600 },
    { status: 'CONFIRMADO', productRevenueCents: 15000, discountsCents: 0, cmvCents: 6000, variableCents: 400 },
    { status: 'CANCELADO', productRevenueCents: 9000, discountsCents: 0, cmvCents: 0, variableCents: 0 },
  ];
  const r = revenueSummary(sales);
  assert.equal(r.recognizedCents, 20000); // só a entregue
  assert.equal(r.inCarteiraCents, 15000); // confirmada, não realizada
  assert.equal(r.discountsCents, 1000);
});

test('caixa: bruto recebido ≠ líquido creditado; vencido continua a receber', () => {
  const recs: ReceivableRecord[] = [
    { grossCents: 10000, feesCents: 300, receivedCents: 10000, status: 'RECEBIDO', overdue: false },
    { grossCents: 10000, feesCents: 300, receivedCents: 0, status: 'PENDENTE', overdue: true },
  ];
  const c = cashSummary(recs);
  assert.equal(c.grossReceivedCents, 10000);
  assert.equal(c.netCreditedCents, 9700); // bruto − taxa
  assert.equal(c.toReceiveCents, 10000);
  assert.equal(c.overdueReceivableCents, 10000);
});

test('resultado gerencial reconcilia sem dupla contagem', () => {
  const r = managerialResult({
    recognizedRevenueCents: 100000,
    returnsCents: 5000,
    cmvCents: 40000,
    variableExpensesCents: 8000,
    fixedExpensesCents: 30000,
  });
  // contribuição = (100000−5000) − 40000 − 8000 = 47000
  assert.equal(r.contributionCents, 47000);
  // resultado = 47000 − 30000 = 17000
  assert.equal(r.resultCents, 17000);
});

test('§11 transferências e aportes não elevam faturamento', () => {
  const ledger: LedgerRecord[] = [
    { kind: 'RECEITA', amountCents: 30000 },
    { kind: 'APORTE', amountCents: 50000 },
    { kind: 'TRANSFERENCIA', amountCents: 20000 },
  ];
  assert.equal(faturamentoFromLedger(ledger), 30000); // só a receita de venda
});

test('§11 saldo: transferência é neutra; pró-labore sai uma vez', () => {
  const ledger: LedgerRecord[] = [
    { kind: 'RECEITA', amountCents: 30000 },
    { kind: 'APORTE', amountCents: 10000 },
    { kind: 'TRANSFERENCIA', amountCents: 99999 }, // neutra
    { kind: 'PRO_LABORE', amountCents: 5000 },
    { kind: 'DESPESA', amountCents: 4000 },
  ];
  // 10000(inicial) +30000 +10000 −5000 −4000 = 41000
  assert.equal(realizedBalance(10000, ledger), 41000);
});

test('contas a pagar: em aberto/vencido; fixas por competência', () => {
  const p = payablesSummary([
    { amountCents: 5000, fixed: true, status: 'EM_ABERTO', inPeriod: true },
    { amountCents: 3000, fixed: false, status: 'VENCIDO', inPeriod: true },
    { amountCents: 2000, fixed: true, status: 'PAGO', inPeriod: true },
    { amountCents: 9000, fixed: true, status: 'CANCELADO', inPeriod: true },
  ]);
  assert.equal(p.toPayCents, 8000); // 5000 + 3000 (pago e cancelado fora)
  assert.equal(p.overduePayableCents, 3000);
  assert.equal(p.fixedInPeriodCents, 7000); // 5000 + 2000 (fixas no período, inclui paga)
});

test('CSV: neutraliza fórmula e escapa separadores', () => {
  assert.equal(csvCell('=SUM(A1:A9)'), `"'=SUM(A1:A9)"`); // apóstrofo + aspas
  assert.equal(csvCell('+1+1'), `"'+1+1"`);
  assert.equal(csvCell('@cmd'), `"'@cmd"`);
  assert.equal(csvCell('normal'), 'normal');
  assert.equal(csvCell('a,b'), '"a,b"'); // vírgula → aspas
  assert.equal(csvCell('diz "oi"'), '"diz ""oi"""'); // aspas escapadas
  const csv = toCSV([
    ['Produto', 'Preço'],
    ['Biquíni', 2903],
  ]);
  assert.equal(csv, 'Produto,Preço\r\nBiquíni,2903');
});
