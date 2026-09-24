/**
 * session.ts — token de sessão assinado (HMAC-SHA256), com expiração.
 *
 * Payload compacto: base64url(json).base64url(hmac). Sem libs externas.
 * O segredo vem de AUTH_SECRET (só no servidor). Verificação em tempo constante.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SessionPayload {
  userId: string;
  storeId: string;
  role: 'ADMIN' | 'OPERADOR';
  /** epoch ms de expiração */
  exp: number;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(data: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(data).digest();
}

export function createSession(
  payload: Omit<SessionPayload, 'exp'>,
  secret: string,
  ttlMs = 1000 * 60 * 60 * 12, // 12h
): string {
  if (!secret) throw new Error('AUTH_SECRET ausente');
  const full: SessionPayload = { ...payload, exp: Date.now() + ttlMs };
  const body = b64url(Buffer.from(JSON.stringify(full)));
  const mac = b64url(sign(body, secret));
  return `${body}.${mac}`;
}

export function readSession(token: string, secret: string): SessionPayload | null {
  if (!token || !secret) return null;
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(body, secret);
  const got = fromB64url(mac);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  let payload: SessionPayload;
  try {
    payload = JSON.parse(fromB64url(body).toString('utf8'));
  } catch {
    return null;
  }
  if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
  return payload;
}
