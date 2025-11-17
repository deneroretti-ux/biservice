// lib/withAuth.ts
import { NextRequest } from 'next/server';
import jwt, { JwtPayload } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';

export type AuthPayload = JwtPayload & {
  id?: number | string;
  email?: string;
  role?: string;
};

/** Extrai token do header Authorization (Bearer ...) ou do cookie `token`. */
export function getTokenFromRequest(req: NextRequest): string | null {
  // Header: Authorization / authorization
  const authHeader =
    req.headers.get('authorization') || req.headers.get('Authorization');

  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const t = authHeader.slice(7).trim();
    if (t) return t;
  }

  // Cookie: token
  const cookieToken = req.cookies.get('token')?.value?.trim();
  if (cookieToken) return cookieToken;

  return null;
}

/** Valida o JWT e retorna o payload ou null. */
export function verifyToken(token: string | null): AuthPayload | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    return payload || null;
  } catch {
    return null;
  }
}

/**
 * Principal helper usado nas rotas API:
 * Retorna o payload autenticado ou null (para você responder 401).
 *
 * Exemplo:
 *   const auth = requireAuth(req);
 *   if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 */
export function requireAuth(req: NextRequest): AuthPayload | null {
  const token = getTokenFromRequest(req);
  return verifyToken(token);
}

/** Conveniência: retorna o id do usuário autenticado (se houver). */
export function getAuthUserId(req: NextRequest): string | number | null {
  const auth = requireAuth(req);
  return auth?.id ?? null;
}

/**
 * (Opcional) Assina um novo token para login.
 * Você já tem isso no seu endpoint de login, mas deixo aqui caso queira padronizar.
 */
export function signToken(
  payload: object,
  maxAgeSeconds = 60 * 60 * 24 * 7 // 7 dias
): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: maxAgeSeconds });
}
