/**
 * Visão geral (§8) — dashboard consolidado.
 *
 * ⚠️ Server Component que lê do banco via Prisma e consolida com o motor testado
 * (revenueSummary/cashSummary/managerialResult). Depende do client Prisma gerado,
 * por isso fica fora do typecheck no ambiente sem rede. Referência da Etapa 4:
 * revise as queries contra o schema antes de produção. Sem dados fictícios — se
 * não houver lançamentos, os cartões mostram zero e sinalizam "resultado parcial".
 */
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
  revenueSummary,
  cashSummary,
  managerialResult,
  type SaleRecord,
  type ReceivableRecord,
} from '@/src/domain/index';
import { formatBRLcents } from '@/lib/brl';

export const dynamic = 'force-dynamic';

export default async function VisaoGeral() {
  const session = getSession();
  if (!session) redirect('/login');

  const orders = await prisma.salesOrder.findMany({
    where: { storeId: session.storeId },
    include: { items: true, receivables: true },
  });

  const sales: SaleRecord[] = orders.map((o) => {
    const productRevenue = o.items.reduce(
      (a, it) => a + (it.unitPriceCents - it.discountCents) * it.qty,
      0,
    );
    const cmv = o.items.reduce((a, it) => a + it.costCents * it.qty, 0);
    return {
      status: o.status as SaleRecord['status'],
      productRevenueCents: productRevenue,
      discountsCents: o.items.reduce((a, it) => a + it.discountCents * it.qty, 0),
      cmvCents: cmv,
      variableCents: o.freightPaid,
    };
  });

  const receivables: ReceivableRecord[] = orders.flatMap((o) =>
    o.receivables.map((r) => ({
      grossCents: r.grossCents,
      feesCents: r.feesCents,
      receivedCents: r.receivedCents,
      status: r.status as ReceivableRecord['status'],
      overdue: r.status !== 'RECEBIDO' && r.dueDate < new Date(),
    })),
  );

  const rev = revenueSummary(sales);
  const cash = cashSummary(receivables);
  const fixed = await prisma.expense.aggregate({
    _sum: { amountCents: true },
    where: { category: { store: { id: session.storeId }, fixed: true } },
  });
  const result = managerialResult({
    recognizedRevenueCents: rev.recognizedCents,
    returnsCents: rev.returnsCents,
    cmvCents: sales.reduce((a, s) => a + s.cmvCents, 0),
    variableExpensesCents: sales.reduce((a, s) => a + s.variableCents, 0),
    fixedExpensesCents: fixed._sum.amountCents ?? 0,
  });

  const parcial = orders.length === 0;

  const Cartao = ({ rot, val, obs }: { rot: string; val: string; obs?: string }) => (
    <div className="card">
      <div style={{ color: '#55655c', fontSize: '0.85rem' }}>{rot}</div>
      <div className="num" style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: 6 }}>
        {val}
      </div>
      {obs && <div style={{ color: '#8a978e', fontSize: '0.75rem', marginTop: 4 }}>{obs}</div>}
    </div>
  );

  return (
    <div>
      <h1 style={{ marginTop: 0, color: 'var(--verde-escuro)' }}>Visão geral</h1>
      {parcial && (
        <p className="estado incompleto" style={{ marginBottom: 16 }}>
          • Sem lançamentos ainda — os números aparecem conforme você registra vendas e gastos.
        </p>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--e-2)',
        }}
      >
        <Cartao rot="Receita reconhecida" val={formatBRLcents(rev.recognizedCents)} obs="entregue no período" />
        <Cartao rot="Pedidos em carteira" val={formatBRLcents(rev.inCarteiraCents)} obs="ainda não realizada" />
        <Cartao rot="Bruto recebido" val={formatBRLcents(cash.grossReceivedCents)} />
        <Cartao rot="Líquido creditado" val={formatBRLcents(cash.netCreditedCents)} obs="após taxas" />
        <Cartao rot="A receber" val={formatBRLcents(cash.toReceiveCents)} obs={`vencido: ${formatBRLcents(cash.overdueReceivableCents)}`} />
        <Cartao rot="Contribuição" val={formatBRLcents(result.contributionCents)} />
        <Cartao rot="Resultado gerencial" val={formatBRLcents(result.resultCents)} obs="após despesas do período" />
      </div>
      <p style={{ color: '#8a978e', fontSize: '0.78rem', marginTop: 16 }}>
        Saldo bancário não é lucro; contribuição não é lucro líquido. Não é demonstração contábil formal.
      </p>
    </div>
  );
}
