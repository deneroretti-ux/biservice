"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from "recharts";
import * as XLSX from "xlsx";

/* ====== CONFIG ====== */
const CYCLE_WINDOW = 17;
const CURRENT_CYCLE = 16; // ciclo atual para lógica de desativação
const BRAND_OPTIONS = ["Todas", "BOTICARIO", "EUDORA", "QUEM DISSE BERENICE"];

const SALES_CITY_OPTIONS = [
  "Todas",
  "BEBEDOURO CENTRO",
  "BEBEDOURO SHOP",
  "BEBEDOURO VD",
  "COLINA",
  "MONTE AZUL PAULISTA",
  "PITANGUEIRAS",
  "VIRADOURO",
];

/* ====== PALETA ====== */
const C_BLUE = "#3b82f6";
const C_GREEN = "#22c55e";
const C_AMBER = "#f59e0b";
const C_ROSE = "#ef4444";
const C_PURPLE = "#7c3aed";
const C_CARD_BORDER = "rgba(255,255,255,0.10)";
const C_CARD_BG = "rgba(255,255,255,0.03)";
const PIE_COLORS = [C_BLUE, C_GREEN, C_AMBER];

/* ====== helpers ====== */
function normalize(str) {
  return String(str || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cicloKey(c) {
  const s = String(c || "");
  if (/^\d{6}$/.test(s)) return parseInt(s, 10);
  const m = s.match(/(20\d{2}).*?(\d{1,2})/);
  if (!m) return Number.NEGATIVE_INFINITY;
  return Number(m[1]) * 100 + Number(m[2]);
}

function brandFromSheetName(name) {
  const n = normalize(name);
  if (/boticario|boti/.test(n)) return "BOTICARIO";
  if (/eudora/.test(n)) return "EUDORA";
  if (/quem.*disse.*berenice|qdb|berenice/.test(n)) return "QUEM DISSE BERENICE";
  return name?.toString?.().toUpperCase?.() || "";
}

async function fetchPdvCityMapLocal() {
  try {
    const r = await fetch("/Pasta1.csv");
    if (!r.ok) return {};
    const txt = await r.text();
    const lines = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return {};
    const cand = [",", ";", "=", "\t", "|"];
    let sep = ";";
    for (const c of cand) {
      if ((lines[0].split(c).length || 0) >= 2) {
        sep = c;
        break;
      }
    }
    let pairs = [];
    for (const ln of lines) {
      if (!ln.includes(sep)) continue;
      const [left, ...rest] = ln.split(sep);
      const right = rest.join(sep);
      const L = String(left || "").trim();
      const R = String(right || "").trim();
      if (L && R) pairs.push([L, R]);
    }
    if (
      pairs.length &&
      /[a-zA-Z]/.test(pairs[0][0]) &&
      !/^\d+$/.test(pairs[0][0])
    ) {
      pairs.shift();
    }
    const map = {};
    for (const [pdv, cidadeUF] of pairs) {
      let cidade = cidadeUF;
      let uf = "";
      if (cidadeUF.includes("/")) {
        const i = cidadeUF.lastIndexOf("/");
        cidade = cidadeUF.slice(0, i).trim();
        uf = cidadeUF.slice(i + 1).trim();
      } else if (cidadeUF.includes("-")) {
        const i = cidadeUF.lastIndexOf("-");
        cidade = cidadeUF.slice(0, i).trim();
        uf = cidadeUF.slice(i + 1).trim();
      }
      map[String(pdv).trim()] = { Cidade: cidade, UF: uf };
    }
    return map;
  } catch {
    return {};
  }
}

function percentile(values, p) {
  const arr = (values || []).slice().sort((a, b) => a - b);
  if (!arr.length) return 0;
  const pos = (p / 100) * (arr.length - 1);
  const base = Math.floor(pos);
  const rest = pos - base;
  return arr[base + 1] !== undefined
    ? arr[base] + rest * (arr[base + 1] - arr[base])
    : arr[base];
}

function parseCycleFromDesativ(v) {
  if (v == null) return null;
  const m = String(v).match(/\d+/); // pega primeiro número (ex: "C15" -> 15)
  if (!m) return null;
  const num = Number(m[0]);
  return Number.isNaN(num) ? null : num;
}

// lê campo "Promoção Próximo Ciclo"
function parsePromoInfo(value) {
  if (value == null) {
    return { cicloPromo: null, descontoPercent: null };
  }
  const s = String(value);

  // Ex.: "202516 - 40%" -> captura "202516"
  const mCycle = s.match(/20\d{4}/);
  const cicloPromo = mCycle ? Number(mCycle[0]) : null;

  // Ex.: "40%" ou "40,0%" -> captura 40
  const mDesc = s.match(/(\d+[\.,]?\d*)\s*%/);
  let descontoPercent = null;
  if (mDesc) {
    const num = Number(mDesc[1].replace(",", "."));
    if (!Number.isNaN(num)) {
      descontoPercent = num;
    }
  }

  return { cicloPromo, descontoPercent };
}

/* ====== UI ====== */
function Card({ title, borderColor = C_CARD_BORDER, children, right = null }) {
  const hasHeader = Boolean(title) || Boolean(right);

  return (
    <section
      className="rounded-2xl p-4 shadow-sm"
      style={{ border: `1px solid ${borderColor}`, background: C_CARD_BG }}
    >
      {hasHeader && (
        <div className="flex items-end justify-between gap-3 mb-3">
          {title && (
            <h2 className="text-lg font-semibold">{title}</h2>
          )}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

function Kpi({ title, value, color = C_BLUE, raw = false, size = "lg" }) {
  const display = raw
    ? String(value ?? "")
    : Number(value || 0).toLocaleString("pt-BR");
  const sizeClass =
    size === "sm" ? "text-base" : size === "md" ? "text-2xl" : "text-3xl";
  return (
    <div
      className="rounded-2xl p-4"
      style={{ border: `1px solid ${C_CARD_BORDER}`, background: C_CARD_BG }}
    >
      <p className="text-xs text-white/70">{title}</p>
      <p className={`${sizeClass} font-extrabold mt-1`} style={{ color }}>
        {display}
      </p>
    </div>
  );
}

function SelectDark({ label, value, onChange, options, className = "" }) {
  return (
    <div className={className}>
      <p className="text-xs text-white/70 mb-1">{label}</p>
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          className="w-full appearance-none rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 text-sm text-white pr-9"
          style={{ colorScheme: "dark" }}
        >
          {options.map((opt) => {
            const val = typeof opt === "string" ? opt : opt.value;
            const labelText = typeof opt === "string" ? opt : opt.label;
            return (
              <option
                key={val}
                value={val}
                className="text-white"
                style={{ color: "#fff", backgroundColor: "#0f172a" }}
              >
                {labelText}
              </option>
            );
          })}
        </select>
        <svg
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-80"
          width="16"
          height="16"
          viewBox="0 0 24 24"
        >
          <path fill="currentColor" d="M7 10l5 5l5-5z" />
        </svg>
      </div>
    </div>
  );
}

/* ====== PAGE ====== */
export default function DashboardEstoquePage() {
  const [activeSection, setActiveSection] = useState("resumo");
  const [pdvMap, setPdvMap] = useState({});
  const [allRowsEstoque, setAllRowsEstoque] = useState([]);
  const [brandFilter, setBrandFilter] = useState("Todas");
  const [rowsProcessed, setRowsProcessed] = useState([]);
  const [error, setError] = useState("");

  const [cityFilter, setCityFilter] = useState("Todas");
  const [query, setQuery] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  const [showMinDetail, setShowMinDetail] = useState(false);
  const [showPlanDetail, setShowPlanDetail] = useState(false);
  const fileRef = useRef(null);

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  const [salesRowsAll, setSalesRowsAll] = useState([]);
  const [salesRows, setSalesRows] = useState([]);
  const [skuList, setSkuList] = useState([]);
  const [skuSel, setSkuSel] = useState("Todos");
  const [selectedCycle, setSelectedCycle] = useState("Todos");
  const [showCycleDetail, setShowCycleDetail] = useState(false);

  const [salesCityFilter, setSalesCityFilter] = useState("Todas");

  const [minMethod, setMinMethod] = useState("media17");
  const [covFactor, setCovFactor] = useState("1.0");

  const [planTab, setPlanTab] = useState("transfer");
  const [planCityFilter, setPlanCityFilter] = useState("Todas");
  const [planCurveFilter, setPlanCurveFilter] = useState("Todas");
  const [planCategoryFilter, setPlanCategoryFilter] = useState("Todas");
  const [planDays, setPlanDays] = useState("21"); // horizonte em dias (~1 ciclo)
  const [planDesativMode, setPlanDesativMode] = useState("todos"); // opção 4
  const [buyDesativMode, setBuyDesativMode] = useState("excluir"); // opção 2

  // Promoções - filtros / controles do card
  const [promoSkuFilter, setPromoSkuFilter] = useState("Todos");
  const [promoCurveFilter, setPromoCurveFilter] = useState("Todas");
  const [promoHorizonDays, setPromoHorizonDays] = useState("21");
  const [showPromoDetail, setShowPromoDetail] = useState(false);

  useEffect(() => {
    (async () => setPdvMap(await fetchPdvCityMapLocal()))();
  }, []);

  // 🔹 Restaura automaticamente o último upload em qualquer rota/aba
  useEffect(() => {
    try {
      const cached = localStorage.getItem("dashboardEstoqueCache");
      if (!cached) return;

      const parsed = JSON.parse(cached);
      const estoqueAll = parsed?.estoqueAll || [];
      const vendasAll = parsed?.vendasAll || [];

      if (!estoqueAll.length && !vendasAll.length) return;

      setAllRowsEstoque(estoqueAll);
      setSalesRowsAll(vendasAll);

      // Filtros padrão
      setBrandFilter("Todas");
      setCityFilter("Todas");
      setSalesCityFilter("Todas");

      setStatus("Dados restaurados do último upload");
      setProgress(100);
    } catch (err) {
      console.error("Erro ao restaurar cache do dashboard", err);
    }
  }, []);

  // Restaura automaticamente dados processados do último upload
  useEffect(() => {
    try {
      const cached = localStorage.getItem("dashboardEstoqueCache");
      if (!cached) return;
      const parsed = JSON.parse(cached);
      if (parsed?.estoqueAll?.length || parsed?.vendasAll?.length) {
        setAllRowsEstoque(parsed.estoqueAll || []);
        setSalesRowsAll(parsed.vendasAll || []);
        setBrandFilter("Todas");
      }
    } catch (err) {
      console.error("Erro ao restaurar cache do dashboard", err);
    }
  }, []);

  async function onUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setIsLoading(true);
    setProgress(0);
    setStatus("Lendo arquivo…");

    try {
      const buf = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onprogress = (evt) => {
          if (evt.lengthComputable) {
            setProgress(
              Math.min(99, Math.round((evt.loaded / evt.total) * 100))
            );
          }
        };
        fr.onload = () => resolve(fr.result);
        fr.onerror = () =>
          reject(fr.error || new Error("Erro ao ler arquivo"));
        fr.readAsArrayBuffer(file);
      });

      setStatus("Montando workbook…");
      setProgress(70);
      const wb = XLSX.read(buf, { type: "array" });

      setStatus("Processando abas de estoque…");
      setProgress(85);
      const estoqueAll = computeFromWorkbookEstoqueLocal(wb, pdvMap);

      setStatus("Processando abas de vendas…");
      setProgress(92);
      const vendasAll = extractSalesRowsAllLocal(wb, pdvMap);

      setAllRowsEstoque(estoqueAll);
      setSalesRowsAll(vendasAll);
      setBrandFilter("Todas");

      try {
        localStorage.setItem(
          "dashboardEstoqueCache",
          JSON.stringify({ estoqueAll, vendasAll })
        );
      } catch (err) {
        console.error("Erro ao salvar cache do dashboard", err);
      }

      setStatus("Finalizando…");
      setProgress(100);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Falha ao processar o arquivo");
    } finally {
      setTimeout(() => {
        setIsLoading(false);
        setStatus("");
        setProgress(0);
      }, 400);
    }
  }

  function computeFromWorkbookEstoqueLocal(wb, pdvCityMap) {
    const result = [];
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;
      const raw = XLSX.utils.sheet_to_json(ws, { defval: null });
      if (!raw.length) continue;

      const headerMap = {};
      Object.keys(raw[0]).forEach((k) => (headerMap[k] = normalize(k)));
      const findCol = (cands) => {
        for (const rawKey in headerMap) {
          if (cands.includes(headerMap[rawKey])) return rawKey;
        }
        return null;
      };

      const skuCol = findCol([
        "sku",
        "codigo do produto",
        "codigo",
        "codigo_produto",
        "código",
        "codigo produto",
      ]);
      const descCol = findCol([
        "descricao",
        "descrição",
        "descricao do produto",
        "descrição do produto",
        "descricao_produto",
        "descrição_produto",
        "nome do produto",
        "produto",
        "nome",
        "descr",
        "descrição item",
        "descricao item",
      ]);
      const estoqueAtualCol = findCol([
        "estoque atual",
        "estoque_atual",
        "estq atual",
        "estq_atual",
      ]);
      const estoqueTransCol = findCol([
        "estoque em transito",
        "estoque em trânsito",
        "estoque_em_transito",
        "transito",
        "trânsito",
      ]);
      const pedidoPendCol = findCol([
        "pedido pendente",
        "pedido_pendente",
        "pedidos pendentes",
        "pedido aberto",
      ]);
      const precoSellInCol = findCol([
        "preço sell in",
        "preco sell in",
        "preco sell-in",
        "preço sell-in",
        "preço unitario",
        "preco unitario",
        "valor unitario",
        "valor unitário",
        "valor unit",
      ]);

      let pdvCol = null;
      for (const rawKey in headerMap) {
        if (headerMap[rawKey] === "pdv") {
          pdvCol = rawKey;
          break;
        }
      }

      const classeCol = findCol([
        "classe",
        "classe sku",
        "classe do sku",
        "classe do produto",
        "curva",
        "curva sku",
        "curva do produto",
      ]);

      const categoriaCol = findCol([
        "categoria",
        "categoria sku",
        "categoria do sku",
        "categoria do produto",
      ]);

      const desativCol = findCol([
        "desativacao",
        "desativação",
        "desativ",
        "desativar",
        "desativado",
      ]);

      const promoCol = findCol([
        "promocao proximo ciclo",
        "promocao proximo",
        "promocao prox ciclo",
        "promocao prox",
        "promoção próximo ciclo",
        "promoção proximo ciclo",
        "promoção prox ciclo",
      ]);

      if (!skuCol) continue;

      const marca = brandFromSheetName(sheetName);
      const bestDescBySku = new Map();
      const tmpRows = [];

      for (const r of raw) {
        const sku = String(r?.[skuCol] ?? "").trim();
        if (!sku) continue;

        const rawDesc = descCol ? r?.[descCol] ?? "" : "";
        const desc = String(rawDesc ?? "").trim();
        if (desc) bestDescBySku.set(sku, desc);

        const pdv = pdvCol ? String(r?.[pdvCol] ?? "").trim() : "";
        const cidade =
          pdv && pdvCityMap?.[pdv]?.Cidade
            ? pdvCityMap[pdv].Cidade || ""
            : "";
        const est = Number(r?.[estoqueAtualCol] ?? 0) || 0;
        const trans = Number(r?.[estoqueTransCol] ?? 0) || 0;
        const pend = Number(r?.[pedidoPendCol] ?? 0) || 0;
        const pendLiquido = Math.max(pend - trans, 0);

        const classe = classeCol
          ? String(r?.[classeCol] ?? "").trim().toUpperCase()
          : "";

        const categoria = categoriaCol
          ? String(r?.[categoriaCol] ?? "").trim().toUpperCase()
          : "";

        const precoSellIn = precoSellInCol
          ? Number(r?.[precoSellInCol] ?? 0) || 0
          : 0;

        const rawDesativ = desativCol ? r?.[desativCol] : null;
        const desativCycle = parseCycleFromDesativ(rawDesativ);

        const rawPromo = promoCol ? r?.[promoCol] : null;
        const { cicloPromo, descontoPercent } = parsePromoInfo(rawPromo);

        tmpRows.push({
          Marca: marca,
          Aba: sheetName,
          CodigoProduto: sku,
          DescricaoProduto: desc,
          PDV: pdv,
          Cidade: cidade,
          Classe: classe,
          Categoria: categoria,
          PrecoSellIn: precoSellIn,
          EstoqueAtual: est,
          EstoqueTransito: trans,
          PedidosPendentes: pend,
          PendentesLiquidos: pendLiquido,
          Desativacao: rawDesativ,
          DesativacaoCiclo: desativCycle,
          PromocaoTexto: rawPromo,
          PromoCiclo: cicloPromo,
          PromoDescontoPercent: descontoPercent,
        });
      }

      for (const row of tmpRows) {
        let d = row.DescricaoProduto;
        if (!d || d.trim() === "") {
          const fallback = bestDescBySku.get(row.CodigoProduto);
          d =
            fallback && String(fallback).trim()
              ? String(fallback).trim()
              : "";
        }
        if (!d) d = `SKU ${row.CodigoProduto}`;
        result.push({ ...row, DescricaoProduto: d });
      }
    }
    return result;
  }

  function extractSalesRowsAllLocal(wb, pdvCityMap) {
    const collected = [];
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;
      const raw = XLSX.utils.sheet_to_json(ws, { defval: null });
      if (!raw.length) continue;

      const headerMap = {};
      Object.keys(raw[0]).forEach((k) => (headerMap[k] = normalize(k)));
      const findCol = (cands) => {
        for (const rawKey in headerMap) {
          if (cands.includes(headerMap[rawKey])) return rawKey;
        }
        return null;
      };

      const marca = brandFromSheetName(sheetName);
      const cicloCol = Object.keys(headerMap).find(
        (rk) => headerMap[rk] === "ciclo"
      );
      const skuColLong = findCol([
        "sku",
        "codigo do produto",
        "codigo",
        "codigo_produto",
        "código",
        "codigo produto",
      ]);
      const qtdColLong = findCol([
        "qtd vendida",
        "qtdvendida",
        "quantidade vendida",
        "qtd",
        "venda",
        "vendida",
      ]);
      const cidadeCol = findCol(["cidade", "municipio", "município"]);
      const pdvCol = findCol(["pdv", "loja", "filial"]);
      let capturedAny = false;

      if (cicloCol && skuColLong && qtdColLong) {
        for (const r of raw) {
          const ciclo = r?.[cicloCol];
          const sku = r?.[skuColLong];
          const qty = Number(r?.[qtdColLong] ?? 0) || 0;
          let cidade = "";
          if (cidadeCol) cidade = String(r?.[cidadeCol] ?? "").trim();
          else if (pdvCol) {
            const pdv = String(r?.[pdvCol] ?? "").trim();
            if (pdv && pdvCityMap?.[pdv]?.Cidade)
              cidade = pdvCityMap[pdv].Cidade;
          }
          if (ciclo && sku != null) {
            collected.push({
              Marca: marca,
              Aba: sheetName,
              Ciclo: String(ciclo).trim(),
              CodigoProduto: String(sku).trim(),
              QtdVendida: qty,
              Cidade: cidade,
            });
          }
          capturedAny = true;
        }
      }

      const skuColWide =
        skuColLong ||
        findCol(["produto", "id produto", "id", "ean", "referencia"]);
      const cycleColumns = [];
      for (const rawKey in headerMap) {
        const original = rawKey;
        const norm = headerMap[rawKey];
        let m =
          original.match(/ciclo\s*(20\d{2})\s*([01]\d)/i) ||
          original.match(/ciclo.*?(20\d{2}[01]\d)/i) ||
          norm.match(/ciclo\s*(20\d{2})\s*([01]\d)/i) ||
          norm.match(/ciclo.*?(20\d{2}[01]\d)/i);
        if (m) {
          const ciclo = m[2] ? `${m[1]}${m[2]}` : m[1];
          if (/^\d{6}$/.test(ciclo)) {
            cycleColumns.push({ key: original, ciclo });
          }
        }
      }
      if (!capturedAny && skuColWide && cycleColumns.length) {
        for (const r of raw) {
          const sku = r?.[skuColWide];
          if (sku == null || sku === "") continue;
          let cidade = "";
          if (cidadeCol) cidade = String(r?.[cidadeCol] ?? "").trim();
          else if (pdvCol) {
            const pdv = String(r?.[pdvCol] ?? "").trim();
            if (pdv && pdvCityMap?.[pdv]?.Cidade)
              cidade = pdvCityMap[pdv].Cidade;
          }
          for (const col of cycleColumns) {
            const qty = Number(r?.[col.key] ?? 0) || 0;
            collected.push({
              Marca: marca,
              Aba: sheetName,
              Ciclo: col.ciclo,
              CodigoProduto: String(sku).trim(),
              QtdVendida: qty,
              Cidade: cidade,
            });
          }
        }
      }
    }
    return collected;
  }

  const brandOptions = useMemo(() => BRAND_OPTIONS, []);
  const cityOptions = useMemo(() => {
    const set = new Set();
    for (const r of rowsProcessed) if (r.Cidade) set.add(r.Cidade);
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rowsProcessed]);

  const rowsAgg = useMemo(() => {
    const base = rowsProcessed.filter((r) =>
      cityFilter === "Todas" ? true : r.Cidade === cityFilter
    );
    const bySku = new Map();
    for (const r of base) {
      const key = r.CodigoProduto;
      if (!bySku.has(key)) {
        bySku.set(key, {
          CodigoProduto: r.CodigoProduto,
          DescricaoProduto: r.DescricaoProduto || "",
          EstoqueAtual: 0,
          EstoqueTransito: 0,
          PedidosPendentes: 0,
          PendentesLiquidos: 0,
          _cities: new Set(),
        });
      }
      const acc = bySku.get(key);
      acc.EstoqueAtual += r.EstoqueAtual || 0;
      acc.EstoqueTransito += r.EstoqueTransito || 0;
      acc.PedidosPendentes += r.PedidosPendentes || 0;
      acc.PendentesLiquidos += r.PendentesLiquidos || 0;
      if (r.Cidade) acc._cities.add(r.Cidade);
      if (
        (!acc.DescricaoProduto || acc.DescricaoProduto.trim() === "") &&
        r.DescricaoProduto
      ) {
        acc.DescricaoProduto = r.DescricaoProduto;
      }
    }
    const q = (query || "").toLowerCase();
    const list = Array.from(bySku.values()).filter(
      (r) =>
        String(r.CodigoProduto || "").toLowerCase().includes(q) ||
        String(r.DescricaoProduto || "").toLowerCase().includes(q)
    );
    for (const item of list) {
      const cities = Array.from(item._cities);
      item.Cidade =
        cityFilter !== "Todas"
          ? cityFilter
          : cities.length === 1
          ? cities[0]
          : cities.length > 1
          ? "Várias"
          : "";
      delete item._cities;
      if (!item.DescricaoProduto || item.DescricaoProduto.trim() === "") {
        item.DescricaoProduto = `SKU ${item.CodigoProduto}`;
      }
    }
    return list;
  }, [rowsProcessed, cityFilter, query]);

  const totEst = useMemo(
    () => rowsAgg.reduce((s, r) => s + (r.EstoqueAtual || 0), 0),
    [rowsAgg]
  );
  const totTrans = useMemo(
    () => rowsAgg.reduce((s, r) => s + (r.EstoqueTransito || 0), 0),
    [rowsAgg]
  );
  const totPendLiq = useMemo(
    () => rowsAgg.reduce((s, r) => s + (r.PendentesLiquidos || 0), 0),
    [rowsAgg]
  );

  useEffect(() => {
    const rows =
      brandFilter === "Todas"
        ? allRowsEstoque
        : allRowsEstoque.filter((r) => r.Marca === brandFilter);
    setRowsProcessed(rows);
  }, [brandFilter, allRowsEstoque]);

  useEffect(() => {
    let rows =
      brandFilter === "Todas"
        ? salesRowsAll
        : salesRowsAll.filter((r) => r.Marca === brandFilter);

    if (salesCityFilter !== "Todas") {
      const target = salesCityFilter.toUpperCase();
      rows = rows.filter(
        (r) => (r.Cidade || "").toUpperCase() === target
      );
    }

    if (!rows.length) {
      setSalesRows([]);
      setSkuList([]);
      setSkuSel("Todos");
      setSelectedCycle("Todos");
      return;
    }
    const ciclosAll = Array.from(new Set(rows.map((r) => r.Ciclo))).sort(
      (a, b) => cicloKey(a) - cicloKey(b)
    );
    const lastN = ciclosAll.slice(-CYCLE_WINDOW);
    const filtered = rows.filter((r) => lastN.includes(r.Ciclo));
    setSalesRows(filtered);
    const skus = Array.from(
      new Set(filtered.map((r) => r.CodigoProduto))
    ).sort((a, b) => a.localeCompare(b));
    setSkuList(["Todos", ...skus]);
    setSkuSel("Todos");
    setSelectedCycle("Todos");
  }, [brandFilter, salesRowsAll, salesCityFilter]);

  const cycleOptions = useMemo(() => {
    if (!salesRows.length) return ["Todos"];
    const all = Array.from(new Set(salesRows.map((r) => r.Ciclo))).sort(
      (a, b) => cicloKey(a) - cicloKey(b)
    );
    const last = all.slice(-CYCLE_WINDOW);
    return ["Todos", ...last];
  }, [salesRows]);

  const cyclesForSku = useMemo(() => {
    if (!salesRows.length) return [];
    const base =
      skuSel === "Todos"
        ? salesRows
        : salesRows.filter((r) => r.CodigoProduto === skuSel);
    const byCiclo = new Map();
    for (const r of base) {
      byCiclo.set(
        r.Ciclo,
        (byCiclo.get(r.Ciclo) || 0) + (r.QtdVendida || 0)
      );
    }
    return Array.from(byCiclo.entries())
      .sort((a, b) => cicloKey(a[0]) - cicloKey(b[0]))
      .map(([Ciclo, QtdVendida]) => ({ Ciclo, QtdVendida }));
  }, [salesRows, skuSel]);

  const media17 = useMemo(() => {
    if (!cyclesForSku.length) return 0;
    const total = cyclesForSku.reduce(
      (s, x) => s + (x.QtdVendida || 0),
      0
    );
    return total / cyclesForSku.length;
  }, [cyclesForSku]);

  const maxInfo = useMemo(() => {
    if (!cyclesForSku.length) return { ciclo: "", qtd: 0 };
    let best = cyclesForSku[0];
    for (const x of cyclesForSku) {
      if (x.QtdVendida > best.QtdVendida) best = x;
    }
    return { ciclo: best.Ciclo, qtd: best.QtdVendida };
  }, [cyclesForSku]);

  const resumoFiltro = useMemo(() => {
    let mediaFiltro = 0;
    let maxFiltroQtd = 0;
    let maxFiltroLabel = "-";

    let base;
    if (selectedCycle === "Todos") {
      base =
        skuSel === "Todos"
          ? salesRows
          : salesRows.filter((r) => r.CodigoProduto === skuSel);
    } else {
      base =
        skuSel === "Todos"
          ? salesRows.filter((r) => r.Ciclo === selectedCycle)
          : salesRows.filter(
              (r) =>
                r.Ciclo === selectedCycle &&
                r.CodigoProduto === skuSel
            );
    }

    if (!base.length) {
      mediaFiltro = selectedCycle === "Todos" ? media17 : 0;
      return {
        mediaTexto: Number(mediaFiltro || 0).toLocaleString("pt-BR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }),
        maxQtdTexto: "0",
        maxLabel: "-",
      };
    }

    const bySku = new Map();
    for (const r of base) {
      bySku.set(
        r.CodigoProduto,
        (bySku.get(r.CodigoProduto) || 0) + (r.QtdVendida || 0)
      );
    }

    const arr = Array.from(bySku.values());
    const total = arr.reduce((s, v) => s + v, 0);
    const count = arr.length || 1;

    mediaFiltro = selectedCycle === "Todos" ? media17 : total / count;

    let bestSku = { sku: "", qtd: 0 };
    for (const [sku, qtd] of bySku.entries()) {
      if (qtd > bestSku.qtd) bestSku = { sku, qtd };
    }

    maxFiltroQtd = bestSku.qtd || 0;

    if (bestSku.sku) {
      let desc = "";
      for (const r of rowsProcessed) {
        if (
          r.CodigoProduto === bestSku.sku &&
          r.DescricaoProduto
        ) {
          desc = r.DescricaoProduto;
          break;
        }
      }
      maxFiltroLabel = desc || bestSku.sku;
    }

    return {
      mediaTexto: Number(mediaFiltro || 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }),
      maxQtdTexto: Number(maxFiltroQtd || 0).toLocaleString("pt-BR"),
      maxLabel: maxFiltroLabel,
    };
  }, [media17, selectedCycle, skuSel, salesRows, rowsProcessed]);

  const skuMeta = useMemo(() => {
    const map = new Map();
    for (const r of rowsProcessed) {
      if (r.CodigoProduto && !map.has(r.CodigoProduto)) {
        map.set(r.CodigoProduto, r.DescricaoProduto || "");
      }
      if (r.CodigoProduto && r.DescricaoProduto) {
        map.set(r.CodigoProduto, r.DescricaoProduto);
      }
    }
    return map;
  }, [rowsProcessed]);

  const skuClasse = useMemo(() => {
    const map = new Map();
    for (const r of rowsProcessed) {
      if (r.CodigoProduto && r.Classe && !map.has(r.CodigoProduto)) {
        map.set(r.CodigoProduto, r.Classe);
      }
    }
    return map;
  }, [rowsProcessed]);

  const skuCategoria = useMemo(() => {
    const map = new Map();
    for (const r of rowsProcessed) {
      if (
        r.CodigoProduto &&
        r.Categoria &&
        !map.has(r.CodigoProduto)
      ) {
        map.set(r.CodigoProduto, r.Categoria);
      }
    }
    return map;
  }, [rowsProcessed]);

  const skuDesativacao = useMemo(() => {
    const map = new Map();
    for (const r of allRowsEstoque) {
      if (!r.CodigoProduto) continue;
      if (r.DesativacaoCiclo == null) continue;

      const sku = String(r.CodigoProduto).trim();
      const ciclo = Number(r.DesativacaoCiclo);
      if (!ciclo || Number.isNaN(ciclo)) continue;

      const atual = map.get(sku);
      if (atual == null || ciclo < atual) {
        map.set(sku, ciclo);
      }
    }
    return map;
  }, [allRowsEstoque]);

  // Marca por SKU (para investimento por marca)
  const skuMarca = useMemo(() => {
    const map = new Map();
    for (const r of allRowsEstoque) {
      if (r.CodigoProduto && r.Marca) {
        const sku = String(r.CodigoProduto).trim();
        if (!sku) continue;
        if (!map.has(sku)) {
          map.set(sku, r.Marca);
        }
      }
    }
    return map;
  }, [allRowsEstoque]);

  // Preço por SKU + Cidade
  const skuPrecoCidade = useMemo(() => {
    const map = new Map(); // sku -> Map(cidade -> preço)
    for (const r of allRowsEstoque) {
      if (r.CodigoProduto == null) continue;
      const sku = String(r.CodigoProduto).trim();
      if (!sku) continue;
      const cidade = (r.Cidade || "").trim();
      if (!cidade) continue;

      const price = Number(r.PrecoSellIn ?? 0) || 0;
      if (!map.has(sku)) map.set(sku, new Map());
      const inner = map.get(sku);

      if (price > 0) {
        inner.set(cidade, price);
      } else if (!inner.has(cidade)) {
        inner.set(cidade, price);
      }
    }
    return map;
  }, [allRowsEstoque]);

  const skuOptions = useMemo(() => {
    if (!skuList || !skuList.length) return ["Todos"];
    return skuList.map((sku) => {
      if (sku === "Todos") {
        return { value: "Todos", label: "Todos" };
      }
      const desc = skuMeta.get(sku);
      return {
        value: sku,
        label:
          desc && String(desc).trim() ? String(desc).trim() : sku,
      };
    });
  }, [skuList, skuMeta]);

  const statsPorSku = useMemo(() => {
    const bySkuCiclo = new Map();
    for (const r of salesRows) {
      const key = `${r.CodigoProduto}||${r.Ciclo}`;
      bySkuCiclo.set(
        key,
        (bySkuCiclo.get(key) || 0) + (r.QtdVendida || 0)
      );
    }
    const bySku = new Map();
    for (const [key, qtd] of bySkuCiclo.entries()) {
      const [sku] = key.split("||");
      if (!bySku.has(sku)) bySku.set(sku, []);
      bySku.get(sku).push(qtd);
    }
    const out = new Map();
    for (const [sku, arrRaw] of bySku.entries()) {
      const arr = arrRaw.map((n) => Number(n || 0));
      const n = arr.length;
      const sum = arr.reduce((s, x) => s + x, 0);
      const mean = n ? sum / n : 0;
      const maxv = n ? Math.max(...arr) : 0;
      const p85 = percentile(arr, 85);
      let sigma = 0;
      if (n > 1) {
        const varS =
          arr.reduce((s, x) => s + Math.pow(x - mean, 2), 0) /
          (n - 1);
        sigma = Math.sqrt(varS);
      }
      out.set(sku, { n, mean, maxv, p85, sigma });
    }
    return out;
  }, [salesRows]);

  const sugestaoMinimo = useMemo(() => {
    const list = [];
    for (const [sku, st] of statsPorSku.entries()) {
      let base = 0;
      switch (minMethod) {
        case "media17":
          base = st.mean;
          break;
        case "max17":
          base = st.maxv;
          break;
        case "p85":
          base = st.p85;
          break;
        case "media+1sigma":
          base = st.mean + st.sigma;
          break;
        default:
          base = st.mean;
      }
      const sugerido = Math.max(
        0,
        Math.ceil((base || 0) * (Number(covFactor) || 1))
      );
      let desc = skuMeta.get(sku) || "";
      if (!desc || desc.trim() === "") desc = `SKU ${sku}`;
      list.push({
        SKU: sku,
        Descricao: desc,
        CiclosUsados: st.n,
        EstoqueMinimoSugerido: sugerido,
      });
    }
    list.sort(
      (a, b) => b.EstoqueMinimoSugerido - a.EstoqueMinimoSugerido
    );
    return list;
  }, [statsPorSku, minMethod, covFactor, skuMeta]);

  const minChartData = useMemo(
    () =>
      sugestaoMinimo.slice(0, 20).map((r) => ({
        SKU: r.SKU,
        Label: `${r.SKU} — ${r.Descricao}`,
        Min: r.EstoqueMinimoSugerido,
      })),
    [sugestaoMinimo]
  );

  const salesShareCity = useMemo(() => {
    const map = new Map();
    for (const r of salesRows) {
      const sku = r.CodigoProduto;
      const cidade = (r.Cidade || "").trim();
      if (!cidade) continue;
      if (!map.has(sku)) map.set(sku, new Map());
      const inner = map.get(sku);
      inner.set(cidade, (inner.get(cidade) || 0) + (r.QtdVendida || 0));
    }
    const share = new Map();
    for (const [sku, byCity] of map.entries()) {
      const total = Array.from(byCity.values()).reduce(
        (s, v) => s + v,
        0
      );
      const innerShare = new Map();
      if (total > 0) {
        for (const [city, v] of byCity.entries()) {
          innerShare.set(city, v / total);
        }
      }
      share.set(sku, innerShare);
    }
    return share;
  }, [salesRows]);

  const estoqueBySkuCity = useMemo(() => {
    const by = new Map();
    for (const r of rowsProcessed) {
      const sku = r.CodigoProduto;
      const city = r.Cidade || "";
      if (!by.has(sku)) by.set(sku, new Map());
      const inner = by.get(sku);
      if (!inner.has(city)) {
        inner.set(city, {
          EstoqueAtual: 0,
          EstoqueTransito: 0,
          PendLiq: 0,
        });
      }
      const acc = inner.get(city);
      acc.EstoqueAtual += r.EstoqueAtual || 0;
      acc.EstoqueTransito += r.EstoqueTransito || 0;
      acc.PendLiq += r.PendentesLiquidos || 0;
    }
    return by;
  }, [rowsProcessed]);

  // Estoque global por SKU (para saber quanto já existe vs alvo)
  const estoqueGlobalBySku = useMemo(() => {
    const map = new Map();
    for (const r of allRowsEstoque) {
      if (!r.CodigoProduto) continue;
      const sku = String(r.CodigoProduto).trim();
      if (!sku) continue;
      const disponivel =
        (r.EstoqueAtual || 0) +
        (r.EstoqueTransito || 0) -
        (r.PendentesLiquidos || 0);
      map.set(sku, (map.get(sku) || 0) + disponivel);
    }
    return map;
  }, [allRowsEstoque]);
  
      // Estoque global detalhado por SKU (Atual, Trânsito, Pendentes)
  const estoqueComponentesBySku = useMemo(() => {
    const map = new Map();

    for (const r of allRowsEstoque) {
      if (!r.CodigoProduto) continue;
      const sku = String(r.CodigoProduto).trim();
      if (!sku) continue;

      const prev =
        map.get(sku) || {
          EstoqueAtual: 0,
          EstoqueTransito: 0,
          PendentesLiquidos: 0,
        };

      prev.EstoqueAtual += r.EstoqueAtual || 0;
      prev.EstoqueTransito += r.EstoqueTransito || 0;
      prev.PendentesLiquidos += r.PendentesLiquidos || 0;

      map.set(sku, prev);
    }
