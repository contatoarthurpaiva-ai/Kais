// create-admin.mjs — garante a administradora (Node puro, sem tsx).
// Se ADMIN_EMAIL e ADMIN_SENHA (ou ADMIN_PASSWORD) forem definidos, ALINHA a
// administradora com esses valores (cria ou atualiza). Nunca derruba o boot:
// qualquer falha aqui apenas registra e segue, para o app sempre subir.
import { PrismaClient } from '@prisma/client';
import { randomBytes, scrypt as _scrypt } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(_scrypt);
const prisma = new PrismaClient();

async function hashPassword(plain) {
  const salt = randomBytes(16);
  const derived = await scrypt(plain, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('hex')}$${derived.toString('hex')}`;
}

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@kais.local').trim().toLowerCase();
  const senha = process.env.ADMIN_SENHA ?? process.env.ADMIN_PASSWORD ?? 'kais12345';
  const nome = process.env.ADMIN_NOME ?? 'Administradora';
  const storeNome = process.env.STORE_NOME ?? 'Kais';
  const explicito = !!(process.env.ADMIN_EMAIL && (process.env.ADMIN_SENHA || process.env.ADMIN_PASSWORD));

  if (senha.length < 8) {
    console.log('AVISO: ADMIN_SENHA tem menos de 8 caracteres — ignorando. Use uma senha maior.');
    return;
  }

  const jaExiste = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

  if (jaExiste) {
    if (explicito) {
      // alinha a administradora existente com as variáveis definidas
      const passwordHash = await hashPassword(senha);
      await prisma.user.update({ where: { id: jaExiste.id }, data: { email, name: nome, passwordHash } });
      console.log(`Administradora atualizada para: ${email}`);
    } else {
      console.log('Já existe uma administradora; nada a fazer.');
    }
    return;
  }

  const store = (await prisma.store.findFirst()) ?? (await prisma.store.create({ data: { name: storeNome } }));
  const passwordHash = await hashPassword(senha);
  const user = await prisma.user.create({
    data: { storeId: store.id, name: nome, email, passwordHash, role: 'ADMIN' },
  });
  console.log(`Administradora criada: ${user.email}`);
  if (!explicito) {
    console.log('LOGIN padrão de dev: admin@kais.local / kais12345 (troque depois).');
  }
}

main()
  .catch((e) => {
    // best-effort: não derruba o boot do app
    console.error('Seed admin falhou (seguindo mesmo assim):', e.message ?? e);
  })
  .finally(() => prisma.$disconnect());
