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
// ===== IndexedDB helpers for Estoque cache (JS) =====
const ESTOQUE_DB_NAME = "biServiceDB";
const ESTOQUE_DB_VERSION = 1;
const ESTOQUE_STORE_NAME = "estoqueStore";

function openEstoqueDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB não suportado"));
      return;
    }

    const request = window.indexedDB.open(ESTOQUE_DB_NAME, ESTOQUE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ESTOQUE_STORE_NAME)) {
        db.createObjectStore(ESTOQUE_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Erro ao abrir IndexedDB"));
  });
}

function saveEstoqueCache(data) {
  return openEstoqueDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ESTOQUE_STORE_NAME, "readwrite");
      const store = tx.objectStore(ESTOQUE_STORE_NAME);
      const req = store.put(data, "ultimoUpload");

      req.onerror = () => {
        console.error("Erro ao salvar cache IndexedDB (estoqueRows)", req.error);
      };

      tx.oncomplete = () => {
        db.close();
        resolve();
      };

      tx.onerror = () => {
        console.error("Erro na transação IndexedDB (save)", tx.error);
        db.close();
        reject(tx.error || new Error("Erro na transação save"));
      };
    });
  });
}

function loadEstoqueCache() {
  return openEstoqueDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ESTOQUE_STORE_NAME, "readonly");
      const store = tx.objectStore(ESTOQUE_STORE_NAME);
      const req = store.get("ultimoUpload");

      req.onsuccess = () => {
        const result = req.result || null;
        db.close();
        resolve(result);
      };

      req.onerror = () => {
        console.error("Erro ao ler IndexedDB", req.error);
        db.close();
        reject(req.error || new Error("Erro ao ler IndexedDB"));
      };
    });
  });
}


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
const C_GRAY = "rgba(255,255,255,0.18)";
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

function normText(str) {
  return normalize(str);
}

// Extrai o SKU de um texto de sugestão do datalist (ex: "12345 — Produto X" ou "12345 - Produto X")
function parseSkuFromLabel(label) {
  const s = String(label || "").trim();
  if (!s) return "";
  // pega o primeiro "token" (números/letras) no início
  const m = s.match(/^([0-9A-Za-z]+)/);
  if (m && m[1]) return m[1].trim();

  // fallback por separadores
  if (s.includes("—")) return s.split("—")[0].trim();
  if (s.includes("-")) return s.split("-")[0].trim();

  return s.split(/\s+/)[0].trim();
}

