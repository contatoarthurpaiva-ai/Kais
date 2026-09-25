/** Vendas (§7) — DB-facing. Fora do typecheck no ambiente sem rede. */
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PageHeader, Table, Empty, Money } from '@/lib/ui';
import { ConfirmSubmit } from '@/lib/confirm';
import { SaleForm } from './sale-form';
import { excluirVenda } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  CONFIRMADO: 'Confirmado',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
};

export default async function Vendas() {
  const s = getSession();
  if (!s) redirect('/login');

  const [variantes, vendas] = await Promise.all([
    prisma.variant.findMany({
      where: { product: { storeId: s.storeId } },
      include: { product: true },
      orderBy: { sku: 'asc' },
    }),
    prisma.salesOrder.findMany({
      where: { storeId: s.storeId },
      include: { items: true, receivables: true },
      orderBy: { date: 'desc' },
      take: 30,
    }),
  ]);

  return (
    <div>
      <PageHeader title="Vendas" subtitle="Registre a venda; estoque e recebíveis são gerados juntos, sem duplicar." />

      <section className="card" style={{ marginBottom: 'var(--e-3)' }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Registrar venda</h2>
        {variantes.length === 0 ? (
          <Empty>Cadastre um produto e variante antes de vender.</Empty>
        ) : (
          <SaleForm
            variants={variantes.map((v) => ({
              id: v.id,
              label: `${v.product.name} — ${v.sku}`,
              tablePriceCents: v.tablePriceCents,
            }))}
          />
        )}
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Vendas recentes</h2>
        {vendas.length === 0 ? (
          <Empty>Nenhuma venda registrada.</Empty>
        ) : (
          <Table head={['Nº', 'Data', 'Situação', 'Itens', 'Bruto', 'Parcelas', '']}>
            {vendas.map((o) => {
              const bruto = o.items.reduce((a, it) => a + it.unitPriceCents * it.qty, 0) + o.freightCharged;
              return (
                <tr key={o.id}>
                  <td style={{ padding: '8px 10px' }}>{o.number}</td>
                  <td style={{ padding: '8px 10px' }}>{o.date.toLocaleDateString('pt-BR')}</td>
                  <td style={{ padding: '8px 10px' }}>{STATUS_LABEL[o.status]}</td>
                  <td style={{ padding: '8px 10px' }}>{o.items.length}</td>
                  <td style={{ padding: '8px 10px' }} className="num"><Money cents={bruto} /></td>
                  <td style={{ padding: '8px 10px' }}>{o.receivables.length}x</td>
                  <td style={{ padding: '8px 10px' }}>
                    <form action={excluirVenda}>
                      <input type="hidden" name="id" value={o.id} />
                      <ConfirmSubmit message={`Excluir a venda nº ${o.number}? As peças voltam ao estoque.`}>Excluir</ConfirmSubmit>
                    </form>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </section>
      <style>{`@media (max-width:720px){ .grade{ grid-template-columns:1fr !important; } }`}</style>
    </div>
  );
}
