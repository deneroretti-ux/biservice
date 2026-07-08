"use client";

import Link from "next/link";
import { BarChart3, Boxes, Calculator, ClipboardCheck, Target, TrendingUp, Trophy, Users, WalletCards, Zap } from "lucide-react";

const cards = [
  { title: "Ticket Médio", value: "Dashboard Consultor", href: "/dashboard-consultor#ticket", icon: WalletCards, text: "Boleto médio, evolução e ranking por consultor." },
  { title: "PA", value: "Itens por boleto", href: "/dashboard-consultor#pa", icon: BarChart3, text: "Quantidade de itens, boletos e produtividade comercial." },
  { title: "Metas", value: "Realizado vs Meta", href: "/dashboard-consultor#metas", icon: Target, text: "Acompanhamento comercial por vendedor e loja." },
  { title: "Sellout", value: "Receita e boletos", href: "/dashboard-consultor#sellout", icon: TrendingUp, text: "Venda, boletos, itens e evolução mensal." },
  { title: "Consultores", value: "Performance", href: "/dashboard-consultor#consultores", icon: Users, text: "Ranking, score, campanhas e fidelidade." },
  { title: "Campanhas", value: "Promoções", href: "/dashboard-consultor#campanhas", icon: Zap, text: "Boleto promocional, turbinado, resgates e conversões." },
  { title: "Ruptura", value: "Estoque", href: "/dashboard-estoque", icon: Boxes, text: "Mínimo, cobertura, compra e transferência." },
  { title: "DRE", value: "Financeiro", href: "/dashboard-rateio", icon: Calculator, text: "Despesas, orçamento, plano de contas e execução." },
  { title: "Operação", value: "Conferente", href: "/dashboard-conferente", icon: ClipboardCheck, text: "Pedidos, itens, jornada e produtividade por hora." },
  { title: "Ranking", value: "Lojas / vendedores", href: "/dashboard-consultor#ranking", icon: Trophy, text: "Classificação operacional e comercial." },
];

function Kpi({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4 shadow-xl">
      <div className="text-xs uppercase tracking-[.18em] text-white/45">{label}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-xs text-emerald-300">{sub}</div>
    </div>
  );
}

export default function ExecutivoPage() {
  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-amber-400/20 bg-[radial-gradient(circle_at_20%_0%,rgba(245,158,11,.22),transparent_34%),linear-gradient(135deg,rgba(255,255,255,.07),rgba(255,255,255,.02))] p-5 shadow-2xl">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="text-xs font-bold uppercase tracking-[.24em] text-amber-300">BI Service • Fase 1 Unificação</div>
            <h2 className="mt-2 text-3xl font-black text-white">Hub Executivo da Franquia</h2>
            <p className="mt-1 max-w-3xl text-sm text-white/62">
              Menu único para acessar comercial, consultores, estoque, DRE/rateio, conferente, rankings e comparativos.
            </p>
          </div>
          <Link href="/dashboard-consultor" className="rounded-2xl border border-amber-400/30 bg-amber-400/15 px-5 py-3 text-sm font-bold text-amber-100 hover:bg-amber-400/25">
            Abrir Comercial
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Módulos prontos" value="4" sub="Consultor, Estoque, Rateio/DRE, Conferente" />
        <Kpi label="KPIs mapeados" value="13+" sub="Ticket, PA, Meta, Sellout, Ruptura e mais" />
        <Kpi label="Navegação" value="Única" sub="Sidebar padrão para todo o BI" />
        <Kpi label="Próximo passo" value="Fase 2" sub="Home executiva com dados reais consolidados" />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href} className="group rounded-2xl border border-white/10 bg-white/[.035] p-4 shadow-xl transition hover:border-amber-400/35 hover:bg-amber-400/[.07]">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10 text-amber-300">
                <Icon size={22} />
              </div>
              <div className="text-sm font-black uppercase tracking-wide text-white">{card.title}</div>
              <div className="mt-1 text-xs font-semibold text-amber-300">{card.value}</div>
              <p className="mt-3 text-xs leading-relaxed text-white/55">{card.text}</p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
