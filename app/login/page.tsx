'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    setErro(null);
    setCarregando(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErro(j.error ?? 'Não foi possível entrar');
        return;
      }
      router.push('/precificacao');
    } catch {
      setErro('Falha de conexão');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--e-3)',
      }}
    >
      <div className="card" style={{ width: 'min(380px, 100%)' }}>
        <div style={{ display: 'grid', placeItems: 'center', marginBottom: 'var(--e-2)' }}>
          <Image src="/kais-logo.png" alt="Kais" width={96} height={96} priority />
          <h1 style={{ margin: '12px 0 0', color: 'var(--verde-escuro)' }}>Kais</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7a70', fontSize: '0.9rem' }}>
            Gestão financeira e precificação
          </p>
        </div>

        <div className="campo">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div className="campo">
          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            onKeyDown={(e) => e.key === 'Enter' && entrar()}
          />
        </div>

        {erro && (
          <p className="estado abaixo_do_minimo" role="alert" style={{ marginBottom: 12 }}>
            ⚠ {erro}
          </p>
        )}

        <button className="btn" onClick={entrar} disabled={carregando} style={{ width: '100%' }}>
          {carregando ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    </main>
  );
}
