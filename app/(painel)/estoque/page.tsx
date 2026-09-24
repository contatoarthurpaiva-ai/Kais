/** Estoque (§4.1) — DB-facing. Fora do typecheck no ambiente sem rede. */
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PageHeader, Field, Table, Empty, Money } from '@/lib/ui';
import { criarMaterial, registrarCompra } from './actions';

export const dynamic = 'force-dynamic';

const DEST_LABEL: Record<string, string> = {
  MODELO: 'Modelo',
  COLECAO: 'Coleção',
  COMPARTILHADO: 'Compartilhado',
  INDEFINIDO: 'Indefinido',
};

export default async function Estoque() {
  const s = getSession();
  if (!s) redirect('/login');

  const materiais = await prisma.material.findMany({
    where: { storeId: s.storeId },
    include: { stockGroups: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div>
      <PageHeader title="Estoque" subtitle="Materiais e compras. Cada grupo guarda seu próprio custo — comprar vermelho não mexe no azul." />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--e-3)' }} className="grade">
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Novo material</h2>
          <form action={criarMaterial}>
            <Field label="Nome" name="name" required placeholder="Tecido, forro, elástico…" />
            <Field label="Cor" name="color" placeholder="vermelho" />
            <div className="campo">
              <label htmlFor="unit">Unidade</label>
              <select id="unit" name="unit">
                <option value="metro">metro</option>
                <option value="unidade">unidade</option>
              </select>
            </div>
            <button className="btn secundario">Cadastrar material</button>
          </form>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Registrar compra</h2>
          {materiais.length === 0 ? (
            <Empty>Cadastre um material antes de registrar compras.</Empty>
          ) : (
            <form action={registrarCompra}>
              <div className="campo">
                <label htmlFor="materialId">Material</label>
                <select id="materialId" name="materialId" required>
                  {materiais.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.color ?? ''}
                    </option>
                  ))}
                </select>
              </div>
              <Field label="Quantidade comprada" name="qty" type="number" step="0.001" required help="na unidade do material (ex.: metros)" />
              <Field label="Quanto pagou no total (R$)" name="total" type="number" step="0.01" required />
              <div className="campo">
                <label htmlFor="destination">Para que será usado?</label>
                <select id="destination" name="destination">
                  <option value="COMPARTILHADO">Compartilhado</option>
                  <option value="MODELO">Modelo específico</option>
                  <option value="COLECAO">Coleção específica</option>
                  <option value="INDEFINIDO">Ainda não definido</option>
                </select>
              </div>
              <Field label="Fornecedor (opcional)" name="supplier" />
              <button className="btn">Registrar compra</button>
            </form>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: 'var(--e-3)' }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Materiais em estoque</h2>
        {materiais.length === 0 ? (
          <Empty>Nenhum material cadastrado.</Empty>
        ) : (
          <Table head={['Material', 'Grupo', 'Qtd.', 'Valor', 'Custo médio']}>
            {materiais.flatMap((m) =>
              m.stockGroups.length === 0
                ? [
                    <tr key={m.id}>
                      <td style={{ padding: '8px 10px' }}>{m.name} {m.color ?? ''}</td>
                      <td colSpan={4} style={{ padding: '8px 10px', color: '#8a978e' }}>sem compras ainda</td>
                    </tr>,
                  ]
                : m.stockGroups.map((g) => {
                    const qty = Number(g.qty);
                    const avg = qty > 0 ? Math.round(g.valueCents / qty) : 0;
                    return (
                      <tr key={g.id}>
                        <td style={{ padding: '8px 10px' }}>{m.name} {m.color ?? ''}</td>
                        <td style={{ padding: '8px 10px' }}>{DEST_LABEL[g.destination]}</td>
                        <td style={{ padding: '8px 10px' }} className="num">{qty} {m.unit}</td>
                        <td style={{ padding: '8px 10px' }} className="num"><Money cents={g.valueCents} /></td>
                        <td style={{ padding: '8px 10px' }} className="num"><Money cents={avg} />/{m.unit}</td>
                      </tr>
                    );
                  }),
            )}
          </Table>
        )}
      </section>
      <style>{`@media (max-width:720px){ .grade{ grid-template-columns:1fr !important; } }`}</style>
    </div>
  );
}
