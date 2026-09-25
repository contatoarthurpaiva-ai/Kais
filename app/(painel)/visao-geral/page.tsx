/** Início — tela do dia a dia. DB-facing, fora do typecheck no ambiente sem rede. */
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Greeting, ActionCard, MiniCard } from '@/lib/ui';
import { formatBRLcents } from '@/lib/brl';
import {
  revenueSummary,
  cashSummary,
  managerialResult,
  type SaleRecord,
  type ReceivableRecord,
} from '@/src/domain/index';

export const dynamic = 'force-dynamic';

export default async function Inicio() {
  const s = getSession();
  if (!s) redirect('/login');

  const [loja, orders, temProduto, temMaterial] = await Promise.all([
    prisma.store.findUnique({ where: { id: s.storeId } }),
    prisma.salesOrder.findMany({
      where: { storeId: s.storeId },
      include: { items: true, receivables: true },
    }),
    prisma.product.findFirst({ where: { storeId: s.storeId } }),
    prisma.material.findFirst({ where: { storeId: s.storeId } }),
  ]);

  const precisaConfigurar = !temProduto && !temMaterial && orders.length === 0;

  const sales: SaleRecord[] = orders.map((o) => ({
    status: o.status as SaleRecord['status'],
    productRevenueCents: o.items.reduce((a, it) => a + (it.unitPriceCents - it.discountCents) * it.qty, 0),
    discountsCents: 0,
    cmvCents: o.items.reduce((a, it) => a + it.costCents * it.qty, 0),
    variableCents: o.freightPaid,
  }));
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
  const res = managerialResult({
    recognizedRevenueCents: rev.recognizedCents,
    returnsCents: rev.returnsCents,
    cmvCents: sales.reduce((a, x) => a + x.cmvCents, 0),
    variableExpensesCents: sales.reduce((a, x) => a + x.variableCents, 0),
    fixedExpensesCents: 0,
  });

  return (
    <div>
      <Greeting nome={loja?.name === 'Kais' ? undefined : loja?.name} sub="O que você quer fazer agora?" />

      <div className="grid-acoes">
        <ActionCard href="/vendas" icon="🛍️" title="Registrar venda" desc="Anote uma venda em poucos toques" destaque />
        <ActionCard href="/financeiro" icon="💸" title="Registrar gasto" desc="Lance uma despesa da loja" />
        <ActionCard href="/produtos" icon="👙" title="Minhas peças" desc="Custo, preço e margem de cada peça" />
      </div>

      {precisaConfigurar ? (
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Vamos começar? 🌱</h2>
          <p style={{ color: '#55655c' }}>
            Ainda não há nada cadastrado. Em poucos passos você deixa a loja pronta — cadastra seus
            materiais, monta suas peças e já pode vender.
          </p>
          <Link href="/onboarding" className="btn">Ver os primeiros passos</Link>
        </section>
      ) : (
        <section>
          <h2 style={{ fontSize: '1rem', color: 'var(--verde-escuro)' }}>Como você está</h2>
          <div className="mini-cards">
            <MiniCard rot="Já entrou no caixa" val={formatBRLcents(cash.grossReceivedCents)} obs="dinheiro recebido" />
            <MiniCard rot="Ainda vai receber" val={formatBRLcents(cash.toReceiveCents)} obs={cash.overdueReceivableCents > 0 ? formatBRLcents(cash.overdueReceivableCents) + ' atrasado' : 'em dia'} />
            <MiniCard rot="Vendas realizadas" val={formatBRLcents(rev.recognizedCents)} obs="pedidos entregues" />
            <MiniCard rot="Sobra estimada" val={formatBRLcents(res.contributionCents)} obs="depois de custo e taxas" />
          </div>
          <p style={{ color: '#9aa79e', fontSize: '0.75rem', marginTop: 12 }}>
            "Sobra" é o que fica das vendas depois do custo das peças e das taxas — não é o lucro final
            (faltam as despesas fixas). Veja o detalhe nos ajustes e relatórios.
          </p>
        </section>
      )}
    </div>
  );
}
