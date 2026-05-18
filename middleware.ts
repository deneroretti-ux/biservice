// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Regras:
 * - Dashboards, uploads, área interna, planejamento e rotas /boti exigem estar logado
 * - Usa cookie "token" salvo no login
 * - /login redireciona para /dashboard se já estiver logado
 * - APIs não são bloqueadas aqui para não quebrar chamadas públicas
 */
export function middleware(req: NextRequest) {
  const token = req.cookies.get('token')?.value || '';
  const { pathname } = req.nextUrl;

  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/dashboard-rateio') ||
    pathname.startsWith('/dashboard-consultor') ||
    pathname.startsWith('/dashboard-orcamento') ||
    pathname.startsWith('/dashboard-agricola-limao') ||
    pathname.startsWith('/dashboard-estoque') ||
    pathname.startsWith('/planejamento') ||
    pathname.startsWith('/upload') ||
    pathname.startsWith('/area') ||
    pathname.startsWith('/boti');

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
 * Não incluímos /api para não interferir nas APIs.
 */
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/dashboard-rateio/:path*',
    '/dashboard-consultor/:path*',
    '/dashboard-orcamento/:path*',
    '/dashboard-agricola-limao/:path*',
    '/dashboard-estoque/:path*',
    '/planejamento/:path*',
    '/upload/:path*',
    '/area/:path*',
    '/boti/:path*',
    '/login',
  ],
};
