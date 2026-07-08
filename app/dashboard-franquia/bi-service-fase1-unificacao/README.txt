FASE 1 — UNIFICAÇÃO BI SERVICE

O que foi criado:
1) components/bi-service/UnifiedShell.jsx
   - Sidebar profissional dark/gold
   - Menu único com os módulos: Ticket Médio, PA, Meta, Sellout, DRE, Margem, Ruptura, Consultores, Campanhas, Evolução mensal, Comparativos, Ranking e Metas por vendedor
   - Topbar com status online e data de atualização
   - Menu recolhível

2) app/(bi-service)/layout.jsx
   - Layout global para envolver as páginas do BI

3) app/(bi-service)/executivo/page.jsx
   - Hub executivo inicial

COMO INSTALAR:

1. Copie a pasta components/bi-service para a raiz do seu projeto.
2. Copie a pasta app/(bi-service) para dentro da pasta app do seu projeto.

IMPORTANTE SOBRE SUAS PAGES ATUAIS:
Para o menu lateral aparecer também dentro das pages antigas, mova suas pastas atuais para dentro de app/(bi-service).

Exemplo:
ANTES:
app/dashboard-consultor/page.jsx
app/dashboard-estoque/page.jsx
app/dashboard-rateio/page.jsx
app/dashboard-conferente/page.tsx

DEPOIS:
app/(bi-service)/dashboard-consultor/page.jsx
app/(bi-service)/dashboard-estoque/page.jsx
app/(bi-service)/dashboard-rateio/page.jsx
app/(bi-service)/dashboard-conferente/page.tsx

No Next.js, a pasta entre parênteses não muda a URL.
Então a URL continua igual:
/dashboard-consultor
/dashboard-estoque
/dashboard-rateio
/dashboard-conferente

NOVA URL CRIADA:
/executivo

ATENÇÃO:
Se alguma página tiver arquivos locais, como JSON, CSS ou imagens importadas por caminho relativo, mova esses arquivos junto com a page.
Exemplo: se dashboard-rateio usa ./plano_depara_oficial.json, esse JSON precisa ficar na mesma pasta da page após mover.

DEPENDÊNCIAS:
Este layout usa lucide-react. Seu projeto já usa lucide-react em várias pages, então provavelmente já está instalado.
Se precisar:
npm install lucide-react

PRÓXIMO PASSO:
Fase 2 — construir a Home Executiva real consolidando dados dos módulos.
