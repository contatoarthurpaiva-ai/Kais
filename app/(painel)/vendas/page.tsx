/** Vendas (§7) — DB-facing. Fora do typecheck no ambiente sem rede. */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PageHeader, Field, Table, Empty, Money } from '@/lib/ui';
import { registrarVenda } from './actions';

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
          <form action={registrarVenda}>
            <input type="hidden" name="idempotencyKey" value={randomUUID()} />
            <div className="campo">
              <label htmlFor="variantId">Peça (variante)</label>
              <select id="variantId" name="variantId" required>
                {variantes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.product.name} — {v.sku}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="grade">
              <Field label="Quantidade" name="qty" type="number" step="1" defaultValue={1} required />
              <Field label="Preço unitário (R$)" name="unitPrice" type="number" step="0.01" required />
              <Field label="Frete cobrado (R$)" name="freightCharged" type="number" step="0.01" />
              <Field label="Frete pago (R$)" name="freightPaid" type="number" step="0.01" />
              <Field label="Parcelas" name="installments" type="number" step="1" defaultValue={1} />
              <div className="campo">
                <label htmlFor="status">Situação</label>
                <select id="status" name="status" defaultValue="CONFIRMADO">
                  <option value="CONFIRMADO">Confirmado (em carteira)</option>
                  <option value="ENTREGUE">Entregue (receita realizada)</option>
                  <option value="RASCUNHO">Rascunho</option>
                </select>
              </div>
            </div>
            <Field label="Canal" name="channel" placeholder="Instagram, WhatsApp…" />
            <Field label="Cliente (opcional)" name="customerName" />
            <button className="btn">Registrar venda</button>
          </form>
        )}
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Vendas recentes</h2>
        {vendas.length === 0 ? (
          <Empty>Nenhuma venda registrada.</Empty>
        ) : (
          <Table head={['Nº', 'Data', 'Situação', 'Itens', 'Bruto', 'Parcelas']}>
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
