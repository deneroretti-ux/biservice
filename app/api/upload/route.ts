// app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/**
 * Versão ultra-segura da rota de upload:
 * - Não usa Prisma
 * - Não usa fs
 * - Não depende de requireAuth
 * - Não deixa escapar erro nenhum (sempre responde JSON)
 *
 * OBS: Por enquanto ela NÃO processa a planilha de verdade.
 * Serve só pra:
 *   - não derrubar o build do Vercel
 *   - permitir você testar o resto do sistema
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { ok: false, error: "Arquivo não enviado" },
        { status: 400 }
      );
    }

    // Apenas consome o arquivo para evitar qualquer erro de stream
    try {
      await (file as File).arrayBuffer();
    } catch (e) {
      console.error("Erro lendo arquivo em /api/upload:", e);
    }

    // Resposta "fake" por enquanto, só pra não quebrar o build
    return NextResponse.json({
      ok: true,
      message: "Upload recebido (modo simples, ainda sem processamento no servidor)",
    });
  } catch (e: any) {
    console.error("UPLOAD_FATAL_ERROR:", e);
    // Mesmo em erro, NÃO retornamos 500 pra não derrubar build
    return NextResponse.json(
      {
        ok: false,
        error: "Falha ao processar upload (modo simples)",
      },
      { status: 200 }
    );
  }
}

export async function GET() {
  // Só pra teste rápido no navegador: /api/upload
  return NextResponse.json({
    ok: true,
    message: "API de upload ativa (modo simples)",
  });
}
