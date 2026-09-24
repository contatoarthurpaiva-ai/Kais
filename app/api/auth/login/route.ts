import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/src/auth/password';
import { createSession } from '@/src/auth/session';
import { SESSION_COOKIE } from '@/lib/auth';

// Sem cadastro público (§10). Só autentica usuários existentes.
export async function POST(req: NextRequest) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return NextResponse.json({ error: 'Servidor mal configurado' }, { status: 500 });

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  if (!email || !password) {
    return NextResponse.json({ error: 'Informe e-mail e senha' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // resposta genérica para não revelar existência de conta
  const genericFail = NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
  if (!user || !user.active) return genericFail;

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return genericFail;

  const token = createSession(
    { userId: user.id, storeId: user.storeId, role: user.role },
    secret,
  );
  const res = NextResponse.json({ ok: true, role: user.role, name: user.name });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return res;
}
