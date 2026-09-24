/** Onboarding (§3) — retomável, mostra pendências. DB-facing, fora do typecheck. */
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/lib/ui';

export const dynamic = 'force-dynamic';

export default async function Onboarding() {
  const s = getSession();
  if (!s) redirect('/login');

  const [loja, margem, conta, categoria, material, produto] = await Promise.all([
    prisma.store.findUnique({ where: { id: s.storeId } }),
    prisma.marginPolicy.findFirst({ where: { storeId: s.storeId } }),
    prisma.financialAccount.findFirst({ where: { storeId: s.storeId } }),
    prisma.expenseCategory.findFirst({ where: { storeId: s.storeId } }),
    prisma.material.findFirst({ where: { storeId: s.storeId } }),
    prisma.product.findFirst({ where: { storeId: s.storeId } }),
  ]);

  const passos = [
    { ok: !!loja?.name, label: 'Dados da loja', href: '/configuracoes' },
    { ok: !!margem, label: 'Metas de margem', href: '/configuracoes' },
    { ok: !!conta, label: 'Conta financeira', href: '/financeiro' },
    { ok: !!categoria, label: 'Categorias de gasto', href: '/financeiro' },
    { ok: !!material, label: 'Materiais', href: '/estoque' },
    { ok: !!produto, label: 'Primeiro produto', href: '/produtos' },
  ];
  const feitos = passos.filter((p) => p.ok).length;

  return (
    <div>
      <PageHeader title="Primeiros passos" subtitle={`${feitos} de ${passos.length} concluídos — pode continuar de onde parou.`} />
      <section className="card">
        {passos.map((p) => (
          <div key={p.label} className="linha-resultado">
            <span>
              {p.ok ? '✓' : '○'} {p.label}
            </span>
            {!p.ok && (
              <Link href={p.href} className="btn secundario" style={{ padding: '4px 12px' }}>
                Configurar
              </Link>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
