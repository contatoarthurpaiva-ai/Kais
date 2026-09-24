/** Sessão no servidor — lê o cookie e valida com o segredo. */
import { cookies } from 'next/headers';
import { readSession, type SessionPayload } from '@/src/auth/session';

export const SESSION_COOKIE = 'kais_session';

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET ausente no ambiente');
  return s;
}

/** Retorna a sessão válida ou null. Uso em Server Components e rotas. */
export function getSession(): SessionPayload | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readSession(token, secret());
}

/** Igual, mas lança quando não autenticado (para rotas protegidas). */
export function requireSession(): SessionPayload {
  const s = getSession();
  if (!s) throw new Error('Não autenticado');
  return s;
}
