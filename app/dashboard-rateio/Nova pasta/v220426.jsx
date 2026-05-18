"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import * as XLSX from "xlsx";
import planoDeParaOficial from "./plano_depara_oficial.json";
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
const VIEW_FILTERS_LS_KEY = "bi_service_rateio_view_filters_v1";
const DETAIL_VIEW_LS_KEY = "bi_service_rateio_detail_view_v1";
const DRILL_VIEW_LS_KEY = "bi_service_rateio_drill_view_v1";
const STATUS_VIEW_LS_KEY = "bi_service_rateio_status_view_v1";
const OUTROS_VIEW_LS_KEY = "bi_service_rateio_outros_view_v1";
const EXECUTADO_VIEW_LS_KEY = "bi_service_rateio_executado_view_v1";

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


const BUDGET_EMPRESA_LS_KEY = "bi_service_rateio_budget_empresa_v1";

function pad2(n) {
  return String(Number(n) || 0).padStart(2, "0");
}

const BUDGET_COMPANY_NAME_MAP = {
  CENTRO: "CENTRO",
  COLINA: "COLINA",
  MONTEAZUL: "MONTE AZUL",
  MONTE_AZUL: "MONTE AZUL",
  "MONTE AZUL": "MONTE AZUL",
  PITANGUEIRAS: "PITANGUEIRAS",
  PITANGEURAS: "PITANGUEIRAS",
  SHOPPING: "SHOPPING",
  VD: "VD",
  VIRADOURO: "VIRADOURO",
};

function normalizeCompanyNameBudget(v) {
  const raw = String(v ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  const compact = raw
    .replace(/\.[^.]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^A-Z0-9 ]+/g, " ")
    .trim();

  const compactNoSpace = compact.replace(/\s+/g, "");
  const direct = BUDGET_COMPANY_NAME_MAP[compact] || BUDGET_COMPANY_NAME_MAP[compactNoSpace];
  if (direct) return direct;

  const tokenSet = new Set(compact.split(" ").filter(Boolean));
  const has = (...terms) => terms.every((t) => tokenSet.has(t));

  if (has("MONTE", "AZUL") || compact.includes("MONTE AZUL") || compact.includes("MONTEAZUL")) return "MONTE AZUL";
  if (compact.includes("PITANGUEIRAS") || compact.includes("PITANGEURAS")) return "PITANGUEIRAS";
  if (compact.includes("VIRADOURO")) return "VIRADOURO";
  if (compact.includes("SHOPPING")) return "SHOPPING";
  if (compact === "VD" || tokenSet.has("VD") || compact.includes(" VD ") || compact.startsWith("VD ") || compact.endsWith(" VD")) return "VD";
  if (compact.includes("COLINA")) return "COLINA";
  if (compact.includes("CENTRO")) return "CENTRO";

  return compact;
}



const PLANO_MATCH_LS_KEY = "bi_service_rateio_plano_depara_v2";

const DEFAULT_PLANO_MATCH_MAP = {
  "compra de mercadorias fc": "2.1.1 - CMV",
  "compra de mercadorias sc": "2.1.1 - CMV",
  "compra de mercadorias lf": "2.1.1 - CMV",
  "compra de mercadorias": "2.1.1 - CMV",
  "cmv": "2.1.1 - CMV",

  "icms st fc imposto sobre operacoes relativas a circulacao de mercadorias": "2.1.1 - CMV",
  "icms st fc": "2.1.1 - CMV",
  "icms st": "2.1.1 - CMV",
  "ipi fc imposto sobre produtos industrializados": "2.1.1 - CMV",
  "ipi fc": "2.1.1 - CMV",
  "ipi": "2.1.1 - CMV",
  "material auxiliar de embalagem mae": "4.5 - Material De Embalagem",
  "mae": "4.5 - Material De Embalagem",

  "esforcos de marketing promocional": "4.4 - Esforços De Marketing Promocional (3%)",
  "despesas com encontro de ciclo": "4.4.1 - Encontro de Ciclo",
  "material promocional": "4.4.6 - Produção/Propaganda",
  "material de publicidade e propaganda": "4.4.6 - Produção/Propaganda",
  "mkt reg 01 midia e ativacao gestao do gb": "4.4.4 - Mídia Local",
  "mkt reg 04 midia e ativacao gestao do cp com agencias locais": "4.4.4 - Mídia Local",
  "mkt reg 05 midia e ativacao gestao do cp com opus ou idea3": "4.4.5 - Mídia Regional",
  "mkt reg 06 impressao e producao de material": "4.4.6 - Produção/Propaganda",

  "remuneracao de esforcos tech ret": "6.2.11 - ZENITH - Outros Serviços Terceirizados",
  "servicos de informatica": "6.2.3 -  Serviços De Informática",

  "irrf funcionario imposto sobre a renda retido na fonte": "6.1.2.6 - IRRF - Salários",
  "irrf funcionario": "6.1.2.6 - IRRF - Salários",
  "aviso previo indenizado": "6.1.4.2 - Indenizações / Rescisões",
  "ferias proporcional indenizadas": "6.1.4.2 - Indenizações / Rescisões",
  "aviso previo proporcional lei 12 506 11": "6.1.4.2 - Indenizações / Rescisões",
  "13o salario indenizado": "6.1.4.2 - Indenizações / Rescisões",
  "multa fgts art 479 da clt fundo de garantia do tempo de servico": "6.1.4.2 - Indenizações / Rescisões",
  "recrutamento e selecao": "6.1.4.4 - Recrutamento e Seleção",

  "despesas gerencial": "6.8 - Despesas Administrativas",
  "outros impostos e taxas": "6.9.3 - Impostos e Taxas",
  "central de inicios": "6.9 - Despesas Gerais",
  "bens nao depreciaveis valor ate 1 200 00": "6.10.3 - Bens não Depreciáveis",
  "maquinas equipamentos e moveis fc": "6.10.1 - Máq., Equip. e Móveis",
};


const STOPWORDS_PLANO = new Set([
  "de", "da", "do", "das", "dos", "e", "em", "para", "por", "com",
  "fc", "sc", "lf", "tipo", "outras", "outros", "grupo", "cia"
]);

function normalizePlanoBudgetKey(v) {
  return String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^\d+(\.\d+)*\s*-\s*/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(sa|ltda|eireli|me|epp|fc)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function planoTokens(v) {
  return normalizePlanoBudgetKey(v)
    .split(" ")
    .filter(Boolean)
    .filter((t) => !STOPWORDS_PLANO.has(t));
}

function diceCoefficient(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = new Map();
  for (let i = 0; i < a.length - 1; i++) {
    const gram = a.slice(i, i + 2);
    bigrams.set(gram, (bigrams.get(gram) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const gram = b.slice(i, i + 2);
    const count = bigrams.get(gram) || 0;
    if (count > 0) {
      bigrams.set(gram, count - 1);
      intersection++;
    }
  }

  return (2 * intersection) / ((a.length - 1) + (b.length - 1));
}

function tokenSimilarity(a, b) {
  const ta = new Set(planoTokens(a));
  const tb = new Set(planoTokens(b));
  if (!ta.size || !tb.size) return 0;

  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection++;

  return intersection / Math.max(ta.size, tb.size);
}

function planoSimilarity(a, b) {
  const na = normalizePlanoBudgetKey(a);
  const nb = normalizePlanoBudgetKey(b);
  const s1 = diceCoefficient(na, nb);
  const s2 = tokenSimilarity(na, nb);
  return s1 * 0.55 + s2 * 0.45;
}

function loadPlanoMatchMap() {
  return {
    ...DEFAULT_PLANO_MATCH_MAP,
    ...planoDeParaOficial,
  };
}

function savePlanoMatchMap(map) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PLANO_MATCH_LS_KEY, JSON.stringify(map || {}));
  } catch {}
}

function resolvePlanoMatch(planoRateio, drePlanos = [], planoMap = {}) {
  const normalizedRateio = normalizePlanoBudgetKey(planoRateio);
  if (!normalizedRateio) {
    return { matched: null, confidence: 0, mode: "unmatched", normalizedRateio };
  }

  const mapped = planoMap?.[normalizedRateio];
  if (mapped) {
    return { matched: mapped, confidence: 1, mode: "mapped", normalizedRateio };
  }

  const exact = drePlanos.find((p) => normalizePlanoBudgetKey(p) === normalizedRateio);
  if (exact) {
    return { matched: exact, confidence: 1, mode: "exact", normalizedRateio };
  }

  let best = null;
  let bestScore = 0;
  for (const p of drePlanos) {
    const score = planoSimilarity(planoRateio, p);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }

  if (best && bestScore >= 0.96) {
    return { matched: best, confidence: bestScore, mode: "auto", normalizedRateio };
  }
  if (best && bestScore >= 0.90) {
    return { matched: best, confidence: bestScore, mode: "approx", normalizedRateio };
  }
  return { matched: null, confidence: bestScore, mode: "unmatched", normalizedRateio };
}

function planoMatchesBudget(planoRateio, planoBudget, drePlanos = [], planoMap = {}) {
  const match = resolvePlanoMatch(planoRateio, drePlanos, planoMap);
  return !!match?.matched && normalizePlanoBudgetKey(match.matched) === normalizePlanoBudgetKey(planoBudget);
}

function budgetEmpresaMatchesFilter(budgetEmpresa, filtroEmpresa) {
  if (!filtroEmpresa || filtroEmpresa === "Todas") return true;

  const normalizeEmpresa = (v) =>
    String(v ?? "")
      .trim()
      .toUpperCase()
      .replace(/^\d+\s*\|\s*/g, "")
      .replace(/^BOTI\s+/g, "")
      .replace(/^O\s+BOTICARIO\s+/g, "")
      .replace(/^BOTICARIO\s+/g, "")
      .trim();

  const a = normalizeEmpresa(budgetEmpresa);
  const b = normalizeEmpresa(filtroEmpresa);
  return a === b;
}

function monthIndexFromNameBR(v) {
  const s = String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

  const map = {
    JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6,
    JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12,
    JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
  };
  return map[s] || null;
}

async function parseBudgetReceitaXlsx(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });

  const headerRow = matrix.find((r) => String(r?.[0] ?? "").toUpperCase().includes("MÊS") || String(r?.[0] ?? "").toUpperCase().includes("MES")) || [];
  const headerIdx = matrix.indexOf(headerRow);
  const yearMatch = String(file?.name || "").match(/(20\d{2})/);
  const year = Number(yearMatch?.[1]) || new Date().getFullYear();

  const companies = headerRow.slice(1).map((c) => normalizeCompanyNameBudget(c)).filter(Boolean);
  const entries = {};

  for (const c of companies) entries[c] = {};

  for (const row of matrix.slice(headerIdx + 1)) {
    const month = monthIndexFromNameBR(row?.[0]);
    if (!month) continue;
    const mes = `${year}-${pad2(month)}`;
    for (let i = 1; i < headerRow.length; i++) {
      const company = normalizeCompanyNameBudget(headerRow[i]);
      if (!company) continue;
      entries[company][mes] = Math.abs(toNumberBR(row?.[i]));
    }
  }

  return { year, companies, entries, filename: file?.name || "" };
}

