/** Início — dashboard mensal. DB-facing, fora do typecheck no ambiente sem rede. */
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Greeting, ActionCard, MiniCard } from '@/lib/ui';
import { formatBRLcents } from '@/lib/brl';

export const dynamic = 'force-dynamic';

function mesInfo(mes?: string) {
  const hoje = new Date();
  const [ano, m] = (mes ?? '').split('-').map(Number);
  const valido = ano && m && m >= 1 && m <= 12;
  const y = valido ? ano : hoje.getFullYear();
  const mm = valido ? m - 1 : hoje.getMonth();
  const inicio = new Date(y, mm, 1);
  const fim = new Date(y, mm + 1, 1);
  const chave = `${y}-${String(mm + 1).padStart(2, '0')}`;
  const prevD = new Date(y, mm - 1, 1);
  const nextD = new Date(y, mm + 1, 1);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(inicio);
  return { inicio, fim, chave, prev: fmt(prevD), next: fmt(nextD), label };
}

export default async function Inicio({ searchParams }: { searchParams?: { mes?: string } }) {
  const s = getSession();
  if (!s) redirect('/login');
  const M = mesInfo(searchParams?.mes);

  const [loja, orders, gastos, temAlgo, aReceberAgg] = await Promise.all([
    prisma.store.findUnique({ where: { id: s.storeId } }),
    prisma.salesOrder.findMany({
      where: { storeId: s.storeId, date: { gte: M.inicio, lt: M.fim } },
      include: { items: true },
    }),
    prisma.expense.findMany({
      where: { category: { storeId: s.storeId }, status: { not: 'CANCELADO' }, competence: { gte: M.inicio, lt: M.fim } },
    }),
    prisma.product.findFirst({ where: { storeId: s.storeId } }),
    prisma.receivable.aggregate({
      _sum: { grossCents: true, receivedCents: true },
      where: { order: { storeId: s.storeId }, status: { not: 'ESTORNADO' } },
    }),
  ]);

  const entregues = orders.filter((o) => o.status === 'ENTREGUE');
  const receita = entregues.reduce((a, o) => a + o.items.reduce((x, it) => x + it.unitPriceCents * it.qty, 0), 0);
  const cmv = entregues.reduce((a, o) => a + o.items.reduce((x, it) => x + it.costCents * it.qty, 0), 0);
  const fretePago = entregues.reduce((a, o) => a + o.freightPaid, 0);
  const carteira = orders.filter((o) => o.status === 'CONFIRMADO').reduce((a, o) => a + o.items.reduce((x, it) => x + it.unitPriceCents * it.qty, 0), 0);
  const gastosMes = gastos.reduce((a, g) => a + g.amountCents, 0);
  const sobraMes = receita - cmv - fretePago - gastosMes;
  const aReceber = (aReceberAgg._sum.grossCents ?? 0) - (aReceberAgg._sum.receivedCents ?? 0);

  const precisaConfigurar = !temAlgo && orders.length === 0;

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
            Ainda não há nada cadastrado. Comece cadastrando suas peças com custo e preço — o resto flui daí.
          </p>
          <Link href="/produtos" className="btn">Cadastrar minha primeira peça</Link>
        </section>
      ) : (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ fontSize: '1rem', color: 'var(--verde-escuro)', margin: 0, textTransform: 'capitalize' }}>{M.label}</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link href={`/visao-geral?mes=${M.prev}`} className="btn secundario" style={{ padding: '6px 12px' }}>← mês anterior</Link>
              <Link href={`/visao-geral?mes=${M.next}`} className="btn secundario" style={{ padding: '6px 12px' }}>próximo →</Link>
            </div>
          </div>
          <div className="mini-cards">
            <MiniCard rot="Vendas do mês" val={formatBRLcents(receita)} obs="pedidos entregues" />
            <MiniCard rot="Gastos do mês" val={formatBRLcents(gastosMes)} obs="despesas lançadas" />
            <MiniCard rot="Sobra do mês" val={formatBRLcents(sobraMes)} obs="vendas − custos − gastos" />
            <MiniCard rot="A receber" val={formatBRLcents(aReceber)} obs="parcelas em aberto (total)" />
          </div>
          {carteira > 0 && (
            <p style={{ color: '#9aa79e', fontSize: '0.78rem', marginTop: 12 }}>
              Há {formatBRLcents(carteira)} em pedidos confirmados ainda não entregues (não entram como venda do mês até a entrega).
            </p>
          )}
        </section>
      )}
    </div>
  );
}
