// lib/parser.js
import * as XLSX from "xlsx";
import { CYCLE_WINDOW } from "@/components/Theme";

/* ===== helpers ===== */
export function normalize(str) {
  return (String(str || "")).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}
export function cicloKey(c) {
  const s = String(c || "");
  if (/^\d{6}$/.test(s)) return parseInt(s, 10);
  const m = s.match(/(20\d{2}).*?(\d{1,2})/);
  if (!m) return Number.NEGATIVE_INFINITY;
  return Number(m[1]) * 100 + Number(m[2]);
}
export function brandFromSheetName(name) {
  const n = normalize(name);
  if (/boticario|boti/.test(n)) return "BOTICARIO";
  if (/eudora/.test(n)) return "EUDORA";
  if (/quem.*disse.*berenice|qdb|berenice/.test(n)) return "QUEM DISSE BERENICE";
  return name?.toString?.().toUpperCase?.() || "";
}
export async function fetchPdvCityMap() {
  try {
    const r = await fetch("/Pasta1.csv");
    if (!r.ok) return {};
    const txt = await r.text();
    const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return {};
    const cand = [",",";","=","\t","|"];
    let sep = ";";
    for (const c of cand) if ((lines[0].split(c).length || 0) >= 2) { sep = c; break; }
    let pairs = [];
    for (const ln of lines) {
      if (!ln.includes(sep)) continue;
      const [left, ...rest] = ln.split(sep);
      const right = rest.join(sep);
      const L = String(left||"").trim();
      const R = String(right||"").trim();
      if (L && R) pairs.push([L, R]);
    }
    if (pairs.length && /[a-zA-Z]/.test(pairs[0][0]) && !/^\d+$/.test(pairs[0][0])) pairs.shift();
    const map = {};
    for (const [pdv, cidadeUF] of pairs) {
      let cidade = cidadeUF, uf = "";
      if (cidadeUF.includes("/")) { const i = cidadeUF.lastIndexOf("/"); cidade = cidadeUF.slice(0,i).trim(); uf = cidadeUF.slice(i+1).trim(); }
      else if (cidadeUF.includes("-")) { const i = cidadeUF.lastIndexOf("-"); cidade = cidadeUF.slice(0,i).trim(); uf = cidadeUF.slice(i+1).trim(); }
      map[String(pdv).trim()] = { Cidade: cidade, UF: uf };
    }
    return map;
  } catch { return {}; }
}
export function percentile(values, p) {
  const arr = (values || []).slice().sort((a,b)=>a-b);
  if (!arr.length) return 0;
  const pos = (p/100)*(arr.length-1);
  const base = Math.floor(pos);
  const rest = pos - base;
  return (arr[base+1] !== undefined) ? (arr[base] + rest*(arr[base+1]-arr[base])) : arr[base];
}

/* ===== parse ESTOQUE ===== */
export function computeFromWorkbookEstoque(wb, pdvMap) {
  const result = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const raw = XLSX.utils.sheet_to_json(ws, { defval: null });
    if (!raw.length) continue;

    const headerMap = {}; Object.keys(raw[0]).forEach(k => headerMap[k] = normalize(k));
    const findCol = (cands) => { for (const rawKey in headerMap) if (cands.includes(headerMap[rawKey])) return rawKey; return null; };

    const skuCol   = findCol(["sku","codigo do produto","codigo","codigo_produto","código","codigo produto"]);
    const descCol  = findCol([
      "descricao","descrição","descricao do produto","descrição do produto",
      "descricao_produto","descrição_produto","nome do produto","produto","nome",
      "descr","descrição item","descricao item"
    ]);
    const estoqueAtualCol = findCol(["estoque atual","estoque_atual","estq atual","estq_atual"]);
    const estoqueTransCol = findCol(["estoque em transito","estoque em trânsito","estoque_em_transito","transito","trânsito"]);
    const pedidoPendCol   = findCol(["pedido pendente","pedido_pendente","pedidos pendentes","pedido aberto"]);
    let pdvCol = null; for (const rawKey in headerMap) if (headerMap[rawKey] === "pdv") { pdvCol = rawKey; break; }

    if (!skuCol) continue;

    const marca = brandFromSheetName(sheetName);
    const bestDescBySku = new Map();
    const tmpRows = [];

    for (const r of raw) {
      const sku = String(r?.[skuCol] ?? "").trim();
      if (!sku) continue;

      const rawDesc = descCol ? (r?.[descCol] ?? "") : "";
      const desc = String(rawDesc ?? "").trim();
      if (desc) bestDescBySku.set(sku, desc);

      const pdv = pdvCol ? String(r?.[pdvCol] ?? "").trim() : "";
      const cidade = (pdv && pdvMap?.[pdv]?.Cidade) ? (pdvMap[pdv].Cidade || "") : "";
      const est  = Number(r?.[estoqueAtualCol] ?? 0) || 0;
      const trans = Number(r?.[estoqueTransCol] ?? 0) || 0;
      const pend  = Number(r?.[pedidoPendCol] ?? 0) || 0;
      const pendLiquido = Math.max(pend - trans, 0);

      tmpRows.push({
        Marca: marca, Aba: sheetName, CodigoProduto: sku,
        DescricaoProduto: desc, PDV: pdv, Cidade: cidade,
        EstoqueAtual: est, EstoqueTransito: trans, PedidosPendentes: pend, PendentesLiquidos: pendLiquido
      });
    }

    for (const row of tmpRows) {
      let d = row.DescricaoProduto;
      if (!d || d.trim() === "") {
        const fallback = bestDescBySku.get(row.CodigoProduto);
        d = fallback && String(fallback).trim() ? String(fallback).trim() : "";
      }
      if (!d) d = `SKU ${row.CodigoProduto}`;
      result.push({ ...row, DescricaoProduto: d });
    }
  }
  return result;
}

