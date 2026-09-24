import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getSession } from '@/lib/auth';

const MENU: { href: string; label: string; pronto?: boolean }[] = [
  { href: '/visao-geral', label: 'Visão geral', pronto: true },
  { href: '/precificacao', label: 'Precificação', pronto: true },
  { href: '/produtos', label: 'Produtos e custos', pronto: true },
  { href: '/vendas', label: 'Vendas', pronto: true },
  { href: '/financeiro', label: 'Financeiro', pronto: true },
  { href: '/estoque', label: 'Estoque', pronto: true },
  { href: '/configuracoes', label: 'Configurações', pronto: true },
  { href: '/onboarding', label: 'Primeiros passos', pronto: true },
  { href: '/relatorios', label: 'Relatórios' },
];

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();
  if (!session) redirect('/login');

  return (
    <div className="painel">
      <aside className="lateral">
        <div className="marca">
          <Image src="/kais-logo.png" alt="Kais" width={40} height={40} />
          <strong>Kais</strong>
        </div>
        <nav>
          {MENU.map((m) => (
            <Link key={m.href} href={m.href} className="item">
              <span>{m.label}</span>
              {!m.pronto && <em className="tag">em breve</em>}
            </Link>
          ))}
        </nav>
        <div className="rodape">
          <span className="perfil">{session.role === 'ADMIN' ? 'Administradora' : 'Operacional'}</span>
          <form action="/api/auth/logout" method="post">
            <button className="btn secundario" style={{ width: '100%' }}>Sair</button>
          </form>
        </div>
      </aside>
      <main className="conteudo">{children}</main>

      {/* estilos locais do shell — desktop lateral / celular compacto */}
      <style>{`
        .painel { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
        .lateral { background: var(--verde-escuro); color: #fff; display: flex; flex-direction: column; padding: var(--e-3) var(--e-2); gap: var(--e-3); }
        .marca { display: flex; align-items: center; gap: 10px; font-size: 1.15rem; }
        .lateral nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .lateral .item { display: flex; align-items: center; justify-content: space-between; color: #eaf1ed; text-decoration: none; padding: 10px 12px; border-radius: var(--r-1); }
        .lateral .item:hover { background: rgba(255,255,255,.10); }
        .lateral .tag { font-style: normal; font-size: .7rem; opacity: .7; background: rgba(255,255,255,.14); padding: 2px 6px; border-radius: 999px; }
        .rodape { display: flex; flex-direction: column; gap: 10px; }
        .perfil { font-size: .8rem; opacity: .85; }
        .conteudo { padding: var(--e-4); max-width: 980px; }
        @media (max-width: 720px) {
          .painel { grid-template-columns: 1fr; }
          .lateral { flex-direction: row; align-items: center; overflow-x: auto; padding: 10px 12px; gap: 12px; }
          .lateral nav { flex-direction: row; overflow-x: auto; }
          .lateral .item { white-space: nowrap; }
          .lateral .tag { display: none; }
          .rodape { flex-direction: row; align-items: center; }
          .conteudo { padding: var(--e-2); }
        }
      `}</style>
    </div>
  );
}
