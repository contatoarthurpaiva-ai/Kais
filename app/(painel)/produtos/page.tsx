/** Produtos e custos (§4) — DB-facing. Fora do typecheck no ambiente sem rede. */
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PageHeader, Field, Table, Empty, Money } from '@/lib/ui';
import { criarProduto, criarVariante, custoDaVariante } from './actions';

export const dynamic = 'force-dynamic';

export default async function Produtos() {
  const s = getSession();
  if (!s) redirect('/login');

  const [produtos, materiais] = await Promise.all([
    prisma.product.findMany({
      where: { storeId: s.storeId },
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.material.findMany({ where: { storeId: s.storeId } }),
  ]);

  // custo de cada variante (ficha ativa)
  const custos = new Map<string, Awaited<ReturnType<typeof custoDaVariante>>>();
  for (const p of produtos) for (const v of p.variants) custos.set(v.id, await custoDaVariante(v.id));

  return (
    <div>
      <PageHeader title="Produtos e custos" subtitle="Cadastre peças e monte a ficha técnica. O custo é calculado sozinho." />

      <section className="card" style={{ marginBottom: 'var(--e-3)' }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Novo produto</h2>
        <form action={criarProduto}>
          <Field label="Nome" name="name" required placeholder="Biquíni cortininha" />
          <Field label="Categoria" name="category" placeholder="Biquíni, saída…" />
          <div className="campo">
            <label htmlFor="origin">Origem</label>
            <select id="origin" name="origin">
              <option value="PROPRIA">Fabricação própria</option>
              <option value="TERCEIRIZADA">Terceirizada</option>
              <option value="REVENDA">Revenda</option>
            </select>
          </div>
          <button className="btn">Cadastrar produto</button>
        </form>
      </section>

      {produtos.length === 0 && <Empty>Nenhum produto ainda. Cadastre o primeiro acima.</Empty>}

      {produtos.map((p) => (
        <section key={p.id} className="card" style={{ marginBottom: 'var(--e-2)' }}>
          <h3 style={{ marginTop: 0 }}>{p.name}</h3>
          {p.variants.length > 0 && (
            <Table head={['SKU', 'Cor', 'Tamanho', 'Preço tabela', 'Custo (C)']}>
              {p.variants.map((v) => {
                const c = custos.get(v.id);
                return (
                  <tr key={v.id}>
                    <td style={{ padding: '8px 10px' }}>{v.sku}</td>
                    <td style={{ padding: '8px 10px' }}>{v.color ?? '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{v.size ?? '—'}</td>
                    <td style={{ padding: '8px 10px' }} className="num"><Money cents={v.tablePriceCents} /></td>
                    <td style={{ padding: '8px 10px' }} className="num">
                      {c ? <Money cents={c.unitCostCents} /> : '—'}
                      {c?.hasEstimates && <span title="contém estimativas"> ⚠</span>}
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}

          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--verde-escuro)' }}>Adicionar variante</summary>
            <form action={criarVariante} style={{ marginTop: 12 }}>
              <input type="hidden" name="productId" value={p.id} />
              <Field label="SKU (único)" name="sku" required placeholder="BIQ-CORT-VERM-M" />
              <Field label="Cor" name="color" />
              <Field label="Tamanho" name="size" />
              <Field label="Preço de tabela (R$)" name="tablePrice" type="number" step="0.01" />
              <button className="btn secundario">Adicionar variante</button>
            </form>
          </details>
        </section>
      ))}

      {materiais.length === 0 && (
        <Empty>Cadastre materiais no Estoque para montar as fichas técnicas e calcular custos.</Empty>
      )}
    </div>
  );
}
