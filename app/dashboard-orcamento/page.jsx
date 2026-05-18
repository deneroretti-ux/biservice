"use client";

import React, { useMemo, useRef, useState } from "react";
import Image from "next/image";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

/**
 * DASHBOARD ORÇAMENTÁRIO — VISÃO EXECUTIVA (1 tela)
 * - Padrão visual do dashboard-estoque (tema escuro + header/botões)
 * - Uma única tela, focada em decisão: faturamento, resultado, para onde vai o dinheiro e alavancas
 * - Upload local do DRE (.xlsx) para alimentar o painel (DEMO aparece se não carregar arquivo)
 *
 * Requisitos:
 * - npm i xlsx recharts
 */

const C_BLUE = "#3b82f6";
const C_GREEN = "#22c55e";
const C_AMBER = "#f59e0b";
const C_ROSE = "#ef4444";
const C_PURPLE = "#7c3aed";
const C_CYAN = "#06b6d4";
const C_CARD_BORDER = "rgba(255,255,255,0.10)";
const C_CARD_BG = "rgba(255,255,255,0.03)";
const PIE_COLORS = [C_BLUE, C_GREEN, C_AMBER, C_ROSE, C_PURPLE, C_CYAN];

function normalize(str) {
  return String(str || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
function fmtBRL(v) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPct(v) {
  const n = Number(v || 0);
  return (n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
}
function safeDiv(a, b) {
  const A = Number(a || 0);
  const B = Number(b || 0);
  return B ? A / B : 0;
}
function toNumberBR(v) {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (!s) return 0;
  const norm = s.replace(/\./g, "").replace(",", ".");
  const n = Number(norm);
  return Number.isFinite(n) ? n : 0;
}

/** Parse do DRE (coluna B descrição, coluna C valor) */
function parseDRE_AOA(aoa) {
  const rows = (aoa || [])
    .map((r) => ({ desc: r?.[1], val: r?.[2] }))
    .filter((r) => r.desc != null || r.val != null);

  const findRowContains = (needle) => {
    const n = normalize(needle);
    return rows.findIndex((r) => normalize(r.desc).includes(n));
  };

  const readSubtotal = (needle) => {
    const idx = findRowContains(needle);
    if (idx < 0) return null;
    const v = rows[idx]?.val;
    return typeof v === "number" ? v : toNumberBR(v);
  };

  const headers = [
    { key: "receitas_brutas", label: "Receitas Brutas" },
    { key: "deducoes", label: "Deduções" },
    { key: "custos", label: "Custos" },
    { key: "desp_adm", label: "Despesas Administrativas" },
    { key: "desp_vendas", label: "Despesas com Vendas" },
    { key: "desp_fin", label: "Despesas Financeiras" },
    { key: "outras_desp_op", label: "Outras Despesas Operacionais" },
    { key: "rec_fin", label: "Receitas Financeiras" },
    { key: "outras_rec_op", label: "Outras Receitas Operacionais" },
  ];

  const found = headers
    .map((h) => ({
      ...h,
      idx: rows.findIndex(
        (r) =>
          normalize(r.desc) === normalize(h.label) ||
          normalize(r.desc).includes(normalize(h.label))
      ),
    }))
    .filter((h) => h.idx >= 0)
    .sort((a, b) => a.idx - b.idx);

  const sumSection = (start, end) => {
    let total = 0;
    for (let i = start; i <= end; i++) {
      const d = String(rows[i]?.desc ?? "").trim();
      if (d.startsWith("=")) continue;
      const v = rows[i]?.val;
      const n = typeof v === "number" ? v : toNumberBR(v);
      if (!n) continue;
      total += n;
    }
    return total;
  };

  const sums = {};
  for (let i = 0; i < found.length; i++) {
    const cur = found[i];
    const next = found[i + 1];
    const start = cur.idx + 1;
    const end = next ? next.idx - 1 : rows.length - 1;
    sums[cur.key] = sumSection(start, end);
  }

  const receitaLiquidaSub = readSubtotal("= receita liquida");
  const lucroBrutoSub = readSubtotal("= lucro bruto");
  const lucroOperSub = readSubtotal("= lucro operacional");
  const lucroLiqSub = readSubtotal("= lucro liquido");

  const receitaBruta = sums.receitas_brutas ?? 0;
  const deducoes = sums.deducoes ?? 0;
  const receitaLiquida = receitaLiquidaSub ?? (receitaBruta + deducoes);
  const cmv = sums.custos ?? 0;
  const lucroBruto = lucroBrutoSub ?? (receitaLiquida + cmv);

  const despAdm = sums.desp_adm ?? 0;
  const despVendas = sums.desp_vendas ?? 0;
  const despFin = sums.desp_fin ?? 0;
  const outrasDespOp = sums.outras_desp_op ?? 0;
  const recFin = sums.rec_fin ?? 0;
  const outrasRecOp = sums.outras_rec_op ?? 0;

  const lucroOperacional =
    lucroOperSub ??
    (lucroBruto +
      despAdm +
      despVendas +
      despFin +
      outrasDespOp +
      recFin +
      outrasRecOp);

  const lucroLiquido = lucroLiqSub ?? lucroOperacional;

  return {
    ytd: {
      receitaBruta,
      deducoes,
      receitaLiquida,
      cmv,
      lucroBruto,
      despAdm,
      despVendas,
      despFin,
      outrasDespOp,
      recFin,
      outrasRecOp,
      lucroOperacional,
      lucroLiquido,
    },
  };
}

/* ===== UI ===== */
function Card({ title, children, right = null }) {
  return (
    <section
      className="rounded-2xl p-3 shadow-sm"
      style={{ border: `1px solid ${C_CARD_BORDER}`, background: C_CARD_BG }}
    >
      {(title || right) && (
        <div className="flex items-end justify-between gap-2 mb-3">
          {title && <h2 className="text-[13px] font-semibold text-white/90">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

function Kpi({ title, value, color = C_BLUE, raw = false }) {
  const display = raw ? String(value ?? "") : fmtBRL(value);
  return (
    <div
      className="rounded-2xl p-3"
      style={{ border: `1px solid ${C_CARD_BORDER}`, background: C_CARD_BG }}
    >
      <p className="text-[11px] text-white/70">{title}</p>
      <p className="text-lg font-extrabold mt-1 leading-none" style={{ color }}>
        {display}
      </p>
    </div>
  );
}

function Tip({ label, value, color = "rgba(255,255,255,0.85)" }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-white/70">{label}</span>
      <span className="font-semibold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

/* ===== DEMO ===== */
function buildDemoModel() {
  const anual2025 = {
    receitaLiquida: 4200000,
    lucroBruto: 2000000,
    lucroOperacional: 520000,
    lucroLiquido: 430000,
    despAdm: -520000,
    despVendas: -680000,
    despFin: -180000,
    outrasDespOp: -100000,
  };
  const orc2026 = {
    receitaLiquida: 4600000,
    lucroBruto: 2300000,
    lucroOperacional: 620000,
    despAdm: -560000,
    despVendas: -720000,
    despFin: -190000,
    outrasDespOp: -110000,
  };

  const comparativo = [
    { indicador: "Receita Líquida", a2025: anual2025.receitaLiquida, o2026: orc2026.receitaLiquida },
    { indicador: "Lucro Bruto", a2025: anual2025.lucroBruto, o2026: orc2026.lucroBruto },
    { indicador: "Lucro Oper.", a2025: anual2025.lucroOperacional, o2026: orc2026.lucroOperacional },
  ];

  const despesas = [
    { grupo: "Adm", real: Math.abs(anual2025.despAdm) },
    { grupo: "Vendas", real: Math.abs(anual2025.despVendas) },
    { grupo: "Financeiro", real: Math.abs(anual2025.despFin) },
    { grupo: "Outras", real: Math.abs(anual2025.outrasDespOp) },
  ];

  const despesasPie = despesas.map((d) => ({ name: d.grupo, value: d.real }));

  const monthly = Array.from({ length: 12 }).map((_, i) => {
    const rl = 320000 + i * 7000;
    const lo = rl * 0.12;
    return {
      mes: `2025-${String(i + 1).padStart(2, "0")}`,
      rl,
      lo,
      orc_rl: 360000,
      orc_lo: 52000,
    };
  });

  const kpis = {
    rl_ytd: 3450000,
    margem_bruta: 0.48,
    margem_oper: 0.12,
    margem_liq: 0.10,
    adm_pct: 0.14,
    vendas_pct: 0.18,
  };

  return { anual2025, orc2026, comparativo, despesas, despesasPie, monthly, kpis, __demo: true };
}

export default function DashboardOrcamentoExecutivo() {
  const fileRef = useRef(null);

  const [fileName, setFileName] = useState("");
  const [dreParsed, setDreParsed] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  // Premissas executivas
  const [mesesYTD, setMesesYTD] = useState("10");
  const [crescimentoReceita, setCrescimentoReceita] = useState("0.08");
  const [ajusteDespesas, setAjusteDespesas] = useState("0.06");
  const [metaMargemBruta, setMetaMargemBruta] = useState("");

  // Cross-filter (estilo Power BI)
  const [selectedGroup, setSelectedGroup] = useState(null); // "Adm" | "Vendas" | "Financeiro" | "Outras"

  async function onUploadLocal(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setProgress(10);
    setStatus("Lendo XLSX…");
    setFileName(file.name);

    try {
      const buf = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onprogress = (evt) => {
          if (evt.lengthComputable) setProgress(Math.min(95, Math.round((evt.loaded / evt.total) * 100)));
        };
        fr.onload = () => resolve(fr.result);
        fr.onerror = () => reject(fr.error || new Error("Erro ao ler arquivo"));
        fr.readAsArrayBuffer(file);
      });

      setProgress(75);
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.Sheets["DRE"] ? "DRE" : (wb.SheetNames?.[0] || "");
      const ws = wb.Sheets[sheetName];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
      const parsed = parseDRE_AOA(aoa);

      const sanity = Math.abs(parsed?.ytd?.receitaLiquida || 0) + Math.abs(parsed?.ytd?.receitaBruta || 0);
      if (!sanity) throw new Error("DRE sem valores detectáveis (confere colunas B/C).");

      setDreParsed(parsed);
      setProgress(100);
      setStatus("Pronto");
    } catch (err) {
      console.error(err);
      setDreParsed(null);
      setFileName(file.name + " (não lido)");
    } finally {
      setTimeout(() => {
        setIsLoading(false);
        setProgress(0);
        setStatus("");
      }, 500);
    }
  }

  const model = useMemo(() => {
    if (!dreParsed?.ytd) return buildDemoModel();

    const y = dreParsed.ytd;
    const mYTD = Math.max(1, Number(mesesYTD || 10) || 10);
    const anual = (v) => (Number(v || 0) / mYTD) * 12;

    const anual2025 = {
      receitaLiquida: anual(y.receitaLiquida),
      lucroBruto: anual(y.lucroBruto),
      lucroOperacional: anual(y.lucroOperacional),
      lucroLiquido: anual(y.lucroLiquido ?? y.lucroOperacional),
      despAdm: anual(y.despAdm),
      despVendas: anual(y.despVendas),
      despFin: anual(y.despFin),
      outrasDespOp: anual(y.outrasDespOp),
    };

    const g = Number(crescimentoReceita || 0) || 0;
    const infl = Number(ajusteDespesas || 0) || 0;
    const gmTarget = metaMargemBruta === "" ? null : Number(metaMargemBruta);

    const pct = (num) => safeDiv(num, anual2025.receitaLiquida);

    const orc2026 = {};
    orc2026.receitaLiquida = anual2025.receitaLiquida * (1 + g);

    const pctLB = safeDiv(anual2025.lucroBruto, anual2025.receitaLiquida);
    const lbPctFinal = gmTarget != null && !Number.isNaN(gmTarget) ? gmTarget : pctLB;
    orc2026.lucroBruto = orc2026.receitaLiquida * lbPctFinal;

    orc2026.despAdm = orc2026.receitaLiquida * pct(anual2025.despAdm) * (1 + infl);
    orc2026.despVendas = orc2026.receitaLiquida * pct(anual2025.despVendas) * (1 + infl);
    orc2026.despFin = orc2026.receitaLiquida * pct(anual2025.despFin) * (1 + infl);
    orc2026.outrasDespOp = orc2026.receitaLiquida * pct(anual2025.outrasDespOp) * (1 + infl);

    orc2026.lucroOperacional =
      orc2026.lucroBruto +
      (orc2026.despAdm + orc2026.despVendas + orc2026.despFin + orc2026.outrasDespOp);

    const comparativo = [
      { indicador: "Receita Líquida", a2025: anual2025.receitaLiquida, o2026: orc2026.receitaLiquida },
      { indicador: "Lucro Bruto", a2025: anual2025.lucroBruto, o2026: orc2026.lucroBruto },
      { indicador: "Lucro Oper.", a2025: anual2025.lucroOperacional, o2026: orc2026.lucroOperacional },
    ];

    const despesas = [
      { grupo: "Adm", real: Math.abs(y.despAdm) },
      { grupo: "Vendas", real: Math.abs(y.despVendas) },
      { grupo: "Financeiro", real: Math.abs(y.despFin) },
      { grupo: "Outras", real: Math.abs(y.outrasDespOp) },
    ].filter((d) => d.real > 0);

    const despesasPie = despesas.map((d) => ({ name: d.grupo, value: d.real }));

    const rlMonth = y.receitaLiquida / mYTD;
    const loMonth = y.lucroOperacional / mYTD;
    const orcRL = orc2026.receitaLiquida / 12;
    const orcLO = orc2026.lucroOperacional / 12;

    const monthly = Array.from({ length: 12 }).map((_, i) => ({
      mes: `2025-${String(i + 1).padStart(2, "0")}`,
      rl: i < mYTD ? rlMonth : null,
      lo: i < mYTD ? loMonth : null,
      orc_rl: orcRL,
      orc_lo: orcLO,
    }));

    const kpis = {
      rl_ytd: y.receitaLiquida,
      margem_bruta: safeDiv(y.lucroBruto, y.receitaLiquida),
      margem_oper: safeDiv(y.lucroOperacional, y.receitaLiquida),
      margem_liq: safeDiv(y.lucroLiquido ?? y.lucroOperacional, y.receitaLiquida),
      adm_pct: safeDiv(Math.abs(y.despAdm), y.receitaLiquida),
      vendas_pct: safeDiv(Math.abs(y.despVendas), y.receitaLiquida),
    };

    return { anual2025, orc2026, comparativo, despesas, despesasPie, monthly, kpis, __demo: false };
  }, [dreParsed, mesesYTD, crescimentoReceita, ajusteDespesas, metaMargemBruta]);

  const ranking = useMemo(() => {
    const arr = [...(model.despesas || [])];
    return arr.sort((a, b) => b.real - a.real).slice(0, 10);
  }, [model.despesas]);

  const filtered = useMemo(() => {
    if (!selectedGroup) {
      return {
        despesas: model.despesas,
        despesasPie: model.despesasPie,
        comparativo: model.comparativo,
        monthly: model.monthly,
        ranking,
      };
    }

    const despesas = (model.despesas || []).filter((d) => d.grupo === selectedGroup);
    const despesasPie = (model.despesasPie || []).filter((d) => d.name === selectedGroup);
    const ranking2 = (ranking || []).filter((d) => d.grupo === selectedGroup);

    return {
      despesas,
      despesasPie,
      comparativo: model.comparativo,
      monthly: model.monthly,
      ranking: ranking2,
    };
  }, [model, ranking, selectedGroup]);


  return (
    <div className="min-h-screen bg-[#0c1118] text-white">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0c1118]/80 backdrop-blur px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-end justify-between gap-2">
          <div className="flex items-end gap-2">
            <div className="h-9 w-9 rounded-xl overflow-hidden ring-1 ring-sky-500/40 bg-sky-500/10 grid place-items-end">
              <Image src="/logo/logo.png" alt="BI Service" width={80} height={80} priority />
            </div>
            <div className="leading-tight">
              <div className="text-sm text-white/70">BI Service Beta</div>
              <h1 className="text-xl font-bold">
                Dashboard <span style={{ color: C_GREEN }}>Orçamentário</span> — <span className="text-white/80">Executivo</span>
              </h1>
              <div className="text-[11px] text-white/60">
                {model.__demo ? "DEMO (gráficos ilustrativos)" : `Arquivo: ${fileName || "-"}`} • 1 tela
              </div>
            </div>
          </div>

          <div className="flex items-end gap-2 no-print">
            <label
              className="inline-flex items-end gap-2 rounded-lg px-3 py-2 text-sm font-medium shadow cursor-pointer"
              style={{ background: C_GREEN }}
              title="Upload do DRE (.xlsx)"
            >
              <span>Upload DRE</span>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onUploadLocal} className="hidden" />
            </label>

            <a href="/dashboard-estoque" className="rounded-lg px-3 py-2 text-sm font-medium shadow" style={{ background: C_PURPLE }}>
              Estoque
            </a>
            <a href="/" className="rounded-lg px-3 py-2 text-sm font-medium shadow" style={{ background: C_ROSE }}>
              Sair
            </a>
          </div>
        </div>

        {isLoading && (
          <div className="mt-3 h-1 w-full bg-white/10 rounded">
            <div className="h-1 rounded" style={{ width: `${progress}%`, background: C_GREEN, transition: "width .2s" }} />
          </div>
        )}
      </header>

      {isLoading && (
        <div className="fixed inset-0 z-10 bg-black/60 backdrop-blur-sm grid place-items-end no-print">
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "#0f172a", border: `1px solid ${C_CARD_BORDER}` }}>
            <div className="flex items-end gap-2 mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" className="animate-spin">
                <path fill="currentColor" d="M12 1a11 11 0 1 0 11 11A11.013 11.013 0 0 0 12 1Zm0 19a8 8 0 1 1 8-8a8.009 8.009 0 0 1-8 8Z" />
                <path fill="currentColor" d="M12 4a8 8 0 0 1 8 8h3A11 11 0 0 0 12 1Z" />
              </svg>
              <h2 className="text-lg font-semibold">Processando</h2>
            </div>
            <p className="text-sm text-white/80 mb-3">{status || "Aguarde…"}</p>
            <div className="h-2 w-full bg-white/10 rounded">
              <div className="h-2 rounded" style={{ width: `${progress}%`, background: C_BLUE, transition: "width .2s" }} />
            </div>
          </div>
        </div>
      )}
      <main className="max-w-7xl mx-auto px-6 py-3 space-y-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <div className="min-w-[160px] flex-1">
            <Kpi title="Receita Líquida (YTD)" value={model.kpis.rl_ytd} color={C_GREEN} />
          </div>
          <div className="min-w-[160px] flex-1">
            <Kpi title="Margem Bruta" value={fmtPct(model.kpis.margem_bruta)} raw color={C_BLUE} />
          </div>
          <div className="min-w-[160px] flex-1">
            <Kpi title="Margem Operacional" value={fmtPct(model.kpis.margem_oper)} raw color={C_AMBER} />
          </div>
          <div className="min-w-[160px] flex-1">
            <Kpi title="Margem Líquida" value={fmtPct(model.kpis.margem_liq)} raw color={C_CYAN} />
          </div>
          <div className="min-w-[160px] flex-1">
            <Kpi title="% Adm / RL" value={fmtPct(model.kpis.adm_pct)} raw color={C_PURPLE} />
          </div>
          <div className="min-w-[160px] flex-1">
            <Kpi title="% Vendas / RL" value={fmtPct(model.kpis.vendas_pct)} raw color={C_ROSE} />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs mt-1">
          <span className="text-white/60">Filtro:</span>
          <button
            onClick={() => setSelectedGroup(null)}
            className={`px-2 py-1 rounded-full border ${!selectedGroup ? "bg-sky-500/20 border-sky-400 text-sky-50" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"}`}
            title="Limpar filtro"
          >
            Todos
          </button>
          {["Adm", "Vendas", "Financeiro", "Outras"].map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGroup((cur) => (cur === g ? null : g))}
              className={`px-2 py-1 rounded-full border ${selectedGroup === g ? "bg-emerald-500/20 border-emerald-400 text-emerald-50" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"}`}
              title="Clique para filtrar"
            >
              {g}
            </button>
          ))}
          {selectedGroup && <span className="text-white/50">• clique no mesmo para remover</span>}
        </div>
        {/* Linha 1 (igual ao modelo): Faturamento + Resultado */}
        {/*
          Importante: manter 2 colunas como no modelo em desktop.
          Em telas menores, cai para 1 coluna.
        */}
        <div className="grid grid-cols-2 gap-2 max-[900px]:grid-cols-1">
          <div className="lg:order-1 order-1">
            <Card title="Faturamento — Receita Líquida (Real vs Orçado)">
            <div style={{ height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={filtered.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" />
                  <XAxis dataKey="mes" stroke="rgba(255,255,255,0.7)" />
                  <YAxis stroke="rgba(255,255,255,0.7)" />
                  <Tooltip formatter={(v) => fmtBRL(v)} contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)" }} labelStyle={{ color: "white" }} />
                  <Legend />
                  <Line type="monotone" dataKey="rl" name="Real" stroke={C_GREEN} dot={false} />
                  <Line type="monotone" dataKey="orc_rl" name="Orçado" stroke={C_BLUE} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            </Card>
          </div>
          <div className="lg:order-2 order-2">
            <Card title="Resultado — Lucro Operacional (Real vs Orçado)">
            <div style={{ height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={filtered.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" />
                  <XAxis dataKey="mes" stroke="rgba(255,255,255,0.7)" />
                  <YAxis stroke="rgba(255,255,255,0.7)" />
                  <Tooltip formatter={(v) => fmtBRL(v)} contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)" }} labelStyle={{ color: "white" }} />
                  <Legend />
                  <Line type="monotone" dataKey="lo" name="Real" stroke={C_AMBER} dot={false} />
                  <Line type="monotone" dataKey="orc_lo" name="Orçado" stroke={C_CYAN} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            </Card>
          </div>
        </div>

        {/* Linha 2 (igual ao modelo): Pizza + Comparativo + Ranking */}
        {/*
          Importante: manter 3 colunas como no modelo em desktop.
          Em telas menores, cai para 1 coluna.
        */}
        {/*
          NOTE: manter os 3 gráficos (Para onde vai / Comparativo / Ranking) lado a lado no desktop.
          O breakpoint anterior (1100px) derrubava para 1 coluna em muitas telas.
          Agora só cai para 1 coluna abaixo de 900px.
        */}
        <div style={{ overflowX: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "0.5rem",
              minWidth: 980,
            }}
          >
          <div className="lg:order-1 order-1">
            <Card title="Para onde vai o dinheiro — Despesas por Grupo">
            <div style={{ height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Tooltip formatter={(v) => fmtBRL(v)} contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)" }} labelStyle={{ color: "white" }} />
                  <Legend />
                  <Pie data={filtered.despesasPie.length ? filtered.despesasPie : model.despesasPie} dataKey="value" nameKey="name" innerRadius={62} outerRadius={105} paddingAngle={2}
                    onClick={(entry) => {
                      const name = entry?.name;
                      if (!name) return;
                      setSelectedGroup((cur) => (cur === name ? null : name));
                    }}
                  >
                    {model.despesasPie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            </Card>
          </div>
          <div className="lg:order-2 order-2">
            <Card title="Comparativo — 2025 (anualizado) x 2026 (orçado)">
            <div style={{ height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={filtered.comparativo}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" />
                  <XAxis dataKey="indicador" stroke="rgba(255,255,255,0.7)" />
                  <YAxis stroke="rgba(255,255,255,0.7)" />
                  <Tooltip formatter={(v) => fmtBRL(v)} contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)" }} labelStyle={{ color: "white" }} />
                  <Legend />
                  <Bar dataKey="a2025" name="2025" fill={C_BLUE} />
                  <Bar dataKey="o2026" name="2026 (orçado)" fill={C_GREEN} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            </Card>
          </div>
          <div className="lg:order-3 order-3">
            <Card title="Ranking — maiores gastos (Real)">
            <div style={{ height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={filtered.ranking.length ? filtered.ranking : ranking} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" />
                  <XAxis type="number" stroke="rgba(255,255,255,0.7)" tickFormatter={(v) => `${(Number(v || 0) / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="grupo" stroke="rgba(255,255,255,0.7)" width={110} />
                  <Tooltip formatter={(v) => fmtBRL(v)} contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)" }} labelStyle={{ color: "white" }} />
                  <Legend />
                  <Bar dataKey="real" name="Real (YTD)" fill={C_ROSE}
                    onClick={(data) => {
                      const g = data?.grupo;
                      if (!g) return;
                      setSelectedGroup((cur) => (cur === g ? null : g));
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            </Card>
          </div>
        </div>
        </div>


      </main>
    </div>
  );
}