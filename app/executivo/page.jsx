"use client";

import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeDollarSign,
  BarChart3,
  Boxes,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Gauge,
  LineChart,
  Megaphone,
  PackageSearch,
  ShoppingBag,
  Target,
  Trophy,
  Users,
} from "lucide-react";

const gold = "#d4a72c";
const gold2 = "#f5c542";
const green = "#22c55e";
const red = "#ef4444";
const blue = "#60a5fa";
const purple = "#a855f7";

function Card({ title, subtitle, children, right, style }) {
  return (
    <section style={{ border: "1px solid rgba(255,255,255,.10)", background: "linear-gradient(145deg, rgba(255,255,255,.075), rgba(255,255,255,.025))", borderRadius: 18, padding: 16, boxShadow: "0 18px 40px rgba(0,0,0,.25)", ...style }}>
      {(title || right) && (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <div>
            {title && <h2 style={{ fontSize: 14, margin: 0, fontWeight: 900, letterSpacing: .5 }}>{title}</h2>}
            {subtitle && <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,.56)", fontSize: 12 }}>{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

function Kpi({ icon: Icon, title, value, desc, color = gold2, href }) {
  const content = (
    <div style={{ border: "1px solid rgba(255,255,255,.10)", background: "linear-gradient(145deg, rgba(255,255,255,.08), rgba(255,255,255,.025))", borderRadius: 18, padding: 16, minHeight: 120, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: "auto -30px -40px auto", width: 110, height: 110, borderRadius: 999, background: color, opacity: .10, filter: "blur(6px)" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", background: `${color}22`, border: `1px solid ${color}55` }}><Icon size={22} color={color} /></div>
        <ArrowUpRight size={18} color="rgba(255,255,255,.42)" />
      </div>
      <div style={{ marginTop: 14, color: "rgba(255,255,255,.58)", fontSize: 11, fontWeight: 800, letterSpacing: .7 }}>{title}</div>
      <div style={{ marginTop: 5, fontSize: 26, fontWeight: 950, letterSpacing: -.6 }}>{value}</div>
      <div style={{ marginTop: 4, color, fontSize: 12, fontWeight: 800 }}>{desc}</div>
    </div>
  );
  if (!href) return content;
  return <Link href={href} style={{ color: "inherit", textDecoration: "none" }}>{content}</Link>;
}

function Filter({ label, value }) {
  return (
    <div style={{ minWidth: 160, flex: 1 }}>
      <div style={{ color: "rgba(255,255,255,.52)", fontSize: 10, fontWeight: 800, letterSpacing: .8, marginBottom: 6 }}>{label}</div>
      <div style={{ height: 42, borderRadius: 12, border: "1px solid rgba(255,255,255,.12)", background: "rgba(0,0,0,.25)", display: "flex", alignItems: "center", padding: "0 12px", fontSize: 13 }}>{value}</div>
    </div>
  );
}

const bars = [
  ["Centro", 94], ["Shopping", 88], ["Colina", 76], ["Pitangueiras", 73], ["Viradouro", 69], ["VD", 63], ["Monte Azul", 58],
];

const modules = [
  { title: "Comercial / Consultores", desc: "Ticket médio, PA, sellout, campanhas, ranking e metas por vendedor.", href: "/bi-service/dashboard-consultor", icon: Users, color: green },
  { title: "Estoque / Ruptura", desc: "Cobertura, estoque mínimo, plano de compra, transferência e produtos críticos.", href: "/bi-service/dashboard-estoque", icon: PackageSearch, color: blue },
  { title: "Financeiro / DRE", desc: "Rateio, despesas, orçamento, execução, DRE e comparativos por loja.", href: "/bi-service/dashboard-rateio", icon: CircleDollarSign, color: gold2 },
  { title: "Operação / Conferente", desc: "Pedidos, itens, jornada, produtividade e ranking operacional.", href: "/bi-service/dashboard", icon: Boxes, color: purple },
];

export default function ExecutivoPage() {
  return (
    <div style={{ padding: 22 }}>
      <header style={{ minHeight: 72, borderBottom: "1px solid rgba(255,255,255,.08)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 950, letterSpacing: .3 }}>DASHBOARD EXECUTIVO</h1>
          <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,.62)", fontSize: 13 }}>Visão unificada da franquia: comercial, estoque, financeiro e operação.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "rgba(255,255,255,.72)", fontSize: 12 }}>
          <CalendarDays size={18} color={gold2} /> Atualizado hoje • modo local
        </div>
      </header>

      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Filter label="EMPRESA" value="Todas" />
          <Filter label="LOJA / PDV" value="Todas" />
          <Filter label="PERÍODO" value="Mês atual" />
          <Filter label="CONSULTOR" value="Todos" />
          <Filter label="CAMPANHA" value="Todas" />
          <Filter label="STATUS" value="Todos" />
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(150px, 1fr))", gap: 12, marginBottom: 18 }}>
        <Kpi icon={BadgeDollarSign} title="FATURAMENTO" value="R$ 2,45M" desc="Meta x realizado" color={gold2} href="/bi-service/dashboard-consultor#sellout" />
        <Kpi icon={Gauge} title="TICKET MÉDIO" value="R$ 315" desc="Indicador comercial" color={green} href="/bi-service/dashboard-consultor#ticket-medio" />
        <Kpi icon={ShoppingBag} title="PA" value="2,18" desc="Itens por boleto" color={blue} href="/bi-service/dashboard-consultor#pa" />
        <Kpi icon={Target} title="META" value="72,5%" desc="Atingimento mês" color={purple} href="/bi-service/dashboard-consultor#metas" />
        <Kpi icon={PackageSearch} title="RUPTURA" value="45" desc="Produtos críticos" color={red} href="/bi-service/dashboard-estoque#ruptura" />
        <Kpi icon={CircleDollarSign} title="DRE" value="R$ 460k" desc="Lucro estimado" color={gold} href="/bi-service/dashboard-rateio#dre" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.25fr .85fr .9fr", gap: 14, marginBottom: 14 }}>
        <Card title="COMPARATIVO ENTRE LOJAS" subtitle="Atingimento consolidado por unidade" right={<BarChart3 size={20} color={gold2} />}>
          <div style={{ display: "grid", gap: 12 }}>
            {bars.map(([name, pct]) => (
              <div key={name} style={{ display: "grid", gridTemplateColumns: "110px 1fr 46px", gap: 10, alignItems: "center" }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.72)" }}>{name}</div>
                <div style={{ height: 12, borderRadius: 999, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${gold}, ${gold2})`, boxShadow: "0 0 18px rgba(245,197,66,.28)" }} />
                </div>
                <div style={{ textAlign: "right", fontSize: 12, fontWeight: 900 }}>{pct}%</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="ALERTAS DE GESTÃO" subtitle="Pontos que precisam de ação" right={<AlertTriangle size={20} color={red} />}>
          <div style={{ display: "grid", gap: 10 }}>
            {["Loja abaixo de 70% da meta", "PA abaixo do mínimo esperado", "Produtos com risco de ruptura", "Despesas próximas do orçamento"].map((x, i) => (
              <div key={x} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, background: i === 0 ? "rgba(239,68,68,.10)" : "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.08)", fontSize: 12 }}>
                {i === 0 ? <AlertTriangle size={17} color={red} /> : <CheckCircle2 size={17} color={green} />}
                {x}
              </div>
            ))}
          </div>
        </Card>

        <Card title="MÓDULOS PRONTOS" subtitle="Atalhos para suas pages atuais" right={<Trophy size={20} color={gold2} />}>
          <div style={{ display: "grid", gap: 10 }}>
            {modules.map((m) => {
              const Icon = m.icon;
              return (
                <Link key={m.title} href={m.href} style={{ color: "#fff", textDecoration: "none", display: "flex", gap: 10, alignItems: "center", padding: 10, borderRadius: 12, background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.08)" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: `${m.color}22`, border: `1px solid ${m.color}55` }}><Icon size={18} color={m.color} /></div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900 }}>{m.title}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,.52)", marginTop: 2 }}>{m.desc}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(220px, 1fr))", gap: 14 }}>
        <Card title="TICKET / PA" subtitle="Comercial" right={<Gauge size={19} color={green} />}>
          <div style={{ fontSize: 34, fontWeight: 950 }}>R$ 315 <span style={{ fontSize: 16, color: "rgba(255,255,255,.46)" }}>/ 2,18 PA</span></div>
          <p style={{ color: "rgba(255,255,255,.58)", fontSize: 12 }}>Abrir módulo consultor para detalhe por vendedor.</p>
        </Card>
        <Card title="CAMPANHAS" subtitle="Boleto promocional e turbinado" right={<Megaphone size={19} color={purple} />}>
          <div style={{ fontSize: 34, fontWeight: 950 }}>68%</div>
          <p style={{ color: "rgba(255,255,255,.58)", fontSize: 12 }}>Performance de campanhas dentro da page consultor.</p>
        </Card>
        <Card title="ESTOQUE" subtitle="Ruptura e cobertura" right={<PackageSearch size={19} color={blue} />}>
          <div style={{ fontSize: 34, fontWeight: 950 }}>465</div>
          <p style={{ color: "rgba(255,255,255,.58)", fontSize: 12 }}>Itens monitorados no módulo estoque.</p>
        </Card>
        <Card title="EVOLUÇÃO" subtitle="Tendência mensal" right={<LineChart size={19} color={gold2} />}>
          <div style={{ fontSize: 34, fontWeight: 950 }}>+18,6%</div>
          <p style={{ color: "rgba(255,255,255,.58)", fontSize: 12 }}>Comparativo mês atual contra anterior.</p>
        </Card>
      </div>
    </div>
  );
}
