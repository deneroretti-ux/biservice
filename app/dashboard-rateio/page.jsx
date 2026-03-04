"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ResponsiveContainer,
  BarChart,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  LabelList
} from "recharts";

/**
 * Dashboard Rateio — Upload Profissional (Inteligente)
 * - Detecta automaticamente a linha do cabeçalho (mesmo com títulos acima)
 * - Detecta a coluna de VALOR (ex.: Valor Bruto, Valor Rateio, etc.)
 * - Persiste dataset no localStorage
 *
 * Dependência:
 *   npm i xlsx
 */

const C_BLUE = "#3b82f6";
const C_GREEN = "#22c55e";
const C_AMBER = "#f59e0b";
const C_ROSE = "#ef4444";
const C_PURPLE = "#7c3aed";
const C_CYAN = "#06b6d4";
const C_VIOLET = "#8b5cf6";
const C_CARD_BORDER = "rgba(255,255,255,0.10)";
const C_CARD_BG = "rgba(255,255,255,0.03)";
const PIE_COLORS = [C_BLUE, C_GREEN, C_AMBER, C_ROSE, C_PURPLE, C_CYAN, C_VIOLET];

const LS_KEY = "bi_service_rateio_dataset_v2_inteligente";

function Card({ title, children, right = null, className = "", style = undefined }) {
  return (
    <section
      className={`rounded-2xl p-3 shadow-sm ${className}`}
      style={{ border: `1px solid ${C_CARD_BORDER}`, background: C_CARD_BG, ...(style ?? {}) }}
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

function fmtBRL(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPct(p) {
  const n = Number(p || 0);
  return `${n.toFixed(1)}%`;
}


function TooltipRich({ active, payload, label, labelPrefix }) {
  if (!active || !payload || !payload.length) return null;

  const first = payload[0];
  const raw = first?.payload || {};
  const pctLabel = raw?.pctLabel || (typeof raw?.pct === "number" ? `${raw.pct.toFixed(1)}%` : null);
  const cumPctLabel = raw?.cumPctLabel || (typeof raw?.cumPct === "number" ? `${raw.cumPct.toFixed(1)}%` : null);

  return (
    <div className="rounded-xl border border-white/10 bg-[#0c1118] px-3 py-2 shadow-lg">
      {label != null && label !== "" && (
        <div className="text-xs text-white/60 mb-1">
          {labelPrefix ? `${labelPrefix}: ` : ""}
          <span className="text-white/80">{String(label)}</span>
        </div>
      )}

      <div className="space-y-1">
        {payload.map((p, i) => {
          const name = p.name ?? p.dataKey ?? "Valor";
          const color = p.color || p.stroke || p.fill || "#fff";
          const value = typeof p.value === "number" ? fmtBRL(p.value) : String(p.value ?? "");
          const r = p.payload || {};
          const pctRaw = r?.pctLabel || (typeof r?.pct === "number" ? `${r.pct.toFixed(1)}%` : null);
          const showPct = (p.dataKey === "valor" || p.name === "Real");
          const pct = showPct ? pctRaw : null;

          return (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
              <span className="text-white/80 truncate max-w-[220px]">{String(name)}</span>
              <span className="ml-auto font-semibold text-white">
                {value}
              </span>
              {pct && <span className="text-white/60 text-xs w-[56px] text-right">{pct}</span>}
            </div>
          );
        })}
      </div>

      {(pctLabel || cumPctLabel) && (
        <div className="mt-2 pt-2 border-t border-white/10 text-xs text-white/60 flex gap-3">
          {pctLabel && (
            <div>
              %: <span className="text-white/80">{pctLabel}</span>
            </div>
          )}
          {cumPctLabel && (
            <div>
              Acum.: <span className="text-white/80">{cumPctLabel}</span>
            </div>
          )}
        </div>
      )}


      {typeof raw?.budget === "number" && raw.budget > 0 && typeof raw?.valor === "number" && (
        <div className="mt-2 pt-2 border-t border-white/10 text-xs text-white/70">
          <div className="flex items-center gap-2">
            <span className="text-white/60">Previsto:</span>
            <span className="text-white/85 font-medium">{fmtBRL(raw.budget)}</span>
            <span className="ml-auto text-white/60">Dif.:</span>
            <span className={`font-medium ${raw.valor > raw.budget ? "text-rose-200" : "text-emerald-200"}`}>{fmtBRL(raw.valor - raw.budget)}</span>
          </div>
          {(() => {
            const ratio = raw.valor / raw.budget;
            const label = raw.valor > raw.budget ? "Estourado" : ratio >= 0.9 ? "Atenção" : "Dentro";
            const cls = raw.valor > raw.budget ? "border-rose-400/30 bg-rose-500/20 text-rose-200" : ratio >= 0.9 ? "border-amber-400/30 bg-amber-500/20 text-amber-200" : "border-emerald-400/30 bg-emerald-500/20 text-emerald-200";
            return (
              <div className="mt-2 flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-lg border ${cls}`}>{label}</span>
                <span className="text-white/50">Execução:</span>
                <span className="text-white/80 font-medium">{(ratio * 100).toFixed(1)}%</span>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}


function normText(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normKey(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toNumberBR(v) {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v)
    .replace(/\s/g, "")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function toISODate(d) {
  if (d == null || d === "") return null;

  // Excel serial date (days since 1899-12-30)
  // - can arrive as number OR as string ("45658" or "+045658-01")
  const tryExcelSerial = (n) => {
    if (!Number.isFinite(n)) return null;
    if (n > 20000 && n < 90000) {
      const base = Date.UTC(1899, 11, 30);
      const ms = base + n * 86400000;
      const dt = new Date(ms);
      if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
    }
    return null;
  };

  if (typeof d === "number") {
    const iso = tryExcelSerial(d);
    if (iso) return iso;
  }

  if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  const s = String(d).trim();

  // String that looks like Excel serial
  // ex: "45658" or "+045658-01" (buggy formatting from upstream)
  const serialMatch = s.match(/^[+]?0*(\d{5,6})(?:-\d{2})?$/);
  if (serialMatch) {
    const n = Number(serialMatch[1]);
    const iso = tryExcelSerial(n);
    if (iso) return iso;
  }

  // dd/mm/yyyy
  const m = s.match(/^([0-3]?\d)\/([0-1]?\d)\/(\d{4})$/);
  if (m) {
    const dd = String(m[1]).padStart(2, "0");
    const mm = String(m[2]).padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // yyyy-mm-dd
  const m2 = s.match(/^(\d{4})-([0-1]?\d)-([0-3]?\d)$/);
  if (m2) {
    const yyyy = m2[1];
    const mm = String(m2[2]).padStart(2, "0");
    const dd = String(m2[3]).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return null;
}


const MESES_LABEL = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
function mesIndexFromISO(iso){
  if(!iso || iso === "(sem data)") return -1;
  const p = String(iso).split("-");
  if(p.length<2) return -1;
  return Number(p[1]) - 1;
}

function monthKey(iso) {
  if (!iso || iso === "(sem data)") return "(sem data)";
  const [y, m] = String(iso).split("-");
  if (!y || !m) return "(sem data)";
  return `${y}-${m}`;
}

const ALIASES = {
  data: ["vencimento", "data", "dt_venc", "dtvenc", "dt vencimento", "vcto", "dt_vcto", "dt. vencimento"],
  competencia: ["competencia", "competência", "comp", "dt_comp", "dt competencia", "referencia", "referência", "ref"],
  plano: ["plano de contas", "plano", "conta gerencial", "categoria", "grupo"],
  conta: ["conta", "conta contabil", "conta contábil", "codconta", "codigo conta", "c.c", "cc"],
  empresa: ["empresa", "filial", "loja", "pdv", "unidade"],
  fornecedor: ["fornecedor", "beneficiario", "beneficiário", "favorecido", "cliente/fornecedor", "razao social", "razão social"],
  meioPagamento: ["meio pagamento", "forma pagamento", "pagamento", "forma"],
  tipoDocumento: ["tipo documento", "documento", "tipo", "tp documento"],
  status: ["status", "situação", "situacao"],
  valor: [
    "valor bruto",
    "vlr bruto",
    "valorbruto",
    "vlrbruto",
    "valor rateio",
    "valor total",
    "valor pago",
    "valor_liquido",
    "vlr_liquido",
    "valor",
    "vlr",
  ],
};

function getByAliases(obj, aliases) {
  if (!obj) return undefined;
  const keys = Object.keys(obj);

  for (const a of aliases) {
    const na = normText(a);
    const k = keys.find((kk) => normText(kk) === na);
    if (k != null) return obj[k];
  }
  for (const a of aliases) {
    const na = normText(a);
    const k = keys.find((kk) => normText(kk).includes(na));
    if (k != null) return obj[k];
  }
  return undefined;
}

function normalizeRow(raw, idx) {
  const dataISO = toISODate(getByAliases(raw, ALIASES.data)); // Vencimento (coluna G)
  const compISO = toISODate(getByAliases(raw, ALIASES.competencia));

  const plano = String(getByAliases(raw, ALIASES.plano) ?? "(sem plano)").trim() || "(sem plano)";
  const conta = String(getByAliases(raw, ALIASES.conta) ?? "(sem conta)").trim() || "(sem conta)";
  const empresa = String(getByAliases(raw, ALIASES.empresa) ?? "(sem empresa)").trim() || "(sem empresa)";
  const fornecedor = String(getByAliases(raw, ALIASES.fornecedor) ?? "(sem fornecedor)").trim() || "(sem fornecedor)";
  const status = String(getByAliases(raw, ALIASES.status) ?? "(sem status)").trim() || "(sem status)";

  // ------------------------
  // VALOR (R$) - robusto
  // ------------------------
  const rawValor = getByAliases(raw, ALIASES.valor);
  let valor = rawValor;

  // Prioridade: número do Excel (ideal)
  if (typeof valor === "number" && Number.isFinite(valor)) {
    // ok
  } else if (typeof valor === "string") {
    let s = valor.replace(/R\$/g, "").trim();

    // padrão BR: 1.234.567,89
    if (s.includes(",") && s.includes(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (s.includes(",") && !s.includes(".")) {
      s = s.replace(",", ".");
    }

    s = s.replace(/[^\d.-]/g, "");
    valor = Number(s);
  } else {
    valor = Number(valor);
  }

  if (typeof valor !== "number" || !Number.isFinite(valor)) valor = 0;

  return {
    id: `${idx}`,
    data: dataISO,
    competencia: compISO,
    plano,
    conta,
    empresa,
    fornecedor,
    status,
    valor,
  };
}

function bestValueColumnName(headers) {
  const hs = headers.map((h) => String(h ?? ""));
  const n = hs.map(normText);

  const prefer = ["valor bruto", "vlr bruto", "valorbruto", "vlrbruto"];
  for (const p of prefer) {
    const i = n.findIndex((x) => x === normText(p) || x.includes(normText(p)));
    if (i >= 0) return hs[i];
  }
  for (const a of ALIASES.valor) {
    const na = normText(a);
    const i = n.findIndex((x) => x === na || x.includes(na));
    if (i >= 0) return hs[i];
  }
  return null;
}

function getByAliasesWithKey(obj, aliases) {
  for (const a of aliases) {
    const key = Object.keys(obj).find((k) => normKey(k) === normKey(a));
    if (key != null) return { key, value: obj[key] };
  }
  return { key: null, value: null };
}


function scoreHeaderRow(headers) {
  const hs = headers.map((h) => String(h ?? ""));
  const n = hs.map(normText);

  const hasTipo = n.some((x) => x === "tipo");
  const hasEmpresa = n.some((x) => x.includes("empresa"));
  const hasCompetencia = n.some((x) => x.includes("compet"));
  const hasPlano = n.some((x) => x.includes("plano") && x.includes("cont"));
  const hasConta = n.some((x) => x.includes("conta"));
  const hasVenc = n.some((x) => x.includes("venc"));
  const hasFornecedor = n.some((x) => x.includes("fornec") || x.includes("favorec") || x.includes("benefic") || x.includes("razao") || x.includes("cliente"));

  const valCol = bestValueColumnName(hs);

  let score = 0;
  if (valCol) score += 8;
  if (hasVenc) score += 5;
  if (hasCompetencia) score += 3;
  if (hasEmpresa) score += 2;
  if (hasPlano) score += 2;
  if (hasConta) score += 1;
  if (hasFornecedor) score += 1;
  if (hasTipo) score += 1;

  // Penaliza linhas de "filtro" que têm "Valor Bruto:" mas não são cabeçalho da tabela
  if (valCol && !hasVenc) score -= 6;

  return { score, valCol };
}

async function parseXlsxSmart(file) {
  const mod = await import("xlsx");
  const XLSX = mod.default ?? mod;

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames?.[0];
  const ws = wb.Sheets?.[sheetName];
  if (!ws) throw new Error("Planilha vazia ou inválida.");

  // Matriz completa das primeiras linhas (mantém colunas e evita header errado)
  const matrix = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    raw: true,
      });

  const norm = (s) =>
    String(s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const MUST = ["vencimento", "valor bruto", "competencia"];
  const NICE = ["plano", "conta", "fornecedor", "empresa", "status", "liquidacao", "emissao"];

  function scoreRow(row) {
    const cells = (row || []).map((c) => norm(c));
    if (!cells.length) return -999;

    const hasColon = cells.some((c) => c.includes(":"));
    const nonEmpty = cells.filter(Boolean).length;

    let score = 0;
    let mustHits = 0;

    for (const k of MUST) {
      const hit = cells.some((c) => c === k || c.includes(k));
      if (hit) {
        score += 10;
        mustHits += 1;
      }
    }
    for (const k of NICE) if (cells.some((c) => c === k || c.includes(k))) score += 2;

    if (mustHits < 2) score -= 50;
    score += Math.min(12, nonEmpty);
    if (hasColon) score -= 15;

    return score;
  }

  let bestIdx = 0;
  let bestScore = -1e9;
  const maxScan = Math.min(80, matrix.length);

  for (let i = 0; i < maxScan; i++) {
    const sc = scoreRow(matrix[i]);
    if (sc > bestScore) {
      bestScore = sc;
      bestIdx = i;
    }
  }

  const header = (matrix[bestIdx] || []).map((h) => String(h ?? "").trim());
  console.log("[rateio] headerRow", { idx: bestIdx, score: bestScore, header: header.slice(0, 20) });

  const dataMatrix = matrix
    .slice(bestIdx + 1)
    .filter((r) => (r || []).some((c) => String(c ?? "").trim() !== ""));

  const out = [];
  for (let i = 0; i < dataMatrix.length; i++) {
    const r = dataMatrix[i] || [];
    const obj = {};
    for (let c = 0; c < header.length; c++) {
      const key = header[c] || `col_${c + 1}`;
      obj[key] = r[c] ?? "";
    }

    const row = normalizeRow(obj, i);

    // Ignorar linhas de resumo/total do Excel (ex.: "Total:" no final)
    const tipoRaw = String(row?.tipo ?? "").trim().toLowerCase();
    const isTotalRow =
      tipoRaw.startsWith("total") ||
      (tipoRaw === "" &&
        row?.valor &&
        (!row?.plano || row.plano === "(sem plano)") &&
        (!row?.empresa || row.empresa === "(sem empresa)") &&
        (!row?.fornecedor || row.fornecedor === "(sem fornecedor)") &&
        (!row?.conta || row.conta === "(sem conta)"));

    if (isTotalRow) continue;

    out.push(row);
  }

  return {
    filename: file.name,
    size: file.size,
    lastModified: file.lastModified,
    sheetName,
    rows: out,
    headerRow: bestIdx,
    headerScore: bestScore,
  };
}

export default function DashboardRateioUploadInteligentePage() {
  const inputRef = useRef(null);

  const [rows, setRows] = useState([]);
  const [fileMeta, setFileMeta] = useState({ name: "", size: 0, loadedAt: "" });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [busca, setBusca] = useState("");
  const [fEmpresa, setFEmpresa] = useState("Todas");
  const [fPlano, setFPlano] = useState("Todos");
  const [mesesSel, setMesesSel] = useState([]);
  const [outrosOpen, setOutrosOpen] = useState(false);
  const [cutoffPct, setCutoffPct] = useState(2.5);


  // ------------------------
  // Orçamentos (Previsto) por Plano — LocalStorage
  // ------------------------
  const BUDGET_LS_KEY = "bi_service_rateio_budgets_v1";
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetQuery, setBudgetQuery] = useState("");
  const [budgets, setBudgets] = useState({}); // { [plano]: { value?: number, pct?: number, mode?: "value"|"pct" } }
  // UI state (permite digitar vírgula/ponto sem o input "pular")
  const [budgetUi, setBudgetUi] = useState({}); 
  const budgetsSeededRef = useRef(false);
// { [plano]: { value?: string, pct?: string } }


const parseNumberInput = (val) => {
  // aceita "1234,56" ou "1.234,56" ou "1234.56"
  const s = String(val ?? "").trim();
  if (!s) return NaN;
  const normalized = s.replace(/\./g, "").replace(/,/g, ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
};

const round2 = (n) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : n);

const fmtBRNumber = (n) =>
  Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "";

const fmtPctNumber = (n) =>
  Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "";

const sanitizeNumericText = (s) => {
  // mantém dígitos e separadores; o parseNumberInput já normaliza.
  return String(s ?? "").replace(/[^0-9.,-]/g, "");
};



  const handlePieClick = (data) => {
    const plano = data?.payload?.plano ?? data?.plano;
    if (!plano) return;
    const p = String(plano).trim().toLowerCase();

    if (p === "outros") {
      setDrillPlano(null);
      setOutrosOpen(true);
      return;
    }

    setOutrosOpen(false);
    setDrillPlano(plano);
  };


  const [drillPlano, setDrillPlano] = useState(null);
  const [drillMes, setDrillMes] = useState(""); // YYYY-MM
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState("");
  const [detailRows, setDetailRows] = useState([]);
  const [detailQuery, setDetailQuery] = useState("");

  // Modal: lista de planos por status (Dentro / Atenção / Estourado / Sem)
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusModalKey, setStatusModalKey] = useState("over");
  const [statusModalQuery, setStatusModalQuery] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.rows?.length) setRows(parsed.rows);
      if (parsed?.meta) setFileMeta(parsed.meta);
    } catch {}
  }, []);

  // Carrega orçamentos do LocalStorage (com migração retrocompatível)
useEffect(() => {
  try {
    const raw = localStorage.getItem(BUDGET_LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;

    // formato antigo: { [plano]: number }
    const migrated = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number") {
        migrated[k] = { value: v, mode: "value" };
      } else if (v && typeof v === "object") {
        const val = typeof v.value === "number" ? v.value : undefined;
        const pct = typeof v.pct === "number" ? v.pct : undefined;
        migrated[k] = { ...(val != null ? { value: val } : {}), ...(pct != null ? { pct } : {}), mode: v.mode === "pct" ? "pct" : "value" };
      }
    }
    setBudgets(migrated);
  } catch (e) {
    // ignore
  }
}, []);


  // Persiste orçamentos
  useEffect(() => {
    try {
      localStorage.setItem(BUDGET_LS_KEY, JSON.stringify(budgets || {}));
    } catch (e) {
      // ignore
    }
  }, [budgets]);


  useEffect(() => {
    try {
      if (!rows.length) return;
      localStorage.setItem(LS_KEY, JSON.stringify({ rows, meta: fileMeta }));
    } catch {}
  }, [rows, fileMeta]);

  function clearData() {
    setRows([]);
    setFileMeta({ name: "", size: 0, loadedAt: "" });
    setBusca("");
    setFPlano("Todos");
    setMesesSel([]);
    setDrillPlano(null);
    setDrillMes("");
    setDetailOpen(false);
    setDetailTitle("");
    setDetailRows([]);
    setDetailQuery("");
    setError("");
    try {
      localStorage.removeItem(LS_KEY);
    } catch {}
  }

  async function handleFile(file) {
    setLoading(true);
    setError("");
    try {
      if (!file) throw new Error("Selecione um arquivo.");
      const isXlsx = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
      if (!isXlsx) throw new Error("Formato inválido. Envie um .xlsx ou .xls");

      const maxMB = 25;
      if (file.size > maxMB * 1024 * 1024) {
        throw new Error(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Limite: ${maxMB}MB`);
      }

      const normalized = await parseXlsxSmart(file);

      setRows(Array.isArray(normalized?.rows) ? normalized.rows : []);
      setFileMeta({ name: file.name, size: file.size, loadedAt: new Date().toLocaleString("pt-BR") });
    } catch (e) {
      setError(e?.message ?? "Erro ao ler arquivo.");
    } finally {
      setLoading(false);
    }
  }

  function onDrop(ev) {
    ev.preventDefault();
    const file = ev.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }
  function onDragOver(ev) {
    ev.preventDefault();
  }

  const planos = useMemo(() => ["Todos", ...Array.from(new Set(rows.map((r) => r.plano))).sort()], [rows]);

  
  const empresas = useMemo(() => ["Todas", ...Array.from(new Set(rows.map((r) => r.empresa).filter(Boolean))).sort()], [rows]);

  const sugestoesBusca = useMemo(() => {
    const s = new Set();
    for (const r of rows) {
      if (r?.plano) s.add(String(r.plano));
      if (r?.conta) s.add(String(r.conta));
      if (r?.fornecedor) s.add(String(r.fornecedor));
      if (r?.empresa) s.add(String(r.empresa));
      if (r?.centro_custo) s.add(String(r.centro_custo));
      if (r?.centroCusto) s.add(String(r.centroCusto));
      if (r?.cc) s.add(String(r.cc));
    }
    return Array.from(s).sort();
  }, [rows]);

const planosSomente = useMemo(() => planos.filter((p) => p !== "Todos"), [planos]);

  const budgetList = useMemo(() => {
    const q = String(budgetQuery || "").trim().toLowerCase();
    const base = planosSomente;
    if (!q) return base;
    return base.filter((p) => String(p).toLowerCase().includes(q));
  }, [planosSomente, budgetQuery]);

  const setBudgetValue = (plano, rawValue) => {
    const n0 = parseNumberInput(rawValue);
    const n = round2(n0);
    setBudgets((prev) => {
      const next = { ...(prev || {}) };
      if (!Number.isFinite(n) || n <= 0) {
        // se apagar valor e não tiver % salvo, remove
        const keepPct = next?.[plano]?.pct;
        if (typeof keepPct === "number" && Number.isFinite(keepPct) && keepPct > 0) {
          next[plano] = { pct: round2(keepPct), mode: "pct" };
        } else {
          delete next[plano];
        }
      } else {
        const pct0 = totalGeral > 0 ? (n / totalBaseAll) * 100 : next?.[plano]?.pct;
        const pct = round2(pct0);
        next[plano] = { value: n, ...(Number.isFinite(pct) ? { pct } : {}), mode: "value" };
      }
      return next;
    });
  };

  const setBudgetPct = (plano, rawPct) => {
    const p0 = parseNumberInput(rawPct);
    const p = round2(p0);
    setBudgets((prev) => {
      const next = { ...(prev || {}) };
      if (!Number.isFinite(p) || p <= 0) {
        const keepVal = next?.[plano]?.value;
        if (typeof keepVal === "number" && Number.isFinite(keepVal) && keepVal > 0) {
          next[plano] = { value: round2(keepVal), mode: "value" };
        } else {
          delete next[plano];
        }
      } else {
        const value0 = totalGeral > 0 ? (totalBaseAll * p) / 100 : next?.[plano]?.value;
        const value = round2(value0);
        next[plano] = { pct: p, ...(Number.isFinite(value) ? { value } : {}), mode: "pct" };
      }
      return next;
    });
  };

const clearBudget = (plano) => {
  setBudgets((prev) => {
    const next = { ...(prev || {}) };
    delete next[plano];
    return next;
  });
  setBudgetUi((prev) => {
    const next = { ...(prev || {}) };
    delete next[plano];
    return next;
  });
};

const clearAllBudgets = () => {
  setBudgets({});
  setBudgetUi({});
};




  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return rows.filter((r) => {
      const matchPlano = fPlano === "Todos" || r.plano === fPlano;
      const matchEmpresa = fEmpresa === "Todas" || r.empresa === fEmpresa;

      const matchBusca =
        !q ||
        r.plano.toLowerCase().includes(q) ||
        r.conta.toLowerCase().includes(q) ||
        r.fornecedor.toLowerCase().includes(q) ||
        r.empresa.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q);

      let matchMes = true;
      if (mesesSel.length > 0) {
        const mi = mesIndexFromISO(r.data);
        matchMes = mesesSel.includes(mi);
      }

      return matchPlano && matchEmpresa && matchBusca && matchMes;
    });
  }, [rows, busca, fPlano, fEmpresa, mesesSel]);

  const debugDatas = useMemo(() => {
    const ok = filtered.filter((r) => !!r.data).length;
    const sample = Array.from(new Set(filtered.map((r) => r.data).filter(Boolean))).slice(0, 6);
    return { ok, total: filtered.length, sample };
  }, [filtered]);

  const debugValores = useMemo(() => {
    const vals = rows.map((r) => r.valor).filter((v) => typeof v === "number" && Number.isFinite(v));
    const max = vals.length ? Math.max(...vals) : 0;
    const min = vals.length ? Math.min(...vals) : 0;
    const keys = Array.from(new Set(rows.map((r) => r.__valorKey).filter(Boolean))).slice(0, 6);
    return { min, max, keys };
  }, [rows]);


  const totalGeral = useMemo(() => filtered.reduce((acc, r) => acc + (r.valor || 0), 0), [filtered]);

  const totalBaseAll = useMemo(() => rows.reduce((acc, r) => acc + (r.valor || 0), 0), [rows]);

  // ------------------------
  // Orçamento (Previsto) — helpers e resumo
  // ------------------------
  const budgetValueForPlano = (plano) => {
    const key = String(plano ?? "");
    const b = budgets?.[key];
    if (!b) return 0;
    const v = Number(b.value ?? 0) || 0;
    const p = Number(b.pct ?? 0) || 0;
    const mode = b.mode;
    if (mode === "pct" || (mode !== "value" && p > 0)) {
      return (totalGeral * p) / 100;
    }
    return v;
  };

  const budgetValueForPlanoMes = (plano, totalMes, mesesCount) => {
    const key = String(plano ?? "");
    const b = budgets?.[key];
    if (!b) return 0;
    const v = Number(b.value ?? 0) || 0;
    const p = Number(b.pct ?? 0) || 0;
    const mode = b.mode;
    if (mode === "pct" || (mode !== "value" && p > 0)) {
      return (totalMes * p) / 100;
    }
    // Quando o orçamento é em R$ (value), tratamos como TOTAL do período selecionado.
    // Para exibir uma "linha mensal" (ou comparar mês a mês), distribuímos igualmente entre os meses do período.
    const n = Number(mesesCount ?? 0) || 0;
    return n > 0 ? v / n : v;
  };

  const budgetStatus = (real, previsto) => {
    const r = Number(real ?? 0) || 0;
    const p = Number(previsto ?? 0) || 0;
    if (!p) return { key: "none", label: "Sem orçamento", cls: "bg-white/10 text-white/70 border-white/15" };
    const ratio = r / p;
    if (r > p) return { key: "over", label: "Estourado", cls: "bg-rose-500/20 text-rose-200 border-rose-400/30" };
    if (ratio >= 0.9) return { key: "warn", label: "Atenção", cls: "bg-amber-500/20 text-amber-200 border-amber-400/30" };
    return { key: "ok", label: "Dentro", cls: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30" };
  };

  // ------------------------
  // Status visual por plano (considera meses + busca, mas IGNORA o filtro de plano)
  // - Previsto em R$ é tratado como mensal (multiplica pela quantidade de meses do período)
  // - Previsto em % é aplicado sobre o total de cada mês
  // ------------------------
  const rowsPeriodo = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      const matchBusca =
        !q ||
        r.plano.toLowerCase().includes(q) ||
        r.conta.toLowerCase().includes(q) ||
        r.fornecedor.toLowerCase().includes(q) ||
        r.empresa.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q);

      let matchMes = true;
      if (mesesSel.length > 0) {
        const mi = mesIndexFromISO(r.data);
        matchMes = mesesSel.includes(mi);
      }

      return matchBusca && matchMes;
    });
  }, [rows, busca, mesesSel]);

  const periodoMesTotals = useMemo(() => {
    const m = new Map();
    for (const r of rowsPeriodo) {
      const k = monthKey(r.data);
      if (!k) continue;
      m.set(k, (m.get(k) ?? 0) + (r.valor || 0));
    }
    return m; // Map<mesKey, totalMes>
  }, [rowsPeriodo]);

  const periodoRealByPlano = useMemo(() => {
    const m = new Map();
    for (const r of rowsPeriodo) {
      const k = String(r.plano ?? "");
      if (!k) continue;
      m.set(k, (m.get(k) ?? 0) + (r.valor || 0));
    }
    return m; // Map<plano, realPeriodo>
  }, [rowsPeriodo]);

  const planoStatusMap = useMemo(() => {
    const out = {};
    const meses = Array.from(periodoMesTotals.keys());
    for (const plano of planosSomente) {
      const real = periodoRealByPlano.get(plano) ?? 0;
      let previsto = 0;
      for (const mes of meses) {
        const totalMes = periodoMesTotals.get(mes) ?? 0;
        previsto += budgetValueForPlanoMes(plano, totalMes, meses.length);
      }
      const st = budgetStatus(real, previsto);
      const emoji = st.key === "ok" ? "🟢" : st.key === "warn" ? "🟡" : st.key === "over" ? "🔴" : "⚪";
      out[plano] = { ...st, emoji, real, previsto, ratio: previsto ? real / previsto : 0 };
    }
    return out; // { [plano]: {key,label,cls,emoji,real,previsto,ratio} }
  }, [planosSomente, periodoMesTotals, periodoRealByPlano, budgets, totalBaseAll]);


  const contasNoFiltro = useMemo(() => {
    // IMPORTANTE: orçamento é por PLANO (plano de conta). Não usar r.conta aqui,
    // porque em alguns contextos r.conta pode ser "Plano — Empresa — Fornecedor" e não bate com o cadastro.
    const s = new Set();
    for (const r of filtered) s.add(String(r.plano ?? ""));
    return Array.from(s).filter(Boolean);
  }, [filtered]);


  const previstoTotal = useMemo(() => {
    return contasNoFiltro.reduce((acc, c) => acc + budgetValueForPlano(c), 0);
  }, [contasNoFiltro, budgets, totalGeral]);

  const execPct = useMemo(() => (previstoTotal ? (totalGeral / previstoTotal) * 100 : 0), [totalGeral, previstoTotal]);
  const diffBudget = useMemo(() => totalGeral - previstoTotal, [totalGeral, previstoTotal]);

  const statusCounts = useMemo(() => {
    const realMap = new Map();
    for (const r of filtered) {
      const k = String(r.plano ?? "");
      realMap.set(k, (realMap.get(k) ?? 0) + (r.valor || 0));
    }
    const counts = { ok: 0, warn: 0, over: 0, none: 0 };
    for (const k of contasNoFiltro) {
      const real = realMap.get(k) ?? 0;
      const prev = budgetValueForPlano(k);
      const st = budgetStatus(real, prev).key;
      counts[st] = (counts[st] ?? 0) + 1;
    }
    return counts;
  }, [filtered, contasNoFiltro, budgets, totalGeral]);

  const statusPlanos = useMemo(() => {
    // Gera lista de planos com Real/Previsto/Execução e Status, respeitando filtros atuais
    const realMap = new Map();
    for (const r of filtered) {
      const k = String(r.plano ?? "");
      realMap.set(k, (realMap.get(k) ?? 0) + (r.valor || 0));
    }

    const arr = [];
    for (const plano of contasNoFiltro) {
      const real = realMap.get(plano) ?? 0;
      const previsto = budgetValueForPlano(plano);
      const st = budgetStatus(real, previsto); // { key, label, emoji, className }
      arr.push({
        plano,
        real,
        previsto,
        execPct: previsto ? (real / previsto) * 100 : 0,
        statusKey: st.key,
        statusLabel: st.label,
        statusEmoji: st.emoji,
      });
    }

    // Ordena: estourado/warn/ok/none e depois por maior execução/real
    const rank = { over: 0, warn: 1, ok: 2, none: 3 };
    arr.sort((a, b) => {
      const ra = rank[a.statusKey] ?? 9;
      const rb = rank[b.statusKey] ?? 9;
      if (ra !== rb) return ra - rb;
      // prioriza maior % de execução e depois maior real
      const ea = Number.isFinite(a.execPct) ? a.execPct : 0;
      const eb = Number.isFinite(b.execPct) ? b.execPct : 0;
      if (eb !== ea) return eb - ea;
      return (b.real || 0) - (a.real || 0);
    });

    return arr;
  }, [filtered, contasNoFiltro, budgets, totalGeral]);

  const statusPlanosFiltered = useMemo(() => {
    const q = (statusModalQuery || "").trim().toLowerCase();
    return statusPlanos.filter((p) => {
      if (p.statusKey !== statusModalKey) return false;
      if (!q) return true;
      return String(p.plano || "").toLowerCase().includes(q);
    });
  }, [statusPlanos, statusModalKey, statusModalQuery]);

  // Quando o total muda, recalcula o outro campo automaticamente
  useEffect(() => {
    if (!Number.isFinite(totalBaseAll) || totalBaseAll <= 0) return;
    setBudgets((prev) => {
      const src = prev || {};
      let changed = false;
      const next = { ...src };
      for (const [plano, b] of Object.entries(src)) {
        if (!b) continue;
        if (b.mode === "pct" && Number.isFinite(b.pct)) {
          const value = round2((totalBaseAll * b.pct) / 100);
          if (!Number.isFinite(b.value) || Math.abs((b.value ?? 0) - value) > 0.009) {
            next[plano] = { ...b, value };
            changed = true;
          }
        }
        if (b.mode === "value" && Number.isFinite(b.value)) {
          const pct = round2((b.value / totalBaseAll) * 100);
          if (!Number.isFinite(b.pct) || Math.abs((b.pct ?? 0) - pct) > 0.009) {
            next[plano] = { ...b, pct };
            changed = true;
          }
        }
      }
      return changed ? next : src;
    });
  }, [totalBaseAll]);


  const byPlano = useMemo(() => {
    const m = new Map();
    for (const r of filtered) m.set(r.plano, (m.get(r.plano) ?? 0) + (r.valor || 0));
    const arr = Array.from(m.entries())
      .map(([plano, valor]) => ({ plano, valor }))
      .sort((a, b) => b.valor - a.valor);
    const total = arr.reduce((a, b) => a + (b.valor || 0), 0);
    return arr.map((d) => ({
      ...d,
      budget: budgetValueForPlano(d.plano),
      pct: total ? (d.valor / total) * 100 : 0,
      pctLabel: total ? `${((d.valor / total) * 100).toFixed(1)}%` : "0.0%",
    }));
  }, [filtered]);

  const topPlanos = useMemo(() => byPlano.slice(0, 10), [byPlano]);

  const byMes = useMemo(() => {
    const m = new Map();
    for (const r of filtered) {
      const k = monthKey(r.data);
      m.set(k, (m.get(k) ?? 0) + (r.valor || 0));
    }
    return Array.from(m.entries())
      .map(([mes, valor]) => ({ mes, valor }))
      .sort((a, b) => (a.mes > b.mes ? 1 : -1));
  }, [filtered]);

  const byMesBudget = useMemo(() => {
    if (!byMes.length) return byMes;
    // Orçado por mês: soma dos orçamentos por plano.
    // - Orçamento em % é aplicado sobre o total do mês.
    // - Orçamento em R$ é considerado mensal (valor fixo) para cada mês.
    return byMes.map((it) => {
      const totalMes = Number(it.valor ?? 0) || 0;
      const orcado = contasNoFiltro.reduce((acc, c) => acc + budgetValueForPlanoMes(c, totalMes, byMes.length), 0);
      return { ...it, orcado };
    });
  }, [byMes, contasNoFiltro, budgets]);

  // Seed automático de orçamentos (só na primeira vez, se não houver nada salvo)
  useEffect(() => {
    if (budgetsSeededRef.current) return;
    // espera ter dados carregados
    if (!rows?.length || !Number.isFinite(totalBaseAll) || totalBaseAll <= 0) return;

    // Seed inteligente:
    // - NÃO sobrescreve planos já preenchidos (value>0 ou pct>0)
    // - Preenche planos com Real>0 com sugestão (Real*1.05)
    // - Preenche planos sem Real com % padrão (0,10%), baseado SEMPRE no total da base (não no filtro)
    const DEFAULT_PCT = 0.1;

    // soma Real por plano na base inteira
    const realByPlano = new Map();
    for (const r of rows) {
      const k = String(r?.plano ?? "");
      const v = Number(r?.valor ?? 0) || 0;
      if (!k) continue;
      realByPlano.set(k, (realByPlano.get(k) || 0) + v);
    }

    // lista completa de planos na base
    const planosAll = Array.from(realByPlano.keys()).sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));

    setBudgets((prev) => {
      const src = prev || {};
      let changed = false;
      const next = { ...src };

      for (const plano of planosAll) {
        const b = next[plano];
        const curV = Number(b?.value ?? 0) || 0;
        const curP = Number(b?.pct ?? 0) || 0;

        // já tem algo preenchido -> respeita
        if (curV > 0 || curP > 0) continue;

        const real = Number(realByPlano.get(plano) || 0) || 0;

        if (real > 0) {
          const value = round2(Math.max(0, real * 1.05));
          const pct = round2((value / totalBaseAll) * 100);
          next[plano] = { ...(b || {}), value, pct, mode: "value" };
          changed = true;
        } else {
          const pct = DEFAULT_PCT;
          const value = round2((totalBaseAll * pct) / 100);
          next[plano] = { ...(b || {}), value, pct, mode: "pct" };
          changed = true;
        }
      }

      if (changed) {
        // marca como seeded somente quando aplicou algo
        budgetsSeededRef.current = true;
        return next;
      }

      // nada para fazer -> evita rodar de novo
      budgetsSeededRef.current = true;
      return src;
    });
  }, [rows, totalBaseAll]);


  // Quando selecionar meses (Jan/Fev/Mar...), mostramos LINHAS por mês (comparativo entre anos)
  // Ex.: seleciona Jan e Fev -> 2 linhas (Jan e Fev) com cores diferentes; eixo X = ano.
  const byAnoMesLinhas = useMemo(() => {
    if (!mesesSel.length) return { data: [], keys: [] };

    // soma por ano + mês (mês baseado no vencimento)
    const acc = new Map(); // year -> { year, "Jan": val, ... }
    for (const r of filtered) {
      const iso = r.data;
      if (!iso) continue;
      const p = String(iso).split("-");
      if (p.length < 2) continue;
      const year = p[0];
      const mi = Number(p[1]) - 1;
      if (!mesesSel.includes(mi)) continue;

      const label = MESES_LABEL[mi] || `M${mi + 1}`;
      if (!acc.has(year)) acc.set(year, { ano: year });
      const obj = acc.get(year);
      obj[label] = (obj[label] ?? 0) + (r.valor || 0);
    }

    const data = Array.from(acc.values()).sort((a, b) => (a.ano > b.ano ? 1 : -1));
    const keys = mesesSel
      .slice()
      .sort((a, b) => a - b)
      .map((mi) => MESES_LABEL[mi] || `M${mi + 1}`);

    return { data, keys };
  }, [filtered, mesesSel]);


  const pieData = useMemo(() => {
    // Opção 2: "Outros" só agrupa planos muito pequenos (ex.: < 1% do total)
    const THRESH_PCT = cutoffPct; // configurável
    const MAX_SLICES = 14; // segurança visual, caso existam muitos >= 1%
    const arr = [...byPlano];

    const grandes = arr.filter((d) => (d.pct ?? 0) >= THRESH_PCT);
    const pequenos = arr.filter((d) => (d.pct ?? 0) < THRESH_PCT);

    // se tiver "grandes" demais, mantém top MAX_SLICES-1 e manda o resto pra Outros (pra não virar bagunça)
    let visiveis = grandes;
    let agrupados = pequenos;

    if (grandes.length > MAX_SLICES) {
      visiveis = grandes.slice(0, MAX_SLICES - 1);
      agrupados = [...pequenos, ...grandes.slice(MAX_SLICES - 1)];
    }

    const outrosValor = agrupados.reduce((a, b) => a + (b.valor || 0), 0);
    const out = [...visiveis];

    if (outrosValor > 0) {
      const total = out.reduce((a, b) => a + (b.valor || 0), 0) + outrosValor;
      out.push({
        plano: "Outros",
        valor: outrosValor,
        pct: total ? (outrosValor / total) * 100 : 0,
        pctLabel: total ? `${((outrosValor / total) * 100).toFixed(1)}%` : "0.0%",
      });
    }

    // adiciona % acumulado (ordem das fatias)
    let run = 0;
    const out2 = out.map((d) => {
      run += d.pct || 0;
      return { ...d, cumPct: run, cumPctLabel: `${run.toFixed(1)}%` };
    });
    return out2;
  }, [byPlano, cutoffPct]);

const outrosDetalhe = useMemo(() => {
    const THRESH_PCT = cutoffPct; // configurável
    const MAX_SLICES = 14;

    const arr = [...byPlano];
    const grandes = arr.filter((d) => (d.pct ?? 0) >= THRESH_PCT);
    const pequenos = arr.filter((d) => (d.pct ?? 0) < THRESH_PCT);

    // regra de segurança: se muitos grandes, agrupa parte deles também
    let agrupados = pequenos;
    if (grandes.length > MAX_SLICES) {
      agrupados = [...pequenos, ...grandes.slice(MAX_SLICES - 1)];
    }

    const total = agrupados.reduce((a, b) => a + (b.valor || 0), 0);
    const rows = agrupados.map((d) => ({
      ...d,
      pct: total ? (d.valor / total) * 100 : 0,
      pctLabel: total ? `${((d.valor / total) * 100).toFixed(1)}%` : "0.0%",
    }));

    return { total, rows };
  }, [byPlano, cutoffPct]);

const outrosPlanos = useMemo(() => {
    const max = 9;
    return byPlano.slice(max);
  }, [byPlano]);


  // ------------------------
  // Drill-down (clique na pizza)
  // ------------------------
  const drillRowsBase = useMemo(() => {
    if (!drillPlano) return [];
    return filtered.filter((r) => r.plano === drillPlano);
  }, [filtered, drillPlano]);

  const drillMesOptions = useMemo(() => {
    if (!drillRowsBase.length) return [];
    const s = new Set();
    for (const r of drillRowsBase) s.add(monthKey(r.data ?? r.competencia));
    return Array.from(s).filter(Boolean).sort();
  }, [drillRowsBase]);

  // Se o usuário clicar na pizza e tiver 1 mês selecionado, pré-seleciona esse mês (sem travar ano)
  useEffect(() => {
    if (!drillPlano) return;
    if (drillMes) return;
    if (drillMesOptions.length === 1) setDrillMes(drillMesOptions[0]);
  }, [drillPlano, drillMes, drillMesOptions]);

  const drillRows = useMemo(() => {
    if (!drillPlano) return [];
    if (!drillMes) return drillRowsBase;
    return drillRowsBase.filter((r) => monthKey(r.data ?? r.competencia) === drillMes);
  }, [drillPlano, drillMes, drillRowsBase]);

  const drillTotal = useMemo(() => drillRows.reduce((acc, r) => acc + (r.valor || 0), 0), [drillRows]);
  const drillCount = useMemo(() => drillRows.length, [drillRows]);
  const drillTicket = useMemo(() => (drillCount ? drillTotal / drillCount : 0), [drillTotal, drillCount]);

  function aggTop(rows, key, topN = 12) {
    const m = new Map();
    for (const r of rows) {
      const k = String(r[key] ?? "(vazio)");
      m.set(k, (m.get(k) ?? 0) + (r.valor || 0));
    }
    const arr = Array.from(m.entries())
      .map(([name, valor]) => ({ name, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, topN);

    const total = arr.reduce((a, b) => a + (b.valor || 0), 0);
    return arr.map((d) => ({
      ...d,
      budget: budgetValueForPlano(d.plano),
      pct: total ? (d.valor / total) * 100 : 0,
      pctLabel: total ? `${((d.valor / total) * 100).toFixed(1)}%` : "0.0%",
    }));
  }

  function openDetail(title, rows) {
    setDetailTitle(title);
    setDetailRows(rows);
    setDetailQuery("");
    setDetailOpen(true);
  }

  const drillByFornecedor = useMemo(() => aggTop(drillRows, "fornecedor", 12), [drillRows]);
  const drillByEmpresa = useMemo(() => aggTop(drillRows, "empresa", 12), [drillRows]);
  const drillByConta = useMemo(() => {
    const base = aggTop(drillRows, "conta", 12);
    return base.map((d) => {
      const previsto = budgetValueForPlano(d.name);
      return { ...d, budget: previsto, status: budgetStatus(d.valor, previsto) };
    });
  }, [drillRows, budgets, totalGeral]);

  const drillByMes = useMemo(() => {
    // evolução do plano selecionado (independente do drillMes)
    if (!drillRowsBase.length) return [];

    // total geral por mês (para orçamento por %)
    const totalMesMap = new Map(byMes.map((d) => [d.mes, d.valor]));

    const m = new Map();
    for (const r of drillRowsBase) {
      const k = monthKey(r.data ?? r.competencia);
      m.set(k, (m.get(k) ?? 0) + (r.valor || 0));
    }

    return Array.from(m.entries())
      .map(([mes, valor]) => {
        const totalMes = totalMesMap.get(mes) ?? 0;
        const previsto = budgetValueForPlanoMes(drillPlano, totalMes, m.size);
        return { mes, valor, previsto, status: budgetStatus(valor, previsto) };
      })
      .sort((a, b) => (a.mes > b.mes ? 1 : -1));
  }, [drillRowsBase, byMes, drillPlano, budgets, totalGeral]);

  return (
    <div className="min-h-screen bg-[#0c1118] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0c1118]/80 backdrop-blur px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-end justify-between gap-2">
          <div className="flex items-end gap-2">
            <div className="h-9 w-9 rounded-xl overflow-hidden ring-1 ring-sky-500/40 bg-sky-500/10 grid place-items-end">
              <Image src="/logo/logo.png" alt="BI Service" width={80} height={80} priority />
            </div>
            <div className="leading-tight">
              <div className="text-sm text-white/70">BI Service Beta</div>
              <h1 className="text-xl font-bold">
                Dashboard <span style={{ color: C_GREEN }}>Rateio</span> — <span className="text-white/80">Financeiro</span>
              </h1>
              <div className="text-[11px] text-white/60">Upload inteligente • detecta cabeçalho/valor automaticamente</div>
            </div>
          </div>

          <div className="hidden md:flex flex-col items-end leading-tight">
            <div className="text-[11px] text-white/60">Total filtrado</div>
            <div className="text-sm font-semibold">{fmtBRL(totalGeral)}</div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        <Card
          title="Carregar arquivo de Rateio (.xlsx)"
          right={
            rows.length ? (
              <div className="text-[11px] text-white/60 text-right">
                <div className="text-white/80 font-medium">{fileMeta.name}</div>
                <div>{(fileMeta.size / 1024 / 1024).toFixed(2)}MB • {fileMeta.loadedAt}</div>
              </div>
            ) : (
              <div className="text-[11px] text-white/60">Arraste e solte ou selecione</div>
            )
          }
        >
          <div onDrop={onDrop} onDragOver={onDragOver} className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4">
            <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white/90">{rows.length ? "Dataset carregado" : "Nenhum arquivo carregado"}</div>
                <div className="text-[12px] text-white/60">Pode ter títulos acima — eu detecto o cabeçalho automaticamente.</div>
                {error && <div className="text-[12px] text-rose-300">Erro: {error}</div>}
                {loading && <div className="text-[12px] text-white/70">Lendo arquivo...</div>}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => inputRef.current?.click()}
                  className="px-3 py-2 rounded-lg bg-sky-500/20 border border-sky-400/30 hover:bg-sky-500/30 text-sm"
                  disabled={loading}
                >
                  Selecionar arquivo
                </button>
                <button
                  onClick={clearData}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm"
                  disabled={loading}
                >
                  Limpar dataset
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card
          title="Filtros"
          right={
            <div className="flex items-center gap-2">
              <div className="text-[11px] text-white/60">Busca + Plano</div>
              <button
                type="button"
                onClick={() => setBudgetOpen(true)}
                className="px-2.5 py-1 rounded-lg text-[11px] border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                disabled={!rows.length}
                style={{ colorScheme: "dark" }}
              >
                Orçamentos
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[320px]">
                <div className="text-[11px] text-white/60 mb-1">Busca (plano, conta, fornecedor...)</div>
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  list="busca-sugestoes"
                  placeholder="Digite para filtrar..."
                  className="w-full rounded-lg px-3 py-2 bg-white/5 border border-white/10 text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-sky-500/40"
                  disabled={!rows.length}
                />
                <datalist id="busca-sugestoes">
                  {sugestoesBusca.slice(0, 5000).map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>

              <div className="w-[260px] min-w-[220px]">
                <div className="text-[11px] text-white/60 mb-1">Empresa</div>
                <select
                  value={fEmpresa}
                  onChange={(e) => setFEmpresa(e.target.value)}
                  className="w-full rounded-lg bg-[#0B1220] text-white border border-white/20 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500/40"
                  disabled={!rows.length}
                >
                  {empresas.map((e) => (
                    <option key={e} value={e} className="text-black bg-white">
                      {e}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-[280px] min-w-[220px]">
                <div className="text-[11px] text-white/60 mb-1">Plano</div>
                <select
                  value={fPlano}
                  onChange={(e) => setFPlano(e.target.value)}
                  className="w-full rounded-lg bg-[#0B1220] text-white border border-white/20 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500/40"
                  disabled={!rows.length}
                >
                  {planos.map((p) => {
                    const st = p !== "Todos" ? planoStatusMap?.[p] : null;
                    const label = p === "Todos" ? "Todos" : `${st?.emoji ?? "⚪"} ${p}`;
                    return (
                      <option key={p} value={p} className="text-black bg-white">
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
<div className="md:col-span-2">
              <div className="text-[11px] text-white/60 mb-1">Meses (Vencimento)</div>
            


              <div className="flex flex-wrap gap-2">
                {MESES_LABEL.map((m, idx) => {
                  const active = mesesSel.includes(idx);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setMesesSel((prev) =>
                          prev.includes(idx)
                            ? prev.filter((x) => x !== idx)
                            : [...prev, idx].sort((a,b)=>a-b)
                        );
                      }}
                      className={
                        "px-3 py-1 rounded-lg text-xs border transition " +
                        (active
                          ? "bg-sky-500/30 border-sky-400/40 text-white"
                          : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10")
                      }
                      disabled={!rows.length}
                    >
                      {m}
                    </button>
                  );
                })}

                {mesesSel.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMesesSel([])}
                    className="px-3 py-1 rounded-lg text-xs border bg-rose-500/20 border-rose-400/30 text-rose-200 hover:bg-rose-500/30"
                  >
                    Limpar meses
                  </button>
                )}
              

                <div className="flex items-center gap-3 flex-wrap">
              <div className="text-xs text-white/60 whitespace-nowrap">Corte p/ “Outros”</div>
              <input
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={cutoffPct}
                onChange={(e) => setCutoffPct(Number(e.target.value))}
                className="w-52 accent-white"
              />
              <div className="text-xs text-white/80 w-12 text-right">{cutoffPct.toFixed(1)}%</div>
              <div className="text-xs text-white/50">Agrupa planos com participação menor que o corte.</div>
            </div>

              </div>
            </div>

          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card title="Total Geral (após filtros)">
            <div className="text-xl font-semibold" style={{ color: C_GREEN }}>
              {fmtBRL(totalGeral)}
            </div>
            <div className="text-[11px] text-white/60 mt-1">{rows.length ? "Base real carregada" : "Carregue um Excel para alimentar os gráficos"}</div>
            {rows.length && (
              <div className="text-[11px] text-white/50 mt-1">
              </div>

            )}
            {rows.length && (
              <div className="text-[11px] text-white/50 mt-1">
              </div>
            )}
          </Card>

          <Card title="Resumo Orçamento">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[11px] text-white/60">Previsto (total)</div>
                <div className="text-lg font-semibold text-white">{fmtBRL(previstoTotal)}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-white/60">Execução</div>
                <div className={`text-lg font-semibold ${previstoTotal ? (execPct > 100 ? "text-rose-200" : execPct >= 90 ? "text-amber-200" : "text-emerald-200") : "text-white/70"}`}>
                  {previstoTotal ? `${execPct.toFixed(1)}%` : "—"}
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-white/70">
              <span>Diferença</span>
              <span className={`${diffBudget > 0 ? "text-rose-200" : "text-emerald-200"} font-medium`}>
                {previstoTotal ? fmtBRL(diffBudget) : "—"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => { setStatusModalKey("ok"); setStatusModalQuery(""); setStatusModalOpen(true); }}
                className="px-2 py-0.5 rounded-lg border border-emerald-400/30 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/25 active:scale-[0.99] transition"
                title="Ver planos Dentro"
              >
                Dentro: {statusCounts.ok}
              </button>
              <button
                type="button"
                onClick={() => { setStatusModalKey("warn"); setStatusModalQuery(""); setStatusModalOpen(true); }}
                className="px-2 py-0.5 rounded-lg border border-amber-400/30 bg-amber-500/20 text-amber-200 hover:bg-amber-500/25 active:scale-[0.99] transition"
                title="Ver planos em Atenção"
              >
                Atenção: {statusCounts.warn}
              </button>
              <button
                type="button"
                onClick={() => { setStatusModalKey("over"); setStatusModalQuery(""); setStatusModalOpen(true); }}
                className="px-2 py-0.5 rounded-lg border border-rose-400/30 bg-rose-500/20 text-rose-200 hover:bg-rose-500/25 active:scale-[0.99] transition"
                title="Ver planos Estourados"
              >
                Estourado: {statusCounts.over}
              </button>
              <button
                type="button"
                onClick={() => { setStatusModalKey("none"); setStatusModalQuery(""); setStatusModalOpen(true); }}
                className="px-2 py-0.5 rounded-lg border border-white/15 bg-white/10 text-white/70 hover:bg-white/15 active:scale-[0.99] transition"
                title="Ver planos Sem orçamento"
              >
                Sem: {statusCounts.none}
              </button>
            </div>
          </Card>

          <Card title="Linhas / Itens">
            <div className="text-xl font-semibold text-white/90">{filtered.length}</div>
            <div className="text-[11px] text-white/60 mt-1">Registros após filtros</div>
          </Card>

          <Card title="Plano Selecionado">
            <div className="text-xl font-semibold text-white/90">{fPlano}</div>
            <div className="text-[11px] text-white/60 mt-1">Use o select para trocar</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <Card title="Distribuição por Plano" style={{ height: 460 }}>
            <div style={{ height: 390 }}>
              {pieData.length ? (
                <ResponsiveContainer width="100%" height={390}>
                  <PieChart>
                    <Pie data={pieData} dataKey="valor" nameKey="plano" outerRadius={150} isAnimationActive={false} onClick={handlePieClick} labelLine={false} label={({ percent }) => `${(percent * 100).toFixed(1)}%`}>
                      {pieData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                          style={{ cursor: "pointer" }}
                          onClick={() => {
                            const plano = entry?.plano;
                            if (plano) {
                              setDrillPlano(plano);
                              setDrillMes("");
                            }
                          }}
                        />
                      ))}
                    </Pie>
                    <Tooltip cursor={false} content={<TooltipRich labelPrefix="Plano" />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full grid place-items-center text-white/60 text-sm">
                  Sem dados para o gráfico (verifique filtros).
                </div>
              )}
            </div>
            <div className="text-[11px] text-white/60 mt-1">
              Clique em uma fatia para abrir o detalhamento do plano.
            </div>
          </Card>

          <Card title="Top Planos de Contas" style={{ height: 420 }}>
            <div style={{ height: 340 }}>
              {topPlanos.length ? (
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={topPlanos} barGap={-34} margin={{ top: 34, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                    <XAxis dataKey="plano" hide />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                    <Tooltip cursor={false} content={<TooltipRich labelPrefix="Categoria" />} />
                    <Bar dataKey="budget" name="Previsto" fill={C_BLUE} fillOpacity={0.18} radius={[10, 10, 0, 0]} barSize={34} />
                        <Bar dataKey="valor" name="Real" fill={C_BLUE} radius={[10, 10, 0, 0]} barSize={22} onClick={(d) => {
                      const plano = d?.name ?? d?.payload?.plano;
                      if (plano) {
                        setDrillPlano(plano);
                        setDrillMes("");
                      }
                    }}>
                      <LabelList dataKey="pctLabel" position="top" offset={10} fill="rgba(255,255,255,0.75)" fontSize={12} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full grid place-items-center text-white/60 text-sm">
                  Sem dados para o gráfico (verifique filtros).
                </div>
              )}
            </div>
          </Card>

          <Card title="Evolução Mensal" className="xl:col-span-2" style={{ height: 420 }}>
            <div style={{ height: 340 }}>
              {mesesSel.length > 0 ? (
                byAnoMesLinhas.data.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={byAnoMesLinhas.data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="ano" />
                      <YAxis />
                      <Tooltip cursor={false} content={<TooltipRich labelPrefix="Categoria" />} />
                      {byAnoMesLinhas.keys.map((k, i) => (
                        <Line
                          key={k}
                          type="monotone"
                          dataKey={k}
                          stroke={PIE_COLORS[i % PIE_COLORS.length]}
                          strokeWidth={3}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full grid place-items-center text-white/60 text-sm">
                    Sem dados para os meses selecionados.
                  </div>
                )
              ) : byMes.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={byMesBudget}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <Tooltip cursor={false} content={<TooltipRich labelPrefix="Mês" />} />
                    <Area
                      type="monotone"
                      dataKey="orcado"
                      name="Previsto"
                      stroke={C_BLUE}
                      fill={C_BLUE}
                      fillOpacity={0.18}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="valor"
                      name="Real"
                      stroke={C_BLUE}
                      strokeWidth={3}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full grid place-items-center text-white/60 text-sm">Sem dados.</div>
              )}</div>
          </Card>
        </div>


        {/* DRILL DOWN: clique na pizza */}

        {/* OUTROS: detalhar planos agrupados */}
        {outrosOpen && outrosDetalhe.total > 0 && (
          <Card
            title="Detalhamento — Outros"
            right={
              <div className="flex items-center gap-2">
                <div className="text-[11px] text-white/60">Planos dentro de “Outros”</div>
                <button
                  type="button"
                  onClick={() => setOutrosOpen(false)}
                  className="px-2 py-1 rounded-lg text-xs border bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                >
                  Fechar
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-3 mb-3">
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2">
                <div className="text-[11px] text-white/60">Total “Outros”</div>
                <div className="text-xl font-bold" style={{ color: C_GREEN }}>
                  {fmtBRL(outrosDetalhe.total)}
                </div>
              </div>

            </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3 mb-4">
      <div className="text-sm font-semibold text-white/90 mb-2 flex items-center justify-between">
        <span>Top planos dentro de “Outros”</span>
        <span className="text-[11px] text-white/50">Top 20</span>
      </div>
      <div style={{ height: 360 }}>
        {outrosDetalhe.rows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={outrosDetalhe.rows.slice(0, 20)}
              layout="vertical"
              margin={{ left: 24, right: 24, top: 8, bottom: 8 }}
            >
<XAxis
                type="number"
                tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="plano"
                width={220}
                tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
              />
              <Tooltip cursor={false} content={<TooltipRich labelPrefix="Plano" />} />
              <Bar
                dataKey="valor"
                fill={C_BLUE}
                radius={[8, 8, 8, 8]}
                onClick={(d) => {
                  const name = d?.payload?.plano ?? d?.plano;
                  if (!name) return;
                  setOutrosOpen(false);
                  setDrillPlano(name);
                }}
              >
                <LabelList dataKey="pctLabel" position="right" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full grid place-items-center text-white/60 text-sm">Sem dados.</div>
        )}
      </div>
      <div className="mt-2 text-[11px] text-white/45">
        Clique em uma barra para abrir o drill do plano.
      </div>
    </div>

    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-sm font-semibold text-white/90 mb-2">Lista completa</div>
      <div className="max-h-[360px] overflow-auto rounded-lg border border-white/10">
        {outrosDetalhe.rows.map((d, i) => (
          <button
            key={`${d.plano}-${i}`}
            type="button"
            onClick={() => {
              setOutrosOpen(false);
              setDrillPlano(d.plano);
            }}
            className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 border-b border-white/5 last:border-b-0"
            title={d.plano}
          >
            <span className="truncate text-white/80">{d.plano}</span>
            <span className="ml-auto text-white/70">{fmtBRL(d.valor)}</span>
            <span className="text-white/50 text-xs w-[56px] text-right">{d.pctLabel}</span>
          </button>
        ))}
      </div>
    </div>
  </Card>
)}

        {drillPlano && drillPlano !== "Outros" && (
          <Card
            title={`Detalhamento — ${drillPlano}`}
            right={
              <div className="flex items-center gap-2">
                <div className="text-[11px] text-white/60">Mês:</div>
                <select
                  value={drillMes}
                  onChange={(e) => setDrillMes(e.target.value)}
                  className="rounded-lg px-2 py-1 bg-white/5 border border-white/10 text-white text-xs outline-none focus:ring-2 focus:ring-sky-500/40"
                >
                  <option value="" className="bg-[#0c1118]">Todos</option>
                  {drillMesOptions.map((m) => (
                    <option key={m} value={m} className="bg-[#0c1118]">
                      {m}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setDrillPlano(null)} className="px-2 py-1 rounded-lg text-xs border bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                >
                  Fechar
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-3 mb-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[11px] text-white/60">Total (plano + filtros)</div>
                <div className="text-xl font-bold" style={{ color: C_GREEN }}>
                  {fmtBRL(drillTotal)}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[11px] text-white/60">Itens</div>
                <div className="text-xl font-bold text-white/90">{drillCount}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[11px] text-white/60">Ticket médio</div>
                <div className="text-xl font-bold text-white/90">{fmtBRL(drillTicket)}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <Card title="Top Fornecedores" style={{ height: 420 }}>
                <div style={{ height: 340 }}>
                  {drillByFornecedor.length ? (
                    <ResponsiveContainer width="100%" height={340}>
                      <BarChart data={drillByFornecedor} margin={{ top: 28, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)"  />
                        <XAxis dataKey="name" hide />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                        <Tooltip cursor={false} content={<TooltipRich labelPrefix="Categoria" />} />
                        <Bar dataKey="valor" name="Real" fill={C_BLUE} radius={[10, 10, 0, 0]} barSize={22} onClick={(d) => {
                          const name = d?.payload?.name ?? d?.name;
                          if (!name) return;
                          openDetail(`Títulos — Fornecedor: ${name}`, drillRows.filter((r) => r.fornecedor === name));
                        }}>
                      <LabelList dataKey="pctLabel" position="top" offset={10} fill="rgba(255,255,255,0.75)" fontSize={12} />
                    </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full grid place-items-center text-white/60 text-sm">Sem dados.</div>
                  )}
                </div>
              </Card>

              <Card title="Top Empresas / Unidades" style={{ height: 420 }}>
                <div style={{ height: 340 }}>
                  {drillByEmpresa.length ? (
                    <ResponsiveContainer width="100%" height={340}>
                      <BarChart data={drillByEmpresa} margin={{ top: 28, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                        <XAxis dataKey="name" hide />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                        <Tooltip cursor={false} content={<TooltipRich labelPrefix="Categoria" />} />
                        <Bar dataKey="valor" fill={C_PURPLE} radius={[10, 10, 0, 0]} barSize={28} onClick={(d) => {
                          const name = d?.payload?.name ?? d?.name;
                          if (!name) return;
                          openDetail(`Títulos — Empresa/Unidade: ${name}`, drillRows.filter((r) => r.empresa === name));
                        }}>
                      <LabelList dataKey="pctLabel" position="top" offset={10} fill="rgba(255,255,255,0.75)" fontSize={12} />
                    </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full grid place-items-center text-white/60 text-sm">Sem dados.</div>
                  )}
                </div>
              </Card>

              <Card title="Top Contas" style={{ height: 420 }}>
                <div style={{ height: 340 }}>
                  {drillByConta.length ? (
                    <ResponsiveContainer width="100%" height={340}>
                      <ComposedChart data={drillByConta}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                        <XAxis dataKey="name" hide />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                        <Tooltip cursor={false} content={<TooltipRich labelPrefix="Categoria" />} />
                        <Bar dataKey="valor" fill={C_CYAN} radius={[10, 10, 0, 0]} onClick={(d) => {
                          const name = d?.payload?.name ?? d?.name;
                          if (!name) return;
                          openDetail(`Títulos — Conta: ${name}`, drillRows.filter((r) => r.conta === name));
                        }}>
                      <LabelList dataKey="pctLabel" position="top" offset={10} fill="rgba(255,255,255,0.75)" fontSize={12} />
                    </Bar>
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full grid place-items-center text-white/60 text-sm">Sem dados.</div>
                  )}
                </div>
              </Card>

              <Card title="Evolução do Plano (por mês)" style={{ height: 420 }}>
                <div style={{ height: 340 }}>
                  {drillByMes.length ? (
                    <ResponsiveContainer width="100%" height={340}>
                      <LineChart data={drillByMes}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                        <XAxis dataKey="mes" tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                        <Tooltip cursor={false} content={<TooltipRich labelPrefix="Categoria" />} />
                        <Line type="monotone" dataKey="previsto" name="Previsto" stroke={C_AMBER} strokeWidth={2} dot={false} strokeDasharray="6 4" />
                        <Line type="monotone" dataKey="valor" name="Real" stroke={C_GREEN} strokeWidth={3} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full grid place-items-center text-white/60 text-sm">Sem dados.</div>
                  )}
                </div>
              </Card>
            </div>

            <div className="text-[11px] text-white/60 mt-2">
              Dica: selecione um <span className="text-white/80 font-medium">mês</span> no topo do detalhamento para ver somente aquele período.
            </div>
          </Card>
        )}


        {/* MODAL ORÇAMENTOS (Previsto por Plano) */}
        {budgetOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
            <div className="max-w-4xl mx-auto p-4 md:p-6">
              <div
                className="rounded-2xl p-4 md:p-5 shadow-xl"
                style={{ border: `1px solid ${C_CARD_BORDER}`, background: "rgba(12,17,24,0.98)" }}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white/90">Orçamentos por Plano</div>
                    <div className="text-[11px] text-white/60">
                      Preencha o previsto por plano em R$ ou em %. Fica salvo neste computador (LocalStorage).
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={budgetQuery}
                      onChange={(e) => setBudgetQuery(e.target.value)}
                      placeholder="Buscar plano..."
                      className="w-64 max-w-full rounded-lg px-3 py-2 bg-white/5 border border-white/10 text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-sky-500/40 text-sm"
                      style={{ colorScheme: "dark" }}
                    />
                    <button
                      type="button"
                      onClick={() => clearAllBudgets()}
                      className="px-3 py-2 rounded-lg text-sm border bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                      disabled={!Object.keys(budgets || {}).length}
                    >
                      Zerar
                    </button>
                    <button
                      type="button"
                      onClick={() => setBudgetOpen(false)}
                      className="px-3 py-2 rounded-lg text-sm border bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                    >
                      Fechar
                    </button>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 overflow-hidden">
                  <div className="max-h-[65vh] overflow-auto">
                    <table className="w-full text-[12px]">
                      <thead className="sticky top-0 bg-[#0c1118] border-b border-white/10">
                        <tr className="text-left">
                          <th className="p-2">Plano</th>
                          <th className="p-2 w-[180px] text-right">Previsto (R$)</th>
                          <th className="p-2 w-[140px] text-right">Previsto (%)</th>
                          <th className="p-2 w-[120px] text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {budgetList.map((plano) => {
                          const b = budgets?.[plano] || {};
                          const vNum = typeof b.value === "number" ? b.value : NaN;
                          const pNum = typeof b.pct === "number" ? b.pct : NaN;
                          const vUi = budgetUi?.[plano]?.value;
                          const pUi = budgetUi?.[plano]?.pct;
                          const v = typeof vUi === "string" ? vUi : fmtBRNumber(vNum);
                          const p = typeof pUi === "string" ? pUi : fmtPctNumber(pNum);
                          return (
                            <tr key={plano} className="border-b border-white/5 hover:bg-white/5">
                              <td className="p-2 text-white/85">{plano}</td>

                              <td className="p-2 text-right">
                                <input
                                  value={v}
                                  onChange={(e) => {
                                    const s = sanitizeNumericText(e.target.value);
                                    setBudgetUi((prev) => ({
                                      ...(prev || {}),
                                      [plano]: { ...(prev?.[plano] || {}), value: s },
                                    }));
                                  }}
                                  onBlur={() => {
                                    const raw = budgetUi?.[plano]?.value ?? "";
                                    const n = round2(parseNumberInput(raw));
                                    // persiste
                                    setBudgetValue(plano, raw);
                                    // atualiza UI (preenche o % automaticamente)
                                    const pct = totalGeral > 0 && Number.isFinite(n) ? round2((n / totalBaseAll) * 100) : NaN;
                                    setBudgetUi((prev) => ({
                                      ...(prev || {}),
                                      [plano]: {
                                        ...(prev?.[plano] || {}),
                                        value: Number.isFinite(n) && n > 0 ? fmtBRNumber(n) : "",
                                        pct: Number.isFinite(pct) && pct > 0 ? fmtPctNumber(pct) : (prev?.[plano]?.pct ?? ""),
                                      },
                                    }));
                                  }}
                                  placeholder="0"
                                  inputMode="decimal"
                                  className="w-full text-right rounded-lg px-3 py-2 bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-sky-500/40"
                                  style={{ colorScheme: "dark" }}
                                />
                              </td>

                              <td className="p-2 text-right">
                                <input
                                  value={p}
                                  onChange={(e) => {
                                    const s = sanitizeNumericText(e.target.value);
                                    setBudgetUi((prev) => ({
                                      ...(prev || {}),
                                      [plano]: { ...(prev?.[plano] || {}), pct: s },
                                    }));
                                  }}
                                  onBlur={() => {
                                    const raw = budgetUi?.[plano]?.pct ?? "";
                                    const pNum = round2(parseNumberInput(raw));
                                    // persiste
                                    setBudgetPct(plano, raw);
                                    // atualiza UI (preenche o R$ automaticamente)
                                    const vNum = totalGeral > 0 && Number.isFinite(pNum) ? round2((totalBaseAll * pNum) / 100) : NaN;
                                    setBudgetUi((prev) => ({
                                      ...(prev || {}),
                                      [plano]: {
                                        ...(prev?.[plano] || {}),
                                        pct: Number.isFinite(pNum) && pNum > 0 ? fmtPctNumber(pNum) : "",
                                        value: Number.isFinite(vNum) && vNum > 0 ? fmtBRNumber(vNum) : (prev?.[plano]?.value ?? ""),
                                      },
                                    }));
                                  }}
                                  placeholder={totalGeral > 0 ? "0" : "—"}
                                  inputMode="decimal"
                                  className="w-full text-right rounded-lg px-3 py-2 bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-sky-500/40"
                                  style={{ colorScheme: "dark" }}
                                  disabled={totalGeral <= 0}
                                  title={totalGeral > 0 ? "Percentual em cima do total filtrado" : "Sem total filtrado para calcular %"}
                                />
                              </td>

                              <td className="p-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => clearBudget(plano)}
                                  className="px-2.5 py-1 rounded-lg text-[11px] border border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                                  disabled={!(b && (b.value != null || b.pct != null))}
                                >
                                  Limpar
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {!budgetList.length && (
                          <tr>
                            <td className="p-3 text-white/60 text-sm" colSpan={4}>
                              Nenhum plano encontrado.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-white/55">
                  % é calculado em cima do <span className="text-white/80">Total Geral filtrado</span> (agora: <span className="text-white/80">{fmtBRL(totalGeral)}</span>).
                  Dica: depois a gente pode usar esses valores para mostrar <span className="text-white/80">Real x Previsto</span> nos gráficos.
                </div>
              </div>
            </div>
          </div>
        )}

        
        {/* MODAL STATUS (clique nos chips Dentro/Atenção/Estourado/Sem) */}
        {statusModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
            <div className="max-w-5xl mx-auto p-4 md:p-4">
              <div
                className="rounded-2xl p-4 md:p-5 shadow-xl"
                style={{ border: `1px solid ${C_CARD_BORDER}`, background: "rgba(12,17,24,0.98)" }}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white/90">
                      Planos {statusModalKey === "ok" ? "Dentro" : statusModalKey === "warn" ? "em Atenção" : statusModalKey === "over" ? "Estourados" : "Sem orçamento"}
                    </div>
                    <div className="text-[11px] text-white/60">
                      {statusPlanosFiltered.length} plano(s) • Base: filtros atuais
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      value={statusModalQuery}
                      onChange={(e) => setStatusModalQuery(e.target.value)}
                      placeholder="Buscar plano..."
                      className="w-56 max-w-[60vw] rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 outline-none focus:border-white/20"
                    />
                    <button
                      type="button"
                      onClick={() => setStatusModalOpen(false)}
                      className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-white/80"
                    >
                      Fechar
                    </button>
                  </div>
                </div>

                <div className="mt-3 overflow-auto rounded-xl border border-white/10">
                  <table className="min-w-[760px] w-full text-sm">
                    <thead className="bg-white/5 text-white/70">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">Status</th>
                        <th className="text-left font-medium px-3 py-2">Plano</th>
                        <th className="text-right font-medium px-3 py-2">Previsto</th>
                        <th className="text-right font-medium px-3 py-2">Real</th>
                        <th className="text-right font-medium px-3 py-2">Execução</th>
                        <th className="text-right font-medium px-3 py-2">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusPlanosFiltered.map((p) => (
                        <tr key={p.plano} className="border-t border-white/10 hover:bg-white/5">
                          <td className="px-3 py-2 text-white/80">
                            <span className="mr-2">{p.statusEmoji}</span>
                            <span className="text-[12px]">{p.statusLabel}</span>
                          </td>
                          <td className="px-3 py-2 text-white/90">{p.plano}</td>
                          <td className="px-3 py-2 text-right text-white/80">{p.previsto ? fmtBRL(p.previsto) : "—"}</td>
                          <td className="px-3 py-2 text-right text-white/80">{fmtBRL(p.real)}</td>
                          <td className="px-3 py-2 text-right">
                            {p.previsto ? (
                              <span className={`${p.execPct > 100 ? "text-rose-200" : p.execPct >= 90 ? "text-amber-200" : "text-emerald-200"} font-medium`}>
                                {p.execPct.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-white/50">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setStatusModalOpen(false);
                                setDrillPlano(p.plano);
                                setDrillMes("");
                                // opcional: já abre o modal de detalhamento do plano via pizza
                              }}
                              className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-[12px] text-white/80"
                            >
                              Abrir detalhado
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!statusPlanosFiltered.length && (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-center text-white/60">
                            Nenhum plano encontrado para esse status.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 text-[11px] text-white/50">
                  Dica: clique em <span className="text-white/70">Abrir detalhado</span> para abrir o drill daquele plano (igual clicar na pizza).
                </div>
              </div>
            </div>
          </div>
        )}

{/* MODAL DETALHE (clique nos gráficos de barras do drill) */}
        {detailOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
            <div className="max-w-6xl mx-auto p-4 md:p-4">
              <div
                className="rounded-2xl p-4 md:p-5 shadow-xl"
                style={{ border: `1px solid ${C_CARD_BORDER}`, background: "rgba(12,17,24,0.98)" }}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white/90">{detailTitle}</div>
                    <div className="text-[11px] text-white/60">
                      Itens: {detailRows.length} • Total: {fmtBRL(detailRows.reduce((a, r) => a + (r.valor || 0), 0))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={detailQuery}
                      onChange={(e) => setDetailQuery(e.target.value)}
                      placeholder="Buscar na lista..."
                      className="w-64 max-w-full rounded-lg px-3 py-2 bg-white/5 border border-white/10 text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-sky-500/40 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setDetailOpen(false)}
                      className="px-3 py-2 rounded-lg text-sm border bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                    >
                      Fechar
                    </button>
                  </div>
                </div>

                <div className="mt-4 overflow-auto rounded-xl border border-white/10">
                  <table className="min-w-[1100px] w-full text-[12px]">
                    <thead className="bg-white/5">
                      <tr className="text-left">
                        <th className="p-2">Venc.</th>
                        <th className="p-2">Plano</th>
                        <th className="p-2">Conta</th>
                        <th className="p-2">Empresa</th>
                        <th className="p-2">Fornecedor</th>
                        <th className="p-2">Status</th>
                        <th className="p-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailRows
                        .filter((r) => {
                          const q = detailQuery.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            String(r.data ?? "").toLowerCase().includes(q) ||
                            String(r.plano ?? "").toLowerCase().includes(q) ||
                            String(r.conta ?? "").toLowerCase().includes(q) ||
                            String(r.empresa ?? "").toLowerCase().includes(q) ||
                            String(r.fornecedor ?? "").toLowerCase().includes(q) ||
                            String(r.status ?? "").toLowerCase().includes(q)
                          );
                        })
                        .slice(0, 300)
                        .map((r, i) => (
                          <tr key={`${r.id}-${i}`} className="border-t border-white/10">
                            <td className="p-2 text-white/80">{r.data ?? "-"}</td>
                            <td className="p-2 text-white/90">
                              {(() => {
                                const st = planoStatusMap?.[r.plano];
                                const emoji = st?.emoji ?? "⚪";
                                if (!st || st.key === "none") {
                                  return <span className="inline-flex items-center gap-2"><span aria-hidden>{emoji}</span><span>{r.plano}</span></span>;
                                }
                                return (
                                  <span className="inline-flex items-center gap-2">
                                    <span aria-hidden>{emoji}</span>
                                    <span>{r.plano}</span>
                                    <span className={`ml-1 px-2 py-0.5 rounded-lg border text-[11px] ${st.cls}`} title={`Real: ${fmtBRL(st.real)} • Previsto: ${fmtBRL(st.previsto)} • Execução: ${(st.ratio * 100).toFixed(1)}%`}>
                                      {st.label}
                                    </span>
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="p-2 text-white/80">{r.conta}</td>
                            <td className="p-2 text-white/80">{r.empresa}</td>
                            <td className="p-2 text-white/80">{r.fornecedor}</td>
                            <td className="p-2 text-white/80">{r.status}</td>
                            <td className="p-2 text-right font-medium" style={{ color: C_GREEN }}>
                              {fmtBRL(r.valor)}
                            </td>
                          </tr>
                        ))}
                      {detailRows.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-4 text-white/60">
                            Sem itens.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="text-[11px] text-white/60 mt-2">
                  Mostrando até 300 linhas. Se quiser, eu adiciono paginação e exportar CSV.
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