function stripSkuPrefix(label, sku) {
  const s = String(label || "").trim();
  const k = String(sku || "").trim();
  if (!s || !k) return s;
  return s.replace(new RegExp("^" + k.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") + "\\s*[—-]\\s*", "i"), "").trim();
}

/**
 * Horizonte (dias) para ajustar SOMENTE a quantidade a comprar (Plano de Compras)
 * Regras:
 * - BEBEDOURO VD: A=50, B=40, C=25, E=20
 * - Demais cidades: A=40, B=30, C=25, E=20
 */
function planDaysByCityCurve(city, classe) {
  const c = String(classe || "").trim().toUpperCase();
  const cityNorm = String(city || "").trim().toUpperCase();
  const isBebedouroVD =
    cityNorm === "BEBEDOURO VD" || cityNorm.includes("BEBEDOURO VD");

  if (isBebedouroVD) {
    if (c === "A") return 50;
    if (c === "B") return 40;
    if (c === "C") return 25;
    if (c === "E") return 20;
    return 25;
  }

  if (c === "A") return 40;
  if (c === "B") return 30;
  if (c === "C") return 25;
  if (c === "E") return 20;
  return 25;
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
      className="rounded-xl p-2 shadow-sm"
      style={{ border: `1px solid ${borderColor}`, background: C_CARD_BG }}
    >
      {hasHeader && (
        <div className="flex items-end justify-between gap-2 mb-2">
          {title && (
            <h2 className="text-base font-semibold">{title}</h2>
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
    size === "sm" ? "text-sm" : size === "md" ? "text-base" : "text-2xl";
  return (
    <div
      className="rounded-xl p-2"
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
          className="w-full rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 text-sm text-white"
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
      </div>
    </div>
  );
}

/* ====== PAGE ====== */
export default function DashboardEstoquePage() {
  const [activeSection, setActiveSection] = useState("resumo");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash ? window.location.hash.replace("#", "") : "";
    const validTabs = ["resumo", "vendas", "minimo", "plano", "promo"];
    if (hash && validTabs.includes(hash)) {
      setActiveSection(hash);
    }
  }, []);

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
  const [skuSearchVendas, setSkuSearchVendas] = useState("");
  const [selectedCycle, setSelectedCycle] = useState("Todos");
  const [showCycleDetail, setShowCycleDetail] = useState(false);

  const [salesCityFilter, setSalesCityFilter] = useState("Todas");

  const [minMethod, setMinMethod] = useState("media17");
  const [covFactor, setCovFactor] = useState("1.0");
  const [minCategoryFilter, setMinCategoryFilter] = useState("Todas");
  const [minCurveFilter, setMinCurveFilter] = useState("Todas");
  const [minCityFilter, setMinCityFilter] = useState("Todas");
  const [minSkuQuery, setMinSkuQuery] = useState("");

  const [planTab, setPlanTab] = useState("transfer");
  const [planCityFilter, setPlanCityFilter] = useState("Todas");
  const [planCurveFilter, setPlanCurveFilter] = useState("Todas");
  const [planCategoryFilter, setPlanCategoryFilter] = useState("Todas");
const [planSkuQuery, setPlanSkuQuery] = useState("");
  const [planDays, setPlanDays] = useState("21"); // horizonte em dias (~1 ciclo)
  const [planDesativMode, setPlanDesativMode] = useState("todos"); // opção 4
  const [buyDesativMode, setBuyDesativMode] = useState("excluir"); // opção 2
  const [applyTransfers, setApplyTransfers] = useState(true);

  // Promoções - filtros / controles do card
  const [promoSkuFilter, setPromoSkuFilter] = useState("");
  const [promoCurveFilter, setPromoCurveFilter] = useState("Todas");
  const [promoHorizonDays, setPromoHorizonDays] = useState("21");
  const [showPromoDetail, setShowPromoDetail] = useState(false);

  // 🔄 Sincroniza filtros entre abas via localStorage (todas as abas)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "biservice-dashboard-filtros-v1";

    const payload = {
      brandFilter,
      cityFilter,
      query,
      minMethod,
      covFactor,
      minCategoryFilter,
      minCurveFilter,
      minCityFilter,
      minSkuQuery,
      planTab,
      planCityFilter,
      planCurveFilter,
      planCategoryFilter,
      planDays,
      planDesativMode,
      buyDesativMode,
      promoSkuFilter,
      promoCurveFilter,
      promoHorizonDays,
    };

    try {
      window.localStorage.setItem(key, JSON.stringify(payload));
    } catch (e) {
      console.warn("Não foi possível salvar filtros no localStorage", e);
    }
  }, [
    brandFilter,
    cityFilter,
    query,
    minMethod,
    covFactor,
    minCategoryFilter,
    minCurveFilter,
    minCityFilter,
    minSkuQuery,
    planTab,
    planCityFilter,
    planCurveFilter,
    planCategoryFilter,
    planDays,
    planDesativMode,
    buyDesativMode,
    promoSkuFilter,
    promoCurveFilter,
    promoHorizonDays,
  ]);

  // 🔄 Carrega e ouve alterações de filtros vindas de outras abas
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "biservice-dashboard-filtros-v1";

    // Ao montar, tenta carregar filtros existentes
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const data = JSON.parse(raw);

        if (data.brandFilter) setBrandFilter(data.brandFilter);
        if (data.cityFilter) setCityFilter(data.cityFilter);
        if (typeof data.query === "string") setQuery(data.query);

        if (data.minMethod) setMinMethod(data.minMethod);
        if (data.covFactor) setCovFactor(data.covFactor);
        if (data.minCategoryFilter) setMinCategoryFilter(data.minCategoryFilter);
        if (data.minCurveFilter) setMinCurveFilter(data.minCurveFilter);
        if (data.minCityFilter) setMinCityFilter(data.minCityFilter);
        if (typeof data.minSkuQuery === "string") setMinSkuQuery(data.minSkuQuery);

        if (data.planTab) setPlanTab(data.planTab);
        if (data.planCityFilter) setPlanCityFilter(data.planCityFilter);
        if (data.planCurveFilter) setPlanCurveFilter(data.planCurveFilter);
        if (data.planCategoryFilter) setPlanCategoryFilter(data.planCategoryFilter);
        if (data.planDays) setPlanDays(String(data.planDays));
        if (data.planDesativMode) setPlanDesativMode(data.planDesativMode);
        if (data.buyDesativMode) setBuyDesativMode(data.buyDesativMode);

        if (typeof data.promoSkuFilter === "string") setPromoSkuFilter(data.promoSkuFilter);
        if (data.promoCurveFilter) setPromoCurveFilter(data.promoCurveFilter);
        if (data.promoHorizonDays)
          setPromoHorizonDays(String(data.promoHorizonDays));
      }
    } catch (e) {
      console.warn("Não foi possível ler filtros do localStorage", e);
    }

    const handler = (event) => {
      if (event.key !== key || !event.newValue) return;
      try {
        const data = JSON.parse(event.newValue);

        if (data.brandFilter) setBrandFilter(data.brandFilter);
        if (data.cityFilter) setCityFilter(data.cityFilter);
        if (typeof data.query === "string") setQuery(data.query);

        if (data.minMethod) setMinMethod(data.minMethod);
        if (data.covFactor) setCovFactor(data.covFactor);
        if (data.minCategoryFilter) setMinCategoryFilter(data.minCategoryFilter);
        if (data.minCurveFilter) setMinCurveFilter(data.minCurveFilter);
        if (data.minCityFilter) setMinCityFilter(data.minCityFilter);
        if (typeof data.minSkuQuery === "string") setMinSkuQuery(data.minSkuQuery);

        if (data.planTab) setPlanTab(data.planTab);
        if (data.planCityFilter) setPlanCityFilter(data.planCityFilter);
        if (data.planCurveFilter) setPlanCurveFilter(data.planCurveFilter);
        if (data.planCategoryFilter) setPlanCategoryFilter(data.planCategoryFilter);
        if (data.planDays) setPlanDays(String(data.planDays));
        if (data.planDesativMode) setPlanDesativMode(data.planDesativMode);
        if (data.buyDesativMode) setBuyDesativMode(data.buyDesativMode);

        if (typeof data.promoSkuFilter === "string") setPromoSkuFilter(data.promoSkuFilter);
        if (data.promoCurveFilter) setPromoCurveFilter(data.promoCurveFilter);
        if (data.promoHorizonDays)
          setPromoHorizonDays(String(data.promoHorizonDays));
      } catch (e) {
        console.warn("Erro ao aplicar filtros sincronizados", e);
      }
    };

    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);


  useEffect(() => {
    (async () => setPdvMap(await fetchPdvCityMapLocal()))();
  }, []);

  // 🔹 Restaura automaticamente o último upload do IndexedDB (padrão tipo Conferência)
  useEffect(() => {
    let cancelled = false;
    if (typeof window === "undefined" || !("indexedDB" in window)) return;

    (async () => {
      try {
        const cached = await loadEstoqueCache();
        if (!cached) return;

        const estoqueAll = cached.estoqueAll || [];
        const vendasAll = cached.vendasAll || [];

        if (!estoqueAll.length && !vendasAll.length) return;
        if (cancelled) return;

        setAllRowsEstoque(estoqueAll);
        setSalesRowsAll(vendasAll);

        setBrandFilter("Todas");
        setCityFilter("Todas");
        setSalesCityFilter("Todas");

        setStatus("Dados restaurados do último upload");
        setProgress(100);
      } catch (err) {
        console.error("Erro ao restaurar cache do dashboard (IndexedDB)", err);
      }
    })();

    return () => {
      cancelled = true;
    };
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
        saveEstoqueCache({ estoqueAll, vendasAll }).catch((err) => {
          console.error("Erro ao salvar cache do dashboard (IndexedDB)", err);
        });
      } catch (err) {
        console.error("Erro ao salvar cache do dashboard (IndexedDB)", err);
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

      // Garante que o range inclua pelo menos até a coluna Z (para pegar Y e Z mesmo se o !ref estiver curto)
      try {
        if (ws["!ref"]) {
          const r = XLSX.utils.decode_range(ws["!ref"]);
          if (r.e.c < 25) { // 0-based: Z = 25
            r.e.c = 25;
            ws["!ref"] = XLSX.utils.encode_range(r);
          }
        }
      } catch (e) {
        // ignora, segue com o !ref original
      }

      // Lê como matriz (AOA) para respeitar posições fixas das colunas
      // Lê como matriz (A1..Z...) preservando posição de colunas (inclui vazios no meio)
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
      if (!aoa.length) continue;

      const headerRow = aoa[0] || [];
      const headers = headerRow.map((h, i) => {
        const s = h == null ? "" : String(h).trim();
        return s ? s : `__COL_${i}`; // placeholder para cabeçalhos vazios
      });

      const raw = [];
      for (let ri = 1; ri < aoa.length; ri++) {
        const row = aoa[ri] || [];
        const obj = {};
        for (let ci = 0; ci < headers.length; ci++) {
          obj[headers[ci]] = row[ci] ?? null;
        }
        raw.push(obj);
      }
      if (!raw.length) continue;

      const headerMap = {};
      Object.keys(raw[0]).forEach((k) => (headerMap[k] = normalize(k)));
      const findCol = (cands) => {
        for (const rawKey in headerMap) {
          if (cands.includes(headerMap[rawKey])) return rawKey;
        }
        return null;
      };

      const toNumLoose = (v) => {
        if (v == null) return 0;
        if (typeof v === "number") return Number.isFinite(v) ? v : 0;
        const s = String(v).trim();
        if (!s) return 0;
        // aceita 1.234,56 e 1234,56
        const norm = s.replace(/\./g, "").replace(",", ".");
        const n = Number(norm);
        return Number.isFinite(n) ? n : 0;
      };

      // Atenção: Y e Z são posições fixas (0-based 24 e 25) na planilha
      const colsInOrder = headers;
      const colY = colsInOrder[24] || null; // Coluna Y
      const colZ = colsInOrder[25] || null; // Coluna Z


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

      // ✅ Força: "Vendas ciclo atual" deve vir da coluna Z (posição fixa)
      // Se por algum motivo a planilha não tiver até Z, cai no detector por nome.
      const vendasCicloAtualCol = colZ; // Coluna Z


      // ✅ Força: "Vendas ciclo ant." deve vir da coluna Y (posição fixa)
      // Se por algum motivo a planilha não tiver até Y, cai no detector por nome.
      const vendasCicloAnteriorCol = colY; // Coluna Y


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

      const compraInteligenteCol =
        findCol([
          "compra inteligente proximo ciclo",
          "compra inteligente prox ciclo",
          "compra inteligente",
        ]) ||
        Object.keys(headerMap).find((k) =>
          headerMap[k].includes("compra inteligente")
        ) ||
        null;

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
          CompraInteligenteProxCiclo: compraInteligenteCol ? toNumLoose(r[compraInteligenteCol]) : 0,
          VendasCicloAnteriorYZ: vendasCicloAnteriorCol ? toNumLoose(r[vendasCicloAnteriorCol]) : 0,
          VendasCicloAtualYZ: vendasCicloAtualCol ? toNumLoose(r[vendasCicloAtualCol]) : 0,
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
    const qRaw = (query || "").toLowerCase();
    const qSku = parseSkuFromLabel(qRaw).toLowerCase();
    const q = qRaw;
    const list = Array.from(bySku.values()).filter(
      (r) =>
        String(r.CodigoProduto || "").toLowerCase().includes(q) ||
        String(r.DescricaoProduto || "").toLowerCase().includes(q) ||
        (qSku ? String(r.CodigoProduto || "").toLowerCase().includes(qSku) : false)
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

  const skuSuggestionsResumo = useMemo(() => {
    const q = normText(query);
    if (!q) return [];
    const seen = new Set();
    const out = [];
    for (const r of rowsAgg || []) {
      const sku = String(r.CodigoProduto ?? "").trim();
      const desc = String(r.DescricaoProduto ?? "").trim();
      if (!sku) continue;
      const label = desc ? `${sku} — ${desc}` : sku;
      if (normText(label).includes(q) && !seen.has(sku)) {
        seen.add(sku);
        out.push(label);
        if (out.length >= 50) break;
      }
    }
    return out;
  }, [query, rowsAgg]);


  const totEst = useMemo(
    () => rowsAgg.reduce((s, r) => s + (r.EstoqueAtual || 0), 0),
    [rowsAgg]
  );
  const totTrans = useMemo(
    () => rowsAgg.reduce((s, r) => s + (r.EstoqueTransito || 0), 0),
    [rowsAgg]
  );
  const totPend = useMemo(
    () => rowsAgg.reduce((s, r) => s + (r.PedidosPendentes || 0), 0),
    [rowsAgg]
  );
  const totPendLiq = useMemo(
    () => rowsAgg.reduce((s, r) => s + (r.PendentesLiquidos || 0), 0),
    [rowsAgg]
  );
  const totEstTotal = useMemo(
    () => totEst + totTrans + totPend,
    [totEst, totTrans, totPend]
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


  const compraInteligenteBySkuCity = useMemo(() => {
    const map = new Map(); // sku -> Map(cidade -> compra inteligente prox ciclo)
    for (const r of allRowsEstoque) {
      if (r.CodigoProduto == null) continue;
      const sku = String(r.CodigoProduto).trim();
      if (!sku) continue;
      const cidade = (r.Cidade || "").trim();
      if (!cidade) continue;

      const raw = r.CompraInteligenteProxCiclo;
      const val = Number(raw ?? 0) || 0;
      if (!map.has(sku)) map.set(sku, new Map());
      const inner = map.get(sku);
      inner.set(cidade, (inner.get(cidade) || 0) + val);
    }
    return map;
  }, [allRowsEstoque]);

  const vendasYZBySkuCity = useMemo(() => {
    const map = new Map(); // sku -> Map(cidade -> { prev, curr })
    for (const r of allRowsEstoque) {
      const sku = String(r.CodigoProduto ?? "").trim();
      if (!sku) continue;
      const cidade = (r.Cidade || "").trim();
      if (!cidade) continue;

      const prev = Number(r.VendasCicloAnteriorYZ ?? 0) || 0;
      const curr = Number(r.VendasCicloAtualYZ ?? 0) || 0;

      if (!map.has(sku)) map.set(sku, new Map());
      const inner = map.get(sku);
      const acc = inner.get(cidade) || { prev: 0, curr: 0 };
      inner.set(cidade, { prev: acc.prev + prev, curr: acc.curr + curr });
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
  const skuOptionsFiltered = useMemo(() => {
    if (!skuOptions || !skuOptions.length) return [];
    const q = (skuSearchVendas || "").trim().toLowerCase();
    if (!q) return skuOptions;
    return skuOptions.filter((opt) => {
      if (typeof opt === "string") {
        return opt.toLowerCase().includes(q);
      }
      const val = String(opt.value || "").toLowerCase();
      const label = String(opt.label || "").toLowerCase();
      return val.includes(q) || label.includes(q);
    });
  }, [skuOptions, skuSearchVendas]);

  const skuSuggestionsVendas = useMemo(() => {
    const q = normText(skuSearchVendas);
    if (!q) return [];
    const seen = new Set();
    const out = [];
    for (const opt of skuOptions || []) {
      let sku = "";
      let desc = "";
      if (typeof opt === "string") {
        // pode vir "SKU — Descrição" ou apenas SKU
        const raw = opt;
        sku = parseSkuFromLabel(raw);
        desc = raw.includes("—") ? raw.split("—").slice(1).join("—").trim() : "";
      } else {
        sku = String(opt.value ?? "").trim();
        desc = stripSkuPrefix(String(opt.label ?? "").trim(), sku);
      }
      if (!sku) continue;
      const label = desc ? `${sku} — ${desc}` : sku;
      if (normText(label).includes(q) && !seen.has(sku)) {
        seen.add(sku);
        out.push(label);
        if (out.length >= 50) break;
      }
    }
    return out;
  }, [skuOptions, skuSearchVendas]);



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

  const rankingMelhorMomento = useMemo(() => {
    const list = [];
    for (const [sku, st] of statsPorSku.entries()) {
      const descricao = skuMeta.get(sku) || "";
      list.push({
        sku,
        descricao,
        pico: st.maxv || 0,
        media: st.mean || 0,
        ciclos: st.n || 0,
      });
    }
    list.sort((a, b) => b.pico - a.pico);
    return list.slice(0, 20);
  }, [statsPorSku, skuMeta]);

  
const statsPorSkuCidade = useMemo(() => {
    const map = new Map();
    for (const r of salesRows) {
      const sku = r.CodigoProduto;
      const cidade = (r.Cidade || "").trim();
      if (!sku || !cidade) continue;
      if (!map.has(sku)) map.set(sku, new Map());
      const byCity = map.get(sku);
      if (!byCity.has(cidade)) byCity.set(cidade, []);
      byCity.get(cidade).push(Number(r.QtdVendida || 0));
    }

    const out = new Map();
    for (const [sku, byCity] of map.entries()) {
      const inner = new Map();
      for (const [cidade, arrRaw] of byCity.entries()) {
        const arr = (arrRaw || []).map((v) => Number(v || 0));
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
        inner.set(cidade, { n, mean, maxv, p85, sigma });
      }
      out.set(sku, inner);
    }
    return out;
  }, [salesRows]);

  const sugestaoMinimoPorCidade = useMemo(() => {
    const list = [];
    const BASE_CYCLE_DAYS = 365 / 17;

    for (const [sku, byCity] of statsPorSkuCidade.entries()) {
      let desc = skuMeta.get(sku) || "";
      if (!desc || desc.trim() === "") desc = `SKU ${sku}`;

      for (const [cidade, st] of byCity.entries()) {
        let base = 0;
        switch (minMethod) {
          case "max17":
            base = st.maxv;
            break;
          case "p85":
            base = st.p85;
            break;
          case "media+1sigma":
            base = st.mean + st.sigma;
            break;
          case "conservador":
            base = st.p85;
            break;
          case "agressivo":
            base = st.mean;
            break;
          case "neutro":
          case "media17":
          default:
            base = st.mean;
        }

        const classe = skuClasse.get(sku) || "";
        const days = planDaysByCityCurve(cidade, classe);
        const horizonFactor = days > 0 ? days / BASE_CYCLE_DAYS : 1;

        const sugerido = Math.max(
          0,
          Math.ceil((base || 0) * horizonFactor * (Number(covFactor) || 1))
        );

        list.push({
          SKU: sku,
          Descricao: desc,
          Cidade: cidade,
          Classe: classe,
          Categoria: skuCategoria.get(sku) || "",
          CiclosUsados: st.n,
          MediaCiclos: Number((st.mean || 0).toFixed(2)),
          PicoCiclos: st.maxv || 0,
          EstoqueMinimoSugerido: sugerido,
        });
      }
    }

    list.sort((a, b) => {
      if ((b.EstoqueMinimoSugerido || 0) !== (a.EstoqueMinimoSugerido || 0)) {
        return (b.EstoqueMinimoSugerido || 0) - (a.EstoqueMinimoSugerido || 0);
      }
      if ((a.SKU || "") !== (b.SKU || "")) {
        return String(a.SKU || "").localeCompare(String(b.SKU || ""));
      }
      return String(a.Cidade || "").localeCompare(String(b.Cidade || ""));
    });

    return list;
  }, [statsPorSkuCidade, minMethod, covFactor, skuMeta, skuClasse, skuCategoria]);

  const targetsBySkuCity = useMemo(() => {
    const map = new Map();
    for (const r of sugestaoMinimoPorCidade) {
      const sku = String(r.SKU || "").trim();
      const cidade = String(r.Cidade || "").trim();
      if (!sku || !cidade) continue;
      if (!map.has(sku)) map.set(sku, new Map());
      map.get(sku).set(cidade, Math.max(0, Number(r.EstoqueMinimoSugerido || 0)));
    }
    return map;
  }, [sugestaoMinimoPorCidade]);

  const sugestaoMinimo = useMemo(() => {
    const bySku = new Map();

    for (const r of sugestaoMinimoPorCidade) {
      const sku = r.SKU;
      if (!bySku.has(sku)) {
        bySku.set(sku, {
          SKU: sku,
          Descricao: r.Descricao,
          CiclosUsados: r.CiclosUsados || 0,
          EstoqueMinimoSugerido: 0,
        });
      }
      const acc = bySku.get(sku);
      acc.EstoqueMinimoSugerido += Number(r.EstoqueMinimoSugerido || 0);
      acc.CiclosUsados = Math.max(acc.CiclosUsados || 0, r.CiclosUsados || 0);
      if (!acc.Descricao && r.Descricao) acc.Descricao = r.Descricao;
    }

    const list = Array.from(bySku.values());
    list.sort(
      (a, b) => b.EstoqueMinimoSugerido - a.EstoqueMinimoSugerido
    );
    return list;
  }, [sugestaoMinimoPorCidade]);

  const minChartData = useMemo(
    () =>
      sugestaoMinimoPorCidade.slice(0, 20).map((r) => ({
        SKU: r.SKU,
        Cidade: r.Cidade,
        Label: `${r.SKU} — ${r.Descricao} — ${r.Cidade}`,
        Min: r.EstoqueMinimoSugerido,
      })),
    [sugestaoMinimoPorCidade]
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


  const vendasCicloCidade = useMemo(() => {
    // Mapa: SKU -> cidade -> { prev, curr }
    const map = new Map();
    if (!salesRows || !salesRows.length) return map;

    // descobre ciclo atual e anterior com base nos dados de vendas
    const ciclos = Array.from(
      new Set(salesRows.map((r) => r.Ciclo))
    ).sort((a, b) => cicloKey(a) - cicloKey(b));
    if (!ciclos.length) return map;

    const cicloAtual = ciclos[ciclos.length - 1];
    const cicloAnterior =
      ciclos.length > 1 ? ciclos[ciclos.length - 2] : null;

    for (const r of salesRows) {
      if (r.Ciclo !== cicloAtual && r.Ciclo !== cicloAnterior) continue;

      const sku = r.CodigoProduto;
      const cidade = (r.Cidade || "").trim();
      if (!sku || !cidade) continue;

      if (!map.has(sku)) map.set(sku, new Map());
      const inner = map.get(sku);
      if (!inner.has(cidade)) {
        inner.set(cidade, { prev: 0, curr: 0 });
      }
      const bucket = inner.get(cidade);
      if (r.Ciclo === cicloAtual) {
        bucket.curr += r.QtdVendida || 0;
      } else if (r.Ciclo === cicloAnterior) {
        bucket.prev += r.QtdVendida || 0;
      }
    }

    return map;
  }, [salesRows]);


  const bestMomentBySkuCity = useMemo(() => {
    const map = new Map();
    if (!salesRows || !salesRows.length) return map;

    for (const r of salesRows) {
      const sku = r.CodigoProduto;
      const cidade = (r.Cidade || "").trim();
      const ciclo = r.Ciclo;
      const qtd = r.QtdVendida || 0;

      if (!sku || !cidade || !ciclo || !qtd) continue;

      if (!map.has(sku)) {
        map.set(sku, new Map());
      }
      const inner = map.get(sku);
      if (!inner.has(cidade)) {
        inner.set(cidade, { bestCycle: ciclo, bestQty: qtd });
      } else {
        const curr = inner.get(cidade);
        if (
          qtd > curr.bestQty ||
          (qtd === curr.bestQty &&
            cicloKey(ciclo) > cicloKey(curr.bestCycle))
        ) {
          inner.set(cidade, { bestCycle: ciclo, bestQty: qtd });
        }
      }
    }

    return map;
  }, [salesRows]);

  
  const minCategoryOptions = useMemo(() => {
    const set = new Set();
    for (const r of sugestaoMinimo) {
      const cat = (skuCategoria.get(r.SKU) || r.Categoria || "").trim();
      if (cat) set.add(cat);
    }
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [sugestaoMinimo, skuCategoria]);

  
const minCityOptions = useMemo(() => cityOptions, [cityOptions]);

const sugestaoMinimoView = useMemo(() => {
    return sugestaoMinimoPorCidade.filter((r) => {
      if (minCategoryFilter !== "Todas") {
        const cat = r.Categoria || skuCategoria.get(r.SKU) || "";
        if (cat !== minCategoryFilter) return false;
      }

      if (minCurveFilter !== "Todas") {
        const cls = r.Classe || skuClasse.get(r.SKU) || "";
        if (cls !== minCurveFilter) return false;
      }

      if (minCityFilter !== "Todas") {
        if ((r.Cidade || "") !== minCityFilter) return false;
      }

      if (minSkuQuery.trim()) {
        const q = normText(minSkuQuery);
        const skuStr = normText(r.SKU || r.CodigoProduto || "");
        const descStr = normText(r.Descricao || r.DescricaoProduto || "");
        const cityStr = normText(r.Cidade || "");
        if (!skuStr.includes(q) && !descStr.includes(q) && !cityStr.includes(q)) return false;
      }

      return true;
    });
  }, [
    sugestaoMinimoPorCidade,
    minCategoryFilter,
    minCurveFilter,
    minCityFilter,
    minSkuQuery,
    skuCategoria,
    skuClasse,
  ]);

  const minSkuSuggestions = useMemo(() => {
    const q = normText(minSkuQuery);
    if (!q) return [];
    const seen = new Set();
    const out = [];
    for (const r of sugestaoMinimoView || []) {
      const sku = String(r.SKU ?? r.CodigoProduto ?? "").trim();
      const desc = String(r.Descricao ?? r.DescricaoProduto ?? "").trim();
      const cidade = String(r.Cidade ?? "").trim();
      if (!sku) continue;
      const label = cidade ? `${sku} — ${desc} — ${cidade}` : (desc ? `${sku} — ${desc}` : sku);
      if (normText(label).includes(q) && !seen.has(label)) {
        seen.add(label);
        out.push(label);
        if (out.length >= 50) break;
      }
    }
    return out;
  }, [minSkuQuery, sugestaoMinimoView]);

  const minChartDataView = useMemo(
    () =>
      sugestaoMinimoView.slice(0, 20).map((r) => ({
        SKU: r.SKU,
        Cidade: r.Cidade,
        Label: `${r.SKU} — ${r.Descricao} — ${r.Cidade}`,
        Min: r.EstoqueMinimoSugerido,
      })),
    [sugestaoMinimoView]
  );

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
    return map;
  }, [allRowsEstoque]);

  // Metadados de promoção (descobre ciclo atual/prox a partir das promoções)
  const promoMeta = useMemo(() => {
    let nextPromoCycle = null; // ex: 202516
    const perSku = new Map(); // sku -> { cicloPromo, descontoPercent }

    for (const r of allRowsEstoque) {
      if (!r.CodigoProduto) continue;
      const sku = String(r.CodigoProduto).trim();
      if (!sku) continue;

      const ciclo = r.PromoCiclo;
      const desconto = r.PromoDescontoPercent;
      if (!ciclo) continue;

      perSku.set(sku, {
        cicloPromo: ciclo,
        descontoPercent: desconto,
      });

      if (nextPromoCycle == null || ciclo < nextPromoCycle) {
        nextPromoCycle = ciclo;
      }
    }

    let currentCycle = null;
    let nextCycleShort = null;

    if (nextPromoCycle != null) {
      const n = Number(nextPromoCycle);
      if (!Number.isNaN(n)) {
        nextCycleShort = n % 100; // 16
        currentCycle = nextCycleShort - 1; // 15
      }
    }

    return { perSku, nextPromoCycle, currentCycle, nextCycleShort };
  }, [allRowsEstoque]);

  const promoSuggestions = useMemo(() => {
    const out = [];
    if (!promoMeta.nextPromoCycle) return out;

    for (const rec of sugestaoMinimo) {
      const sku = rec.SKU;
      const meta = promoMeta.perSku.get(sku);
      if (!meta) continue;

      const baseMin = rec.EstoqueMinimoSugerido || 0;
      if (baseMin <= 0) continue;

      const desconto = meta.descontoPercent || 0;
      const classe = skuClasse.get(sku) || "";

      // boost por curva
      let fatorClasse = 1;
      const clsUpper = classe.toUpperCase();
      if (clsUpper.startsWith("A")) fatorClasse = 1.5;
      else if (clsUpper.startsWith("B")) fatorClasse = 1.2;
      else if (clsUpper.startsWith("C")) fatorClasse = 1.0;
      else fatorClasse = 0.8;

      // boost por desconto
      const fatorPromo = 1 + desconto / 100;

      const alvo = Math.max(
        baseMin,
        Math.round(baseMin * fatorPromo * fatorClasse)
      );

      // componentes de estoque global
      const comp =
        estoqueComponentesBySku.get(sku) || {
          EstoqueAtual: 0,
          EstoqueTransito: 0,
          PendentesLiquidos: 0,
        };

      const disponivel =
        (comp.EstoqueAtual || 0) +
        (comp.EstoqueTransito || 0) -
        (comp.PendentesLiquidos || 0);

      const qtdComprar = Math.max(0, alvo - disponivel);
      if (qtdComprar <= 0) continue;

      // preço médio SKU (sell in)
      let precoBase = 0;
      const priceMap = skuPrecoCidade.get(sku);
      if (priceMap && priceMap.size) {
        for (const v of priceMap.values()) {
          if (v > 0) {
            precoBase = v;
            break;
          }
        }
        if (precoBase === 0) {
          precoBase = Array.from(priceMap.values())[0] || 0;
        }
      }

      const precoPromo = precoBase * (1 - desconto / 100);
      const valorTotal = qtdComprar * precoPromo;

      out.push({
        SKU: sku,
        Descricao: rec.Descricao,
        Classe: classe,
        Desconto: desconto,
        EstoqueMinBase: baseMin,
        EstoqueAlvoPromo: alvo,

        // novos campos para exportação
        EstoqueAtualGlobal: comp.EstoqueAtual || 0,
        EstoqueTransitoGlobal: comp.EstoqueTransito || 0,
        PendentesLiquidosGlobal: comp.PendentesLiquidos || 0,

        EstoqueDisponivel: disponivel,
        QtdSugerida: qtdComprar,
        PrecoUnitPromo: precoPromo,
        ValorTotal: valorTotal,
      });
    }

    out.sort((a, b) => (b.ValorTotal || 0) - (a.ValorTotal || 0));
    return out;
  }, [
    sugestaoMinimo,
    promoMeta,
    estoqueComponentesBySku,
    skuClasse,
    skuPrecoCidade,
  ]);


  // Totais base (sem filtros de visualização)
  const promoTotals = useMemo(() => {
    let totalQtd = 0;
    let totalValor = 0;
    for (const r of promoSuggestions) {
      totalQtd += r.QtdSugerida || 0;
      totalValor += r.ValorTotal || 0;
    }
    return {
      totalQtd,
      totalValor,
      totalSkus: promoSuggestions.length,
    };
  }, [promoSuggestions]);

  // Opções de SKU para o filtro do card de promoção
  const promoSkuOptions = useMemo(() => {
    if (!promoSuggestions || !promoSuggestions.length) {
      return [{ value: "Todos", label: "Todos" }];
    }

    const skus = Array.from(
      new Set(promoSuggestions.map((r) => r.SKU))
    ).sort((a, b) => a.localeCompare(b));

    return [
      { value: "Todos", label: "Todos" },
      ...skus.map((sku) => ({
        value: sku,
        label: `${sugestaoMinimo.find((x) => x.SKU === sku)?.Descricao || ""}`,
      })),
    ];
  }, [promoSuggestions, sugestaoMinimo]);

  const promoSkuSuggestions = useMemo(() => {
    const q = normText(promoSkuFilter);
    if (!q) return [];
    const seen = new Set();
    const out = [];
    for (const opt of promoSkuOptions || []) {
      let sku = "";
      let desc = "";
      if (typeof opt === "string") {
        sku = parseSkuFromLabel(opt);
        desc = opt.includes("—") ? opt.split("—").slice(1).join("—").trim() : "";
      } else {
        sku = String(opt.value ?? "").trim();
        desc = String(opt.label ?? "").trim();
      }
      if (!sku) continue;
      const label = desc ? `${sku} — ${desc}` : sku;
      if (normText(label).includes(q) && !seen.has(sku)) {
        seen.add(sku);
        out.push(label);
        if (out.length >= 50) break;
      }
    }
    return out;
  }, [promoSkuFilter, promoSkuOptions]);


  // Opções de curva para o card de promoção
  const promoCurveOptions = useMemo(() => {
    if (!promoSuggestions || !promoSuggestions.length) {
      return ["Todas"];
    }
    const set = new Set();
    for (const r of promoSuggestions) {
      const cls = (r.Classe || "").trim();
      if (cls) set.add(cls);
    }
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [promoSuggestions]);

  // Aplicar filtro por curva, SKU e horizonte (dias) na visualização de promo
  const promoSuggestionsView = useMemo(() => {
    if (!promoSuggestions || !promoSuggestions.length) return [];

    // Horizonte: considerar sugestão base como ~1 ciclo (21 dias)
    const BASE_CYCLE_DAYS = 365 / 17;

    // Horizonte (dias) para ajustar SOMENTE a quantidade a comprar (Plano de Compras)
    // Regras:
    // - BEBEDOURO VD: A=50, B=40, C=25, E=20
    // - Demais cidades: A=40, B=30, C=25, E=20
    const planDaysByCityCurve = (city, classe) => {
      const c = String(classe || "").trim().toUpperCase();
      const cityNorm = String(city || "").trim().toUpperCase();
      const isBebedouroVD =
        cityNorm === "BEBEDOURO VD" || cityNorm.includes("BEBEDOURO VD");

      if (isBebedouroVD) {
        if (c === "A") return 50;
        if (c === "B") return 40;
        if (c === "C") return 25;
        if (c === "E") return 20;
        return 25;
      }

      if (c === "A") return 40;
      if (c === "B") return 30;
      if (c === "C") return 25;
      if (c === "E") return 20;
      return 25;
    };

    const horizonDaysNum =
      Number(promoHorizonDays) > 0
        ? Number(promoHorizonDays)
        : BASE_CYCLE_DAYS;
    const horizonFactor = horizonDaysNum / BASE_CYCLE_DAYS;

    let list = promoSuggestions;

    // filtro por curva
    if (promoCurveFilter !== "Todas") {
      list = list.filter((r) => (r.Classe || "") === promoCurveFilter);
    }
    // filtro por SKU/Descrição (texto ou seleção)
    if (promoSkuFilter && String(promoSkuFilter).trim() && true) {
      const raw = String(promoSkuFilter || "").trim();
      const q = normText(raw);
      const qSku = normText(typeof parseSkuFromLabel === "function" ? parseSkuFromLabel(raw) : raw);

      list = list.filter((r) => {
        const sku = normText(r.SKU || "");
        const desc = normText(r.Descricao || r.DescricaoProduto || "");

        // 1) busca por texto livre (código ou descrição)
        if (q && (sku.includes(q) || desc.includes(q))) return true;

        // 2) quando o usuário escolhe uma opção do datalist (ex: "12345 — Shampoo X"),
        // o input fica com o texto completo; então filtramos pelo SKU extraído também.
        if (qSku && sku.includes(qSku)) return true;

        return false;
      });
    }

    // aplica ajuste de horizonte (multiplica qtd e valor)
    return list.map((r) => {
      const fator = horizonFactor || 1;
      return {
        ...r,
        QtdSugerida: Math.round((r.QtdSugerida || 0) * fator),
        ValorTotal: (r.ValorTotal || 0) * fator,
      };
    });
  }, [
    promoSuggestions,
    promoCurveFilter,
    promoSkuFilter,
    promoHorizonDays,
  ]);

  const promoTotalsView = useMemo(() => {
    let totalQtd = 0;
    let totalValor = 0;
    for (const r of promoSuggestionsView) {
      totalQtd += r.QtdSugerida || 0;
      totalValor += r.ValorTotal || 0;
    }
    return {
      totalQtd,
      totalValor,
      totalSkus: promoSuggestionsView.length,
    };
  }, [promoSuggestionsView]);

  const promoChartData = useMemo(() => {
    return promoSuggestionsView.slice(0, 20).map((r) => ({
      SKU: r.SKU,
      Label: `${r.SKU} — ${r.Descricao}`,
      QtdSugerida: r.QtdSugerida,
      ValorTotal: r.ValorTotal,
    }));
  }, [promoSuggestionsView]);

  const promoResumoKpis = useMemo(() => {
    if (!promoSuggestionsView.length) {
      return {
        valorTop1: 0,
        totalTop5Qtd: 0,
        totalTop5Valor: 0,
      };
    }

    const sorted = [...promoSuggestionsView].sort(
      (a, b) => (b.ValorTotal || 0) - (a.ValorTotal || 0)
    );

    const top1 = sorted[0];
    const top5 = sorted.slice(0, 5);

    const totalTop5Qtd = top5.reduce(
      (sum, r) => sum + (r.QtdSugerida || 0),
      0
    );
    const totalTop5Valor = top5.reduce(
      (sum, r) => sum + (r.ValorTotal || 0),
      0
    );

    return {
      valorTop1: top1?.ValorTotal || 0,
      totalTop5Qtd,
      totalTop5Valor,
    };
  }, [promoSuggestionsView]);

  const { transfers, buys, totalsPlan } = useMemo(() => {
    const transfers = [];
    const buys = [];

    let totalTransfer = 0; // qtd transferida (itens)
    let totalBuy = 0; // qtd comprada (itens)
    let totalBuyValor = 0; // investimento com transferências (R$)

    let baseBuyQty = 0; // qtd que seria comprada sem transferência
    let baseBuyValor = 0; // investimento sem transferências (R$)

    let moves = 0;

    // cada EstoqueMinimoSugerido foi calculado para ~1 ciclo
    const BASE_CYCLE_DAYS = 365 / 17;
    const horizonDaysNum =
      Number(planDays) > 0 ? Number(planDays) : BASE_CYCLE_DAYS;
    const horizonFactor = horizonDaysNum / BASE_CYCLE_DAYS;

    for (const rec of sugestaoMinimo) {
      const sku = rec.SKU;
      const desc = rec.Descricao;

      const cicloDes = skuDesativacao.get(sku) ?? null;

      if (planDesativMode === "somente_ativos") {
        if (cicloDes != null && cicloDes <= CURRENT_CYCLE) continue;
      } else if (planDesativMode === "ate_ciclo_atual") {
        if (cicloDes == null || cicloDes > CURRENT_CYCLE) continue;
      } else if (planDesativMode === "ate_prox_ciclo") {
        if (cicloDes == null || cicloDes > CURRENT_CYCLE + 1) continue;
      }

      const classe = skuClasse.get(sku) || "";
      if (planCurveFilter !== "Todas" && classe !== planCurveFilter) {
        continue;
      }

      const categoria = skuCategoria.get(sku) || "";
      if (
        planCategoryFilter !== "Todas" &&
        categoria !== planCategoryFilter
      ) {
        continue;
      }

      const citiesMap = estoqueBySkuCity.get(sku);
      if (!citiesMap || !citiesMap.size) continue;

      const detailTargets = targetsBySkuCity.get(sku) || new Map();
      const cityTargets = new Map();

      for (const city of citiesMap.keys()) {
        const baseTarget = Math.max(0, Number(detailTargets.get(city) || 0));
        cityTargets.set(
          city,
          Math.max(0, Math.round(baseTarget * horizonFactor))
        );
      }

      const globalMin = Array.from(cityTargets.values()).reduce(
        (s, v) => s + (v || 0),
        0
      );

      const totalEstoqueAtualSku = Array.from(citiesMap.values()).reduce(
        (s, acc) => s + Math.max(0, acc?.EstoqueAtual || 0),
        0
      );

      const sources = [];
      const sinks = [];

      for (const [city, acc] of citiesMap.entries()) {
        const estoqueAtual = Math.max(0, acc.EstoqueAtual || 0);
        const estoqueTransito = Math.max(0, acc.EstoqueTransito || 0);
        const pendLiq = Math.max(0, acc.PendLiq || 0);
        const target = cityTargets.get(city) || 0;

        const availableFuture = Math.max(
          0,
          estoqueAtual + estoqueTransito - pendLiq
        );

        const needed = Math.max(0, target - availableFuture);

        const transferable =
          estoqueAtual > target && totalEstoqueAtualSku > globalMin
            ? Math.max(0, estoqueAtual - target)
            : 0;

        if (needed > 0) {
          const priceMap = skuPrecoCidade.get(sku);
          const valorUnitBase = priceMap?.get(city) || 0;
          const valorTotalBase = valorUnitBase * needed;

          baseBuyQty += needed;
          baseBuyValor += valorTotalBase;

          sinks.push({ city, qty: needed });
        } else if (transferable > 0) {
          sources.push({ city, qty: transferable });
        }
      }

      let i = 0;
      let j = 0;
      if (applyTransfers && totalEstoqueAtualSku > globalMin) {
        while (i < sources.length && j < sinks.length) {
          const give = Math.min(sources[i].qty, sinks[j].qty);
          if (give > 0) {
            transfers.push({
              SKU: sku,
              Descricao: desc,
              Origem: sources[i].city,
              Destino: sinks[j].city,
              Qtd: give,
            });
            totalTransfer += give;
            moves += 1;
          }
          sources[i].qty -= give;
          sinks[j].qty -= give;
          if (sources[i].qty === 0) i++;
          if (sinks[j].qty === 0) j++;
        }
      }

// O que ainda falta depois das transferências -> compra
            for (; j < sinks.length; j++) {
        const city = sinks[j].city;

        const vendasInfo =
          vendasYZBySkuCity.get(sku)?.get(city) || { prev: 0, curr: 0 };
        const vendasCicloAnterior = vendasInfo.prev || 0;
        const vendasCicloAtual = vendasInfo.curr || 0;

        const days = planDaysByCityCurve(city, classe);
        const estoqueAtualCidade = citiesMap.get(city)?.EstoqueAtual || 0;

        // ✅ Recalcula SOMENTE a Qtd a comprar usando consumo diário * horizonte - estoque atual (cidade).
        // Não altera vendas/melhor momento/compra inteligente.
        const vendasMediaCiclo = (vendasCicloAnterior + vendasCicloAtual) / 2;
        const consumoDia = vendasMediaCiclo / BASE_CYCLE_DAYS;
        const alvo = consumoDia * days;
        const q = Math.max(0, Math.ceil(alvo - estoqueAtualCidade));

        if (q > 0) {
          const priceMap = skuPrecoCidade.get(sku);
          const valorUnit = priceMap?.get(city) || 0;
          const valorTotal = valorUnit * q;

          const isDesativadoParaCompra =
            cicloDes != null && cicloDes <= CURRENT_CYCLE;

          // OPÇÃO 2 – se SKU desativado entra ou não no plano de compras
          if (isDesativadoParaCompra && buyDesativMode === "excluir") {
            // não cria linha de compra, só deixa registrado no cenário base
            continue;
          }

          const vendasInfo =
            vendasYZBySkuCity.get(sku)?.get(city) || { prev: 0, curr: 0 };
          const vendasCicloAnterior = vendasInfo.prev || 0;
          const vendasCicloAtual = vendasInfo.curr || 0;

          const bestInfo = bestMomentBySkuCity.get(sku)?.get(city);
          const melhorMomento = bestInfo?.bestCycle || "";

          const compraInteligente =
            compraInteligenteBySkuCity.get(sku)?.get(city) || 0;

          buys.push({
            SKU: sku,
            Descricao: desc,
            Cidade: city,
            HorizonteDias: planDaysByCityCurve(city, classe),
            EstoqueAtualCidade: estoqueAtualCidade,
            EstoqueAtualTotal: Array.from(citiesMap.values()).reduce((s, a) => s + (a?.EstoqueAtual || 0), 0),
            VendasCicloAnterior: vendasCicloAnterior,
            VendasCicloAtual: vendasCicloAtual,
            MelhorMomento: melhorMomento,
            CompraInteligenteProxCiclo: compraInteligente,
            Qtd: q,
            ValorUnit: valorUnit,
            ValorTotal: valorTotal,
          });

          totalBuy += q;
          totalBuyValor += valorTotal;
        }
      }
    }

    const economiaValor = baseBuyValor - totalBuyValor;
    const economiaQty = baseBuyQty - totalBuy;

    return {
      transfers,
      buys,
      totalsPlan: {
        totalTransfer,
        totalBuy,
        totalBuyValor,
        baseBuyQty,
        baseBuyValor,
        economiaQty,
        economiaValor,
        moves,
      },
    };
  }, [
    sugestaoMinimo,
    estoqueBySkuCity,
    targetsBySkuCity,
    skuClasse,
    skuCategoria,
    skuPrecoCidade,
    skuDesativacao,
    planCurveFilter,
    planCategoryFilter,
    planDays,
    planDesativMode,
    buyDesativMode,
    applyTransfers,
  ]);

  const planCityOptions = useMemo(() => {
    const set = new Set();
    for (const inner of Array.from(estoqueBySkuCity.values())) {
      for (const city of inner.keys()) {
        if (city) set.add(city);
      }
    }
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [estoqueBySkuCity]);

  const planCurveOptions = useMemo(() => {
    const set = new Set();
    for (const rec of sugestaoMinimo) {
      const cls = skuClasse.get(rec.SKU);
      if (cls) set.add(cls);
    }
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [sugestaoMinimo, skuClasse]);

  const planCategoryOptions = useMemo(() => {
    const set = new Set();
    for (const rec of sugestaoMinimo) {
      const cat = skuCategoria.get(rec.SKU);
      if (cat) set.add(cat);
    }
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [sugestaoMinimo, skuCategoria]);


  const planSkuSuggestions = useMemo(() => {
    const q = normText(planSkuQuery);
    if (!q) return [];
    const seen = new Set();
    const out = [];
    const skus = new Set();
    for (const t of transfers || []) skus.add(String(t.SKU || "").trim());
    for (const b of buys || []) skus.add(String(b.SKU || "").trim());

    for (const sku of Array.from(skus)) {
      if (!sku) continue;
      const desc =
        (sugestaoMinimo?.find((x) => String(x.SKU || "").trim() === sku)?.Descricao ||
          "");
      const label = desc ? `${sku} — ${desc}` : sku;
      if (normText(label).includes(q) && !seen.has(label)) {
        seen.add(label);
        out.push(label);
        if (out.length >= 25) break;
      }
    }
    return out;
  }, [planSkuQuery, transfers, buys, sugestaoMinimo]);

  const transfersView = useMemo(() => {
    let list = transfers || [];
    if (planCityFilter !== "Todas") {
      list = list.filter(
        (t) => t.Origem === planCityFilter || t.Destino === planCityFilter
      );
    }

    if (planSkuQuery && String(planSkuQuery).trim()) {
      const raw = String(planSkuQuery || "").trim();
      const q = normText(raw);
      const qSku = normText(parseSkuFromLabel(raw) || raw);
      list = list.filter((t) => {
        const sku = normText(t.SKU || "");
        const desc = normText(t.Descricao || "");
        return (
          (q && (sku.includes(q) || desc.includes(q))) ||
          (qSku && sku.includes(qSku))
        );
      });
    }

    return list;
  }, [transfers, planCityFilter, planSkuQuery]);

  const buysView = useMemo(() => {
    let list = buys || [];
    if (planCityFilter !== "Todas") {
      list = list.filter((b) => b.Cidade === planCityFilter);
    }

    if (planSkuQuery && String(planSkuQuery).trim()) {
      const raw = String(planSkuQuery || "").trim();
      const q = normText(raw);
      const qSku = normText(parseSkuFromLabel(raw) || raw);
      list = list.filter((b) => {
        const sku = normText(b.SKU || "");
        const desc = normText(b.Descricao || "");
        return (
          (q && (sku.includes(q) || desc.includes(q))) ||
          (qSku && sku.includes(qSku))
        );
      });
    }

    return list;
  }, [buys, planCityFilter, planSkuQuery]);

  const transfersByDestino = useMemo(() => {
    const map = new Map();
    for (const t of transfersView) {
      const k = t.Destino || "(sem cidade)";
      map.set(k, (map.get(k) || 0) + (t.Qtd || 0));
    }
    return Array.from(map.entries())
      .map(([Cidade, Qtd]) => ({ Cidade, Qtd }))
      .sort((a, b) => b.Qtd - a.Qtd);
  }, [transfersView]);

  const transfersTopSku = useMemo(() => {
    const map = new Map();
    for (const t of transfersView) {
      const k = `${t.SKU} — ${t.Descricao || ""}`.trim();
      map.set(k, (map.get(k) || 0) + (t.Qtd || 0));
    }
    return Array.from(map.entries())
      .map(([SKU, Qtd]) => ({ SKU, Qtd }))
      .sort((a, b) => b.Qtd - a.Qtd)
      .slice(0, 10);
  }, [transfersView]);

  const buysByCidade = useMemo(() => {
    const map = new Map();
    for (const b of buysView) {
      const k = b.Cidade || "(sem cidade)";
      const prev = map.get(k) || { Qtd: 0, Valor: 0 };
      prev.Qtd += b.Qtd || 0;
      prev.Valor += b.ValorTotal || 0;
      map.set(k, prev);
    }
    return Array.from(map.entries())
      .map(([Cidade, v]) => ({
        Cidade,
        Qtd: v.Qtd,
        Valor: v.Valor,
      }))
      .sort((a, b) => b.Valor - a.Valor);
  }, [buysView]);

  const invPorMarca = useMemo(() => {
    const map = new Map();
    for (const b of buysView) {
      const marca = skuMarca.get(b.SKU) || "SEM MARCA";
      map.set(marca, (map.get(marca) || 0) + (b.ValorTotal || 0));
    }
    return Array.from(map.entries())
      .map(([Marca, Valor]) => ({ Marca, Valor }))
      .sort((a, b) => b.Valor - a.Valor);
  }, [buysView, skuMarca]);

  const buysTopSku = useMemo(() => {
    const map = new Map();

    for (const b of buysView) {
      const sku = b.SKU || "";
      if (!sku) continue;

      const key = sku;
      const atual = map.get(key) || {
        SKU: b.SKU,
        Descricao: b.Descricao || "",
        Qtd: 0,
        ValorTotal: 0,
      };

      atual.Qtd += b.Qtd || 0;
      atual.ValorTotal += b.ValorTotal || 0;

      map.set(key, atual);
    }

    return Array.from(map.values())
      .sort((a, b) => (b.ValorTotal || 0) - (a.ValorTotal || 0))
      .slice(0, 10);
  }, [buysView]);

  function exportXlsx() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        {
          MarcaFiltro: brandFilter,
          CidadeFiltro: cityFilter,
          EstoqueAtual: totEst,
          EstoqueEmTransito: totTrans,
          PedidosPendentes: totPend,
          EstoqueTotal: totEstTotal,
        },
      ]),
      "ResumoTotais"
    );
    const detalheSheet = rowsAgg.map((r) => ({
      CodigoProduto: r.CodigoProduto,
      DescricaoProduto: r.DescricaoProduto,
      Cidade: r.Cidade || "",
      EstoqueAtual: r.EstoqueAtual,
      EstoqueEmTransito: r.EstoqueTransito,
      PedidosPendentes: r.PedidosPendentes,
      EstoqueTotal:
        (r.EstoqueAtual || 0) +
        (r.EstoqueTransito || 0) +
        (r.PedidosPendentes || 0),
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(detalheSheet),
      "DetalhePorSKU"
    );

    if (cyclesForSku.length) {
      const vendasSheet = cyclesForSku.map((r) => ({
        Ciclo: r.Ciclo,
        QtdVendida: r.QtdVendida,
      }));
      vendasSheet.push({
        Ciclo: "Média (janela)",
        QtdVendida: Number(media17.toFixed(2)),
      });
      vendasSheet.push({
        Ciclo: `Máximo (${maxInfo.ciclo})`,
        QtdVendida: maxInfo.qtd,
      });
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(vendasSheet),
        "Vendas_ciclos"
      );
    }
    XLSX.writeFile(wb, "dashboard_estoque.xlsx");
  }

function exportPlanXlsx() {
  const wb = XLSX.utils.book_new();

  // Transferências com Classe e Categoria
  const transfersExport = transfersView.map((r) => ({
    ...r,
    Classe: skuClasse.get(r.SKU) || "",
    Categoria: skuCategoria.get(r.SKU) || "",
  }));

  // Compras com Classe, Categoria e componentes de estoque
  const buysExport = buysView.map((r) => {
    const comp =
      estoqueComponentesBySku.get(r.SKU) || {
        EstoqueAtual: 0,
        EstoqueTransito: 0,
        PendentesLiquidos: 0,
      };

    const disponivel =
      (comp.EstoqueAtual || 0) +
      (comp.EstoqueTransito || 0) -
      (comp.PendentesLiquidos || 0);

    return {
      ...r,
      Classe: skuClasse.get(r.SKU) || "",
      Categoria: skuCategoria.get(r.SKU) || "",
      EstoqueAtualGlobal: comp.EstoqueAtual || 0,
      EstoqueTransitoGlobal: comp.EstoqueTransito || 0,
      PendentesLiquidosGlobal: comp.PendentesLiquidos || 0,
      EstoqueDisponivelGlobal: disponivel,
    };
  });

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(transfersExport),
    "Transferencias"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(buysExport),
    "Compras"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        TotalTransferir: totalsPlan.totalTransfer,
        Movimentos: totalsPlan.moves,
        TotalComprarItens: totalsPlan.totalBuy,
        InvestimentoComTransferencias: totalsPlan.totalBuyValor,
        InvestimentoSemTransferencias: totalsPlan.baseBuyValor,
        EconomiaValor: totalsPlan.economiaValor,
      },
      {
        ModoDistribuicao:
          "vendas (fallback igualitário se sem vendas por cidade)",
        CidadeFiltroPlano: planCityFilter,
        MarcaFiltro: brandFilter,
        ClasseFiltroPlano: planCurveFilter,
        CategoriaFiltroPlano: planCategoryFilter,
        HorizonteDias: Number(planDays) || 0,
        DesativacaoFiltroPlano: planDesativMode,
        ComprasDesativados: buyDesativMode,
      },
    ]),
    "Resumo"
  );

  XLSX.writeFile(wb, "plano_transferencia_compra.xlsx");
}


function exportMinimoXlsx() {
  if (!sugestaoMinimoView.length) return;

  const wb = XLSX.utils.book_new();

  // Detalhe por SKU com informações de filtros
  const detalheSheet = sugestaoMinimoView.map((r) => {
    const cls = skuClasse.get(r.SKU) || "";
    const cat = skuCategoria.get(r.SKU) || "";
    const share = salesShareCity.get(r.SKU);
    const cidades =
      share && share.size
        ? Array.from(share.keys()).join(", ")
        : "";

    return {
      SKU: r.SKU,
      Descricao: r.Descricao,
      Classe: cls,
      Categoria: cat,
      CidadesComVenda: cidades,
      CiclosUsados: r.CiclosUsados,
      EstoqueMinimoSugerido: r.EstoqueMinimoSugerido,
    };
  });

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(detalheSheet),
    "EstoqueMinimo"
  );

  // Resumo de filtros aplicados
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        Metodo: minMethod,
        FatorCobertura: covFactor,
        FiltroCategoria: minCategoryFilter,
        FiltroCurva: minCurveFilter,
        FiltroCidade: minCityFilter,
        FiltroSkuTexto: minSkuQuery,
      },
    ]),
    "ResumoFiltros"
  );

  XLSX.writeFile(wb, "estoque_minimo_sugestao.xlsx");
}


  function exportPromoXlsx() {
    if (!promoSuggestionsView.length) return;

    const wb = XLSX.utils.book_new();

    // Detalhe por SKU (incluindo componentes de estoque)
    const promoExport = promoSuggestionsView.map((r) => ({
      SKU: r.SKU,
      Descricao: r.Descricao,
      Classe: r.Classe,
      Categoria: skuCategoria.get(r.SKU) || "",
      DescontoPercent: r.Desconto,
      EstoqueMinBase: r.EstoqueMinBase,
      EstoqueAlvoPromo: r.EstoqueAlvoPromo,

      EstoqueAtualGlobal: r.EstoqueAtualGlobal || 0,
      EstoqueTransitoGlobal: r.EstoqueTransitoGlobal || 0,
      PendentesLiquidosGlobal: r.PendentesLiquidosGlobal || 0,
      EstoqueDisponivel: r.EstoqueDisponivel || 0,

      QtdSugerida: r.QtdSugerida,
      PrecoUnitPromo: r.PrecoUnitPromo,
      ValorTotal: r.ValorTotal,
    }));

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(promoExport),
      "Sugestao_Promocao"
    );

    // Resumo + filtros atuais do card
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        {
          HorizonteDias: Number(promoHorizonDays) || 0,
          SkuFiltro: promoSkuFilter,
          TotalSkus: promoTotalsView.totalSkus,
          TotalQtd: promoTotalsView.totalQtd,
          TotalValor: promoTotalsView.totalValor,
          NextPromoCycle: promoMeta.nextPromoCycle || null,
        },
      ]),
      "Resumo"
    );

    XLSX.writeFile(wb, "sugestao_compra_promocao.xlsx");
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-[#0c1118] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0c1118]/80 backdrop-blur px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-end justify-between gap-2">
          <div className="flex items-end gap-2">
            <div className="h-9 w-9 rounded-xl overflow-hidden ring-1 ring-sky-500/40 bg-sky-500/10 grid place-items-end">
              <Image
                src="/logo/logo.png"
                alt="BI Service"
                width={80}
                height={80}
                priority
              />
            </div>
            <div className="leading-tight">
              <div className="text-sm text-white/70">BI Service Beta</div>
              <h1 className="text-base font-bold">
                <span>Dashboard</span>{" "}
                <span style={{ color: C_GREEN }}>de Estoque</span>
              </h1>
            </div>
          </div>

          <div className="flex items-end gap-2 no-print">
            <div className="inline-flex items-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (fileRef.current) {
                    fileRef.current.value = null; // permite reenviar o mesmo arquivo
                    fileRef.current.click();
                  }
                }}
                className="inline-flex items-end gap-2 rounded-lg px-3 py-2 text-sm font-medium shadow"
                style={{ background: C_GREEN }}
              >
                Upload
              </button>

              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={onUpload}
                className="hidden"
              />
            </div>

            <a
              href="/dashboard"
              className="rounded-lg px-3 py-2 text-sm font-medium shadow"
              style={{ background: C_PURPLE }}
            >
              Conferência
            </a>
            <a
              href="/dashboard-orcamento"
              className="rounded-lg px-3 py-2 text-sm font-medium shadow"
              style={{ background: C_BLUE }}
            >
              Orçamento
            </a>
            <a
              href="/"
              className="rounded-lg px-3 py-2 text-sm font-medium shadow inline-flex items-end gap-2"
              style={{ background: C_ROSE }}
            >
              Sair
            </a>
          </div>
        </div>

        {isLoading && (
          <div className="mt-3 h-1 w-full bg-white/10 rounded">
            <div
              className="h-1 rounded"
              style={{
                width: `${progress}%`,
                background: C_BLUE,
                transition: "width .2s",
              }}
            />
          </div>
        )}
      </header>
      
      <nav className="mt-4 max-w-7xl mx-auto flex flex-wrap gap-2 text-xs sm:text-sm">
        {[
          {
            id: "resumo",
            label: "Resumo Total",
          },
          {
            id: "vendas",
            label: "Análise de Vendas",
          },
          {
            id: "minimo",
            label: "Sugestão Estoque Mínimo",
          },
          {
            id: "plano",
            label: "Plano de Transferências & Compras",
          },
          {
            id: "promo",
            label: "Sugestão Promoção",
          },
        ].map((tab) => {
          const isActive = activeSection === tab.id;
          const href = `#${tab.id}`;
          return (
            <a
              key={tab.id}
              href={href}
              onClick={(e) => {
                e.preventDefault();
                setActiveSection(tab.id);
                if (typeof window !== "undefined") {
                  window.history.replaceState(null, "", href);
                }
              }}
              className={`px-3 py-1.5 rounded-full border text-[11px] sm:text-xs transition-colors ${
                isActive
                  ? "bg-sky-500/30 border-sky-400 text-sky-50"
                  : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
              }`}
            >
              {tab.label}
            </a>
          );
        })}
      </nav>


      {isLoading && (
        <div className="fixed inset-0 z-10 bg-black/60 backdrop-blur-sm grid place-items-end no-print">
          <div
            className="w-full max-w-md rounded-xl p-2"
            style={{ background: "#0f172a", border: `1px solid ${C_CARD_BORDER}` }}
          >
            <div className="flex items-end gap-2 mb-2">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                className="animate-spin"
              >
                <path
                  fill="currentColor"
                  d="M12 1a11 11 0 1 0 11 11A11.013 11.013 0 0 0 12 1Zm0 19a8 8 0 1 1 8-8a8.009 8.009 0 0 1-8 8Z"
                />
                <path
                  fill="currentColor"
                  d="M12 4a8 8 0 0 1 8 8h3A11 11 0 0 0 12 1Z"
                />
              </svg>
              <h2 className="text-base font-semibold">Processando arquivo</h2>
            </div>
            <p className="text-sm text-white/80 mb-2">
              {status || "Aguarde…"}
            </p>
            <div className="h-2 w-full bg-white/10 rounded">
              <div
                className="h-2 rounded"
                style={{
                  width: `${progress}%`,
                  background: C_GREEN,
                  transition: "width .2s",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {activeSection === "resumo" && (
        <>
      {/* RESUMO TOTAL COMPLETO DENTRO DO CARD AZUL */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4 no-print">
        <Card
          title="Resumo Total"
          borderColor="rgba(59,130,246,.35)"
        >
          {/* Toolbar: filtros + botões na mesma linha */}
          <div className="flex flex-col md:flex-row md:items-end gap-2">
            {/* Filtros */}
            <div className="flex-1">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <SelectDark
                  label="Aba/Marca"
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  options={brandOptions}
                />
                <SelectDark
                  label="Cidade"
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  options={cityOptions}
                />
<SelectDark
                  label="Ciclo"
                  value={selectedCycle}
                  onChange={(e) => setSelectedCycle(e.target.value)}
                  options={cycleOptions}
                />
                <div className="flex flex-col">
                  <p className="text-xs mb-1 opacity-80">
                    Buscar por SKU/Descrição
                  </p>

                  <input list="sku-sug-resumo"
                    className="w-full h-10 rounded-lg border border-white/20 px-3 text-sm"
                    style={{ backgroundColor: "#0f172a", color: "#ffffff" }}
                    placeholder="buscar…"
                    value={query}
                    onChange={(e) => {
                      const v = e.target.value;
                      const sku = parseSkuFromLabel(v);
                      if (v && (v.includes("—") || v.includes("-")) && sku) setQuery(sku);
                      else setQuery(v);
                    }}
                  />
                  <datalist id="sku-sug-resumo">
                    {skuSuggestionsResumo.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                {promoSuggestionsView.length === 0 && (
                  <div className="mt-3 text-sm text-white/70">
                    Nenhum resultado para o filtro informado. Ajuste o texto de busca, a curva, ou limpe os filtros.
                  </div>
                )}

                </div>
              </div>
            </div>

            {/* Botões */}
            <div className="flex flex-wrap md:flex-nowrap gap-2 md:justify-end mt-2 md:mt-5">
              <button
                onClick={() => {
                  setBrandFilter("Todas");
                  setCityFilter("Todas");
                  setQuery("");
                  setSkuSel("Todos");
                  setSelectedCycle("Todos");
                  setSalesCityFilter("Todas");
                  setPlanCityFilter("Todas");
                  setPlanCurveFilter("Todas");
                  setPlanCategoryFilter("Todas");
                  setPlanDesativMode("todos");
                  setBuyDesativMode("excluir");
                }}
                className="h-10 rounded-lg px-4 text-sm font-medium"
                style={{ background: "rgba(148,163,184,.5)" }}
                type="button"
              >
                Limpar filtros
              </button>
              <button
                onClick={() => setShowDetail((v) => !v)}
                className="h-10 rounded-lg px-4 text-sm font-medium"
                style={{ background: C_PURPLE }}
                type="button"
              >
                {showDetail ? "Ocultar detalhe" : "Ver detalhe"}
              </button>
              <button
                onClick={exportXlsx}
                className="h-10 rounded-lg px-4 text-sm font-medium shadow"
                style={{ background: C_BLUE }}
                type="button"
              >
                Exportar XLSX
              </button>
            </div>
          </div>

          {/* Erro */}
          {error ? (
            <p className="text-sm mt-2" style={{ color: "#f87171" }}>
              {error}
            </p>
          ) : null}

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-6">
            <Kpi title="Estoque Atual" value={totEst} color={C_BLUE} />
            <Kpi title="Em Trânsito" value={totTrans} color={C_GREEN} />
            <Kpi
              title="Pendentes Líquidos"
              value={totPendLiq}
              color={C_AMBER}
            />
          </div>

          {/* Pizza */}
          <div className="mt-6">
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Estoque Atual", value: totEst },
                      { name: "Em Trânsito", value: totTrans },
                      { name: "Pendentes Líquidos", value: totPendLiq },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius="80%"
                    label
                  >
                    {PIE_COLORS.map((c, i) => (
                      <Cell key={i} fill={c} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detalhe por SKU */}
          {showDetail && (
            <div className="mt-6">
              <div
                className="overflow-auto rounded-lg details-scroll"
                style={{ border: `1px solid ${C_CARD_BORDER}` }}
              >
                <table className="w-full text-sm details-table">
                  <thead className="bg-white/5">
                    <tr>
                      {[
                        "Código do Produto",
                        "Descrição do Produto",
                        "Cidade",
                        "Estoque Atual",
                        "Em Trânsito",
                        "Pedidos Pendentes",
                        "Estoque Total",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left px-3 py-2 font-medium"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rowsAgg.map((r) => (
                      <tr
                        key={r.CodigoProduto + "-" + (r.Cidade || "")}
                        className="border-t"
                        style={{ borderColor: C_CARD_BORDER }}
                      >
                        <td className="px-3 py-2 whitespace-nowrap">
                          {r.CodigoProduto}
                        </td>
                        <td className="px-3 py-2">
                          {r.DescricaoProduto}
                        </td>
                        <td className="px-3 py-2">
                          {r.Cidade || ""}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.EstoqueAtual}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.EstoqueTransito}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.PedidosPendentes}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {(r.EstoqueAtual || 0) +
                            (r.EstoqueTransito || 0) +
                            (r.PedidosPendentes || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      </div>


        </>
      )}
      {(activeSection === "vendas") && (
        <>
      {/* VENDAS 17 CICLOS */}
      <div className="max-w-7xl mx-auto px-6 mt-10 space-y-4">
        <Card
          title="Análise de Vendas (últimos 17 ciclos)"
          borderColor="rgba(59,130,246,.35)"
          >

          {/* Toolbar: filtros + botões (mesmo estilo do Resumo Total) */}
                    <div className="flex items-end gap-2 overflow-x-auto pb-1 mb-2 no-print details-scroll">
                      {/* Loja (Cidade vendas) */}
                      <div className="min-w-[220px]">
                        <SelectDark
                          label="Loja (Cidade vendas)"
                          value={salesCityFilter}
                          onChange={(e) => setSalesCityFilter(e.target.value)}
                          options={SALES_CITY_OPTIONS}
                        />
                      </div>

                      {/* Ciclo (para detalhe) */}
                      <div className="min-w-[220px]">
                        <SelectDark
                          label="Ciclo (para detalhe)"
                          value={selectedCycle}
                          onChange={(e) => setSelectedCycle(e.target.value)}
                          options={cycleOptions}
                        />
                      </div>

                      {/* Buscar por SKU/Descrição */}
                      <div className="min-w-[340px] flex flex-col gap-1">
                        <label className="text-xs text-white/70">Buscar por SKU/Descrição</label>
                        <input list="sku-sug-vendas"
                          className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
                          placeholder="buscar..."
                          value={skuSearchVendas}
                          onChange={(e) => {
                      const v = e.target.value;
                      const sku = parseSkuFromLabel(v);
                      const next = v && (v.includes("—") || v.includes("-")) && sku ? sku : v;
                      setSkuSearchVendas(next);

                      // Importante: a aba de vendas filtra usando skuSel (não o texto do input).
                      // Então, quando houver um SKU válido (exato), sincronizamos skuSel.
                      const candidate = String(parseSkuFromLabel(next) || next).trim();
                      if (candidate && skuList && skuList.includes(candidate)) {
                        setSkuSel(candidate);
                      } else if (!candidate) {
                        setSkuSel("Todos");
                      }
                    }}
                        />
                        <datalist id="sku-sug-vendas">
                          {skuSuggestionsVendas.map((s) => (
                            <option key={s} value={s} />
                          ))}
                        </datalist>
                      </div>

                      {/* Botões */}
                      <div className="flex gap-2 shrink-0 self-end">
                        <button
                          onClick={() => {
                            setSkuSearchVendas("");
                            setSelectedCycle("Todos");
                            setSalesCityFilter("Todas");
                            setShowCycleDetail(false);
                          }}
                          className="h-10 rounded-lg px-4 text-xs sm:text-sm font-medium shadow"
                          style={{ background: "rgba(148,163,184,.5)" }}
                          type="button"
                        >
                          Limpar filtros
                        </button>

                        <button
                          onClick={() => setShowCycleDetail((v) => !v)}
                          className="h-10 rounded-lg px-4 text-xs sm:text-sm font-medium shadow"
                          style={{ background: "rgba(139,92,246,.9)" }}
                          type="button"
                        >
                          Ver detalhe
                        </button>

                        <button
                          onClick={exportXlsx}
                          className="h-10 rounded-lg px-4 text-xs sm:text-sm font-medium shadow"
                          style={{ background: C_BLUE }}
                          type="button"
                        >
                          Exportar XLSX
                        </button>
                      </div>
                    </div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
            <Kpi
              title="Média (janela)"
              value={Number(media17 || 0).toLocaleString("pt-BR", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}
              color={C_BLUE}
              raw
            />
            <Kpi
              title="Ciclo com maior venda"
              value={maxInfo.ciclo || "-"}
              color={C_GREEN}
              raw
            />
            <Kpi
              title="Qtd máxima nesse ciclo"
              value={maxInfo.qtd || 0}
              color={C_AMBER}
            />
          </div>

          {showCycleDetail && (
            <Card
              title="Resumo do Filtro"
              borderColor="rgba(124,58,237,.35)"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Kpi
                  title="Média por ciclo (filtro)"
                  value={resumoFiltro.mediaTexto}
                  color={C_BLUE}
                  raw
                />
                <Kpi
                  title="Máximo no filtro (Qtd)"
                  value={resumoFiltro.maxQtdTexto}
                  color={C_AMBER}
                  raw
                />
                <Kpi
                  title="Onde ocorreu o máximo"
                  value={resumoFiltro.maxLabel}
                  color={C_GREEN}
                  raw
                  size="sm"
                />
              </div>
            </Card>
          )}

         <div style={{ width: "100%", height: 360, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart
                data={cyclesForSku}
                margin={{ left: 12, right: 12, top: 10, bottom: 10 }}
                onClick={(state) => {
                  if (state && state.activeLabel)
                    setSelectedCycle(state.activeLabel);
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="Ciclo" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="QtdVendida"
                  name="Qtd Vendida"
                  fill={C_BLUE}
                />
                <ReferenceLine
                  y={media17 || 0}
                  stroke={C_AMBER}
                  strokeDasharray="4 4"
                  label={{
                    value: "Média",
                    fill: "#fff",
                    position: "top",
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {rankingMelhorMomento && rankingMelhorMomento.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-white/80 mb-2">
                Ranking de SKUs por pico de vendas (últimos 17 ciclos)
              </h3>
              <div className="overflow-auto max-h-72 rounded-xl border border-white/10 bg-black/20 details-scroll">
                <table className="w-full text-xs details-table">
                  <thead>
                    <tr className="text-left border-b border-white/10">
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2">Descrição</th>
                      <th className="px-3 py-2 text-right">Pico (unid.)</th>
                      <th className="px-3 py-2 text-right">Média 17 ciclos</th>
                      <th className="px-3 py-2 text-right">Qtd ciclos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingMelhorMomento.map((r, idx) => (
                      <tr
                        key={r.sku}
                        className="border-t border-white/5 hover:bg-white/5 transition"
                      >
                        <td className="px-3 py-2">{idx + 1}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {r.sku}
                        </td>
                        <td className="px-3 py-2">
                          {r.descricao}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.pico.toLocaleString("pt-BR")}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.media.toLocaleString("pt-BR", {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.ciclos}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      </div>


        </>
      )}
      {(activeSection === "minimo") && (
        <>
      {/* MÍNIMO */}
      <div className="max-w-7xl mx-auto px-6 mt-10 space-y-4">
        <Card
          title="Sugestão de Estoque Mínimo (17 ciclos)"
          borderColor="rgba(34,197,94,.35)"
        >

          {/* Toolbar (sem prop right, mais seguro) */}
          <div className="no-print">
              {/* 1 linha: Buscar SKU - Curva - Categoria - Cidade - Limpar Filtro - Ver detalhe - Exportar XLSX */}
              <div className="flex items-end gap-2 flex-nowrap overflow-x-auto details-scroll">
                <div className="flex flex-col w-[200px] shrink-0">
                  <p className="text-xs mb-1 opacity-80">Buscar SKU</p>
                  <input list="sku-sug-minimo"
                    type="text"
                    value={minSkuQuery}
                    onChange={(e) => {
                      const v = e.target.value;
                      const sku = parseSkuFromLabel(v);
                      if (v && (v.includes("—") || v.includes("-")) && sku) setMinSkuQuery(sku);
                      else setMinSkuQuery(v);
                    }}
                    placeholder="buscar..."
                    className="h-10 w-full rounded-lg px-3 text-sm bg-slate-950/40 border border-slate-700/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                  <datalist id="sku-sug-minimo">
                    {minSkuSuggestions.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>

                <div className="w-[140px] shrink-0">
                  <SelectDark
                    label="Curva"
                    value={minCurveFilter}
                    onChange={(v) => setMinCurveFilter(v)}
                    options={planCurveOptions}
                  />
                </div>

                <div className="w-[220px] shrink-0">
                  <SelectDark
                    label="Categoria"
                    value={minCategoryFilter}
                    onChange={(v) => setMinCategoryFilter(v)}
                    options={minCategoryOptions}
                  />
                </div>

                <div className="w-[180px] shrink-0">
                  <SelectDark
                    label="Cidade"
                    value={minCityFilter}
                    onChange={(v) => setMinCityFilter(v)}
                    options={minCityOptions}
                  />
                </div>

                <div className="flex gap-2 shrink-0 ">
                  <button
                    type="button"
                    onClick={() => {
                      setMinSkuQuery("");
                      setMinCurveFilter("Todas");
                      setMinCategoryFilter("Todas");
                      setMinCityFilter("Todas");
                    }}
                    className="h-10 rounded-lg px-4 text-xs sm:text-sm font-medium shadow"
                    style={{ background: "rgba(148,163,184,.5)" }}
                  >
                    Limpar filtro
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowMinDetail((v) => !v)}
                    className="h-10 rounded-lg px-4 text-xs sm:text-sm font-medium shadow"
                    style={{ background: C_PURPLE }}
                  >
                    Ver detalhe
                  </button>

                  <button
                    type="button"
                    onClick={() => exportToXlsx(sugestaoMinimoView, "sugestao_estoque_minimo")}
                    className="h-10 rounded-lg px-4 text-xs sm:text-sm font-medium shadow"
                    style={{ background: C_BLUE }}
                  >
                    Exportar XLSX
                  </button>
                </div>
              </div>

              {/* Cenário rápido */}
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <span className="text-xs opacity-80 mr-1">Cenário rápido</span>
                <button
                  type="button"
                  onClick={() => setMinMethod("conservador")}
                  className="h-8 rounded-full px-3 text-xs font-medium"
                  style={{
                    background: minMethod === "conservador" ? "rgba(34,197,94,.25)" : "rgba(148,163,184,.15)",
                    border: "1px solid rgba(148,163,184,.25)",
                  }}
                >
                  Conservador
                </button>
                <button
                  type="button"
                  onClick={() => setMinMethod("neutro")}
                  className="h-8 rounded-full px-3 text-xs font-medium"
                  style={{
                    background: minMethod === "neutro" ? "rgba(34,197,94,.25)" : "rgba(148,163,184,.15)",
                    border: "1px solid rgba(148,163,184,.25)",
                  }}
                >
                  Neutro
                </button>
                <button
                  type="button"
                  onClick={() => setMinMethod("agressivo")}
                  className="h-8 rounded-full px-3 text-xs font-medium"
                  style={{
                    background: minMethod === "agressivo" ? "rgba(34,197,94,.25)" : "rgba(148,163,184,.15)",
                    border: "1px solid rgba(148,163,184,.25)",
                  }}
                >
                  Agressivo
                </button>
              </div>
            </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
            <Kpi
              title="Top 1 mínimo por loja"
              value={sugestaoMinimoView[0]?.EstoqueMinimoSugerido || 0}
              color={C_GREEN}
            />
            <Kpi
              title="Top 5 lojas (soma)"
              value={sugestaoMinimoView
                .slice(0, 5)
                .reduce(
                  (s, r) => s + (r.EstoqueMinimoSugerido || 0),
                  0
                )}
              color={C_BLUE}
            />
            <Kpi
              title="Qtd linhas loja com mínimo > 0"
              value={
                sugestaoMinimoView.filter(
                  (r) => (r.EstoqueMinimoSugerido || 0) > 0
                ).length
              }
              color={C_AMBER}
            />
          </div>

          <div style={{ width: "100%", height: 360, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart
                data={minChartDataView}
                margin={{ left: 12, right: 12, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="SKU" hide />
                <YAxis />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const item = payload[0].payload; // { SKU, Label, Min }

                    return (
                      <div
                        className="rounded-lg px-3 py-2 text-xs shadow"
                        style={{
                          background: "#ffffff",
                          color: C_GREEN,
                          border: `1px solid ${C_GREEN}`,
                        }}
                      >
                        {/* SKU + Descrição */}
                        <div className="font-semibold mb-1">{item.Label}</div>

                        <div>
                          Estoque mínimo sugerido:{" "}
                          <span className="font-bold">{item.Min}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend />
                <Bar
                  dataKey="Min"
                  name="Estoque mínimo sugerido"
                  fill={C_GREEN}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {showMinDetail && (
            <div
              className="mt-6 overflow-auto rounded-lg details-scroll"
              style={{ border: `1px solid ${C_CARD_BORDER}` }}
            >
              <table className="w-full text-sm details-table">
                <thead className="bg-white/5">
                  <tr>
                    {[
                      "SKU",
                      "Descrição",
                      "Cidade",
                      "Ciclos usados",
                      "Mínimo sugerido",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-3 py-2 font-medium"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sugestaoMinimoView.map((r) => (
                    <tr
                      key={`${r.SKU}-${r.Cidade}`}
                      className="border-t"
                      style={{ borderColor: C_CARD_BORDER }}
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.SKU}
                      </td>
                      <td className="px-3 py-2">
                        {r.Descricao}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.Cidade}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.CiclosUsados}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.EstoqueMinimoSugerido}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>


        </>
      )}
      {(activeSection === "plano") && (
        <>
      {/* PLANO TRANSFERÊNCIAS & COMPRAS */}
      <div className="max-w-7xl mx-auto px-6 mt-10 mb-10 space-y-4">
        <Card borderColor="rgba(239,68,68,.35)">
          {/* Cabeçalho - Plano de Transferências & Compras */}
          <div className="no-print mb-2">
            <h2 className="text-sm font-semibold mb-2 text-left">
              Plano de Transferências &amp; Compras
            </h2>

            {/* Filtros (1 linha) */}
            <div className="flex flex-nowrap items-end justify-start gap-2 overflow-x-auto pb-1 details-scroll">
              <SelectDark
                label="Cidade (filtro plano)"
                value={planCityFilter}
                onChange={(e) => setPlanCityFilter(e.target.value)}
                options={planCityOptions}
              />

              <SelectDark
                label="Curva SKU"
                value={planCurveFilter}
                onChange={(e) => setPlanCurveFilter(e.target.value)}
                options={planCurveOptions}
              />

              <SelectDark
                label="Categoria"
                value={planCategoryFilter}
                onChange={(e) => setPlanCategoryFilter(e.target.value)}
                options={planCategoryOptions}
              />

              <SelectDark
                label="Compras p/ desativados"
                value={buyDesativMode}
                onChange={(e) => setBuyDesativMode(e.target.value)}
                options={[
                  { value: "excluir", label: "Não comprar" },
                  { value: "incluir", label: "Incluir nas compras" },
                ]}
                className="w-40"
              />
              <div className="min-w-[280px] flex flex-col gap-1">
                <label className="text-xs text-white/70">Buscar por SKU/Descrição</label>
                <input
                  list="sku-sug-plano"
                  className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
                  placeholder="buscar..."
                  value={planSkuQuery}
                  onChange={(e) => {
                    const v = e.target.value;
                    const sku = parseSkuFromLabel(v);
                    const next =
                      v && (v.includes("—") || v.includes("-")) && sku ? sku : v;
                    setPlanSkuQuery(next);
                  }}
                />
                <datalist id="sku-sug-plano">
                  {planSkuSuggestions.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>



              <button
                onClick={() => setPlanTab("transfer")}
                className={`rounded-lg px-3 py-2 text-xs sm:text-sm font-medium shadow ${
                  planTab === "transfer" ? "bg-emerald-500" : "bg-white/10"
                }`}
              >
                Transferências
              </button>

              <button
                onClick={() => setPlanTab("compras")}
                className={`rounded-lg px-3 py-2 text-xs sm:text-sm font-medium shadow ${
                  planTab === "compras" ? "bg-white/20" : "bg-white/10"
                }`}
              >
                Compras
              </button>
            </div>

            {/* Botões (abaixo dos filtros) */}
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={() => {
                  setPlanCityFilter("Todas");
                  setPlanCurveFilter("Todas");
                  setPlanCategoryFilter("Todas");
                  setPlanDays("21");
                  setPlanDesativMode("todos");
                  setBuyDesativMode("excluir");
                }}
                className="rounded-lg px-3 py-2 text-xs sm:text-sm font-medium shadow"
                style={{ background: "rgba(148,163,184,.5)" }}
              >
                Limpar filtros
              </button>

              <button
                type="button"
                onClick={() => setShowPlanDetail((v) => !v)}
                className="rounded-lg px-3 py-2 text-xs sm:text-sm font-medium shadow"
                style={{ background: C_PURPLE }}
              >
                {showPlanDetail ? "Ocultar detalhe" : "Ver detalhe"}
              </button>

              <button
                type="button"
                onClick={exportPlanXlsx}
                className="rounded-lg px-3 py-2 text-xs sm:text-sm font-medium shadow"
                style={{ background: C_BLUE }}
              >
                Exportar XLSX
              </button>

              <button
                type="button"
                onClick={() => setApplyTransfers((v) => !v)}
                className="rounded-lg px-3 py-2 text-xs sm:text-sm font-medium shadow border border-white/30"
                style={{
                  background: applyTransfers
                    ? "rgba(34,197,94,.4)"
                    : "rgba(148,163,184,.4)",
                }}
              >
                Aplicar transferência
              </button>
            </div>
          </div>
{/* KPIs do plano (já respeitando filtro de cidade) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
            <Kpi
              title="Total a transferir (itens)"
              value={transfersView.reduce((s, t) => s + (t.Qtd || 0), 0)}
              color={C_GREEN}
            />
            <Kpi
              title="Movimentos de transferência"
              value={transfersView.length}
              color={C_BLUE}
            />
            <Kpi
              title="Total a comprar (itens)"
              value={buysView.reduce((s, b) => s + (b.Qtd || 0), 0)}
              color={C_ROSE}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
            <Kpi
              title="Investimento com transferências (R$)"
              value={buysView
                .reduce((s, b) => s + (b.ValorTotal || 0), 0)
                .toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              color={C_ROSE}
              raw
            />
            <Kpi
              title="Investimento sem transferências (R$)"
              value={totalsPlan.baseBuyValor.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
              color={C_AMBER}
              raw
            />
            <Kpi
              title="Economia obtida (R$)"
              value={(
                totalsPlan.baseBuyValor -
                buysView.reduce((s, b) => s + (b.ValorTotal || 0), 0)
              ).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
              color={C_GREEN}
              raw
            />
          </div>

          {planTab === "transfer" ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-2">
                <Card
                  title="Transferências por Cidade de Destino"
                  borderColor="rgba(34,197,94,.35)"
                >
                  <div style={{ width: "100%", height: 300 }}>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={transfersByDestino}
                        margin={{
                          left: 12,
                          right: 12,
                          top: 10,
                          bottom: 10,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="Cidade" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="Qtd"
                          name="Qtd a transferir"
                          fill={C_GREEN}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card
                  title="Top 10 SKUs para Transferir"
                  borderColor="rgba(34,197,94,.35)"
                >
                  <div style={{ width: "100%", height: 300 }}>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={transfersTopSku}
                        margin={{
                          left: 12,
                          right: 12,
                          top: 10,
                          bottom: 10,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="SKU" hide />
                        <YAxis />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length)
                              return null;
                            const item = payload[0].payload;

                            return (
                              <div
                                className="rounded-lg px-3 py-2 text-xs shadow"
                                style={{
                                  background: "#ffffff",
                                  color: C_BLUE,
                                  border: `1px solid ${C_BLUE}`,
                                }}
                              >
                                <div className="font-semibold mb-1">
                                  {item.SKU}
                                </div>
                                <div>
                                  Qtd a transferir:{" "}
                                  <span className="font-bold">
                                    {item.Qtd}
                                  </span>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Legend />
                        <Bar
                          dataKey="Qtd"
                          name="Qtd a transferir"
                          fill={C_BLUE}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              {showPlanDetail && (
                <div
                  className="mt-6 overflow-auto rounded-lg details-scroll"
                  style={{ border: `1px solid ${C_CARD_BORDER}` }}
                >
                  <table className="w-full text-sm details-table">
                    <thead className="bg-white/5">
                      <tr>
                        {[
                          "SKU",
                          "Descrição",
                          "Classe",
                          "Categoria",
                          "Desativação",
                          "Origem",
                          "Destino",
                          "Qtd a transferir",
                        ].map((h) => (
                          <th
                            key={h}
                            className="text-left px-3 py-2 font-medium"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {transfersView.length ? (
                        transfersView.map((r, idx) => {
                          const cicloDes = skuDesativacao.get(r.SKU);
                          return (
                            <tr
                              key={idx}
                              className="border-t"
                              style={{ borderColor: C_CARD_BORDER }}
                            >
                              <td className="px-3 py-2 whitespace-nowrap">
                                {r.SKU}
                              </td>
                              <td className="px-3 py-2">
                                {r.Descricao}
                              </td>
                              <td className="px-3 py-2">
                                {skuClasse.get(r.SKU) || ""}
                              </td>
<td className="px-3 py-2">
                                {skuCategoria.get(r.SKU) || ""}
                              </td>
                              <td className="px-3 py-2">
                                {cicloDes ? (
                                  <span
                                    className={
                                      cicloDes <= CURRENT_CYCLE
                                        ? "text-red-400 font-semibold"
                                        : cicloDes === CURRENT_CYCLE + 1
                                        ? "text-amber-300 font-semibold"
                                        : "text-white"
                                    }
                                  >
                                    {`C${cicloDes}${
                                      cicloDes <= CURRENT_CYCLE
                                        ? " (desativado)"
                                        : cicloDes === CURRENT_CYCLE + 1
                                        ? " (próx. ciclo)"
                                        : ""
                                    }`}
                                  </span>
                                ) : (
                                  ""
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {r.Origem}
                              </td>
                              <td className="px-3 py-2">
                                {r.Destino}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {r.Qtd}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr
                          className="border-t"
                          style={{ borderColor: C_CARD_BORDER }}
                        >
                          <td className="px-3 py-4" colSpan={8}>
                            Nenhuma transferência necessária.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-2">
                <Card
                  title="Compras por Cidade (R$)"
                  borderColor="rgba(239,68,68,.35)"
                >
                  <div style={{ width: "100%", height: 300 }}>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={buysByCidade}
                        margin={{
                          left: 12,
                          right: 12,
                          top: 10,
                          bottom: 10,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="Cidade" />
                        <YAxis />
                        <Tooltip
                          formatter={(value) => [
                            value.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }),
                            "Investimento",
                          ]}
                        />
                        <Legend />
                        <Bar
                          dataKey="Valor"
                          name="Investimento (R$)"
                          fill={C_ROSE}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card
                  title="Investimento por Marca (R$)"
                  borderColor="rgba(239,68,68,.35)"
                >
                  <div style={{ width: "100%", height: 300 }}>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={invPorMarca}
                        margin={{
                          left: 12,
                          right: 12,
                          top: 10,
                          bottom: 10,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="Marca" />
                        <YAxis />
                        <Tooltip
                          formatter={(value) => [
                            value.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }),
                            "Investimento",
                          ]}
                        />
                        <Legend />
                        <Bar
                          dataKey="Valor"
                          name="Investimento (R$)"
                          fill={C_BLUE}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <div className="mt-4">
                <Card
                  title="Top 10 SKUs para Comprar (R$)"
                  borderColor="rgba(239,68,68,0.35)"
                >
                  <div
                    className="overflow-auto rounded-lg details-scroll"
                    style={{ border: `1px solid ${C_CARD_BORDER}` }}
                  >
                    <table className="w-full text-sm details-table">
                      <thead className="bg-white/5">
                        <tr>
                          {[
                            "SKU",
                            "Descrição",
                            "Qtd a comprar",
                            "Investimento (R$)",
                          ].map((h) => (
                            <th
                              key={h}
                              className="text-left px-3 py-2 font-medium"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {buysTopSku.length ? (
                          buysTopSku.map((r) => (
                            <tr
                              key={r.SKU}
                              className="border-t"
                              style={{ borderColor: C_CARD_BORDER }}
                            >
                              <td className="px-3 py-2 whitespace-nowrap">
                                {r.SKU}
                              </td>
                              <td className="px-3 py-2">{r.Descricao}</td>
                              <td className="px-3 py-2 text-right">
                                {r.Qtd}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {(r.ValorTotal ?? 0).toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                })}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr
                            className="border-t"
                            style={{ borderColor: C_CARD_BORDER }}
                          >
                            <td className="px-3 py-4" colSpan={4}>
                              Nenhuma compra necessária.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              {showPlanDetail && (
                <div
                  className="mt-6 overflow-auto rounded-lg details-scroll"
                  style={{ border: `1px solid ${C_CARD_BORDER}` }}
                >
                  <table className="w-full text-sm details-table">
                    <thead className="bg-white/5">
                      <tr>
                        {[
                          "SKU",
                          "Descrição",
                          "Classe",
                          "Horizonte (dias)",
                          "Categoria",
                          "Desativação",
                          "Cidade",
                          "Vendas ciclo ant.",
                          "Vendas ciclo atual",
                          "Melhor momento",
                          "Estoque atual (cidade)",
                          "Estoque atual (total)",
                          "Compra intelig. prox ciclo",
                          "Qtd a comprar",
                          "Valor unitário",
                          "Total compra",
                        ].map((h) => (
                          <th
                            key={h}
                            className="text-left px-3 py-2 font-medium"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {buysView.length ? (
                        buysView.map((r, idx) => {
                          const cicloDes = skuDesativacao.get(r.SKU);
                          return (
                            <tr
                              key={idx}
                              className="border-t"
                              style={{ borderColor: C_CARD_BORDER }}
                            >
                              <td className="px-3 py-2 whitespace-nowrap">
                                {r.SKU}
                              </td>
                              <td className="px-3 py-2">
                                {r.Descricao}
                              </td>
                              <td className="px-3 py-2">
                                {skuClasse.get(r.SKU) || ""}
                              </td>
                              <td className="px-3 py-2 text-right">{r.HorizonteDias ?? ""}</td>
                              <td className="px-3 py-2">
                                {skuCategoria.get(r.SKU) || ""}
                              </td>
                              <td className="px-3 py-2">
                                {cicloDes ? (
                                  <span
                                    className={
                                      cicloDes <= CURRENT_CYCLE
                                        ? "text-red-400 font-semibold"
                                        : cicloDes === CURRENT_CYCLE + 1
                                        ? "text-amber-300 font-semibold"
                                        : "text-white"
                                    }
                                  >
                                    {`C${cicloDes}${
                                      cicloDes <= CURRENT_CYCLE
                                        ? " (desativado)"
                                        : cicloDes === CURRENT_CYCLE + 1
                                        ? " (próx. ciclo)"
                                        : ""
                                    }`}
                                  </span>
                                ) : (
                                  ""
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {r.Cidade}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {r.VendasCicloAnterior ?? 0}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {r.VendasCicloAtual ?? 0}
                              </td>
                              <td className="px-3 py-2">
                                {r.MelhorMomento || ""}
                              </td>
                              <td className="px-3 py-2 text-right">{r.EstoqueAtualCidade ?? 0}</td>
                              <td className="px-3 py-2 text-right">{r.EstoqueAtualTotal ?? 0}</td>
                              <td className="px-3 py-2 text-right">
                                {r.CompraInteligenteProxCiclo ?? 0}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {r.Qtd}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {(r.ValorUnit ?? 0).toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                })}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {(r.ValorTotal ?? 0).toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                })}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr
                          className="border-t"
                          style={{ borderColor: C_CARD_BORDER }}
                        >
                          <td className="px-3 py-4" colSpan={13}>
                            Nenhuma compra necessária.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Card>
      </div>


        </>
      )}
      {(activeSection === "promo") && (
        <>
      {/* SUGESTÃO DE COMPRA - SKUs EM PROMOÇÃO (PRÓXIMO CICLO) */}
      {
        <div className="max-w-7xl mx-auto px-6 mt-6 mb-10 space-y-4">
          <Card borderColor="rgba(34,197,94,.35)">
            {/* Título + filtros + botões (padrão Resumo Total) */}
            <div className="no-print mb-2">
              <div className="mb-2 text-left">
                <h2 className="text-base font-semibold">
                  Sugestão de Compra – SKUs em Promoção (Próximo Ciclo C16)
                </h2>
                <p className="text-xs text-white/60 mt-1">
                  Considerando promoções do próximo ciclo e consumo base estimado a partir do ciclo atual C15.
                </p>
              </div>
            
              {/* Toolbar: Filtros + Botões (mesma linha) */}
              <div className="flex flex-nowrap items-end gap-2 overflow-x-auto details-scroll">
                <SelectDark
                  label="Horizonte (dias)"
                  value={promoHorizonDays}
                  onChange={(e) => setPromoHorizonDays(e.target.value)}
                  options={[
                    { value: "7", label: "7 dias" },
                    { value: "14", label: "14 dias" },
                    { value: "21", label: "21 dias (padrão)" },
                    { value: "30", label: "30 dias" },
                    { value: "45", label: "45 dias" },
                    { value: "60", label: "60 dias" },
                    { value: "90", label: "90 dias" },
                  ]}
                  className="w-40"
                />
            
                <SelectDark
                  label="Curva SKU"
                  value={promoCurveFilter}
                  onChange={(e) => setPromoCurveFilter(e.target.value)}
                  options={promoCurveOptions}
                  className="w-32"
                />
            
                <div className="w-56 flex flex-col">
                  <p className="text-xs mb-1 opacity-80">SKU</p>
                  <input
                    list="sku-sug-promo"
                    className="w-full h-10 rounded-lg border border-white/20 px-3 text-sm"
                    style={{ backgroundColor: "#0f172a", color: "#ffffff" }}
                    placeholder="digite SKU ou descrição…"
                    value={promoSkuFilter}
                    onChange={(e) => {
                      const v = e.target.value;
                      // Se o usuário selecionou do datalist (ex: "12345 — Descrição"),
                      // guardamos só o SKU para o filtro funcionar.
                      const sku = typeof parseSkuFromLabel === "function" ? parseSkuFromLabel(v) : v;
                      if (v && (v.includes("—") || v.includes("-")) && sku) setPromoSkuFilter(sku);
                      else setPromoSkuFilter(v);
                    }}
                  />
                  <datalist id="sku-sug-promo">
                    {promoSkuSuggestions.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>

                <div className="flex gap-2 shrink-0 ">
                  <button
                  onClick={() => {
                    setPromoHorizonDays("21");
                    setPromoCurveFilter("Todas");
                    setPromoSkuFilter("");
                  }}
                  className="rounded-lg px-3 py-2 text-xs sm:text-sm font-medium shadow"
                  style={{ background: C_GRAY }}
                >
                  Limpar filtros
                </button>
            
                <button
                  onClick={() => setShowPromoDetail((v) => !v)}
                  className="rounded-lg px-3 py-2 text-xs sm:text-sm font-medium shadow"
                  style={{ background: C_PURPLE }}
                >
                  {showPromoDetail ? "Ocultar detalhe" : "Ver detalhe"}
                </button>
            
                <button
                  onClick={exportPromoXlsx}
                  className="rounded-lg px-3 py-2 text-xs sm:text-sm font-medium shadow"
                  style={{ background: C_BLUE }}
                >
                  Exportar Promo XLSX
                </button>
                </div>
              </div>
            </div>

            {/* KPIs do card de promoção */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
              <Kpi
                title="SKUs em promoção (com compra sugerida)"
                value={promoTotalsView.totalSkus}
                color={C_BLUE}
              />
              <Kpi
                title="Total de itens sugeridos"
                value={promoTotalsView.totalQtd}
                color={C_GREEN}
              />
              <Kpi
                title="Investimento sugerido (R$)"
                value={promoTotalsView.totalValor.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
                color={C_AMBER}
                raw
              />
            </div>

            {/* KPIs adicionais (Top 1 / Top 5) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
              <Kpi
                title="Top 1 SKU (R$)"
                value={promoResumoKpis.valorTop1.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
                color={C_ROSE}
                raw
              />
              <Kpi
                title="Top 5 SKUs - Itens"
                value={promoResumoKpis.totalTop5Qtd}
                color={C_GREEN}
              />
              <Kpi
                title="Top 5 SKUs - Investimento (R$)"
                value={promoResumoKpis.totalTop5Valor.toLocaleString(
                  "pt-BR",
                  {
                    style: "currency",
                    currency: "BRL",
                  }
                )}
                color={C_BLUE}
                raw
              />
            </div>

            {/* Gráfico de barras dos SKUs em promoção */}
            <div style={{ width: "100%", height: 360, marginTop: 16 }}>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart
                  data={promoChartData}
                  margin={{
                    left: 12,
                    right: 12,
                    top: 10,
                    bottom: 10,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="SKU" hide />
                  <YAxis />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length)
                        return null;
                      const item = payload[0].payload;

                      return (
                        <div
                          className="rounded-lg px-3 py-2 text-xs shadow"
                          style={{
                            background: "#ffffff",
                            color: C_BLUE,
                            border: `1px solid ${C_BLUE}`,
                          }}
                        >
                          <div className="font-semibold mb-1">
                            {item.Label}
                          </div>
                          <div>
                            Qtd sugerida:{" "}
                            <span className="font-bold">
                              {item.QtdSugerida}
                            </span>
                          </div>
                          <div>
                            Investimento sugerido:{" "}
                            <span className="font-bold">
                              {item.ValorTotal.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="ValorTotal"
                    name="Investimento sugerido (R$)"
                    fill={C_BLUE}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detalhe em tabela */}
            {showPromoDetail && (
              <div
                className="mt-6 overflow-auto rounded-lg details-scroll"
                style={{ border: `1px solid ${C_CARD_BORDER}` }}
              >
                <table className="w-full text-sm details-table">
                  <thead className="bg-white/5">
                    <tr>
                      {[
                        "SKU",
                        "Descrição",
                        "Classe",
                        "Desconto (%)",
                        "Mínimo base",
                        "Alvo promo",
                        "Estoque disponível",
                        "Qtd sugerida compra",
                        "Preço unit. promo (R$)",
                        "Total sugerido (R$)",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left px-3 py-2 font-medium"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {promoSuggestionsView.map((r) => (
                      <tr
                        key={r.SKU}
                        className="border-t"
                        style={{ borderColor: C_CARD_BORDER }}
                      >
                        <td className="px-3 py-2 whitespace-nowrap">
                          {r.SKU}
                        </td>
                        <td className="px-3 py-2">{r.Descricao}</td>
                        <td className="px-3 py-2">{r.Classe}</td>
                        <td className="px-3 py-2 text-right">
                          {r.Desconto}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.EstoqueMinBase}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.EstoqueAlvoPromo}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.EstoqueDisponivel}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.QtdSugerida}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.PrecoUnitPromo.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.ValorTotal.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      }

      
        </>
      )}
<style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        select,
        select option {
          color: #fff;
          background-color: #0f172a;
        }

        /* === Cabeçalho fixo nas tabelas de "Exibir detalhes" === */
        .details-scroll {
          position: relative;
          max-height: 70vh;
          overflow: auto;
        }
        table.details-table {
          border-collapse: separate;
          border-spacing: 0;
        }
        table.details-table thead th {
          position: sticky;
          top: 0;
          z-index: 30;
          background: #0f172a;
          backdrop-filter: blur(6px);
          box-shadow: 0 2px 10px rgba(0,0,0,.35);
          border-bottom: 1px solid rgba(255,255,255,.10);
        }


      `}</style>
    </div>
  );
}