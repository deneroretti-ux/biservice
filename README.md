# Projeto Unificado (Next.js + Prisma) — v0.2

Consolida seu backend (Django) e frontend (React/Vite) em um único app Next.js (TypeScript) com Prisma.

## Rodar (dev)
1. `cp .env.example .env` e ajuste `JWT_SECRET`.
2. `npm i`
3. `npm run prisma:generate`
4. `npm run prisma:migrate`
5. (opcional) `npm run seed` — cria usuário admin (`admin@local` / `admin`)
6. `npm run dev`

## Rotas
- `GET /` — home
- `GET /login` — login
- `GET /area/upload` — upload autenticado (CSV/XLSX)
- `GET /dashboard` — filtros e gráficos
- `POST /api/auth/login` — login (JWT)
- `POST /api/upload` — upload + import
- `GET /api/stats` — métricas (query: `cidade`, `conferente`, `month=YYYY-MM`)

## Modelos (Prisma)
- `User(id, email, name, passwordHash, role, createdAt)`
- `Tenant(id, name)`
- `Upload(id, tenantId?, filePath, createdAt, status, log)`
- `FatoConferencia(id, tenantId?, uploadId, datahora?, datadia?, conferente?, cidade?, endereco?, qtdpedidos=1, qtditens?)`

## Parser de Upload
- Extensões: **.csv**, **.xlsx/.xls**
- Colunas reconhecidas (case-insensitive, variações):
  - `conferente`, `cidade`, `endereco|endereço`
  - `qtdpedidos|qtd_pedidos|qtd`
  - `qtditens|qtd_itens|itens`
  - `datahora|data_hora|timestamp|data`
  - `datadia|data_dia|dia|data`

## Dica (produção)
- Trocar para Postgres: ajuste `DATABASE_URL` (e.g. `postgresql://user:pass@host:5432/db`) e rode `prisma migrate deploy`.
