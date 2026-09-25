/** Financeiro (§5) — DB-facing. Fora do typecheck no ambiente sem rede. */
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PageHeader, Field, Table, Empty, Money } from '@/lib/ui';
import { Ajuda } from '@/lib/ajuda';
import { criarCategoria, registrarDespesa, marcarPaga, criarConta } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  PREVISTO: 'Previsto',
  EM_ABERTO: 'Em aberto',
  PARCIALMENTE_PAGO: 'Parcial',
  PAGO: 'Pago',
  VENCIDO: 'Vencido',
  CANCELADO: 'Cancelado',
};

export default async function Financeiro() {
  const s = getSession();
  if (!s) redirect('/login');

  const [categorias, despesas, contas] = await Promise.all([
    prisma.expenseCategory.findMany({ where: { storeId: s.storeId }, orderBy: { name: 'asc' } }),
    prisma.expense.findMany({
      where: { category: { storeId: s.storeId } },
      include: { category: true },
      orderBy: { competence: 'desc' },
      take: 50,
    }),
    prisma.financialAccount.findMany({ where: { storeId: s.storeId } }),
  ]);

  const aPagar = despesas
    .filter((d) => d.status !== 'PAGO' && d.status !== 'CANCELADO')
    .reduce((a, d) => a + d.amountCents, 0);

  return (
    <div>
      <PageHeader title="Financeiro" subtitle="Gastos, categorias e contas. Registre uma vez; os relatórios se atualizam." />

      <section className="card" style={{ marginBottom: 'var(--e-3)' }}>
        <div className="linha-resultado">
          <span className="rot">Contas a pagar (em aberto)</span>
          <span className="val num"><Money cents={aPagar} /></span>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--e-3)' }} className="grade">
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Nova categoria</h2>
          <form action={criarCategoria}>
            <Field label="Nome" name="name" required placeholder="Aluguel, marketing…" />
            <div className="campo">
              <label htmlFor="nature">
                Natureza
                <Ajuda>Para onde esse gasto vai no resultado. "Operacional" = tocar a loja (aluguel, internet). "Produção" = fazer as peças. Na dúvida, deixe Operacional.</Ajuda>
              </label>
              <select id="nature" name="nature">
                <option value="operacional">Operacional</option>
                <option value="producao">Produção</option>
                <option value="financeira">Financeira</option>
                <option value="outra">Outra</option>
              </select>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <input type="checkbox" name="fixed" /> Despesa fixa
              <Ajuda>Marque se é um gasto que se repete todo mês com valor parecido (aluguel, internet, plano da loja). Deixe desmarcado para gastos que variam.</Ajuda>
            </label>
            <button className="btn secundario">Criar categoria</button>
          </form>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Registrar gasto</h2>
          {categorias.length === 0 ? (
            <Empty>Crie uma categoria antes de registrar gastos.</Empty>
          ) : (
            <form action={registrarDespesa}>
              <div className="campo">
                <label htmlFor="categoryId">Categoria</label>
                <select id="categoryId" name="categoryId" required>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <Field label="Descrição" name="description" required />
              <Field label="Valor (R$)" name="amount" type="number" step="0.01" required />
              <Field label="Competência" name="competence" type="date" tip="O mês a que o gasto se refere, mesmo que você pague em outra data. Ex.: a internet de março, mesmo paga em abril." />
              <Field label="Vencimento" name="dueDate" type="date" tip="Quando essa conta vence. Ajuda a lembrar o que está para pagar." />
              <button className="btn">Registrar gasto</button>
            </form>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: 'var(--e-3)' }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Gastos recentes</h2>
        {despesas.length === 0 ? (
          <Empty>Nenhum gasto registrado.</Empty>
        ) : (
          <Table head={['Descrição', 'Categoria', 'Valor', 'Status', '']}>
            {despesas.map((d) => (
              <tr key={d.id}>
                <td style={{ padding: '8px 10px' }}>{d.description}</td>
                <td style={{ padding: '8px 10px' }}>{d.category.name}</td>
                <td style={{ padding: '8px 10px' }} className="num"><Money cents={d.amountCents} /></td>
                <td style={{ padding: '8px 10px' }}>{STATUS_LABEL[d.status]}</td>
                <td style={{ padding: '8px 10px' }}>
                  {d.status !== 'PAGO' && d.status !== 'CANCELADO' && (
                    <form action={marcarPaga}>
                      <input type="hidden" name="id" value={d.id} />
                      <button className="btn secundario" style={{ padding: '4px 10px' }}>Marcar paga</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section className="card" style={{ marginTop: 'var(--e-3)' }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Contas</h2>
        <form action={criarConta} style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 160 }}><Field label="Nova conta" name="name" placeholder="Caixa, Nubank…" /></div>
          <div style={{ minWidth: 140 }}><Field label="Saldo inicial (R$)" name="opening" type="number" step="0.01" /></div>
          <button className="btn secundario">Adicionar</button>
        </form>
        {contas.length === 0 ? (
          <Empty>Nenhuma conta cadastrada.</Empty>
        ) : (
          <Table head={['Conta', 'Saldo inicial']}>
            {contas.map((c) => (
              <tr key={c.id}>
                <td style={{ padding: '8px 10px' }}>{c.name}</td>
                <td style={{ padding: '8px 10px' }} className="num"><Money cents={c.openingCents} /></td>
              </tr>
            ))}
          </Table>
        )}
      </section>
      <style>{`@media (max-width:720px){ .grade{ grid-template-columns:1fr !important; } }`}</style>
    </div>
  );
}
