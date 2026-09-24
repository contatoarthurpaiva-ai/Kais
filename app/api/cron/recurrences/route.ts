/**
 * cron/recurrences — gera ocorrências de despesas recorrentes (§5, §9).
 *
 * Idempotente: cada ocorrência tem chave única (recurrenceId + competência), então
 * rodar o cron duas vezes NÃO duplica lançamentos. Gera previsões/obrigações, nunca
 * pagamentos fictícios. Protegida por CRON_SECRET (Authorization: Bearer ...).
 *
 * Agendar na Vercel via vercel.json (cron) chamando esta rota. Não presumir
 * processo permanente.
 *
 * ⚠️ Depende do client Prisma gerado — fora do typecheck no ambiente sem rede.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Vercel Cron invoca via GET e injeta Authorization: Bearer $CRON_SECRET.
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const now = new Date();
  const due = await prisma.recurrence.findMany({ where: { active: true, nextRun: { lte: now } } });

  let criadas = 0;
  for (const rec of due) {
    const competencia = new Date(rec.nextRun);
    const chave = `${rec.id}:${competencia.toISOString().slice(0, 7)}`; // recorrência + AAAA-MM

    await prisma.$transaction(async (tx) => {
      // idempotência: só cria se ainda não existir a ocorrência dessa competência
      const existe = await tx.expense.findFirst({ where: { recurrenceId: chave } });
      if (existe) return;

      await tx.expense.create({
        data: {
          categoryId: rec.categoryId,
          description: rec.description,
          amountCents: rec.amountCents,
          competence: competencia,
          status: 'PREVISTO', // previsão/obrigação — nunca pago automaticamente
          recurrenceId: chave,
        },
      });
      // avança a próxima execução (mensal, no exemplo)
      const prox = new Date(competencia);
      prox.setMonth(prox.getMonth() + 1);
      await tx.recurrence.update({ where: { id: rec.id }, data: { nextRun: prox } });
      criadas++;
    });
  }

  return NextResponse.json({ ok: true, ocorrenciasCriadas: criadas });
}
