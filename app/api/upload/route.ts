// app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

// Versão mínima e segura da rota de upload
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { ok: false, error: "Arquivo não enviado" },
        { status: 400 }
      );
    }

    // Aqui você pode implementar a lógica real depois:
    // - salvar em /tmp
    // - processar CSV/Excel
    // - mandar pra algum serviço
    // Por enquanto, só responde que deu certo.
    return NextResponse.json({ ok: true, message: "Upload recebido (dummy)" });
  } catch (e: any) {
    console.error("Erro em /api/upload:", e);
    return NextResponse.json(
      { ok: false, error: "Erro ao processar upload" },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Só pra garantir que, se o Next tentar acessar, não quebra.
  return NextResponse.json({
    ok: true,
    message: "Upload API ativa (GET)",
  });
}
