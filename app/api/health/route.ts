import { NextResponse } from 'next/server';

// Verificação de saúde simples (sem banco). Para um health check profundo,
// adicione um SELECT 1 via Prisma numa rota separada.
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'kais',
    time: new Date().toISOString(),
  });
}
