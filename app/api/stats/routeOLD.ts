import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/withAuth';

export const dynamic = 'force-dynamic';

function buildWhere(searchParams: URLSearchParams) {
  const cidade = searchParams.get('cidade') || undefined;
  const conferente = searchParams.get('conferente') || undefined;
  const month = searchParams.get('month') || undefined;

  const where: any = {};
  if (cidade) where.cidade = cidade;
  if (conferente) where.conferente = conferente;

  if (month) {
    const [y, m] = month.split('-').map(Number);
    if (!isNaN(y) && !isNaN(m) && y > 1900 && m >= 1 && m <= 12) {
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 1));
      where.OR = [
        { datadia: { gte: start, lt: end } },
        { AND: [{ datadia: null }, { datahora: { gte: start, lt: end } }] },
      ];
    }
  }

  return where;
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const where = buildWhere(searchParams);

    const [total, byCidade, byConferente, cidadesRaw, conferentesRaw, rows] = await Promise.all([
      prisma.fatoConferencia.count({ where }),

      prisma.fatoConferencia.groupBy({
        by: ['cidade'],
        where,
        _sum: { qtdpedidos: true, qtditens: true },
        _count: { _all: true },
      }),

      prisma.fatoConferencia.groupBy({
        by: ['conferente'],
        where,
        _sum: { qtdpedidos: true, qtditens: true },
        _count: { _all: true },
      }),

      prisma.fatoConferencia.findMany({
        where,
        select: { cidade: true },
        distinct: ['cidade'],
        take: 5000,
      }),

      prisma.fatoConferencia.findMany({
        where,
        select: { conferente: true },
        distinct: ['conferente'],
        take: 5000,
      }),

      // pegamos os campos necessários para reconstruir o "byDia"
      prisma.fatoConferencia.findMany({
        where,
        select: { datadia: true, datahora: true, qtdpedidos: true, qtditens: true },
        take: 100_000, // limite de segurança
      }),
    ]);

    // agrega em JS por dia = date( datadia || datahora )
    const byDiaMap = new Map<string, { pedidos: number; itens: number }>();
    for (const r of rows) {
      const base = r.datadia ?? r.datahora;
      if (!base) continue;
      const d = new Date(base);
      if (isNaN(+d)) continue;
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      const prev = byDiaMap.get(key) ?? { pedidos: 0, itens: 0 };
      byDiaMap.set(key, {
        pedidos: prev.pedidos + (r.qtdpedidos ?? 0),
        itens: prev.itens + (r.qtditens ?? 0),
      });
    }

    // devolve no mesmo formato esperado pelo front
    const byDia = Array.from(byDiaMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([iso, agg]) => ({
        datadia: iso, // string ISO yyyy-mm-dd (antes era Date | null, aqui usamos string)
        _sum: { qtdpedidos: agg.pedidos, qtditens: agg.itens },
        _count: { _all: 0 },
      }));

    const cidades = cidadesRaw.map((x) => x.cidade).filter((v) => v != null);
    const conferentes = conferentesRaw.map((x) => x.conferente).filter((v) => v != null);

    return NextResponse.json({ total, byCidade, byConferente, byDia, cidades, conferentes });
  } catch (err: any) {
    console.error('STATS_ERROR:', err);
    return NextResponse.json({ error: 'Falha ao obter estatísticas' }, { status: 500 });
  }
}
