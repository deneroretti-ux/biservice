"use client";

<h1 className="text-2xl font-bold">
  Dashboard Rateio (VERSÃO NOVA)
</h1>

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ResponsiveContainer,
  BarChart,
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

  // Para Pizza/Bar: geralmente vem 1 item no payload
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

          // tenta puxar % do próprio item (pizza/bar)
          const r = p.payload || {};
          const pct = r?.pctLabel || (typeof r?.pct === "number" ? `${r.pct.toFixed(1)}%` : null);
          const cum = r?.cumPctLabel || (typeof r?.cumPct === "number" ? `${r.cumPct.toFixed(1)}%` : null);

          return (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
              <span className="text-white/80 truncate max-w-[220px]">{String(name)}</span>
              <span className="ml-auto font-semibold" style={{ color }}>
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
  const [fPlano, setFPlano] = useState("Todos");
  const [mesesSel, setMesesSel] = useState([]);
  const [outrosOpen, setOutrosOpen] = useState(false);
  const [cutoffPct, setCutoffPct] = useState(2.5);


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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.rows?.length) setRows(parsed.rows);
      if (parsed?.meta) setFileMeta(parsed.meta);
    } catch {}
  }, []);

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

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return rows.filter((r) => {
      const matchPlano = fPlano === "Todos" || r.plano === fPlano;

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

      return matchPlano && matchBusca && matchMes;
    });
  }, [rows, busca, fPlano, mesesSel]);

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

  const byPlano = useMemo(() => {
    const m = new Map();
    for (const r of filtered) m.set(r.plano, (m.get(r.plano) ?? 0) + (r.valor || 0));
    const arr = Array.from(m.entries())
      .map(([plano, valor]) => ({ plano, valor }))
      .sort((a, b) => b.valor - a.valor);
    const total = arr.reduce((a, b) => a + (b.valor || 0), 0);
    return arr.map((d) => ({
      ...d,
      pct: total ? (d.valor / total) * 100 : 0,
      pctLabel: total ? `${((d.valor / total) * 100).toFixed(1)}%` : "0.0%",
    }));
  }, [filtered]);

  const topPlanos = useMemo(() => byPlano.slice(0, 10), [byPlano]);

  const byMes = useMemo(() => {
    const m = new Map();
    for (const r of filtered) {
      const k = monthKey(r.competencia ?? r.data);
      m.set(k, (m.get(k) ?? 0) + (r.valor || 0));
    }
    return Array.from(m.entries())
      .map(([mes, valor]) => ({ mes, valor }))
      .sort((a, b) => (a.mes > b.mes ? 1 : -1));
  }, [filtered]);

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

    // adiciona % acumulado para tooltip (ordem das fatias)
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
  const drillByConta = useMemo(() => aggTop(drillRows, "conta", 12), [drillRows]);

  const drillByMes = useMemo(() => {
    // evolução do plano selecionado (independente do drillMes)
    if (!drillRowsBase.length) return [];
    const m = new Map();
    for (const r of drillRowsBase) {
      const k = monthKey(r.data ?? r.competencia);
      m.set(k, (m.get(k) ?? 0) + (r.valor || 0));
    }
    return Array.from(m.entries())
      .map(([mes, valor]) => ({ mes, valor }))
      .sort((a, b) => (a.mes > b.mes ? 1 : -1));
  }, [drillRowsBase]);

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

        <Card title="Filtros" right={<div className="text-[11px] text-white/60">Busca + Plano</div>}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] text-white/60 mb-1">Busca (plano, conta, fornecedor...)</div>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Digite para filtrar..."
                className="w-full rounded-lg px-3 py-2 bg-white/5 border border-white/10 text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-sky-500/40"
                disabled={!rows.length}
              />
            </div>

            <div>
              <div className="text-[11px] text-white/60 mb-1">Plano</div>
              <select
                value={fPlano}
                onChange={(e) => setFPlano(e.target.value)}
                className="w-full rounded-lg px-3 py-2 bg-white/5 border border-white/10 text-white outline-none focus:ring-2 focus:ring-sky-500/40"
                disabled={!rows.length}
              >
                {planos.map((p) => (
                  <option key={p} value={p} className="bg-[#0c1118]">
                    {p}
                  </option>
                ))}
              </select>
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
              </div>
            </div>

          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card title="Total Geral (após filtros)">
            <div className="text-3xl font-bold" style={{ color: C_GREEN }}>
              {fmtBRL(totalGeral)}
            </div>
            <div className="text-[11px] text-white/60 mt-1">{rows.length ? "Base real carregada" : "Carregue um Excel para alimentar os gráficos"}</div>
            {rows.length && (
              <div className="text-[11px] text-white/50 mt-1">
                Valor (min/max): {fmtBRL(debugValores.min)} / {fmtBRL(debugValores.max)} • Coluna: {debugValores.keys.join(", ") || "-"}
              </div>

            )}
            {rows.length && (
              <div className="text-[11px] text-white/50 mt-1">
                Vencimentos lidos: {debugDatas.ok}/{debugDatas.total} • Ex.: {debugDatas.sample.join(", ") || "-"}
              </div>
            )}
          </Card>

          <Card title="Linhas / Itens">
            <div className="text-3xl font-bold text-white/90">{filtered.length}</div>
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
                    <Tooltip content={<TooltipRich labelPrefix="Categoria" />} />
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
                  <BarChart data={topPlanos}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                    <XAxis dataKey="plano" hide />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                    <Tooltip content={<TooltipRich labelPrefix="Categoria" />} />
                    <Bar dataKey="valor" fill={C_BLUE} radius={[10, 10, 0, 0]} onClick={(d) => {
                      const plano = d?.name ?? d?.payload?.plano;
                      if (plano) {
                        setDrillPlano(plano);
                        setDrillMes("");
                      }
                    }}>
                      <LabelList dataKey="pctLabel" position="top" fill="rgba(255,255,255,0.75)" fontSize={12} />
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
                      <Tooltip content={<TooltipRich labelPrefix="Categoria" />} />
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
                  <LineChart data={byMes}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <Tooltip content={<TooltipRich labelPrefix="Categoria" />} />
                    <Line type="monotone" dataKey="valor" strokeWidth={3} dot={false} />
                  </LineChart>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[11px] text-white/60">Total “Outros”</div>
                <div className="text-xl font-bold" style={{ color: C_GREEN }}>
                  {fmtBRL(outrosDetalhe.total)}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 md:col-span-2">
                <div className="text-[11px] text-white/60">
                  Clique em um plano para abrir o drill (Plano → Empresa → Fornecedor)
                </div>
                <div className="mt-2 flex flex-wrap gap-2 max-h-24 overflow-auto">
                  {outrosDetalhe.rows.slice(0, 24).map((d) => (
                    <button
                      key={d.plano}
                      type="button"
                      onClick={() => {
                        setOutrosOpen(false);
                        setDrillPlano(d.plano);
                      }}
                      className="px-2 py-1 rounded-lg text-xs border bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                      title={d.plano}
                    >
                      {d.plano} • {d.pctLabel}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-sm font-semibold text-white/90 mb-2">Top planos dentro de “Outros”</div>
                <div style={{ height: 340 }}>
                  {outrosDetalhe.rows.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={outrosDetalhe.rows.slice(0, 15)} layout="vertical" margin={{ left: 24, right: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="plano" width={160} />
                        <Tooltip content={<TooltipRich labelPrefix="Plano" />} />
                        <Bar dataKey="valor" radius={[8, 8, 8, 8]}>
                          <LabelList dataKey="pctLabel" position="right" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full grid place-items-center text-white/60 text-sm">Sem dados.</div>
                  )}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
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
                      <BarChart data={drillByFornecedor}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                        <XAxis dataKey="name" hide />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                        <Tooltip content={<TooltipRich labelPrefix="Categoria" />} />
                        <Bar dataKey="valor" fill={C_BLUE} radius={[10, 10, 0, 0]} onClick={(d) => {
                          const name = d?.payload?.name ?? d?.name;
                          if (!name) return;
                          openDetail(`Títulos — Fornecedor: ${name}`, drillRows.filter((r) => r.fornecedor === name));
                        }}>
                      <LabelList dataKey="pctLabel" position="top" fill="rgba(255,255,255,0.75)" fontSize={12} />
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
                      <BarChart data={drillByEmpresa}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                        <XAxis dataKey="name" hide />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                        <Tooltip content={<TooltipRich labelPrefix="Categoria" />} />
                        <Bar dataKey="valor" fill={C_PURPLE} radius={[10, 10, 0, 0]} onClick={(d) => {
                          const name = d?.payload?.name ?? d?.name;
                          if (!name) return;
                          openDetail(`Títulos — Empresa/Unidade: ${name}`, drillRows.filter((r) => r.empresa === name));
                        }}>
                      <LabelList dataKey="pctLabel" position="top" fill="rgba(255,255,255,0.75)" fontSize={12} />
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
                      <BarChart data={drillByConta}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                        <XAxis dataKey="name" hide />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                        <Tooltip content={<TooltipRich labelPrefix="Categoria" />} />
                        <Bar dataKey="valor" fill={C_CYAN} radius={[10, 10, 0, 0]} onClick={(d) => {
                          const name = d?.payload?.name ?? d?.name;
                          if (!name) return;
                          openDetail(`Títulos — Conta: ${name}`, drillRows.filter((r) => r.conta === name));
                        }}>
                      <LabelList dataKey="pctLabel" position="top" fill="rgba(255,255,255,0.75)" fontSize={12} />
                    </Bar>
                      </BarChart>
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
                        <Tooltip content={<TooltipRich labelPrefix="Categoria" />} />
                        <Line type="monotone" dataKey="valor" stroke={C_GREEN} strokeWidth={3} dot={false} />
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


        {/* MODAL DETALHE (clique nos gráficos de barras do drill) */}
        {detailOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
            <div className="max-w-6xl mx-auto p-4 md:p-6">
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
                            <td className="p-2 text-white/90">{r.plano}</td>
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
