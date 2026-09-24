/** Configurações (§2, §3) — DB-facing. Fora do typecheck no ambiente sem rede. */
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PageHeader, Field, Table, Empty, Money } from '@/lib/ui';
import { salvarLoja, salvarMargem, criarTaxa } from './actions';

export const dynamic = 'force-dynamic';

export default async function Configuracoes() {
  const s = getSession();
  if (!s) redirect('/login');
  const admin = s.role === 'ADMIN';

  const [loja, margem, taxas] = await Promise.all([
    prisma.store.findUnique({ where: { id: s.storeId } }),
    prisma.marginPolicy.findFirst({ where: { storeId: s.storeId } }),
    prisma.feePolicy.findMany({ where: { storeId: s.storeId } }),
  ]);

  if (!admin) {
    return (
      <div>
        <PageHeader title="Configurações" />
        <Empty>Apenas a administradora altera políticas financeiras.</Empty>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Dados da loja, metas de margem, taxas e logo." />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--e-3)' }} className="grade">
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Dados da loja</h2>
          <form action={salvarLoja}>
            <Field label="Nome" name="name" defaultValue={loja?.name ?? 'Kais'} />
            <Field label="Fuso horário" name="timezone" defaultValue={loja?.timezone ?? 'America/Sao_Paulo'} />
            <button className="btn secundario">Salvar</button>
          </form>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Metas de margem</h2>
          <form action={salvarMargem}>
            <Field label="Margem mínima (%)" name="minMargin" type="number" step="0.01" defaultValue={margem ? Number(margem.minMargin) * 100 : 20} />
            <Field label="Meta de margem (%)" name="goalMargin" type="number" step="0.01" defaultValue={margem ? Number(margem.goalMargin) * 100 : 35} />
            <button className="btn secundario">Salvar metas</button>
          </form>
        </section>
      </div>

      <section className="card" style={{ marginTop: 'var(--e-3)' }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Logo da loja</h2>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          {loja?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={loja.logoUrl} alt="Logo" width={64} height={64} style={{ borderRadius: 8 }} />
          ) : (
            <span style={{ color: '#8a978e' }}>Nenhuma logo enviada (usando a padrão).</span>
          )}
          <form action="/api/uploads/logo" method="post" encType="multipart/form-data" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" required />
            <button className="btn secundario">Enviar</button>
          </form>
        </div>
        <p className="ajuda" style={{ marginTop: 8 }}>PNG, JPEG ou WebP até 512 KB. SVG não é aceito.</p>
      </section>

      <section className="card" style={{ marginTop: 'var(--e-3)' }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Taxas de pagamento</h2>
        <form action={criarTaxa} style={{ marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="grade">
            <Field label="Nome" name="name" placeholder="Cartão à vista" />
            <div className="campo">
              <label htmlFor="base">Base</label>
              <select id="base" name="base">
                <option value="produto">Sobre o produto</option>
                <option value="produto_mais_frete">Produto + frete</option>
                <option value="frete">Sobre o frete</option>
                <option value="fixa_por_pedido">Fixa por pedido</option>
              </select>
            </div>
            <Field label="Percentual (%)" name="pct" type="number" step="0.01" placeholder="2,99" />
            <Field label="Valor fixo (R$, se fixa)" name="fixed" type="number" step="0.01" />
            <Field label="Modalidade" name="modality" placeholder="pix, cartao_avista…" />
          </div>
          <button className="btn secundario">Adicionar taxa</button>
        </form>
        {taxas.length === 0 ? (
          <Empty>Nenhuma taxa cadastrada.</Empty>
        ) : (
          <Table head={['Nome', 'Base', 'Valor']}>
            {taxas.map((t) => (
              <tr key={t.id}>
                <td style={{ padding: '8px 10px' }}>{t.name}</td>
                <td style={{ padding: '8px 10px' }}>{t.base}</td>
                <td style={{ padding: '8px 10px' }} className="num">
                  {t.base === 'fixa_por_pedido' ? <Money cents={t.fixedCents ?? 0} /> : `${(Number(t.pct) * 100).toFixed(2)}%`}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
      <style>{`@media (max-width:720px){ .grade{ grid-template-columns:1fr !important; } }`}</style>
    </div>
  );
}
