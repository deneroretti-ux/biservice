import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    // 🔐 Aqui entra sua validação de login
    // Se já tinha validação antes, copie a lógica pra cá
    if (
      email === process.env.APP_USER &&
      password === process.env.APP_PASS
    ) {
      return NextResponse.json({ ok: true, token: "token-falso-exemplo" });
    }

    return NextResponse.json(
      { ok: false, error: "Credenciais inválidas" },
      { status: 401 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Erro ao processar login" },
      { status: 500 }
    );
  }
}