async function parseBudgetDreXlsx(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets["DRE"] || wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });

  const header = matrix[0] || [];
  const monthCols = [];
  for (let i = 1; i < header.length; i++) {
    const m = String(header[i] ?? "").match(/^(\d{2})\/(\d{4})$/);
    if (m) monthCols.push({ idx: i, month: Number(m[1]), year: Number(m[2]) });
  }

  const company = normalizeCompanyNameBudget(String(file?.name || "").replace(/\.[^.]+$/, ""));
  const entries = [];

  for (const row of matrix.slice(1)) {
    const rawName = String(row?.[0] ?? "").trim();
    if (!rawName) continue;

    for (const mc of monthCols) {
      const valor = Math.abs(toNumberBR(row?.[mc.idx]));
      if (!valor) continue;
      entries.push({
        empresa: company,
        month: mc.month,
        sourceYear: mc.year,
        plano: rawName,
        planoKey: normKey(rawName),
        valor,
      });
    }
  }

  return { company, entries, filename: file?.name || "" };
}

function buildBudgetEmpresaPayload(receitaData, dreDataList) {
  const year = Number(receitaData?.year) || new Date().getFullYear();
  const entries = {};
  const unmatched = new Set();

  for (const dre of dreDataList || []) {
    const company = normalizeCompanyNameBudget(dre?.company);
    const receitaByMonth = receitaData?.entries?.[company];
    if (!receitaByMonth) {
      unmatched.add(company);
      continue;
    }

    for (const item of dre.entries || []) {
      const mes = `${year}-${pad2(item.month)}`;
      const receita = Math.abs(toNumberBR(receitaByMonth?.[mes]));
      if (!receita) continue;

      const pct = (Number(item.valor) || 0) / receita;
      const previsto = receita * pct;
      const key = `${company}|${normKey(item.plano)}`;

      const prev = entries[key] || {
        empresa: company,
        plano: item.plano,
        planoKey: normKey(item.plano),
        totalPrevisto: 0,
        months: {},
      };

      prev.totalPrevisto += previsto;
      prev.months[mes] = {
        receita,
        pct,
        previsto,
        valorDreBase: Number(item.valor) || 0,
      };

      entries[key] = prev;
    }
  }

  return {
    year,
    entries,
    summary: {
      year,
      empresas: Array.from(new Set(Object.values(entries).map((x) => x.empresa))).sort(),
      planos: Array.from(new Set(Object.values(entries).map((x) => x.plano))).sort(),
      combinacoes: Object.keys(entries).length,
      unmatchedCompanies: Array.from(unmatched),
      receitaFile: receitaData?.filename || "",
      dreFiles: (dreDataList || []).map((x) => x.filename || ""),
    },
  };
}

function getStandaloneBootParams() {
  if (typeof window === "undefined") {
    return { view: "", budgetStandalone: false };
  }
  try {
    const sp = new URLSearchParams(window.location.search);
    return {
      view: sp.get("view") || "",
      budgetStandalone: sp.get("orcamentos") === "1",
    };
  } catch {
    return { view: "", budgetStandalone: false };
  }
}

