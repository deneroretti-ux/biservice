// app/api/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

type Row = {
  conferente: string | null;
  cidade: string | null;
  datadia: Date | null;
  datahora: Date | null;
  qtdpedidos: number | null;
  qtditens: number | null;
};

function parseDate(d?: string | null, endOfDay = false) {
  if (!d) return undefined;
  return new Date(endOfDay ? `${d}T23:59:59.999` : `${d}T00:00:00.000`);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const cidade = searchParams.get('cidade') || '';
    const conferente = searchParams.get('conferente') || '';

    // where dinâmico (usa DATADIA)
    const where: any = {};
    if (from || to) {
      where.datadia = {};
      if (from) where.datadia.gte = parseDate(from);
      if (to) where.datadia.lte = parseDate(to, true);
    }
    if (cidade) where.cidade = cidade;
    if (conferente) where.conferente = conferente;

    // pega só os campos necessários
    const rows: Row[] = await prisma.fatoConferencia.findMany({
      where,
      select: {
        conferente: true,
        cidade: true,
        datadia: true,
        datahora: true,
        qtdpedidos: true,
        qtditens: true,
      },
    });

    // ---- agregações base ----
    let totalPedidos = 0;
    let totalItens = 0;

    const somaPedidosPorConf = new Map<string, number>();
    const somaItensPorConf = new Map<string, number>();
    const somaPedidosPorCidade = new Map<string, number>();

    // para jornada: min/max HORA por conferente em cada DIA
    const jornadaPorDiaConf = new Map<string, { min: number; max: number }>();

    for (const r of rows) {
      const conf = (r.conferente ?? '—').trim();
      const cid = (r.cidade ?? '—').trim();
      const itens = Number(r.qtditens ?? 0);

      // --- pedidos com fallback ---
      const qtd = Number(r.qtdpedidos);
      const pedidosEff =
        Number.isFinite(qtd) && qtd > 0 ? qtd : (itens > 0 ? 1 : 0);

      totalPedidos += pedidosEff;
      totalItens += itens;

      somaPedidosPorConf.set(conf, (somaPedidosPorConf.get(conf) ?? 0) + pedidosEff);
      somaItensPorConf.set(conf, (somaItensPorConf.get(conf) ?? 0) + itens);
      somaPedidosPorCidade.set(cid, (somaPedidosPorCidade.get(cid) ?? 0) + pedidosEff);

      // Jornada (horas) = soma dos (max(hora) - min(hora)) por DIA e Conferente
      if (r.datadia && r.datahora) {
        const diaStr = r.datadia.toISOString().slice(0, 10); // YYYY-MM-DD
        const key = `${conf}__${diaStr}`;
        const ts = r.datahora.getTime();
        const cur = jornadaPorDiaConf.get(key);
        if (!cur) {
          jornadaPorDiaConf.set(key, { min: ts, max: ts });
        } else {
          if (ts < cur.min) cur.min = ts;
          if (ts > cur.max) cur.max = ts;
        }
      }
    }

    // soma das horas por conferente
    const somaHorasPorConf = new Map<string, number>();
    for (const [key, mm] of jornadaPorDiaConf.entries()) {
      const [conf] = key.split('__');
      const horasDia = Math.max(0, (mm.max - mm.min) / 3_600_000); // ms → h
      somaHorasPorConf.set(conf, (somaHorasPorConf.get(conf) ?? 0) + horasDia);
    }

    // ---- gráficos ----
    const pedidosPorConferente = Array.from(somaPedidosPorConf.entries())
      .map(([conferente, pedidos]) => ({ conferente, pedidos }))
      .sort((a, b) => b.pedidos - a.pedidos);

    const itensPorConferente = Array.from(somaItensPorConf.entries())
      .map(([conferente, itens]) => ({ conferente, itens }))
      .sort((a, b) => b.itens - a.itens);

    const jornadaPorConferente = Array.from(somaHorasPorConf.entries())
      .map(([conferente, horas]) => ({ conferente, horas: Number(horas.toFixed(2)) }))
      .sort((a, b) => (b.horas ?? 0) - (a.horas ?? 0));

    const pedidosHoraPorConferente = pedidosPorConferente.map(p => {
      const horas = somaHorasPorConf.get(p.conferente) ?? 0;
      const pedidos_hora = horas > 0 ? p.pedidos / horas : 0;
      return { conferente: p.conferente, pedidos_hora: Number(pedidos_hora.toFixed(2)) };
    }).sort((a, b) => b.pedidos_hora - a.pedidos_hora);

    const pedidosPorCidade = Array.from(somaPedidosPorCidade.entries())
      .map(([cidade, pedidos]) => ({ cidade, pedidos }))
      .sort((a, b) => b.pedidos - a.pedidos);

    // ---- filtros (distinct) ----
    const cidadesDistinct = (await prisma.fatoConferencia.findMany({
      select: { cidade: true },
      distinct: ['cidade'],
    }))
      .map(r => r.cidade)
      .filter(Boolean)
      .map(String)
      .sort();

    const conferentesDistinct = (await prisma.fatoConferencia.findMany({
      select: { conferente: true },
      distinct: ['conferente'],
    }))
      .map(r => r.conferente)
      .filter(Boolean)
      .map(String)
      .sort();

    // totais auxiliares
    const jornadaTotal = Array.from(somaHorasPorConf.values()).reduce((a, b) => a + (b ?? 0), 0);
    const pedidosHoraGeral = jornadaTotal > 0 ? Number((totalPedidos / jornadaTotal).toFixed(2)) : 0;

    return NextResponse.json({
      totals: {
        totalPedidos,
        totalItens,
        jornadaTotal: Number(jornadaTotal.toFixed(2)),
        pedidosHoraGeral,
      },
      charts: {
        pedidosPorConferente,
        itensPorConferente,
        jornadaPorConferente,
        pedidosHoraPorConferente,
        pedidosPorCidade,
      },
      filters: {
        cidades: cidadesDistinct,
        conferentes: conferentesDistinct,
      },
    });
  } catch (e: any) {
    console.error('STATS_ERROR', e);
    return NextResponse.json({ error: e?.message ?? 'Erro ao calcular estatísticas' }, { status: 500 });
  }
}
