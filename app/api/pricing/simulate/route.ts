import { NextRequest, NextResponse } from 'next/server';
import { validatePricing } from '@/src/server/validation';
import { simulatePricing } from '@/src/server/pricing-service';
import { getSession } from '@/lib/auth';

// Servidor é a fonte de verdade: revalida e recalcula (§6). Sem banco aqui —
// a simulação é cálculo puro sobre o motor testado.
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = validatePricing(body as Record<string, unknown>);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: 'Dados incompletos', missing: parsed.missing, problemas: parsed.errors },
      { status: 422 },
    );
  }

  try {
    const result = simulatePricing(parsed.value);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