export default function DashboardRateioUploadInteligentePage() {
  const inputRef = useRef(null);

  const [rows, setRows] = useState([]);
  const [fileMeta, setFileMeta] = useState({ name: "", size: 0, loadedAt: "" });
  const [dedupeInfo, setDedupeInfo] = useState({ removed: 0, kept: 0, total: 0 });

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
  const [budgetEmpresaFilter, setBudgetEmpresaFilter] = useState("Todas");
  const [budgetMesFilter, setBudgetMesFilter] = useState("Todos");
  const [budgets, setBudgets] = useState({}); // { [plano]: { value?: number, pct?: number, mode?: "value"|"pct" } }
  // UI state (permite digitar vírgula/ponto sem o input "pular")
  const [budgetUi, setBudgetUi] = useState({}); 
  const budgetsSeededRef = useRef(false);

  const receitaBudgetInputRef = useRef(null);
  const dreBudgetInputRef = useRef(null);
  const [budgetStandalone, setBudgetStandalone] = useState(() => getStandaloneBootParams().budgetStandalone);
  const [budgetReceitaFile, setBudgetReceitaFile] = useState(null);
  const [budgetDreFiles, setBudgetDreFiles] = useState([]);
  const [budgetEmpresaLoading, setBudgetEmpresaLoading] = useState(false);
  const [budgetEmpresaError, setBudgetEmpresaError] = useState("");
  const [budgetEmpresaData, setBudgetEmpresaData] = useState({ year: null, entries: {}, summary: null });
  const [budgetPersistTick, setBudgetPersistTick] = useState(0);
  const [budgetEmpresaHydrated, setBudgetEmpresaHydrated] = useState(false);

  const generatedBudgetAvailable = useMemo(
    () => Object.keys(budgetEmpresaData?.entries || {}).length > 0,
    [budgetEmpresaData]
  );

  const [planoMatchMap, setPlanoMatchMap] = useState({});

  useEffect(() => {
    setPlanoMatchMap(loadPlanoMatchMap());
  }, []);

  const selectedMonthKeys = useMemo(() => {
    if (!mesesSel?.length) return null;
    return new Set(mesesSel.slice().sort((a, b) => a - b).map((mi) => String(mi + 1).padStart(2, "0")));
  }, [mesesSel]);

  const budgetDrePlanos = useMemo(
    () => Array.from(new Set(Object.values(budgetEmpresaData?.entries || {}).map((item) => String(item?.plano ?? "")).filter(Boolean))),
    [budgetEmpresaData]
  );

  const planoMatchDiagnostics = useMemo(() => {
    const diagnostics = {};
    for (const plano of Array.from(new Set(rows.map((r) => String(r?.plano ?? "")).filter(Boolean)))) {
      diagnostics[plano] = resolvePlanoMatch(plano, budgetDrePlanos, planoMatchMap);
    }
    return diagnostics;
  }, [rows, budgetDrePlanos, planoMatchMap]);

  useEffect(() => {
    if (!budgetDrePlanos.length) return;
    setPlanoMatchMap((prev) => {
      const next = { ...(prev || {}) };
      let changed = false;

      for (const plano of Array.from(new Set(rows.map((r) => String(r?.plano ?? "")).filter(Boolean)))) {
        const normalized = normalizePlanoBudgetKey(plano);
        if (!normalized || next[normalized]) continue;
        const match = resolvePlanoMatch(plano, budgetDrePlanos, next);
        if (match?.matched && (match.mode === "exact" || match.mode === "auto")) {
          next[normalized] = match.matched;
          changed = true;
        }
      }

      if (changed) {
        savePlanoMatchMap(next);
        return next;
      }
      return prev;
    });
  }, [rows, budgetDrePlanos]);

  const budgetEmpresaIndex = useMemo(() => {
    const index = new Map();
    for (const item of Object.values(budgetEmpresaData?.entries || {})) {
      const normalized = normalizePlanoBudgetKey(item?.plano);
      if (!normalized) continue;
      const arr = index.get(normalized) || [];
      arr.push(item);
      index.set(normalized, arr);
    }
    return index;
  }, [budgetEmpresaData]);

  const generatedBudgetMetaForPlano = (plano, empresaFiltro = "Todas", monthKeySet = null) => {
    const match = resolvePlanoMatch(plano, budgetDrePlanos, planoMatchMap);

    if (!match?.matched || match?.mode === "approx") {
      return { valor: 0, estimado: false, match };
    }

    const normalized = normalizePlanoBudgetKey(match.matched);
    const items = budgetEmpresaIndex.get(normalized) || [];

    let total = 0;
    let foundAny = false;

    for (const item of items) {
      if (!budgetEmpresaMatchesFilter(item?.empresa, empresaFiltro)) continue;
      for (const [mes, mm] of Object.entries(item?.months || {})) {
        const mesNum = String(mes).split("-")[1] || "";
        if (monthKeySet && !monthKeySet.has(mesNum)) continue;
        const valorMes = typeof mm === "number" ? mm : Number(mm?.previsto ?? mm ?? 0);
        if (Number.isFinite(valorMes)) {
          total += valorMes;
          foundAny = true;
        }
      }
    }

    if (foundAny) {
      return { valor: total, estimado: false, match };
    }

    return { valor: 0, estimado: false, match };
  };

  const generatedBudgetValueForPlano = (plano, empresaFiltro = "Todas", monthKeySet = null) => {
    return generatedBudgetMetaForPlano(plano, empresaFiltro, monthKeySet).valor;
  };

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
      openOutrosStandalone();
      return;
    }

    openDrillStandalone(plano);
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
  const [statusStandaloneRows, setStatusStandaloneRows] = useState([]);
  const [standaloneView, setStandaloneView] = useState(() => getStandaloneBootParams().view);
  const [executadoOpen, setExecutadoOpen] = useState(false);
  const [executadoQuery, setExecutadoQuery] = useState("");
  const [executadoEmpresa, setExecutadoEmpresa] = useState("Todas");
  const [executadoPlano, setExecutadoPlano] = useState("Todos");
  const [executadoMeses, setExecutadoMeses] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.rows?.length) setRows(parsed.rows);
      if (parsed?.meta) {
        setFileMeta(parsed.meta);
        setDedupeInfo({
          removed: Number(parsed.meta?.duplicatesRemoved || 0),
          kept: Number(parsed.meta?.finalCount || (Array.isArray(parsed.rows) ? parsed.rows.length : 0)),
          total: Number(parsed.meta?.rawCount || (Array.isArray(parsed.rows) ? parsed.rows.length : 0)),
        });
      }
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


  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      setBudgetStandalone(sp.get("orcamentos") === "1");
      const view = sp.get("view") || "";
      setStandaloneView(view);

      const rawFilters = localStorage.getItem(VIEW_FILTERS_LS_KEY);
      if (rawFilters) {
        const saved = JSON.parse(rawFilters);
        if (typeof saved?.busca === "string") setBusca(saved.busca);
        if (typeof saved?.fEmpresa === "string") setFEmpresa(saved.fEmpresa);
        if (typeof saved?.fPlano === "string") setFPlano(saved.fPlano);
        if (Array.isArray(saved?.mesesSel)) setMesesSel(saved.mesesSel);
      }

      if (view === "drill") {
        setDrillPlano(sp.get("plano") || null);
        setDrillMes(sp.get("mes") || "");
        setDetailTitle("");
        const rawDrill = localStorage.getItem(DRILL_VIEW_LS_KEY);
        if (rawDrill) {
          const parsed = JSON.parse(rawDrill);
          if (Array.isArray(parsed?.rows)) setDetailRows(parsed.rows);
        }
      }

      if (view === "status") {
        setStatusModalKey(sp.get("status") || "over");
        setStatusModalQuery("");
        const rawStatus = localStorage.getItem(STATUS_VIEW_LS_KEY);
        if (rawStatus) {
          const parsed = JSON.parse(rawStatus);
          if (parsed?.statusKey) setStatusModalKey(parsed.statusKey);
          if (Array.isArray(parsed?.rows)) setStatusStandaloneRows(parsed.rows);
          if (parsed?.title) setDetailTitle(parsed.title);
        }
      }

      if (view === "outros") {
        const rawOutros = localStorage.getItem(OUTROS_VIEW_LS_KEY);
        if (rawOutros) {
          const parsed = JSON.parse(rawOutros);
          if (Array.isArray(parsed?.rows)) {
            setDetailRows(parsed.rows);
            setDetailTitle(parsed?.title || "Detalhamento — Outros");
          }
        }
      }

      if (view === "detail") {
        const rawDetail = localStorage.getItem(DETAIL_VIEW_LS_KEY);
        if (rawDetail) {
          const parsed = JSON.parse(rawDetail);
          setDetailTitle(parsed?.title || "Detalhes");
          setDetailRows(Array.isArray(parsed?.rows) ? parsed.rows : []);
          setDetailQuery("");
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BUDGET_EMPRESA_LS_KEY);
      if (!raw) {
        setBudgetEmpresaHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed?.data || parsed?.meta) {
        if (parsed?.data) setBudgetEmpresaData(parsed.data);
        if (parsed?.meta?.receitaFile) setBudgetReceitaFile({ name: parsed.meta.receitaFile, __restored: true });
        if (Array.isArray(parsed?.meta?.dreFiles)) {
          setBudgetDreFiles(parsed.meta.dreFiles.map((name) => ({ name, __restored: true })));
        }
        setBudgetPersistTick((x) => x + 1);
      }
    } catch {}
    finally {
      setBudgetEmpresaHydrated(true);
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
    if (!budgetEmpresaHydrated) return;
    try {
      const hasEntries = Object.keys(budgetEmpresaData?.entries || {}).length > 0;
      const hasReceita = !!budgetReceitaFile?.name;
      const hasDres = (budgetDreFiles || []).length > 0;
      if (!hasEntries && !hasReceita && !hasDres) return;
      localStorage.setItem(
        BUDGET_EMPRESA_LS_KEY,
        JSON.stringify({
          data: budgetEmpresaData,
          meta: {
            receitaFile: budgetReceitaFile?.name || "",
            dreFiles: (budgetDreFiles || []).map((f) => f?.name || String(f)),
            summary: budgetEmpresaData?.summary || null,
            savedAt: new Date().toLocaleString("pt-BR"),
          },
        })
      );
    } catch {}
  }, [budgetEmpresaHydrated, budgetEmpresaData, budgetReceitaFile, budgetDreFiles]);



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
    setDedupeInfo({ removed: 0, kept: 0, total: 0 });
    try {
      localStorage.removeItem(LS_KEY);
    } catch {}
  }

  async function handleFile(fileOrFiles) {
    setLoading(true);
    setError("");
    try {
      const files = Array.isArray(fileOrFiles)
        ? fileOrFiles.filter(Boolean)
        : Array.from(fileOrFiles || []).filter(Boolean);

      if (!files.length) throw new Error("Selecione ao menos um arquivo.");

      const maxMB = 25;
      for (const file of files) {
        const isXlsx = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
        if (!isXlsx) throw new Error(`Formato inválido em ${file.name}. Envie apenas .xlsx ou .xls`);
        if (file.size > maxMB * 1024 * 1024) {
          throw new Error(`Arquivo muito grande (${file.name} - ${(file.size / 1024 / 1024).toFixed(1)}MB). Limite: ${maxMB}MB`);
        }
      }

      const parsedList = [];
      for (const file of files) {
        const normalized = await parseXlsxSmart(file);
        parsedList.push({ file, normalized });
      }

      const rawRows = parsedList.flatMap(({ normalized }) => Array.isArray(normalized?.rows) ? normalized.rows : []);
      const dedupedMap = new Map();
      for (const row of rawRows) {
        const dedupeKey = [
          String(row?.data ?? ""),
          String(row?.competencia ?? ""),
          normKey(row?.plano),
          normKey(row?.conta),
          normKey(row?.empresa),
          normKey(row?.fornecedor),
          normKey(row?.status),
          Number(row?.valor || 0).toFixed(2),
        ].join("|");
        if (!dedupedMap.has(dedupeKey)) dedupedMap.set(dedupeKey, row);
      }
      const nextRows = Array.from(dedupedMap.values());
      const duplicatesRemoved = Math.max(0, rawRows.length - nextRows.length);
      const totalSize = files.reduce((acc, file) => acc + (Number(file.size) || 0), 0);
      const nextMeta = {
        name: files.length === 1 ? files[0].name : `${files.length} arquivos de rateio`,
        size: totalSize,
        loadedAt: new Date().toLocaleString("pt-BR"),
        count: files.length,
        names: files.map((file) => file.name),
        duplicatesRemoved,
        rawCount: rawRows.length,
        finalCount: nextRows.length,
      };

      setRows(nextRows);
      setFileMeta(nextMeta);
      setDedupeInfo({ removed: duplicatesRemoved, kept: nextRows.length, total: rawRows.length });
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ rows: nextRows, meta: nextMeta }));
      } catch {}
    } catch (e) {
      setError(e?.message ?? "Erro ao ler arquivo.");
    } finally {
      setLoading(false);
    }
  }

  function onDrop(ev) {
    ev.preventDefault();
    const files = Array.from(ev.dataTransfer?.files || []);
    if (files.length) handleFile(files);
  }
  function onDragOver(ev) {
    ev.preventDefault();
  }


  
  function persistBudgetEmpresaState() {
    try {
      const hasEntries = Object.keys(budgetEmpresaData?.entries || {}).length > 0;
      const hasReceita = !!budgetReceitaFile?.name;
      const hasDres = (budgetDreFiles || []).length > 0;
      if (!hasEntries && !hasReceita && !hasDres) return;
      localStorage.setItem(
        BUDGET_EMPRESA_LS_KEY,
        JSON.stringify({
          data: budgetEmpresaData,
          meta: {
            receitaFile: budgetReceitaFile?.name || "",
            dreFiles: (budgetDreFiles || []).map((f) => f?.name || String(f)),
            summary: budgetEmpresaData?.summary || null,
            savedAt: new Date().toLocaleString("pt-BR"),
          },
        })
      );
    } catch {}
  }

  function persistDashboardState() {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          rows,
          meta: fileMeta,
        })
      );
    } catch {}
  }

  function persistViewFilters() {
    try {
      localStorage.setItem(
        VIEW_FILTERS_LS_KEY,
        JSON.stringify({ busca, fEmpresa, fPlano, mesesSel })
      );
    } catch {}
  }

  function returnToDashboardFromStandalone() {
    try {
      if (window.opener && !window.opener.closed) {
        try { window.opener.focus(); } catch {}
        try { window.close(); } catch {}
        return;
      }
    } catch {}
    try {
      window.location.href = window.location.pathname;
    } catch {}
  }

  function openStandaloneView(view, params = {}) {
    try {
      persistViewFilters();
      const sp = new URLSearchParams();
      sp.set("view", view);
      Object.entries(params || {}).forEach(([k, v]) => {
        if (v != null && v !== "") sp.set(k, String(v));
      });
      const url = `${window.location.pathname}?${sp.toString()}`;
      const win = window.open(url, "_blank");
      try { win?.focus?.(); } catch {}
    } catch {}
  }

  function openOutrosStandalone() {
    try {
      persistViewFilters();
      localStorage.setItem(OUTROS_VIEW_LS_KEY, JSON.stringify({
        title: "Detalhamento — Outros",
        rows: Array.isArray(outrosDetalhe?.rows) ? outrosDetalhe.rows : [],
      }));
      const url = `${window.location.pathname}?view=outros`;
      const win = window.open(url, "_blank");
      try { win?.focus?.(); } catch {}
    } catch {}
  }

  function openDrillStandalone(plano, mes = "") {
    if (!plano) return;
    try {
      persistViewFilters();

      const readStoredDatasetRows = () => {
        try {
          const rawDataset = localStorage.getItem(LS_KEY);
          const parsedDataset = rawDataset ? JSON.parse(rawDataset) : null;
          return Array.isArray(parsedDataset?.rows) ? parsedDataset.rows : [];
        } catch {
          return [];
        }
      };

      let sourceRows = readStoredDatasetRows();
      if (!sourceRows.length && Array.isArray(rows) && rows.length) {
        sourceRows = rows;
      }

      let empresaAtual = "Todas";
      let mesesAtuais = [];
      try {
        const rawFilters = localStorage.getItem(VIEW_FILTERS_LS_KEY);
        const parsedFilters = rawFilters ? JSON.parse(rawFilters) : null;
        if (typeof parsedFilters?.fEmpresa === "string" && parsedFilters.fEmpresa) {
          empresaAtual = parsedFilters.fEmpresa;
        } else if (typeof fEmpresa === "string" && fEmpresa) {
          empresaAtual = fEmpresa;
        }
        if (Array.isArray(parsedFilters?.mesesSel)) {
          mesesAtuais = parsedFilters.mesesSel;
        } else if (Array.isArray(mesesSel)) {
          mesesAtuais = mesesSel;
        }
      } catch {}

      const alvoPlano = normalizePlanoBudgetKey(plano);
      const matchesPlano = (r, useNormalizedPlano = false) => {
        if (useNormalizedPlano) return normalizePlanoBudgetKey(r?.plano) === alvoPlano;
        return String(r?.plano ?? "").trim() === String(plano ?? "").trim();
      };

      const matchesEmpresa = (r, useEmpresaFilter = true) => {
        if (!useEmpresaFilter || empresaAtual === "Todas") return true;
        return String(r?.empresa ?? "").trim() === String(empresaAtual ?? "").trim();
      };

      const matchesMes = (r, useMesFilter = true) => {
        if (!useMesFilter || !mesesAtuais.length) return true;
        const mi = mesIndexFromISO(r?.data ?? r?.competencia);
        return mesesAtuais.includes(mi);
      };

      const findRowsForPlano = (useNormalizedPlano = false, useEmpresaFilter = true, useMesFilter = true) => {
        return sourceRows.filter((r) => {
          if (!matchesPlano(r, useNormalizedPlano)) return false;
          if (!matchesEmpresa(r, useEmpresaFilter)) return false;
          if (!matchesMes(r, useMesFilter)) return false;
          return true;
        });
      };

      let drillSnapshotRows = findRowsForPlano(false, true, true);
      if (!drillSnapshotRows.length) drillSnapshotRows = findRowsForPlano(true, true, true);
      if (!drillSnapshotRows.length) drillSnapshotRows = findRowsForPlano(false, true, false);
      if (!drillSnapshotRows.length) drillSnapshotRows = findRowsForPlano(true, true, false);
      if (!drillSnapshotRows.length) drillSnapshotRows = findRowsForPlano(false, false, false);
      if (!drillSnapshotRows.length) drillSnapshotRows = findRowsForPlano(true, false, false);

      localStorage.setItem(
        DRILL_VIEW_LS_KEY,
        JSON.stringify({
          plano: String(plano),
          mes: String(mes || ""),
          title: `Detalhamento — ${plano}`,
          rows: drillSnapshotRows,
          empresa: drillSnapshotRows.length ? empresaAtual : "Todas",
          mesesSel: drillSnapshotRows.length ? mesesAtuais : [],
        })
      );

      const sp = new URLSearchParams();
      sp.set("view", "drill");
      sp.set("plano", String(plano));
      if (mes) sp.set("mes", String(mes));

      const url = `${window.location.pathname}?${sp.toString()}`;
      const win = window.open(url, "_blank");
      try { win?.focus?.(); } catch {}
    } catch (e) {
      console.error("openDrillStandalone", e);
    }
  }

  function openStatusStandalone(statusKey) {
    try {
      persistViewFilters();

      const finalKey = String(statusKey || "over");
      const snapshotRows = statusPlanos
        .filter((p) => p.statusKey === finalKey)
        .map((p) => ({ ...p }));

      localStorage.setItem(
        STATUS_VIEW_LS_KEY,
        JSON.stringify({
          statusKey: finalKey,
          title: `Planos por status`,
          rows: snapshotRows,
        })
      );

      const url = `${window.location.pathname}?view=status&status=${encodeURIComponent(finalKey)}`;
      const win = window.open(url, "_blank");
      try { win?.focus?.(); } catch {}
    } catch (e) {
      console.error("openStatusStandalone", e);
    }
  }

  function openDetailStandalone(title, rows) {
    try {
      persistViewFilters();
      localStorage.setItem(DETAIL_VIEW_LS_KEY, JSON.stringify({ title, rows }));
      const url = `${window.location.pathname}?view=detail`;
      const win = window.open(url, "_blank");
      try { win?.focus?.(); } catch {}
    } catch {}
  }


  function returnToDashboardFromBudget() {
    try {
      persistDashboardState();
      persistBudgetEmpresaState();
    } catch {}
    try {
      if (window.opener && !window.opener.closed) {
        try { window.opener.focus(); } catch {}
        try { window.close(); } catch {}
        return;
      }
    } catch {}
    try {
      window.location.href = window.location.pathname;
    } catch {}
  }

