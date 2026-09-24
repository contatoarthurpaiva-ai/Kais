import { NextRequest, NextResponse } from 'next/server';
import { toCSV } from '@/src/domain/csv';
import { getSession } from '@/lib/auth';
import { can } from '@/src/auth/rbac';

// Exportação CSV protegida (§8). Recebe as linhas já montadas e devolve o arquivo,
// neutralizando fórmulas. Só ADMIN exporta (report:export — §10).
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!can(session.role, 'report:export')) {
    return NextResponse.json({ error: 'Sem permissão para exportar' }, { status: 403 });
  }

  let body: { filename?: string; rows?: (string | number | null)[][] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ error: 'rows deve ser uma lista de linhas' }, { status: 422 });
  }

  const csv = toCSV(body.rows);
  const filename = (body.filename ?? 'kais-relatorio').replace(/[^\w.-]/g, '_') + '.csv';
  // BOM para acentuação correta no Excel
  return new NextResponse('\uFEFF' + csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
