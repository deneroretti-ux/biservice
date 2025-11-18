// app/api/stats/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    // lê os filtros (por enquanto não vamos aplicar lógica complexa)
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const cidade = searchParams.get("cidade");
    const conferente = searchParams.get("conferente");

    console.log("Filtros /api/stats:", { from, to, cidade, conferente });

    // =====================================================================
    // 🔹 AQUI VAI A LÓGICA REAL DE CONFERÊNCIA NO FUTURO
    //    (ler arquivo enviado, calcular pedidos, itens, jornada etc.)
    //
    // POR ENQUANTO vamos devolver dados EXEMPLO só pra fazer o dashboard
    // funcionar e você conseguir validar layout e fluxo.
    // =====================================================================

    const conferentes = ["João", "Maria", "Carlos", "Ana", "Pedro"];
    const cidades = ["Bebedouro", "Barretos", "Ribeirão Preto"];

    const pedidosPorConferente = [
      { conferente: "João", pedidos: 120 },
      { conferente: "Maria", pedidos: 95 },
      { conferente: "Carlos", pedidos: 80 },
      { conferente: "Ana", pedidos: 70 },
      { conferente: "Pedro", pedidos: 60 }
    ];

    const itensPorConferente = [
      { conferente: "João", itens: 1500 },
      { conferente: "Maria", itens: 1300 },
      { conferente: "Carlos", itens: 1100 },
      { conferente: "Ana", itens: 900 },
      { conferente: "Pedro", itens: 800 }
    ];

    const jornadaPorConferente = [
      { conferente: "João", horas: 40 },
      { conferente: "Maria", horas: 38 },
      { conferente: "Carlos", horas: 36 },
      { conferente: "Ana", horas: 34 },
      { conferente: "Pedro", horas: 32 }
    ];

    const pedidosHoraPorConferente = [
      { conferente: "João", pedidos_hora: 3.0 },
      { conferente: "Maria", pedidos_hora: 2.6 },
      { conferente: "Carlos", pedidos_hora: 2.3 },
      { conferente: "Ana", pedidos_hora: 2.1 },
      { conferente: "Pedro", pedidos_hora: 1.9 }
    ];

    const pedidosPorCidade = [
      { cidade: "Bebedouro", pedidos: 180 },
      { cidade: "Barretos", pedidos: 90 },
      { cidade: "Ribeirão Preto", pedidos: 135 }
    ];

    const totalPedidos = pedidosPorConferente.reduce((acc, x) => acc + x.pedidos, 0);
    const totalItens = itensPorConferente.reduce((acc, x) => acc + x.itens, 0);
    const jornadaTotal = jornadaPorConferente.reduce((acc, x) => acc + x.horas, 0);
    const pedidosHoraGeral = totalPedidos && jornadaTotal ? +(totalPedidos / jornadaTotal).toFixed(2) : 0;

    const payload = {
      totals: {
        totalPedidos,
        totalItens,
        jornadaTotal,
        pedidosHoraGeral
      },
      charts: {
        pedidosPorConferente,
        itensPorConferente,
        jornadaPorConferente,
        pedidosHoraPorConferente,
        pedidosPorCidade
      },
      filters: {
        cidades,
        conferentes
      }
    };

    return NextResponse.json(payload);
  } catch (e: any) {
    console.error("Erro em /api/stats:", e);
    return NextResponse.json(
      { error: "Erro ao calcular estatísticas" },
      { status: 500 }
    );
  }
}
