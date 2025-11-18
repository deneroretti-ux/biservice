import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

// helper: tenta importar prisma sem derrubar a rota
async function getPrismaSafe() {
  try {
    const mod = await import("@/lib/db");
    // aqui assumo que exporta "prisma"
    return (mod as any).prisma as any;
  } catch (e) {
    console.error("PRISMA_IMPORT_ERROR em /api/stats:", e);
    return null;
  }
}

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

// payload vazio pra não derrubar o build caso dê erro de DB
function emptyPayload() {
  return {
    totals: {
      totalPedidos: 0,
      totalItens: 0,
      jornadaTotal: 0,
      pedidosHoraGeral: 0,
    },
    charts: {
      pedidosPorConferente: [] as any[],
      itensPorConferente: [] as any[],
      jornadaPorConferente: [] as any[],
      pedidosHoraPorConferente: [] as any[],
      pedidosPorCidade: [] as any[],
    },
    filters: {
      cidades: [] as string[],
      conferentes: [] as string[],
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const prisma = await getPrismaSafe();

    // se não conseguiu importar prisma, volta payload vazio, mas SEM 500
    if (!prisma) {
      return NextResponse.json(emptyPayload());
    }

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const cidadeParam = searchParams.get("cidade") || "";
    const confParam = searchParams.get("conferente") || "";

    const cidade =
      cidadeParam.toLowerCase().startsWith("todo") ? "" : cidadeParam;
    const conferente =
      confParam.toLowerCase().startsWith("todo") ? "" : confParam;

    const where: any = {};
    if (from || to) {
      where.datadia = {};
      if (from) where.datadia.gte = parseDate(from);
      if (to) where.datadia.lte = parseDate(to, true);
    }
    if (cidade) where.cidade = cidade;
    if (conferente) where.conferente = conferente;

    let rows: Row[] = [];
    try {
      rows = await prisma.fatoConferencia.findMany({
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
    } catch (e) {
      console.error("PRISMA_QUERY_ERROR em /api/stats:", e);
      // se der erro de query/DB, não derruba build – volta vazio
      return NextResponse.json(emptyPayload());
    }

    let totalPedidos = 0;
    let totalItens = 0;

    const somaPedidosPorConf = new Map<string, number>();
    const somaItensPorConf = new Map<string, number>();
    const somaPedidosPorCidade = new Map<string, number>();
    const jornadaPorDiaConf = new Map<string, { min: number; max: number }>();

    for (const r of rows) {
      const conf = (r.conferente ?? "—").trim();
      const cid = (r.cidade ?? "—").trim();
      const itens = Number(r.qtditens ?? 0);

      const qtd = Number(r.qtdpedidos);
      const pedidosEff =
        Number.isFinite(qtd) && qtd > 0 ? qtd : itens > 0 ? 1 : 0;

      totalPedidos += pedidosEff;
      totalItens += itens;

      somaPedidosPorConf.set(
        conf,
        (somaPedidosPorConf.get(conf) ?? 0) + pedidosEff
      );
      somaItensPorConf.set(conf, (somaItensPorConf.get(conf) ?? 0) + itens);
      somaPedidosPorCidade.set(
        cid,
        (somaPedidosPorCidade.get(cid) ?? 0) + pedidosEff
      );

      if (r.datadia && r.datahora) {
        const diaStr = r.datadia.toISOString().slice(0, 10);
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

    const somaHorasPorConf = new Map<string, number>();
    for (const [key, mm] of jornadaPorDiaConf.entries()) {
      const [conf] = key.split("__");
      const horasDia = Math.max(0, (mm.max - mm.min) / 3_600_000);
      somaHorasPorConf.set(
        conf,
        (somaHorasPorConf.get(conf) ?? 0) + horasDia
      );
    }

    const pedidosPorConferente = Array.from(somaPedidosPorConf.entries())
      .map(([conferente, pedidos]) => ({ conferente, pedidos }))
      .sort((a, b) => b.pedidos - a.pedidos);

    const itensPorConferente = Array.from(somaItensPorConf.entries())
      .map(([conferente, itens]) => ({ conferente, itens }))
      .sort((a, b) => b.itens - a.itens);

    const jornadaPorConferente = Array.from(somaHorasPorConf.entries())
      .map(([conferente, horas]) => ({
        conferente,
        horas: Number(horas.toFixed(2)),
      }))
      .sort((a, b) => (b.horas ?? 0) - (a.horas ?? 0));

    const pedidosHoraPorConferente = pedidosPorConferente
      .map((p) => {
        const horas = somaHorasPorConf.get(p.conferente) ?? 0;
        const pedidos_hora = horas > 0 ? p.pedidos / horas : 0;
        return {
          conferente: p.conferente,
          pedidos_hora: Number(pedidos_hora.toFixed(2)),
        };
      })
      .sort((a, b) => b.pedidos_hora - a.pedidos_hora);

    const pedidosPorCidade = Array.from(somaPedidosPorCidade.entries())
      .map(([cidade, pedidos]) => ({ cidade, pedidos }))
      .sort((a, b) => b.pedidos - a.pedidos);

    let cidadesDistinct: string[] = [];
    let conferentesDistinct: string[] = [];

    try {
      cidadesDistinct = (
        await prisma.fatoConferencia.findMany({
          select: { cidade: true },
          distinct: ["cidade"],
        })
      )
        .map((r: any) => r.cidade)
        .filter(Boolean)
        .map(String)
        .sort();

      conferentesDistinct = (
        await prisma.fatoConferencia.findMany({
          select: { conferente: true },
          distinct: ["conferente"],
        })
      )
        .map((r: any) => r.conferente)
        .filter(Boolean)
        .map(String)
        .sort();
    } catch (e) {
      console.error("PRISMA_DISTINCT_ERROR em /api/stats:", e);
      // se der erro só nos filtros, mantém arrays vazios
    }

    const jornadaTotal = Array.from(somaHorasPorConf.values()).reduce(
      (a, b) => a + (b ?? 0),
      0
    );
    const pedidosHoraGeral =
      jornadaTotal > 0
        ? Number((totalPedidos / jornadaTotal).toFixed(2))
        : 0;

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
    console.error("STATS_FATAL_ERROR:", e);
    // mesmo em erro "geral", não retornamos 500
    return NextResponse.json(emptyPayload());
  }
}
