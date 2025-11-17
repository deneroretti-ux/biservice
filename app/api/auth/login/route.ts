// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signToken } from '@/lib/withAuth';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    // Ajuste a validação do usuário conforme seu schema
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, role: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      );
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      );
    }

    // Assina com o MESMO segredo usado no requireAuth
    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role ?? 'admin',
    });

    // Define cookie (SameSite=Lax é suficiente para same-site)
    const res = NextResponse.json({ token });

    // HttpOnly false porque você já lê o cookie no cliente;
    // se quiser aumentar a segurança, depois migramos a leitura p/ server.
    res.headers.append(
      'Set-Cookie',
      [
        `token=${token}`,
        'Path=/',
        'Max-Age=604800', // 7 dias
        'SameSite=Lax',
        // 'Secure', // descomente em produção HTTPS
      ].join('; ')
    );

    return res;
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Erro ao autenticar' },
      { status: 500 }
    );
  }
}
