/** Materiais (§4.1) — DB-facing. Fora do typecheck no ambiente sem rede. */
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PageHeader, Table, Empty, Money } from '@/lib/ui';
import { ConfirmSubmit } from '@/lib/confirm';
import { CompraForm } from './compra-form';
import { excluirMaterial } from './actions';

export const dynamic = 'force-dynamic';

export default async function Materiais() {
  const s = getSession();
  if (!s) redirect('/login');

  const materiais = await prisma.material.findMany({
    where: { storeId: s.storeId },
    include: { stockGroups: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div>
      <PageHeader title="Materiais" subtitle="Registre o que você compra. O custo por metro/unidade é calculado sozinho." />

      <section className="card" style={{ marginBottom: 'var(--e-3)' }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Registrar uma compra</h2>
        <CompraForm materials={materiais.map((m) => ({ id: m.id, label: `${m.name}${m.color ? ' ' + m.color : ''}` }))} />
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Seus materiais</h2>
        {materiais.length === 0 ? (
          <Empty>Nenhum material ainda. Registre sua primeira compra acima.</Empty>
        ) : (
          <Table head={['Material', 'Em estoque', 'Custo por medida', '']}>
            {materiais.map((m) => {
              const qty = m.stockGroups.reduce((a, g) => a + Number(g.qty), 0);
              const valor = m.stockGroups.reduce((a, g) => a + g.valueCents, 0);
              const avg = qty > 0 ? Math.round(valor / qty) : 0;
              return (
                <tr key={m.id}>
                  <td style={{ padding: '8px 10px' }}>{m.name} {m.color ?? ''}</td>
                  <td style={{ padding: '8px 10px' }} className="num">
                    {qty > 0 ? `${qty} ${m.unit}` : <span style={{ color: '#9aa79e' }}>sem compras</span>}
                  </td>
                  <td style={{ padding: '8px 10px' }} className="num">
                    {qty > 0 ? <><Money cents={avg} />/{m.unit}</> : '—'}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <form action={excluirMaterial}>
                      <input type="hidden" name="id" value={m.id} />
                      <ConfirmSubmit message={`Excluir o material "${m.name}"?`}>Excluir</ConfirmSubmit>
                    </form>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </section>
    </div>
  );
}
