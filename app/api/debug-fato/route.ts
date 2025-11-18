import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

async function getPrismaSafe() {
  try {
    const mod = await import("@/lib/db");
    return (mod as any).prisma as any;
  } catch (e) {
    console.error("PRISMA_IMPORT_ERROR em /api/debug-fato:", e);
    return null;
  }
}

export async function GET(_req: NextRequest) {
  try {
    const prisma = await getPrismaSafe();
    if (!prisma) {
      return NextResponse.json({
        ok: false,
        error: "Sem prisma/DB em produção",
      });
    }

    const total = await prisma.fatoConferencia.count();
    const sample = await prisma.fatoConferencia.findMany({
      take: 5,
      orderBy: { id: "desc" },
      select: {
        id: true,
        conferente: true,
        cidade: true,
        qtdpedidos: true,
        qtditens: true,
        datadia: true,
      },
    });

    return NextResponse.json({
      ok: true,
      total,
      sample,
    });
  } catch (e: any) {
    console.error("DEBUG_FATO_ERROR:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Erro desconhecido" },
      { status: 200 }
    );
  }
}
