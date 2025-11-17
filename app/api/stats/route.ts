// app/api/stats/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  // rota propositalmente simples só pra não quebrar o build
  return NextResponse.json({
    ok: true,
    message: "Stats API ativa (dummy)",
  });
}