function openBudgetManager() {
    try {
      persistDashboardState();
      const url = `${window.location.pathname}?orcamentos=1`;
      const win = window.open(url, "_blank");
      try { win?.focus?.(); } catch {}
    } catch {
      setBudgetOpen(true);
    }
  }

  function openExecutadoView() {
    setExecutadoEmpresa(fEmpresa || "Todas");
    setExecutadoPlano("Todos");
    setExecutadoQuery(busca || "");
    setExecutadoMeses(Array.isArray(mesesSel) ? [...mesesSel] : []);
    setExecutadoOpen(true);
  }

  async function processBudgetEmpresaFiles() {
    setBudgetEmpresaLoading(true);
    setBudgetEmpresaError("");
    try {
      if (!budgetReceitaFile) throw new Error("Selecione a planilha de receita.");
      if (!budgetDreFiles?.length) throw new Error("Selecione os arquivos DRE das empresas.");

      const restoredOnly = (budgetDreFiles || []).some((f) => f?.__restored && typeof f?.arrayBuffer !== "function");
      if (restoredOnly) {
        if (Object.keys(budgetEmpresaData?.entries || {}).length) {
          throw new Error("Os DREs mostrados foram restaurados só como referência. A base processada já está salva e pode ser usada no dashboard. Reenvie os arquivos apenas se quiser recalcular.");
        }
        throw new Error("Os nomes dos DREs foram restaurados, mas os arquivos originais não podem ser reabertos pelo navegador. Reenvie os DREs apenas se quiser recalcular a base.");
      }

      const receitaData = await parseBudgetReceitaXlsx(budgetReceitaFile);
      const dreDataList = [];
      for (const f of budgetDreFiles) {
        if (typeof f?.arrayBuffer !== "function") continue;
        dreDataList.push(await parseBudgetDreXlsx(f));
      }
      const payload = buildBudgetEmpresaPayload(receitaData, dreDataList);
      payload.summary = { ...(payload.summary || {}), savedAt: new Date().toLocaleString("pt-BR") };
      setBudgetEmpresaData(payload);
      try {
        localStorage.setItem(
          BUDGET_EMPRESA_LS_KEY,
          JSON.stringify({
            data: payload,
            meta: {
              receitaFile: budgetReceitaFile?.name || "",
              dreFiles: (budgetDreFiles || []).map((f) => f?.name || String(f)),
              summary: payload?.summary || null,
              savedAt: new Date().toLocaleString("pt-BR"),
            },
          })
        );
      } catch {}
    } catch (e) {
      setBudgetEmpresaError(e?.message || "Erro ao processar orçamento por empresa.");
    } finally {
      setBudgetEmpresaLoading(false);
    }
  }

  function clearBudgetEmpresaBase() {
    setBudgetReceitaFile(null);
    setBudgetDreFiles([]);
    setBudgetEmpresaData({ year: null, entries: {}, summary: null });
    setBudgetEmpresaError("");
    try { localStorage.removeItem(BUDGET_EMPRESA_LS_KEY); } catch {}
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

  const budgetStatusColor = (row) => {
    const st = budgetStatus(row?.valor, row?.budget);
    if (st.key === "over") return C_ROSE;
    if (st.key === "warn") return C_AMBER;
    return C_BLUE;
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


  const generatedBudgetEntriesFiltered = useMemo(() => {
    if (!generatedBudgetAvailable) return [];

    return Object.values(budgetEmpresaData?.entries || {}).filter((item) => {
      if (!budgetEmpresaMatchesFilter(item?.empresa, fEmpresa)) return false;
      if (!selectedMonthKeys) return true;

      return Object.keys(item?.months || {}).some((mes) => {
        const mesNum = String(mes).split("-")[1] || "";
        return selectedMonthKeys.has(mesNum);
      });
    });
  }, [generatedBudgetAvailable, budgetEmpresaData, fEmpresa, selectedMonthKeys]);

  const contasNoFiltro = useMemo(() => {
    // IMPORTANTE: orçamento é por PLANO (plano de conta). Não usar r.conta aqui,
    // porque em alguns contextos r.conta pode ser "Plano — Empresa — Fornecedor" e não bate com o cadastro.
    const s = new Set();
    for (const r of filtered) s.add(String(r.plano ?? ""));
    return Array.from(s).filter(Boolean);
  }, [filtered]);

  const realMapByPlano = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const plano = String(r.plano ?? "");
      map.set(plano, (map.get(plano) ?? 0) + (r.valor || 0));
    }
    return map;
  }, [filtered]);

  const generatedBudgetTotal = useMemo(() => {
    if (!generatedBudgetAvailable) return 0;

    let total = 0;
    for (const plano of contasNoFiltro) {
      total += Math.abs(generatedBudgetValueForPlano(plano, fEmpresa, selectedMonthKeys));
    }
    return total;
  }, [generatedBudgetAvailable, contasNoFiltro, fEmpresa, selectedMonthKeys, budgetEmpresaIndex, budgetDrePlanos, planoMatchMap]);

  const generatedBudgetByMes = useMemo(() => {
    const map = new Map();
    if (!generatedBudgetAvailable) return map;

    let monthList = [];
    if (selectedMonthKeys?.size) {
      monthList = Array.from(selectedMonthKeys).sort();
    } else {
      const monthSet = new Set();
      for (const item of generatedBudgetEntriesFiltered) {
        for (const mes of Object.keys(item?.months || {})) {
          const mesNum = String(mes).split("-")[1] || "";
          if (mesNum) monthSet.add(mesNum);
        }
      }
      monthList = Array.from(monthSet).sort();
    }

    for (const mesNum of monthList) {
      const onlyThisMonth = new Set([mesNum]);
      let totalMes = 0;
      for (const plano of contasNoFiltro) {
        totalMes += generatedBudgetValueForPlano(plano, fEmpresa, onlyThisMonth);
      }
      const mesKey = `${budgetEmpresaData?.year || new Date().getFullYear()}-${mesNum}`;
      map.set(mesKey, totalMes);
    }
    return map;
  }, [generatedBudgetAvailable, contasNoFiltro, fEmpresa, selectedMonthKeys, budgetEmpresaData, budgetEmpresaIndex, budgetDrePlanos, planoMatchMap, generatedBudgetEntriesFiltered]);



  const previstoTotal = useMemo(() => {
    if (generatedBudgetAvailable) return generatedBudgetTotal;
    return contasNoFiltro.reduce((acc, c) => acc + Math.abs(budgetValueForPlano(c)), 0);
  }, [generatedBudgetAvailable, generatedBudgetTotal, contasNoFiltro, budgets, totalGeral]);

  const execPct = useMemo(() => (previstoTotal ? (totalGeral / previstoTotal) * 100 : 0), [totalGeral, previstoTotal]);
  const diffBudget = useMemo(() => totalGeral - previstoTotal, [totalGeral, previstoTotal]);

  const statusCounts = useMemo(() => {
    const counts = { ok: 0, warn: 0, over: 0, none: 0 };
    for (const k of contasNoFiltro) {
      const real = realMapByPlano.get(k) ?? 0;
      const prev = generatedBudgetAvailable ? generatedBudgetValueForPlano(k, fEmpresa, selectedMonthKeys, real) : budgetValueForPlano(k);
      const st = budgetStatus(real, prev).key;
      counts[st] = (counts[st] ?? 0) + 1;
    }
    return counts;
  }, [contasNoFiltro, generatedBudgetAvailable, fEmpresa, selectedMonthKeys, realMapByPlano, budgets, totalGeral, budgetEmpresaIndex, budgetDrePlanos, planoMatchMap]);

  const statusPlanos = useMemo(() => {
    // Gera lista de planos com Real/Previsto/Execução e Status, respeitando filtros atuais
    const arr = [];
    for (const plano of contasNoFiltro) {
      const real = realMapByPlano.get(plano) ?? 0;
      const budgetMeta = generatedBudgetAvailable
        ? generatedBudgetMetaForPlano(plano, fEmpresa, selectedMonthKeys)
        : { valor: budgetValueForPlano(plano), estimado: false };
      const previsto = Number(budgetMeta?.valor || 0);
      const st = budgetStatus(real, previsto);
      const matchInfo = planoMatchDiagnostics?.[plano] || { matched: null, confidence: 0, mode: "unmatched" };
      arr.push({
        plano,
        real,
        previsto,
        previstoEstimado: Boolean(budgetMeta?.estimado),
        execPct: previsto ? (real / previsto) * 100 : 0,
        statusKey: st.key,
        statusLabel: st.label,
        statusEmoji: st.key === "ok" ? "🟢" : st.key === "warn" ? "🟡" : st.key === "over" ? "🔴" : "⚪",
        matchMode: matchInfo.mode,
        matchedPlano: matchInfo.matched || "",
        matchConfidence: Number(matchInfo.confidence || 0),
      });
    }

    // Ordena: estourado/warn/ok/none e depois por maior execução/real
    const rank = { over: 0, warn: 1, ok: 2, none: 3 };
    arr.sort((a, b) => {
      const ra = rank[a.statusKey] ?? 9;
      const rb = rank[b.statusKey] ?? 9;
      if (ra !== rb) return ra - rb;
      const ea = Number.isFinite(a.execPct) ? a.execPct : 0;
      const eb = Number.isFinite(b.execPct) ? b.execPct : 0;
      if (eb !== ea) return eb - ea;
      return (b.real || 0) - (a.real || 0);
    });

    return arr;
  }, [contasNoFiltro, generatedBudgetAvailable, fEmpresa, selectedMonthKeys, budgetEmpresaIndex, budgetDrePlanos, planoMatchMap, planoMatchDiagnostics, realMapByPlano, budgets, totalGeral]);

  const statusPlanosFiltered = useMemo(() => {
    const q = (statusModalQuery || "").trim().toLowerCase();
    const base =
      standaloneView === "status" && Array.isArray(statusStandaloneRows) && statusStandaloneRows.length
        ? statusStandaloneRows
        : statusPlanos;

    return base.filter((p) => {
      if (p.statusKey !== statusModalKey) return false;
      if (!q) return true;
      return String(p.plano || "").toLowerCase().includes(q);
    });
  }, [standaloneView, statusStandaloneRows, statusPlanos, statusModalKey, statusModalQuery]);

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
      budget: generatedBudgetAvailable ? generatedBudgetValueForPlano(d.plano, fEmpresa, selectedMonthKeys) : budgetValueForPlano(d.plano),
      pct: total ? (d.valor / total) * 100 : 0,
      pctLabel: total ? `${((d.valor / total) * 100).toFixed(1)}%` : "0.0%",
    }));
  }, [filtered, generatedBudgetAvailable, budgetEmpresaData, fEmpresa, selectedMonthKeys, budgets]);

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
    return byMes.map((it) => {
      const totalMes = Number(it.valor ?? 0) || 0;
      const orcado = generatedBudgetAvailable
        ? (generatedBudgetByMes.get(it.mes) || 0)
        : contasNoFiltro.reduce((acc, c) => acc + budgetValueForPlanoMes(c, totalMes, byMes.length), 0);
      return { ...it, orcado, budget: orcado };
    });
  }, [byMes, contasNoFiltro, budgets, generatedBudgetAvailable, generatedBudgetByMes]);

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
    if (!mesesSel.length) return { data: [], keys: [], budgetKeys: [] };

    const acc = new Map();
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

    if (generatedBudgetAvailable) {
      for (const item of Object.values(budgetEmpresaData?.entries || {})) {
        if (!budgetEmpresaMatchesFilter(item?.empresa, fEmpresa)) continue;
        for (const [mes, mm] of Object.entries(item?.months || {})) {
          const p = String(mes).split("-");
          if (p.length < 2) continue;
          const year = p[0];
          const mi = Number(p[1]) - 1;
          if (!mesesSel.includes(mi)) continue;

          const label = MESES_LABEL[mi] || `M${mi + 1}`;
          const budgetLabel = `${label} Previsto`;
          if (!acc.has(year)) acc.set(year, { ano: year });
          const obj = acc.get(year);
          obj[budgetLabel] = (obj[budgetLabel] ?? 0) + Number(mm?.previsto || 0);
        }
      }
    }

    const data = Array.from(acc.values()).sort((a, b) => (a.ano > b.ano ? 1 : -1));
    const keys = mesesSel.slice().sort((a, b) => a - b).map((mi) => MESES_LABEL[mi] || `M${mi + 1}`);
    const budgetKeys = generatedBudgetAvailable ? keys.map((k) => `${k} Previsto`) : [];
    return { data, keys, budgetKeys };
  }, [filtered, mesesSel, generatedBudgetAvailable, budgetEmpresaData, fEmpresa]);


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

    const alvoPlano = normalizePlanoBudgetKey(drillPlano);

    if (standaloneView === "drill" && Array.isArray(detailRows) && detailRows.length) {
      return detailRows.filter((r) => normalizePlanoBudgetKey(r?.plano) === alvoPlano);
    }

    const readStoredDatasetRows = () => {
      try {
        const rawDataset = localStorage.getItem(LS_KEY);
        const parsedDataset = rawDataset ? JSON.parse(rawDataset) : null;
        return Array.isArray(parsedDataset?.rows) ? parsedDataset.rows : [];
      } catch {
        return [];
      }
    };

    const base = Array.isArray(rows) && rows.length ? rows : readStoredDatasetRows();

    let filtrado = base.filter((r) => normalizePlanoBudgetKey(r?.plano) === alvoPlano);

    if (fEmpresa !== "Todas") {
      filtrado = filtrado.filter((r) => String(r?.empresa ?? "").trim() === String(fEmpresa ?? "").trim());
    }

    if (Array.isArray(mesesSel) && mesesSel.length) {
      filtrado = filtrado.filter((r) => {
        const mi = mesIndexFromISO(r?.data ?? r?.competencia);
        return mesesSel.includes(mi);
      });
    }

    return filtrado;
  }, [rows, drillPlano, fEmpresa, mesesSel, standaloneView, detailRows]);

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
    openDetailStandalone(title, rows);
  }

  async function exportStatusTableXlsx() {
    try {
      const mod = await import("xlsx");
      const XLSX = mod.default ?? mod;

      const tableRows = statusPlanosFiltered
        .map((p) => ({
          Status: p.statusLabel || "",
          Plano: p.plano || "",
          Previsto: Number(p.previsto || 0),
          Real: Number(p.real || 0),
          "Execução %": p.previsto ? Number(p.execPct || 0) : null,
        }));

      const wb = XLSX.utils.book_new();
      const wsTabela = XLSX.utils.json_to_sheet(
        tableRows.length
          ? tableRows
          : [{ Status: "", Plano: "", Previsto: 0, Real: 0, "Execução %": null }]
      );
      XLSX.utils.book_append_sheet(wb, wsTabela, "Status");

      const safeStatus = String(statusModalKey || "status")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase() || "status";

      XLSX.writeFile(wb, `status_${safeStatus}_tabela.xlsx`);
    } catch (e) {
      console.error(e);
      alert("Não foi possível exportar o XLSX da tabela.");
    }
  }

  async function exportOutrosTableXlsx() {
    try {
      const mod = await import("xlsx");
      const XLSX = mod.default ?? mod;

      const sourceRows = Array.isArray(detailRows) && detailRows.length ? detailRows : outrosDetalhe.rows;
      const tableRows = sourceRows.map((d) => ({
        Plano: d?.plano || "",
        Valor: Number(d?.valor || 0),
        "% Outros": typeof d?.pct === "number" ? Number(d.pct) : null,
      }));

      const wb = XLSX.utils.book_new();
      const wsTabela = XLSX.utils.json_to_sheet(
        tableRows.length ? tableRows : [{ Plano: "", Valor: 0, "% Outros": null }]
      );
      XLSX.utils.book_append_sheet(wb, wsTabela, "Outros");
      XLSX.writeFile(wb, "outros_tabela.xlsx");
    } catch (e) {
      console.error(e);
      alert("Não foi possível exportar o XLSX de Outros.");
    }
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
        let previsto = 0;

        if (generatedBudgetAvailable) {
          const mesNum = String(mes).split("-")[1] || "";
          const onlyThisMonth = mesNum ? new Set([mesNum]) : null;
          previsto = generatedBudgetValueForPlano(drillPlano, fEmpresa, onlyThisMonth);
        } else {
          previsto = budgetValueForPlanoMes(drillPlano, totalMes, m.size);
        }

        return { mes, valor, previsto, status: budgetStatus(valor, previsto) };
      })
      .sort((a, b) => (a.mes > b.mes ? 1 : -1));
  }, [drillRowsBase, byMes, drillPlano, budgets, totalGeral, generatedBudgetAvailable, fEmpresa, budgetEmpresaIndex, budgetDrePlanos, planoMatchMap]);



  const detailRowsFiltered = useMemo(() => {
    const base = Array.isArray(detailRows) ? detailRows : [];
    const q = String(detailQuery || "").trim().toLowerCase();

    if (!q) return base;

    return base.filter((r) => {
      const hay = [
        r?.data,
        r?.competencia,
        r?.plano,
        r?.conta,
        r?.empresa,
        r?.fornecedor,
        r?.status,
        String(r?.valor ?? ""),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [detailRows, detailQuery]);

  const budgetEmpresaCompanies = useMemo(() => {
    const set = new Set();
    for (const item of Object.values(budgetEmpresaData?.entries || {})) {
      if (item?.empresa) set.add(String(item.empresa));
    }
    return Array.from(set).sort();
  }, [budgetEmpresaData]);

  const budgetEmpresaMonths = useMemo(() => {
    const set = new Set();
    for (const item of Object.values(budgetEmpresaData?.entries || {})) {
      for (const mes of Object.keys(item?.months || {})) {
        set.add(String(mes));
      }
    }
    return Array.from(set).sort();
  }, [budgetEmpresaData]);

  const budgetEmpresaRows = useMemo(() => {
    const map = {};
    const q = String(budgetQuery || "").trim().toLowerCase();

    for (const item of Object.values(budgetEmpresaData?.entries || {})) {
      const empresa = String(item?.empresa || "");
      if (budgetEmpresaFilter !== "Todas" && empresa !== budgetEmpresaFilter) continue;

      const plano = String(item?.plano || "");
      const key = normKey(plano);

      if (!map[key]) map[key] = { plano, values: {}, total: 0 };
      map[key].plano = plano;

      let totalItem = 0;
      if (budgetMesFilter !== "Todos") {
        totalItem = Number(item?.months?.[budgetMesFilter]?.previsto || 0);
      } else {
        totalItem = Number(item?.totalPrevisto || 0);
      }

      map[key].values[empresa] = (map[key].values[empresa] || 0) + totalItem;
      map[key].total += totalItem;
    }

    return Object.values(map)
      .filter((r) => !q || String(r.plano).toLowerCase().includes(q))
      .sort((a, b) => String(a.plano).localeCompare(String(b.plano), "pt-BR"));
  }, [budgetEmpresaData, budgetQuery, budgetEmpresaFilter, budgetMesFilter]);

  const budgetEmpresaCompaniesVisible = useMemo(() => {
    if (budgetEmpresaFilter !== "Todas") return [budgetEmpresaFilter];
    return budgetEmpresaCompanies;
  }, [budgetEmpresaCompanies, budgetEmpresaFilter]);

  async function exportBudgetEmpresaXlsx() {
    try {
      const mod = await import("xlsx");
      const XLSX = mod.default ?? mod;
      const wb = XLSX.utils.book_new();

      const companiesForExport = budgetEmpresaFilter !== "Todas" ? [budgetEmpresaFilter] : budgetEmpresaCompanies;
      for (const empresa of companiesForExport) {
        const rowsExport = [];

        for (const item of Object.values(budgetEmpresaData?.entries || {})) {
          if (String(item?.empresa || "") !== String(empresa)) continue;
          if (budgetMesFilter !== "Todos") {
            const prev = Number(item?.months?.[budgetMesFilter]?.previsto || 0);
            if (!prev) continue;
            rowsExport.push({
              Empresa: empresa,
              Plano: String(item?.plano || ""),
              Mês: budgetMesFilter,
              Previsto: prev,
            });
          } else {
            for (const [mes, mm] of Object.entries(item?.months || {})) {
              const prev = Number(mm?.previsto || 0);
              if (!prev) continue;
              rowsExport.push({
                Empresa: empresa,
                Plano: String(item?.plano || ""),
                Mês: mes,
                Previsto: prev,
              });
            }
          }
        }

        rowsExport.sort((a, b) => {
          const c1 = String(a.Plano).localeCompare(String(b.Plano), "pt-BR");
          if (c1 !== 0) return c1;
          return String(a.Mês).localeCompare(String(b.Mês), "pt-BR");
        });

        const ws = XLSX.utils.json_to_sheet(rowsExport.length ? rowsExport : [{ Empresa: empresa, Plano: "", Mês: "", Previsto: 0 }]);
        XLSX.utils.book_append_sheet(wb, ws, String(empresa).slice(0, 31));
      }

      const filename = `orcamento_por_empresa_${budgetMesFilter !== "Todos" ? budgetMesFilter : "completo"}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (e) {
      console.error(e);
      alert("Não foi possível exportar o XLSX.");
    }
  }


  const executadoSelectedMonthKeys = useMemo(() => {
    if (!executadoMeses?.length) return null;
    return new Set(executadoMeses.slice().sort((a, b) => a - b).map((mi) => String(mi + 1).padStart(2, "0")));
  }, [executadoMeses]);

  const executadoFiltered = useMemo(() => {
    const q = String(executadoQuery || "").trim().toLowerCase();
    return rows.filter((r) => {
      const matchPlano = executadoPlano === "Todos" || r.plano === executadoPlano;
      const matchEmpresa = executadoEmpresa === "Todas" || r.empresa === executadoEmpresa;
      const matchBusca =
        !q ||
        String(r.plano || "").toLowerCase().includes(q) ||
        String(r.conta || "").toLowerCase().includes(q) ||
        String(r.fornecedor || "").toLowerCase().includes(q) ||
        String(r.empresa || "").toLowerCase().includes(q) ||
        String(r.status || "").toLowerCase().includes(q);

      let matchMes = true;
      if (executadoMeses.length > 0) {
        const mi = mesIndexFromISO(r.data);
        matchMes = executadoMeses.includes(mi);
      }

      return matchPlano && matchEmpresa && matchBusca && matchMes;
    });
  }, [rows, executadoQuery, executadoPlano, executadoEmpresa, executadoMeses]);

  const executadoContas = useMemo(() => {
    const s = new Set();
    for (const r of executadoFiltered) s.add(String(r.plano ?? ""));
    return Array.from(s).filter(Boolean);
  }, [executadoFiltered]);

  const executadoRealMapByPlano = useMemo(() => {
    const map = new Map();
    for (const r of executadoFiltered) {
      const plano = String(r.plano ?? "");
      map.set(plano, (map.get(plano) ?? 0) + (r.valor || 0));
    }
    return map;
  }, [executadoFiltered]);

  const executadoStatusPlanos = useMemo(() => {
    const arr = [];
    for (const plano of executadoContas) {
      const real = executadoRealMapByPlano.get(plano) ?? 0;
      const budgetMeta = generatedBudgetAvailable
        ? generatedBudgetMetaForPlano(plano, executadoEmpresa, executadoSelectedMonthKeys)
        : { valor: budgetValueForPlano(plano), estimado: false, match: null };
      const previsto = Number(budgetMeta?.valor || 0);
      const st = budgetStatus(real, previsto);
      const matchInfo = budgetMeta?.match || planoMatchDiagnostics?.[plano] || { matched: null, confidence: 0, mode: "unmatched" };
      arr.push({
        plano,
        real,
        previsto,
        execPct: previsto ? (real / previsto) * 100 : 0,
        statusKey: st.key,
        statusLabel: st.label,
        statusEmoji: st.key === "ok" ? "🟢" : st.key === "warn" ? "🟡" : st.key === "over" ? "🔴" : "⚪",
        matchMode: matchInfo.mode,
        matchedPlano: matchInfo.matched || "",
        matchConfidence: Number(matchInfo.confidence || 0),
      });
    }
    const rank = { over: 0, warn: 1, ok: 2, none: 3 };
    arr.sort((a, b) => {
      const ra = rank[a.statusKey] ?? 9;
      const rb = rank[b.statusKey] ?? 9;
      if (ra !== rb) return ra - rb;
      const ea = Number.isFinite(a.execPct) ? a.execPct : 0;
      const eb = Number.isFinite(b.execPct) ? b.execPct : 0;
      if (eb !== ea) return eb - ea;
      return (b.real || 0) - (a.real || 0);
    });
    return arr;
  }, [executadoContas, executadoRealMapByPlano, generatedBudgetAvailable, executadoEmpresa, executadoSelectedMonthKeys, budgetEmpresaIndex, budgetDrePlanos, planoMatchMap, planoMatchDiagnostics, budgets, totalGeral]);

  function exportExecutadoXlsx() {
    try {
      const wb = XLSX.utils.book_new();
      const data = executadoStatusPlanos.map((p) => ({
        Status: p.statusLabel,
        Plano: p.plano,
        "Plano DRE": p.matchedPlano || "",
        "Tipo match": p.matchMode || "unmatched",
        "Confiança match": Number(p.matchConfidence || 0),
        Previsto: Number(p.previsto || 0),
        Real: Number(p.real || 0),
        "Execução %": Number(p.execPct || 0),
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Executado");
      XLSX.writeFile(wb, "executado_status_plano.xlsx");
    } catch (e) {
      console.error(e);
      alert("Não foi possível exportar o XLSX.");
    }
  }

  if (executadoOpen) {
    return (
      <div className="min-h-screen bg-[#0c1118] text-white">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0c1118]/90 backdrop-blur px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-white/90">Executado</div>
              <div className="text-[12px] text-white/60">Status, plano, previsto, real e execução usando a base carregada do dashboard</div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={exportExecutadoXlsx} className="px-3 py-2 rounded-lg text-sm border bg-white/5 border-white/10 text-white/80 hover:bg-white/10">Exportar XLSX</button>
              <button type="button" onClick={() => setExecutadoOpen(false)} className="px-3 py-2 rounded-lg text-sm border bg-white/5 border-white/10 text-white/80 hover:bg-white/10">← Voltar</button>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">
          <Card title="Filtros">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="text-[11px] text-white/60 mb-1">Empresa</div>
                <select value={executadoEmpresa} onChange={(e) => setExecutadoEmpresa(e.target.value)} className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 text-sm text-white outline-none">
                  {empresas.map((empresa) => <option key={empresa} value={empresa}>{empresa}</option>)}
                </select>
              </div>
              <div>
                <div className="text-[11px] text-white/60 mb-1">Plano</div>
                <select value={executadoPlano} onChange={(e) => setExecutadoPlano(e.target.value)} className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 text-sm text-white outline-none">
                  <option value="Todos">Todos</option>
                  {planosSomente.map((plano) => <option key={plano} value={plano}>{plano}</option>)}
                </select>
              </div>
              <div>
                <div className="text-[11px] text-white/60 mb-1">Busca do plano</div>
                <input value={executadoQuery} onChange={(e) => setExecutadoQuery(e.target.value)} placeholder="Digite para filtrar..." className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white/80 outline-none focus:border-white/20" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-[11px] text-white/60 mb-1">Mês</div>
              <div className="flex flex-wrap gap-2">
                {MESES_LABEL.map((label, idx) => {
                  const active = executadoMeses.includes(idx);
                  return (
                    <button key={label} type="button" onClick={() => setExecutadoMeses((prev) => prev.includes(idx) ? prev.filter((m) => m !== idx) : [...prev, idx])} className={`px-3 py-1 rounded-lg text-[11px] border ${active ? "bg-white text-[#0c1118] border-white" : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card title="Tabela executado">
            <div className="mb-3 text-white/70 text-sm">{executadoStatusPlanos.length} plano(s) encontrados com os filtros atuais</div>
            <div className="overflow-auto rounded-xl border border-white/10">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-white/5 text-white/70">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Status</th>
                    <th className="text-left font-medium px-3 py-2">Plano</th>
                    <th className="text-left font-medium px-3 py-2">Plano DRE</th>
                    <th className="text-left font-medium px-3 py-2">Tipo match</th>
                    <th className="text-right font-medium px-3 py-2">Previsto</th>
                    <th className="text-right font-medium px-3 py-2">Real</th>
                    <th className="text-right font-medium px-3 py-2">Execução</th>
                  </tr>
                </thead>
                <tbody>
                  {executadoStatusPlanos.map((p) => (
                    <tr key={p.plano} className="border-t border-white/10 hover:bg-white/5">
                      <td className="px-3 py-2 text-white/80"><span className="mr-2">{p.statusEmoji}</span><span className="text-[12px]">{p.statusLabel}</span></td>
                      <td className="px-3 py-2 text-white/90">{p.plano}</td>
                      <td className="px-3 py-2 text-white/70">{p.matchedPlano || "—"}</td>
                      <td className="px-3 py-2 text-white/70">{p.matchMode || "unmatched"}</td>
                      <td className="px-3 py-2 text-right text-white/80">{p.previsto || p.previsto === 0 ? fmtBRL(p.previsto) : "—"}</td>
                      <td className="px-3 py-2 text-right text-white/80">{fmtBRL(p.real)}</td>
                      <td className="px-3 py-2 text-right">{p.previsto ? <span className={`${p.execPct > 100 ? "text-rose-200" : p.execPct >= 90 ? "text-amber-200" : "text-emerald-200"} font-medium`}>{p.execPct.toFixed(1)}%</span> : <span className="text-white/50">—</span>}</td>
                    </tr>
                  ))}
                  {!executadoStatusPlanos.length && (
                    <tr className="border-t border-white/10">
                      <td colSpan={7} className="px-3 py-6 text-center text-white/50">Nenhum plano encontrado com os filtros atuais.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </main>
      </div>
    );
  }


  if (standaloneView === "status") {
    return (
      <div className="min-h-screen bg-[#0c1118] text-white">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0c1118]/90 backdrop-blur px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-white/90">Planos por status</div>
              <div className="text-[12px] text-white/60">{statusPlanosFiltered.length} plano(s) • visualização aberta em nova guia</div>
            </div>
            <button type="button" onClick={returnToDashboardFromStandalone} className="px-3 py-2 rounded-lg text-sm border bg-white/5 border-white/10 text-white/80 hover:bg-white/10">← Voltar</button>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">
          <Card title={`Status: ${statusModalKey === "ok" ? "Dentro" : statusModalKey === "warn" ? "Atenção" : statusModalKey === "over" ? "Estourado" : "Sem orçamento"}`}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input value={statusModalQuery} onChange={(e) => setStatusModalQuery(e.target.value)} placeholder="Buscar plano..." className="w-80 max-w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 outline-none focus:border-white/20" />
              <button type="button" onClick={exportStatusTableXlsx} className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-white/80">Exportar XLSX</button>
            </div>
            <div className="overflow-auto rounded-xl border border-white/10">
              <table className="min-w-[760px] w-full text-sm">
                <thead className="bg-white/5 text-white/70"><tr><th className="text-left font-medium px-3 py-2">Status</th><th className="text-left font-medium px-3 py-2">Plano</th><th className="text-right font-medium px-3 py-2">Previsto</th><th className="text-right font-medium px-3 py-2">Real</th><th className="text-right font-medium px-3 py-2">Execução</th></tr></thead>
                <tbody>
                  {statusPlanosFiltered.map((p) => (
                    <tr key={p.plano} className="border-t border-white/10 hover:bg-white/5">
                      <td className="px-3 py-2 text-white/80"><span className="mr-2">{p.statusEmoji}</span><span className="text-[12px]">{p.statusLabel}</span></td>
                      <td className="px-3 py-2 text-white/90">
                        <span className="text-left text-white/90">{p.plano}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-white/80">{p.previsto ? fmtBRL(p.previsto) : "—"}</td>
                      <td className="px-3 py-2 text-right text-white/80">{fmtBRL(p.real)}</td>
                      <td className="px-3 py-2 text-right">{p.previsto ? <span className={`${p.execPct > 100 ? "text-rose-200" : p.execPct >= 90 ? "text-amber-200" : "text-emerald-200"} font-medium`}>{p.execPct.toFixed(1)}%</span> : <span className="text-white/50">—</span>}</td>
                      
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  if (standaloneView === "outros") {
    return (
      <div className="min-h-screen bg-[#0c1118] text-white">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0c1118]/90 backdrop-blur px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div><div className="text-lg font-semibold text-white/90">Detalhamento — Outros</div><div className="text-[12px] text-white/60">Planos agrupados em outros</div></div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={exportOutrosTableXlsx} className="px-3 py-2 rounded-lg text-sm border bg-white/5 border-white/10 text-white/80 hover:bg-white/10">Exportar XLSX</button>
              <button type="button" onClick={returnToDashboardFromStandalone} className="px-3 py-2 rounded-lg text-sm border bg-white/5 border-white/10 text-white/80 hover:bg-white/10">← Voltar</button>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">
          <Card title="Lista completa">
            <div className="mb-3 text-white/80">Total: {fmtBRL((Array.isArray(detailRows) && detailRows.length ? detailRows : outrosDetalhe.rows).reduce((acc, d) => acc + (Number(d?.valor || 0)), 0) || 0)}</div>
            <div className="max-h-[70vh] overflow-auto rounded-lg border border-white/10">
              {(Array.isArray(detailRows) && detailRows.length ? detailRows : outrosDetalhe.rows).map((d, i) => (
                <div key={`${d.plano}-${i}`} className="w-full text-left px-3 py-2 flex items-center gap-2 border-b border-white/5 last:border-b-0">
                  <span className="truncate text-white/80">{d.plano}</span>
                  <span className="ml-auto text-white/70">{fmtBRL(d.valor)}</span>
                  <span className="text-white/50 text-xs w-[56px] text-right">{d.pctLabel || ""}</span>
                </div>
              ))}
            </div>
          </Card>
        </main>
      </div>
    );
  }

  if (standaloneView === "drill" && drillPlano) {
    return (
      <div className="min-h-screen bg-[#0c1118] text-white">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0c1118]/90 backdrop-blur px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-white/90">Detalhamento — {drillPlano}</div>
              <div className="text-[12px] text-white/60">Itens {drillCount} • Total {fmtBRL(drillTotal)}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-white/50">Mês</span>
              <select
                value={drillMes}
                onChange={(e) => setDrillMes(e.target.value)}
                className="rounded-lg px-2 py-2 bg-white/5 border border-white/10 text-white text-xs outline-none focus:ring-2 focus:ring-sky-500/40"
              >
                <option value="" className="bg-[#0c1118]">Todos</option>
                {drillMesOptions.map((m) => (
                  <option key={m} value={m} className="bg-[#0c1118]">{m}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={returnToDashboardFromStandalone}
                className="px-3 py-2 rounded-lg text-sm border bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
              >
                ← Voltar
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card title="Total (plano + filtros)">
              <div className="text-2xl font-bold" style={{ color: C_GREEN }}>{fmtBRL(drillTotal)}</div>
            </Card>
            <Card title="Itens">
              <div className="text-2xl font-bold text-white/90">{drillCount}</div>
            </Card>
            <Card title="Ticket médio">
              <div className="text-2xl font-bold text-white/90">{fmtBRL(drillTicket)}</div>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card title="Top Fornecedores" style={{ height: 420 }}>
              <div style={{ height: 340 }}>
                {drillByFornecedor.length ? (
                  <ResponsiveContainer width="100%" height={340}>
                    <ComposedChart data={drillByFornecedor}>
                      <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                      <XAxis dataKey="name" hide />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                      <Tooltip cursor={false} content={<TooltipRich labelPrefix="Categoria" />} />
                      <Bar
                        dataKey="valor"
                        fill={C_BLUE}
                        radius={[10, 10, 0, 0]}
                        onClick={(d) => {
                          const name = d?.payload?.name ?? d?.name;
                          if (!name) return;
                          openDetail(`Títulos — Fornecedor: ${name}`, drillRows.filter((r) => r.fornecedor === name));
                        }}
                      >
                        <LabelList dataKey="pctLabel" position="top" offset={10} fill="rgba(255,255,255,0.75)" fontSize={12} />
                      </Bar>
                    </ComposedChart>
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
                    <ComposedChart data={drillByEmpresa}>
                      <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                      <XAxis dataKey="name" hide />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                      <Tooltip cursor={false} content={<TooltipRich labelPrefix="Categoria" />} />
                      <Bar
                        dataKey="valor"
                        fill={C_PURPLE}
                        radius={[10, 10, 0, 0]}
                        onClick={(d) => {
                          const name = d?.payload?.name ?? d?.name;
                          if (!name) return;
                          openDetail(`Títulos — Empresa/Unidade: ${name}`, drillRows.filter((r) => r.empresa === name));
                        }}
                      >
                        <LabelList dataKey="pctLabel" position="top" offset={10} fill="rgba(255,255,255,0.75)" fontSize={12} />
                      </Bar>
                    </ComposedChart>
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
                      <Bar
                        dataKey="valor"
                        fill={C_CYAN}
                        radius={[10, 10, 0, 0]}
                        onClick={(d) => {
                          const name = d?.payload?.name ?? d?.name;
                          if (!name) return;
                          openDetail(`Títulos — Conta: ${name}`, drillRows.filter((r) => r.conta === name));
                        }}
                      >
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

          <div className="text-[11px] text-white/60">
            Dica: clique nas barras dos gráficos para abrir os títulos filtrados daquele recorte.
          </div>
        </main>
      </div>
    );
  }

  if (standaloneView === "detail") {
    const detailRowsFilteredStandalone = detailRowsFiltered;
    return (
      <div className="min-h-screen bg-[#0c1118] text-white">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0c1118]/90 backdrop-blur px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div><div className="text-lg font-semibold text-white/90">{detailTitle || "Detalhes"}</div><div className="text-[12px] text-white/60">Itens: {detailRowsFilteredStandalone.length}</div></div>
            <button type="button" onClick={returnToDashboardFromStandalone} className="px-3 py-2 rounded-lg text-sm border bg-white/5 border-white/10 text-white/80 hover:bg-white/10">← Voltar</button>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">
          <Card title="Detalhes">
            <div className="mb-3"><input value={detailQuery} onChange={(e) => setDetailQuery(e.target.value)} placeholder="Buscar na lista..." className="w-64 max-w-full rounded-lg px-3 py-2 bg-white/5 border border-white/10 text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-sky-500/40 text-sm" /></div>
            <div className="overflow-auto rounded-xl border border-white/10">
              <table className="min-w-[1100px] w-full text-[12px]"><thead className="bg-white/5"><tr className="text-left"><th className="p-2">Venc.</th><th className="p-2">Plano</th><th className="p-2">Conta</th><th className="p-2">Empresa</th><th className="p-2">Fornecedor</th><th className="p-2">Status</th><th className="p-2 text-right">Valor</th></tr></thead><tbody>{detailRowsFilteredStandalone.map((r, i) => (<tr key={`${r.id || i}-${i}`} className="border-t border-white/10 hover:bg-white/5"><td className="p-2 text-white/70">{r.data || "—"}</td><td className="p-2 text-white/80">{r.plano || "—"}</td><td className="p-2 text-white/80">{r.conta || "—"}</td><td className="p-2 text-white/80">{r.empresa || "—"}</td><td className="p-2 text-white/80">{r.fornecedor || "—"}</td><td className="p-2 text-white/70">{r.status || "—"}</td><td className="p-2 text-right text-white/90">{fmtBRL(r.valor)}</td></tr>))}</tbody></table>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  if (budgetStandalone) {
    return (
      <div className="min-h-screen bg-[#0c1118] text-white">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0c1118]/90 backdrop-blur px-6 py-4">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-white/90">Orçamento por Empresa</div>
              <div className="text-[12px] text-white/60">
                Carregue a receita e os DREs, gere o previsto por empresa e salve para usar no dashboard. A base processada fica salva neste computador; para consultar depois, não precisa reenviar os arquivos.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => returnToDashboardFromBudget()}
                className="px-3 py-2 rounded-lg text-sm border bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
              >
                Voltar ao dashboard
              </button>
              <button
                type="button"
                onClick={() => returnToDashboardFromBudget()}
                className="px-3 py-2 rounded-lg text-sm border bg-sky-500/20 border-sky-400/30 text-sky-100 hover:bg-sky-500/30"
              >
                Salvar e voltar
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">
          <Card title="Arquivos do orçamento por empresa">
            <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1.2fr_auto] gap-3 items-end">
              <div>
                <div className="text-[11px] text-white/60 mb-1">Receita mensal (xlsx)</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => receitaBudgetInputRef.current?.click()}
                    className="px-3 py-2 rounded-lg text-sm border bg-white/5 border-white/10 text-white/85 hover:bg-white/10"
                  >
                    Selecionar receita
                  </button>
                  <div className="flex-1 rounded-lg px-3 py-2 bg-white/5 border border-white/10 text-sm text-white/75 truncate">
                    {budgetReceitaFile?.name || "Nenhum arquivo selecionado"}
                  </div>
                </div>
                <input
                  ref={receitaBudgetInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  multiple
                  className="hidden"
                  onChange={(e) => setBudgetReceitaFile(e.target.files?.[0] || null)}
                />
              </div>

              <div>
                <div className="text-[11px] text-white/60 mb-1">DREs das empresas (xlsx)</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => dreBudgetInputRef.current?.click()}
                    className="px-3 py-2 rounded-lg text-sm border bg-white/5 border-white/10 text-white/85 hover:bg-white/10"
                  >
                    Selecionar DREs
                  </button>
                  <div className="flex-1 rounded-lg px-3 py-2 bg-white/5 border border-white/10 text-sm text-white/75 truncate">
                    {budgetDreFiles?.length ? `${budgetDreFiles.length} arquivo(s)` : "Nenhum arquivo selecionado"}
                  </div>
                </div>
                <input
                  ref={dreBudgetInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  multiple
                  multiple
                  className="hidden"
                  onChange={(e) => setBudgetDreFiles(Array.from(e.target.files || []))}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => processBudgetEmpresaFiles()}
                  disabled={budgetEmpresaLoading}
                  className="px-3 py-2 rounded-lg text-sm border bg-emerald-500/20 border-emerald-400/30 text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-60"
                >
                  {budgetEmpresaLoading ? "Processando..." : "Gerar previsto"}
                </button>
                <button
                  type="button"
                  onClick={() => clearBudgetEmpresaBase()}
                  className="px-3 py-2 rounded-lg text-sm border bg-white/5 border-white/10 text-white/75 hover:bg-white/10"
                >
                  Limpar base
                </button>
              </div>
            </div>

            {budgetEmpresaError && (
              <div className="mt-3 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {budgetEmpresaError}
              </div>
            )}

            <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="text-[11px] text-white/60">Receita selecionada</div>
                <div className="text-white/85 mt-1">{budgetReceitaFile?.name || "Nenhum arquivo"}</div>
                {budgetEmpresaData?.summary?.receitaFile && !budgetReceitaFile?.name && (
                  <div className="text-[11px] text-white/50 mt-1">Base restaurada do armazenamento local</div>
                )}
              </div>
              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="text-[11px] text-white/60">DREs selecionados</div>
                <div className="text-white/85 mt-1">{budgetDreFiles?.length ? `${budgetDreFiles.length} arquivo(s)` : "Nenhum arquivo"}</div>
                {(budgetDreFiles || []).some((f) => f?.__restored) ? (
                  <div className="text-[11px] text-white/50 mt-1">Os DREs restaurados são só referência visual. A base processada já ficou salva.</div>
                ) : null}
                {budgetEmpresaData?.summary?.dreFiles?.length ? (
                  <div className="text-[11px] text-white/50 mt-1">Os nomes ficam salvos; a base usada no dashboard é a processada.</div>
                ) : null}
                {!!budgetEmpresaData?.summary?.dreFiles?.length && !budgetDreFiles?.length && (
                  <div className="text-[11px] text-white/50 mt-1">Base restaurada do armazenamento local</div>
                )}
              </div>
              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="text-[11px] text-white/60">Combinações geradas</div>
                <div className="text-white/85 mt-1">{Object.keys(budgetEmpresaData?.entries || {}).length || 0}</div>
                {(budgetEmpresaData?.summary || budgetPersistTick) ? (
                  <div className="text-[11px] text-emerald-200/80 mt-1">Base persistida no navegador</div>
                ) : null}
                {budgetEmpresaData?.summary?.combinacoes ? (
                  <div className="text-[11px] text-white/50 mt-1">Base processada restaurável sem reenviar arquivos</div>
                ) : null}
              </div>
              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="text-[11px] text-white/60">Ano base</div>
                <div className="text-white/85 mt-1">{budgetEmpresaData?.summary?.year || "—"}</div>
              </div>
            </div>

            {!!budgetEmpresaData?.summary?.unmatchedCompanies?.length && (
              <div className="mt-3 text-xs text-amber-200">
                Empresas sem casamento entre Receita e DRE: {budgetEmpresaData.summary.unmatchedCompanies.join(", ")}
              </div>
            )}
          </Card>

          <Card
            title="Previsto por plano e empresa"
            right={
              <div className="w-full flex flex-col md:flex-row gap-2 md:items-end">
                <div className="w-full md:w-72">
                  <div className="text-[11px] text-white/60 mb-1">Buscar plano</div>
                  <input
                    value={budgetQuery}
                    onChange={(e) => setBudgetQuery(e.target.value)}
                    placeholder="Buscar plano..."
                    className="w-full rounded-lg px-3 py-2 bg-white/5 border border-white/10 text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-sky-500/40 text-sm"
                  />
                </div>
                <div className="w-full md:w-52">
                  <div className="text-[11px] text-white/60 mb-1">Empresa</div>
                  <select
                    value={budgetEmpresaFilter}
                    onChange={(e) => setBudgetEmpresaFilter(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 bg-white/5 border border-white/10 text-white outline-none focus:ring-2 focus:ring-sky-500/40 text-sm"
                  >
                    <option value="Todas">Todas</option>
                    {budgetEmpresaCompaniesVisible.map((empresa) => (
                      <option key={empresa} value={empresa}>{empresa}</option>
                    ))}
                  </select>
                </div>
                <div className="w-full md:w-40">
                  <div className="text-[11px] text-white/60 mb-1">Mês</div>
                  <select
                    value={budgetMesFilter}
                    onChange={(e) => setBudgetMesFilter(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 bg-white/5 border border-white/10 text-white outline-none focus:ring-2 focus:ring-sky-500/40 text-sm"
                  >
                    <option value="Todos">Todos</option>
                    {budgetEmpresaMonths.map((mes) => (
                      <option key={mes} value={mes}>{mes}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={exportBudgetEmpresaXlsx}
                  className="px-3 py-2 rounded-lg text-sm border bg-emerald-500/20 border-emerald-400/30 text-emerald-100 hover:bg-emerald-500/30"
                >
                  Exportar XLSX
                </button>
              </div>
            }
          >
            <div className="text-[11px] text-white/60 mb-3">
              Os valores ficam salvos neste computador e você só precisa trocar os arquivos quando quiser atualizar a base. Agora você pode filtrar por empresa e por mês, além de exportar para XLSX.
            </div>

            <div className="rounded-xl border border-white/10 overflow-hidden">
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 bg-[#0c1118] border-b border-white/10">
                    <tr className="text-left">
                      <th className="p-2 min-w-[280px]">Plano</th>
                      {budgetEmpresaCompaniesVisible.map((empresa) => (
                        <th key={empresa} className="p-2 min-w-[160px] text-right">{`Previsto ${empresa}`}</th>
                      ))}
                      <th className="p-2 min-w-[160px] text-right">Total Previsto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetEmpresaRows.map((row) => (
                      <tr key={row.plano} className="border-b border-white/5 hover:bg-white/5">
                        <td className="p-2 text-white/85">{row.plano}</td>
                        {budgetEmpresaCompaniesVisible.map((empresa) => (
                          <td key={empresa} className="p-2 text-right text-white/80">
                            {fmtBRL(row.values?.[empresa] || 0)}
                          </td>
                        ))}
                        <td className="p-2 text-right text-white font-medium">{fmtBRL(row.total || 0)}</td>
                      </tr>
                    ))}
                    {!budgetEmpresaRows.length && (
                      <tr>
                        <td className="p-3 text-white/60 text-sm" colSpan={Math.max(2, budgetEmpresaCompaniesVisible.length + 2)}>
                          Carregue e gere a base para visualizar o previsto por empresa.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </main>
      </div>
    );
  }

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
                <div className="text-[12px] text-white/60">Pode carregar 1 ou vários arquivos de rateio — eu junto tudo na mesma base, detecto o cabeçalho automaticamente e removo linhas idênticas repetidas.</div>
                {dedupeInfo.removed > 0 && (
                  <div className="text-[12px] text-amber-300">Duplicidades removidas automaticamente: {dedupeInfo.removed} linha(s). Base final: {dedupeInfo.kept} de {dedupeInfo.total} linha(s).</div>
                )}
                {error && <div className="text-[12px] text-rose-300">Erro: {error}</div>}
                {loading && <div className="text-[12px] text-white/70">Lendo arquivo...</div>}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => inputRef.current?.click()}
                  className="px-3 py-2 rounded-lg bg-sky-500/20 border border-sky-400/30 hover:bg-sky-500/30 text-sm"
                  disabled={loading}
                >
                  Selecionar arquivo(s)
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
                  multiple
                  className="hidden"
                  onChange={(e) => handleFile(Array.from(e.target.files || []))}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card
          title="Filtros"
          right={
            <div className="flex items-center gap-2">
              <div className="text-[11px] text-white/60">Busca / Empresa / Plano</div>
              <button
                type="button"
                onClick={() => openBudgetManager()}
                className="px-2.5 py-1 rounded-lg text-[11px] border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                disabled={!rows.length}
                style={{ colorScheme: "dark" }}
              >
                Orçamentos
              </button>
              <button
                type="button"
                onClick={() => openExecutadoView()}
                className="px-2.5 py-1 rounded-lg text-[11px] border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                disabled={!rows.length}
                style={{ colorScheme: "dark" }}
              >
                Executado
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
                onClick={() => openStatusStandalone("ok")}
                className="px-2 py-0.5 rounded-lg border border-emerald-400/30 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/25 active:scale-[0.99] transition"
                title="Ver planos Dentro"
              >
                Dentro: {statusCounts.ok}
              </button>
              <button
                type="button"
                onClick={() => openStatusStandalone("warn")}
                className="px-2 py-0.5 rounded-lg border border-amber-400/30 bg-amber-500/20 text-amber-200 hover:bg-amber-500/25 active:scale-[0.99] transition"
                title="Ver planos em Atenção"
              >
                Atenção: {statusCounts.warn}
              </button>
              <button
                type="button"
                onClick={() => openStatusStandalone("over")}
                className="px-2 py-0.5 rounded-lg border border-rose-400/30 bg-rose-500/20 text-rose-200 hover:bg-rose-500/25 active:scale-[0.99] transition"
                title="Ver planos Estourados"
              >
                Estourado: {statusCounts.over}
              </button>
              <button
                type="button"
                onClick={() => openStatusStandalone("none")}
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

          <Card title="Top Planos de Contas" style={{ height: 460 }}>
            <div style={{ height: 390 }}>
              {topPlanos.length ? (
                <ResponsiveContainer width="100%" height={390}>
                  <BarChart data={topPlanos} barGap={-34} margin={{ top: 34, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                    <XAxis dataKey="plano" hide />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                    <Tooltip cursor={false} content={<TooltipRich labelPrefix="Categoria" />} />
                    <Bar dataKey="budget" name="Previsto" fill={C_BLUE} fillOpacity={0.18} radius={[10, 10, 0, 0]} barSize={34} />
                        <Bar dataKey="valor" name="Real" radius={[10, 10, 0, 0]} barSize={22} onClick={(d) => {
                      const plano = d?.name ?? d?.payload?.plano;
                      if (plano) {
                        openDrillStandalone(plano);
                        setDrillMes("");
                      }
                    }}>
                      {topPlanos.map((entry, i) => (
                        <Cell key={`top-plano-${i}`} fill={budgetStatusColor(entry)} />
                      ))}
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
                      {byAnoMesLinhas.budgetKeys?.map((k, i) => (
                        <Line
                          key={k}
                          type="monotone"
                          dataKey={k}
                          stroke={PIE_COLORS[i % PIE_COLORS.length]}
                          strokeWidth={2}
                          strokeDasharray="6 4"
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
          <div className="fixed inset-0 z-40 bg-[#091018] overflow-auto">
            <div className="max-w-7xl mx-auto p-4 md:p-6">
          <Card
            title="Detalhamento — Outros"
            right={
              <div className="flex items-center gap-2">
                <div className="text-[11px] text-white/60">Planos dentro de “Outros”</div>
                <button
                  type="button"
                  onClick={() => setOutrosOpen(false)}
                  className="px-3 py-2 rounded-lg text-xs border bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                >
                  ← Voltar
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
          <div
            key={`${d.plano}-${i}`}
            className="w-full text-left px-3 py-2 flex items-center gap-2 border-b border-white/5 last:border-b-0"
            title={d.plano}
          >
            <span className="truncate text-white/80">{d.plano}</span>
            <span className="ml-auto text-white/70">{fmtBRL(d.valor)}</span>
            <span className="text-white/50 text-xs w-[56px] text-right">{d.pctLabel}</span>
          </div>
        ))}
      </div>
    </div>
  </Card>
            </div>
          </div>
)}

        {drillPlano && drillPlano !== "Outros" && (
          <div className="fixed inset-0 z-40 bg-[#091018] overflow-auto">
            <div className="max-w-7xl mx-auto p-4 md:p-6">
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
                  onClick={() => setDrillPlano(null)} className="px-3 py-2 rounded-lg text-xs border bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                >
                  ← Voltar
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
            </div>
          </div>
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
                      onClick={exportStatusTableXlsx}
                      className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-white/80"
                    >
                      Exportar XLSX
                    </button>
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
                        </tr>
                    </thead>
                    <tbody>
                      {statusPlanosFiltered.map((p) => (
                        <tr key={p.plano} className="border-t border-white/10 hover:bg-white/5">
                          <td className="px-3 py-2 text-white/80">
                            <span className="mr-2">{p.statusEmoji}</span>
                            <span className="text-[12px]">{p.statusLabel}</span>
                          </td>
                          <td className="px-3 py-2 text-white/90">
                            <span className="text-left text-white/90">{p.plano}</span>
                          </td>
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
                        </tr>
                      ))}
                      {!statusPlanosFiltered.length && (
                        <tr>
                          <td colSpan={5} className="px-3 py-8 text-center text-white/60">
                            Nenhum plano encontrado para esse status.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 text-[11px] text-white/50">
                  Dica: use <span className="text-white/70">Exportar XLSX</span> para baixar a tabela filtrada desse status.
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
