// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Regras:
 * - /dashboard e /area/* exigem estar logado (cookie "token")
 * - /login redireciona para /dashboard se já estiver logado
 * - Demais rotas passam direto
 *
 * Observação:
 * O backend (rotas /api/...) já valida com requireAuth, então
 * não bloqueamos /api/ aqui para evitar quebrar chamadas públicas.
 */
export function middleware(req: NextRequest) {
  const token = req.cookies.get('token')?.value || '';
  const { pathname } = req.nextUrl;

  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/area');

  // bloquear rotas protegidas sem token
  if (isProtected && !token) {
    const url = new URL('/login', req.url);
    return NextResponse.redirect(url);
  }

  // evitar ir para /login quando já logado
  if (pathname === '/login' && token) {
    const url = new URL('/dashboard', req.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

/**
 * O matcher define quais rotas passam pelo middleware.
 * - Protegemos /dashboard/* e /area/* e também observamos /login para redirecionar quando já logado.
 * - NÃO incluímos /api para não interferir nas APIs (o backend já valida via requireAuth).
 */
export const config = {
  matcher: ['/dashboard/:path*', '/area/:path*', '/login'],
};
