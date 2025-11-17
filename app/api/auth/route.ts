import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { user, pass } = body;
  if (user === "admin" && pass === "123") {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("bi_service_auth", "token123", { httpOnly: true, path: "/" });
    return res;
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("bi_service_auth");
  return res;
}
