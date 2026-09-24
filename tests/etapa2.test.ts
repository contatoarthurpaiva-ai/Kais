/**
 * etapa2.test.ts — testes da camada de aplicação (auth, permissões, serviço).
 * Rodar: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hashPassword, verifyPassword } from '../src/auth/password.ts';
import { createSession, readSession } from '../src/auth/session.ts';
import { can, assertCan, ForbiddenError } from '../src/auth/rbac.ts';
import { validatePricing } from '../src/server/validation.ts';
import { simulatePricing } from '../src/server/pricing-service.ts';

test('senha: hash verifica correta e rejeita errada', async () => {
  const h = await hashPassword('segredoForte1');
  assert.ok(h.startsWith('scrypt$'));
  assert.equal(await verifyPassword('segredoForte1', h), true);
  assert.equal(await verifyPassword('senhaErrada1', h), false);
});

test('senha: rejeita curta demais', async () => {
  await assert.rejects(() => hashPassword('1234'));
});

test('sessão: assina, lê e detecta adulteração/expiração', () => {
  const secret = 'segredo-de-teste';
  const tok = createSession({ userId: 'u1', storeId: 's1', role: 'ADMIN' }, secret);
  const p = readSession(tok, secret);
  assert.ok(p);
  assert.equal(p?.userId, 'u1');
  assert.equal(p?.role, 'ADMIN');
  // segredo errado → inválido
  assert.equal(readSession(tok, 'outro'), null);
  // adulterado → inválido
  assert.equal(readSession(tok.slice(0, -2) + 'xy', secret), null);
  // expirado → inválido
  const expired = createSession({ userId: 'u1', storeId: 's1', role: 'ADMIN' }, secret, -1000);
  assert.equal(readSession(expired, secret), null);
});

test('permissões: ADMIN pode editar política e confirmar abaixo do mínimo; OPERADOR não', () => {
  assert.equal(can('ADMIN', 'policy:edit'), true);
  assert.equal(can('ADMIN', 'sale:confirm-below-min'), true);
  assert.equal(can('OPERADOR', 'policy:edit'), false);
  assert.equal(can('OPERADOR', 'sale:confirm-below-min'), false);
  assert.equal(can('OPERADOR', 'sale:create'), true);
  assert.throws(() => assertCan('OPERADOR', 'policy:edit'), ForbiddenError);
});

test('validação: aponta campos faltantes em vez de assumir zero', () => {
  const r = validatePricing({ C: 1500 });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.ok(r.missing.length >= 3); // E, t, meta, mínimo
  }
});

test('validação: rejeita taxa+meta ≥ 1 (preço indefinido)', () => {
  const r = validatePricing({ C: 1500, E: 300, t: 0.5, goalMargin: 0.6, minMargin: 0.2 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => e.includes('indefinido')));
});

test('serviço: simulação completa bate com o motor (C=15,E=3,t=2,99%,meta=35%,mín=20%)', () => {
  const v = validatePricing({
    C: 1500,
    E: 300,
    t: 0.0299,
    goalMargin: 0.35,
    minMargin: 0.2,
    desiredPriceCents: 2403,
  });
  assert.equal(v.ok, true);
  if (!v.ok) return;
  const res = simulatePricing(v.value);
  assert.equal(res.targetPriceCents, 2903); // R$29,03
  assert.equal(res.minPriceCents, 2338); // R$23,38
  assert.equal(res.zeroFloorCents, 1856); // R$18,56
  assert.equal(res.maxDiscount.available, true);
  assert.equal(res.maxDiscount.valueCents, 565); // R$5,65
  assert.ok(res.evaluation);
  assert.equal(res.evaluation?.state, 'abaixo_da_meta');
});
