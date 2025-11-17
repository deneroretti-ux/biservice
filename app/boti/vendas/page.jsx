"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend, ReferenceLine
} from "recharts";
import * as XLSX from "xlsx";
import {
  C_BLUE, C_GREEN, C_AMBER, C_PURPLE,
  BRAND_OPTIONS, Card, Kpi, SelectDark,
  readFileWithProgress, saveSessionData, loadSessionData,
  fetchPdvCityMap, extractSalesRowsAll, computeFromWorkbookEstoque,
  CYCLE_WINDOW, cicloKey
} from "../boti-lib";

export default function PageVendas() {
  const fileRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [pdvMap, setPdvMap] = useState({});
  const [salesRowsAll, setSalesRowsAll] = useState([]);
  const [brandFilter, setBrandFilter] = useState("Todas");
  const [salesRows, setSalesRows] = useState([]);
  const [skuList, setSkuList] = useState([]);
  const [skuSel, setSkuSel] = useState("Todos");
  const [selectedCycle, setSelectedCycle] = useState("Todos");
  const [showCycleDetail, setShowCycleDetail] = useState(false);

  useEffect(() => { (async ()=> setPdvMap(await fetchPdvCityMap()))(); }, []);
  useEffect(() => {
    const cache = loadSessionData();
    if (cache?.vendas) setSalesRowsAll(cache.vendas);
  }, []);

  async function onUpload(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setError(""); setIsLoading(true); setProgress(0); setStatus("Lendo arquivo…");
    try {
      const buf = await readFileWithProgress(file, (p)=>setProgress(p));
      setStatus("Montando workbook…"); setProgress(70);
      const wb = XLSX.read(buf, { type: "array" });
      setStatus("Processando…"); setProgress(85);
      const vendasAll  = extractSalesRowsAll(wb, pdvMap);
      const estoqueAll = computeFromWorkbookEstoque(wb, pdvMap); // salva também
      saveSessionData({ estoque: estoqueAll, vendas: vendasAll });
      setSalesRowsAll(vendasAll);
      setStatus("Finalizando…"); setProgress(100);
    } catch (err) { console.error(err); setError(err?.message || "Falha ao processar"); }
    finally { setTimeout(()=>{ setIsLoading(false); setStatus(""); setProgress(0); }, 300); }
  }

  useEffect(() => {
    const rows = brandFilter === "Todas" ? salesRowsAll : salesRowsAll.filter(r => r.Marca === brandFilter);
    if (!rows.length) { setSalesRows([]); setSkuList([]); setSkuSel("Todos"); setSelectedCycle("Todos"); return; }
    const ciclosAll = Array.from(new Set(rows.map(r => r.Ciclo))).sort((a,b)=>cicloKey(a)-cicloKey(b));
    const lastN = ciclosAll.slice(-CYCLE_WINDOW);
    const filtered = rows.filter(r => lastN.includes(r.Ciclo));
    setSalesRows(filtered);
    const skus = Array.from(new Set(filtered.map(r => r.CodigoProduto))).sort((a,b)=>a.localeCompare(b));
    setSkuList(["Todos", ...skus]);
    setSkuSel("Todos"); setSelectedCycle("Todos");
  }, [brandFilter, salesRowsAll]);

  const cycleOptions = useMemo(() => {
    if (!salesRows.length) return ["Todos"];
    const all = Array.from(new Set(salesRows.map(r => r.Ciclo))).sort((a,b)=>cicloKey(a)-cicloKey(b));
    const last = all.slice(-CYCLE_WINDOW);
    return ["Todos", ...last];
  }, [salesRows]);

  const cyclesForSku = useMemo(() => {
    if (!salesRows.length) return [];
    const base = (skuSel === "Todos") ? salesRows : salesRows.filter(r => r.CodigoProduto === skuSel);
    const byCiclo = new Map();
    for (const r of base) byCiclo.set(r.Ciclo, (byCiclo.get(r.Ciclo) || 0) + (r.QtdVendida || 0));
    return Array.from(byCiclo.entries()).sort((a,b)=>cicloKey(a[0])-cicloKey(b[0]))
      .map(([Ciclo, QtdVendida]) => ({ Ciclo, QtdVendida }));
  }, [salesRows, skuSel]);

  const media17 = useMemo(() => {
    if (!cyclesForSku.length) return 0;
    const total = cyclesForSku.reduce((s,x)=>s+(x.QtdVendida||0), 0);
    return total / cyclesForSku.length;
  }, [cyclesForSku]);

  const maxInfo = useMemo(() => {
    if (!cyclesForSku.length) return { ciclo: "", qtd: 0 };
    let best = cyclesForSku[0];
    for (const x of cyclesForSku) if (x.QtdVendida > best.QtdVendida) best = x;
    return { ciclo: best.Ciclo, qtd: best.QtdVendida };
  }, [cyclesForSku]);

  return (
    <>
      {/* Upload */}
      <div className="flex items-center gap-2 mb-4 no-print">
        <label className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium shadow" style={{ background: C_GREEN }}>
          <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-90"><path fill="currentColor" d="M19 15v4H5v-4H3v6h18v-6zM11 3v10.17l-3.59-3.58L6 11l6 6l6-6l-1.41-1.41L13 13.17V3z"/></svg>
          Upload XLSX
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onUpload} className="hidden" />
        </label>
        {isLoading && (
          <div className="flex-1 h-2 bg-white/10 rounded">
            <div className="h-2 rounded" style={{ width: `${progress}%`, background: C_BLUE, transition: "width .2s" }} />
          </div>
        )}
        {status && <span className="text-xs text-white/70">{status}</span>}
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 no-print">
        <SelectDark label="Aba/Marca" value={brandFilter} onChange={(e)=>setBrandFilter(e.target.value)} options={BRAND_OPTIONS} />
        <SelectDark label="SKU (Produto)" value={skuSel} onChange={(e)=>setSkuSel(e.target.value)} options={skuList.length ? skuList : ["Todos"]}/>
        <SelectDark label="Ciclo (detalhe)" value={selectedCycle} onChange={(e)=>setSelectedCycle(e.target.value)} options={cycleOptions} />
      </div>

      {error ? <p className="text-sm" style={{ color:"#f87171" }}>{error}</p> : null}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Kpi title="Média (janela)" value={Number((media17||0)).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} color={C_BLUE} raw/>
        <Kpi title="Ciclo com maior venda" value={maxInfo.ciclo || "-"} color={C_GREEN} raw/>
        <Kpi title="Qtd máxima nesse ciclo" value={maxInfo.qtd || 0} color={C_AMBER}/>
      </div>

      {/* Gráfico barras */}
      <Card title={`Vendas por ciclo (últimos ${CYCLE_WINDOW})`} borderColor="rgba(59,130,246,.35)">
        <div style={{ width: "100%", height: 360 }}>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={cyclesForSku} margin={{ left: 12, right: 12, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="Ciclo" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="QtdVendida" name="Qtd Vendida" fill={C_BLUE} />
              <ReferenceLine y={media17 || 0} stroke={C_AMBER} strokeDasharray="4 4" label={{ value: "Média", fill: "#fff", position: "top" }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Botão detalhe */}
      <div className="mt-4">
        <button
          onClick={()=>setShowCycleDetail(v=>!v)}
          className="rounded-lg px-3 py-2 text-sm font-medium no-print"
          style={{ background: C_PURPLE }}
        >
          {showCycleDetail ? "Ocultar detalhe do ciclo" : "Ver detalhe do ciclo"}
        </button>
      </div>

      {showCycleDetail && (
        <div className="mt-4">
          <Card title="Resumo do filtro" borderColor="rgba(124,58,237,.35)">
            <p className="text-sm text-white/80">SKU: <b>{skuSel}</b> · Ciclo: <b>{selectedCycle}</b> · Marca: <b>{brandFilter}</b></p>
          </Card>
        </div>
      )}
    </>
  );
}
