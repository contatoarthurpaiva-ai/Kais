// create-admin.mjs — cria a 1ª administradora sem depender de tsx (Node puro).
// Roda no start de produção (start:prod) e no `npm run setup`.
import { PrismaClient } from '@prisma/client';
import { randomBytes, scrypt as _scrypt } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(_scrypt);
const prisma = new PrismaClient();

async function hashPassword(plain) {
  if (!plain || plain.length < 8) throw new Error('Senha deve ter ao menos 8 caracteres');
  const salt = randomBytes(16);
  const derived = await scrypt(plain, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('hex')}$${derived.toString('hex')}`;
}

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@kais.local').trim().toLowerCase();
  const senha = process.env.ADMIN_SENHA ?? 'kais12345';
  const nome = process.env.ADMIN_NOME ?? 'Administradora';
  const storeNome = process.env.STORE_NOME ?? 'Kais';
  const usouPadrao = !process.env.ADMIN_EMAIL || !process.env.ADMIN_SENHA;
  if (senha.length < 8) throw new Error('ADMIN_SENHA deve ter ao menos 8 caracteres.');

  const jaExiste = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (jaExiste) {
    console.log('Já existe uma administradora; nada a fazer.');
    return;
  }
  const store = (await prisma.store.findFirst()) ?? (await prisma.store.create({ data: { name: storeNome } }));
  const passwordHash = await hashPassword(senha);
  const user = await prisma.user.create({
    data: { storeId: store.id, name: nome, email, passwordHash, role: 'ADMIN' },
  });

  console.log(`Administradora criada: ${user.email} (loja: ${store.name}).`);
  if (usouPadrao) {
    console.log('\n=========================================');
    console.log('  LOGIN (padrão de desenvolvimento):');
    console.log(`  e-mail: ${email}`);
    console.log(`  senha:  ${senha}`);
    console.log('  TROQUE antes de usar de verdade.');
    console.log('=========================================\n');
  }
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
