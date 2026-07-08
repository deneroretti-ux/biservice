"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Calculator,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Gauge,
  LineChart,
  LogOut,
  Menu,
  MonitorUp,
  Settings,
  Target,
  TrendingUp,
  Trophy,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";

const MENU = [
  { label: "Executivo", href: "/executivo", icon: Gauge, group: "Visão Geral" },
  { label: "Ticket Médio", href: "/dashboard-consultor#ticket", icon: WalletCards, group: "Comercial" },
  { label: "PA", href: "/dashboard-consultor#pa", icon: BarChart3, group: "Comercial" },
  { label: "Meta", href: "/dashboard-consultor#metas", icon: Target, group: "Comercial" },
  { label: "Sellout", href: "/dashboard-consultor#sellout", icon: TrendingUp, group: "Comercial" },
  { label: "Consultores", href: "/dashboard-consultor#consultores", icon: Users, group: "Comercial" },
  { label: "Campanhas", href: "/dashboard-consultor#campanhas", icon: Zap, group: "Comercial" },
  { label: "Evolução mensal", href: "/dashboard-consultor#evolucao", icon: LineChart, group: "Comercial" },
  { label: "Ranking", href: "/dashboard-consultor#ranking", icon: Trophy, group: "Comercial" },
  { label: "Metas por vendedor", href: "/dashboard-consultor#metas-vendedor", icon: Target, group: "Comercial" },
  { label: "Estoque / Ruptura", href: "/dashboard-estoque", icon: Boxes, group: "Operação" },
  { label: "Conferente", href: "/dashboard-conferente", icon: ClipboardCheck, group: "Operação" },
  { label: "DRE / Rateio", href: "/dashboard-rateio", icon: Calculator, group: "Financeiro" },
  { label: "Margem", href: "/dashboard-rateio#margem", icon: BarChart3, group: "Financeiro" },
  { label: "Comparativo lojas", href: "/dashboard-rateio#comparativo", icon: MonitorUp, group: "Gestão" },
  { label: "Configurações", href: "/configuracoes", icon: Settings, group: "Sistema" },
];

function sameRoute(pathname, href) {
  const base = href.split("#")[0];
  return pathname === base || pathname?.startsWith(`${base}/`);
}

function MenuItem({ item, collapsed }) {
  const pathname = usePathname();
  const active = sameRoute(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={item.label}
      className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all duration-200 ${
        active
          ? "border-amber-400/40 bg-gradient-to-r from-amber-500/25 to-yellow-500/10 text-white shadow-[0_0_22px_rgba(245,158,11,.18)]"
          : "border-transparent text-white/68 hover:border-white/10 hover:bg-white/[.045] hover:text-white"
      } ${collapsed ? "justify-center px-2" : ""}`}
    >
      <Icon size={19} className={active ? "text-amber-300" : "text-white/58 group-hover:text-white"} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function Sidebar({ collapsed, setCollapsed }) {
  const groups = useMemo(() => {
    return MENU.reduce((acc, item) => {
      acc[item.group] = acc[item.group] || [];
      acc[item.group].push(item);
      return acc;
    }, {});
  }, []);

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen border-r border-amber-400/15 bg-[#050505] shadow-2xl transition-all duration-300 ${
        collapsed ? "w-[76px]" : "w-[264px]"
      }`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_8%,rgba(245,158,11,.22),transparent_28%),linear-gradient(180deg,rgba(255,255,255,.04),transparent_32%)]" />
      <div className="relative flex h-full flex-col">
        <div className={`flex items-center gap-3 border-b border-white/10 px-4 py-5 ${collapsed ? "justify-center" : ""}`}>
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/30 to-yellow-700/10 shadow-[0_0_25px_rgba(245,158,11,.22)]">
            <BarChart3 className="text-amber-300" size={23} />
          </div>
          {!collapsed && (
            <div>
              <div className="text-lg font-black tracking-wide text-white">BI SERVICE</div>
              <div className="text-[11px] font-semibold uppercase tracking-[.24em] text-amber-300">Franquia Edition</div>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4 [scrollbar-width:thin]">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              {!collapsed && <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[.22em] text-white/35">{group}</div>}
              <div className="space-y-1.5">
                {items.map((item) => <MenuItem key={`${item.group}-${item.label}`} item={item} collapsed={collapsed} />)}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.035] px-3 py-2 text-sm text-white/70 hover:bg-white/[.065] hover:text-white"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!collapsed && "Recolher menu"}
          </button>
          <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-200">
            <LogOut size={17} /> {!collapsed && "Sair"}
          </button>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ collapsed, title }) {
  const [now, setNow] = useState("");

  useEffect(() => {
    const update = () => setNow(new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }));
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header
      className={`fixed right-0 top-0 z-30 h-[72px] border-b border-amber-400/15 bg-[#060606]/90 backdrop-blur-xl transition-all duration-300 ${
        collapsed ? "left-[76px]" : "left-[264px]"
      }`}
    >
      <div className="flex h-full items-center justify-between px-6">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wide text-white">{title || "Dashboard Executivo"}</h1>
          <p className="text-xs text-white/55">Gestão comercial, estoque, financeiro e operação em uma navegação única</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-white/60">
          <span>Atualizado em: <b className="text-white/85">{now}</b></span>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-bold text-emerald-300">ONLINE</span>
        </div>
      </div>
    </header>
  );
}

export default function UnifiedShell({ children, title }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("bi_service_sidebar_collapsed");
      if (saved === "1") setCollapsed(true);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("bi_service_sidebar_collapsed", collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <Topbar collapsed={collapsed} title={title} />
      <main
        className={`min-h-screen pt-[88px] transition-all duration-300 ${collapsed ? "ml-[76px]" : "ml-[264px]"}`}
      >
        <div className="mx-auto w-full max-w-[1800px] px-5 pb-6">{children}</div>
      </main>
    </div>
  );
}