/* ===== parse VENDAS ===== */
export function extractSalesRowsAll(wb, pdvMap) {
  const collected = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]; if (!ws) continue;
    const raw = XLSX.utils.sheet_to_json(ws, { defval: null }); if (!raw.length) continue;

    const headerMap = {}; Object.keys(raw[0]).forEach(k => headerMap[k] = normalize(k));
    const findCol = (cands) => { for (const rawKey in headerMap) if (cands.includes(headerMap[rawKey])) return rawKey; return null; };

    const marca = brandFromSheetName(sheetName);
    const cicloCol = Object.keys(headerMap).find(rk => headerMap[rk] === "ciclo");
    const skuColLong = findCol(["sku","codigo do produto","codigo","codigo_produto","código","codigo produto"]);
    const qtdColLong = findCol(["qtd vendida","qtdvendida","quantidade vendida","qtd","venda","vendida"]);
    const cidadeCol  = findCol(["cidade","municipio","município"]);
    const pdvCol     = findCol(["pdv","loja","filial"]);
    let capturedAny = false;

    // LONGO
    if (cicloCol && skuColLong && qtdColLong) {
      for (const r of raw) {
        const ciclo = r?.[cicloCol]; const sku = r?.[skuColLong];
        const qty = Number(r?.[qtdColLong] ?? 0) || 0;
        let cidade = "";
        if (cidadeCol) cidade = String(r?.[cidadeCol] ?? "").trim();
        else if (pdvCol) {
          const pdv = String(r?.[pdvCol] ?? "").trim();
          if (pdv && pdvMap?.[pdv]?.Cidade) cidade = pdvMap[pdv].Cidade;
        }
        if (ciclo && sku != null)
          collected.push({ Marca: marca, Aba: sheetName, Ciclo: String(ciclo).trim(), CodigoProduto: String(sku).trim(), QtdVendida: qty, Cidade: cidade });
        capturedAny = true;
      }
    }

    // WIDE (colunas por ciclo)
    const skuColWide = skuColLong || findCol(["produto","id produto","id","ean","referencia"]);
    const cycleColumns = [];
    for (const rawKey in headerMap) {
      const original = rawKey, norm = headerMap[rawKey];
      let m =
        original.match(/ciclo\s*(20\d{2})\s*([01]\d)/i) ||
        original.match(/ciclo.*?(20\d{2}[01]\d)/i) ||
        norm.match(/ciclo\s*(20\d{2})\s*([01]\d)/i) ||
        norm.match(/ciclo.*?(20\d{2}[01]\d)/i);
      if (m) {
        const ciclo = m[2] ? `${m[1]}${m[2]}` : m[1];
        if (/^\d{6}$/.test(ciclo)) cycleColumns.push({ key: original, ciclo });
      }
    }
    if (!capturedAny && skuColWide && cycleColumns.length) {
      for (const r of raw) {
        const sku = r?.[skuColWide]; if (sku == null || sku === "") continue;
        let cidade = "";
        if (cidadeCol) cidade = String(r?.[cidadeCol] ?? "").trim();
        else if (pdvCol) {
          const pdv = String(r?.[pdvCol] ?? "").trim();
          if (pdv && pdvMap?.[pdv]?.Cidade) cidade = pdvMap[pdv].Cidade;
        }
        for (const col of cycleColumns) {
          const qty = Number(r?.[col.key] ?? 0) || 0;
          collected.push({ Marca: marca, Aba: sheetName, Ciclo: col.ciclo, CodigoProduto: String(sku).trim(), QtdVendida: qty, Cidade: cidade });
        }
      }
    }
  }
  return collected;
}

/* ===== master parse (buffer -> datasets) ===== */
export async function parseWorkbookFromFile(file) {
  const pdvMap = await fetchPdvCityMap();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const estoque = computeFromWorkbookEstoque(wb, pdvMap);
  const vendas = extractSalesRowsAll(wb, pdvMap);

  // limita janela de 17 ciclos
  const ciclosAll = Array.from(new Set(vendas.map(r => r.Ciclo))).sort((a,b)=>cicloKey(a)-cicloKey(b));
  const lastN = ciclosAll.slice(-CYCLE_WINDOW);
  const vendas17 = vendas.filter(r => lastN.includes(r.Ciclo));

  return { estoque, vendas: vendas17, ciclos: lastN };
}
