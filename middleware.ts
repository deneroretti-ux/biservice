import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(_req: NextRequest) {
return NextResponse.next();
}

export const config = {
matcher: [
'/dashboard/:path*',
'/dashboard-rateio/:path*',
'/dashboard-consultor/:path*',
'/dashboard-orcamento/:path*',
'/dashboard-agricola-limao/:path*',
'/dashboard-estoque/:path*',
'/dashboard-estoque/:path*',
'/dashboard-fiscal/:path*',
'/dashboard-franquia/:path*',
'/executivo/:path*',
'/planejamento/:path*',
'/upload/:path*',
'/area/:path*',
'/boti/:path*',
'/login',
],
};
