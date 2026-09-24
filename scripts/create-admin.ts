/**
 * create-admin.ts — cria a PRIMEIRA administradora com segurança (§10).
 * Sem cadastro público, sem senha padrão. Uso:
 *
 *   ADMIN_EMAIL=dona@kais.com ADMIN_SENHA='umaSenhaForte' ADMIN_NOME='Katarina' \
 *   STORE_NOME='Kais' npx tsx scripts/create-admin.ts
 *
 * Recusa criar uma segunda administradora se já existir uma (rodar de novo é seguro).
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password';

const prisma = new PrismaClient();

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

  const store =
    (await prisma.store.findFirst()) ??
    (await prisma.store.create({ data: { name: storeNome } }));

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
