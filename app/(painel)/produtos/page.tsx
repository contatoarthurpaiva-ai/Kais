/** Peças e custos (§4) — DB-facing. Fora do typecheck no ambiente sem rede. */
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PageHeader, Field, Table, Empty, Money } from '@/lib/ui';
import { ConfirmSubmit } from '@/lib/confirm';
import { adicionarVariante, custoDaVariante, excluirPeca } from './actions';
import { PieceForm } from './piece-form';

export const dynamic = 'force-dynamic';

export default async function Pecas() {
  const s = getSession();
  if (!s) redirect('/login');

  const produtos = await prisma.product.findMany({
    where: { storeId: s.storeId },
    include: { variants: true },
    orderBy: { createdAt: 'desc' },
  });
  const margem = await prisma.marginPolicy.findFirst({ where: { storeId: s.storeId } });
  const meta = margem ? Number(margem.goalMargin) : 0.35;

  const custos = new Map<string, Awaited<ReturnType<typeof custoDaVariante>>>();
  for (const p of produtos) for (const v of p.variants) custos.set(v.id, await custoDaVariante(v.id));

  return (
    <div>
      <PageHeader title="Peças" subtitle="Diga quanto custa e por quanto vende — a margem aparece na hora." />

      <section className="card" style={{ marginBottom: 'var(--e-3)' }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Nova peça</h2>
        <PieceForm metaMargin={meta} />
      </section>

      {produtos.length === 0 && <Empty>Nenhuma peça ainda. Cadastre a primeira acima.</Empty>}

      {produtos.map((p) => (
        <section key={p.id} className="card" style={{ marginBottom: 'var(--e-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>{p.name}</h3>
            <form action={excluirPeca}>
              <input type="hidden" name="id" value={p.id} />
              <ConfirmSubmit message={`Excluir a peça "${p.name}" e todas as suas variantes?`}>Excluir</ConfirmSubmit>
            </form>
          </div>
          {p.variants.length > 0 && (
            <Table head={['Cor', 'Tam.', 'Custo', 'Preço', 'Sobra', 'Margem', 'Estoque']}>
              {p.variants.map((v) => {
                const c = custos.get(v.id);
                const custo = c?.unitCostCents ?? 0;
                const sobra = v.tablePriceCents - custo;
                const margem = v.tablePriceCents > 0 ? (sobra / v.tablePriceCents) * 100 : 0;
                const cor = sobra < 0 ? 'var(--erro)' : margem < 20 ? 'var(--alerta)' : 'var(--ok)';
                return (
                  <tr key={v.id}>
                    <td style={{ padding: '8px 10px' }}>{v.color ?? '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{v.size ?? '—'}</td>
                    <td style={{ padding: '8px 10px' }} className="num">{custo > 0 ? <Money cents={custo} /> : '—'}{c?.hasEstimates && ' ⚠'}</td>
                    <td style={{ padding: '8px 10px' }} className="num"><Money cents={v.tablePriceCents} /></td>
                    <td style={{ padding: '8px 10px' }} className="num">{custo > 0 && v.tablePriceCents > 0 ? <span style={{ color: cor }}><Money cents={sobra} /></span> : '—'}</td>
                    <td style={{ padding: '8px 10px' }} className="num">{custo > 0 && v.tablePriceCents > 0 ? <span style={{ color: cor }}>{margem.toFixed(0)}%</span> : '—'}</td>
                    <td style={{ padding: '8px 10px' }} className="num">{v.stockQty}</td>
                  </tr>
                );
              })}
            </Table>
          )}

          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--verde-escuro)' }}>Adicionar outra cor/tamanho</summary>
            <form action={adicionarVariante} style={{ marginTop: 12 }}>
              <input type="hidden" name="productId" value={p.id} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="grade">
                <Field label="Cor" name="color" />
                <Field label="Tamanho" name="size" />
                <Field label="Quanto custa (R$)" name="cost" type="number" step="0.01" />
                <Field label="Preço de venda (R$)" name="tablePrice" type="number" step="0.01" />
                <Field label="Quantas prontas" name="stockQty" type="number" step="1" />
              </div>
              <button className="btn secundario">Adicionar</button>
            </form>
          </details>
        </section>
      ))}
      <style>{`@media (max-width:720px){ .grade{ grid-template-columns:1fr !important; } }`}</style>
    </div>
  );
}
