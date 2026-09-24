/**
 * Upload da logo (§2). Aceita PNG/JPEG/WebP com validação de tipo (magic bytes),
 * tamanho e conteúdo. NÃO aceita SVG não sanitizado.
 *
 * Persistência: em produção, envie para o bucket persistente (UPLOADS_*) e grave
 * a URL. Como fallback sem bucket, guarda um data URI em Store.logoUrl (adequado só
 * para imagens pequenas). Nunca grava em diretório temporário do deploy.
 *
 * ⚠️ DB-facing (Prisma). Fora do typecheck no ambiente sem rede.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { can } from '@/src/auth/rbac';

const MAX_BYTES = 512 * 1024; // 512 KB

function sniff(buf: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (buf.length > 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf.length > 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  )
    return 'image/webp';
  return null;
}

export async function POST(req: NextRequest) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!can(s.role, 'policy:edit')) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

  const form = await req.formData();
  const file = form.get('logo');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Envie um arquivo' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Arquivo acima de 512 KB' }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniff(bytes);
  if (!mime) return NextResponse.json({ error: 'Formato inválido. Use PNG, JPEG ou WebP.' }, { status: 415 });

  // TODO produção: subir `bytes` para UPLOADS_* e usar a URL retornada.
  const dataUri = `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
  await prisma.store.update({ where: { id: s.storeId }, data: { logoUrl: dataUri } });

  return NextResponse.redirect(new URL('/configuracoes', req.url), { status: 303 });
}
