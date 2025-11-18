import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body as { email?: string; password?: string };

    const envUser = process.env.APP_USER;
    const envPass = process.env.APP_PASS;

    // se não tiver nada no .env, usa esse padrão pra não travar
    const validEmail = envUser ?? "admin@admin.com";
    const validPass = envPass ?? "123456";

    if (email === validEmail && password === validPass) {
      return NextResponse.json({
        ok: true,
        user: { email: validEmail },
        token: "token-falso-exemplo",
      });
    }

    return NextResponse.json(
      { ok: false, error: "Credenciais inválidas" },
      { status: 401 }
    );
  } catch (e: any) {
    console.error("Erro em /api/login:", e);
    return NextResponse.json(
      { ok: false, error: "Erro ao processar login" },
      { status: 500 }
    );
  }
}
