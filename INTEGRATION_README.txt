BI Service – Integração sem alterar gráficos/cores/botões
=========================================================

Arquivos criados (apenas se não existiam):
- app/api/auth/route.ts
- app/upload/page.tsx

Regras:
- Login obrigatório via cookie 'bi_service_auth'.
- POST /api/auth: login mock (admin/123).
- POST /api/upload: mock de upload.
- Páginas existentes não foram alteradas.
