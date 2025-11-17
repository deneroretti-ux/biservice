// @ts-nocheck
"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend
} from "recharts";
import * as XLSX from "xlsx";
import {
  C_BLUE, C_GREEN, C_AMBER, BRAND_OPTIONS, Card, Kpi, SelectDark,
  readFileWithProgress, saveSessionData, loadSessionData,
  fetchPdvCityMap, extractSalesRowsAll, computeFromWorkbookEstoque,
  percentile, CYCLE_WINDOW
} from "../boti-lib";

export default function PageMinimo() {
  const fileRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [pdvMap, setPdvMap] = useState({});
  const [salesRowsAll, setSalesRowsAll] = useState([]);
  const [brandFilter, setBrandFilter] = useState("Todas");
  const [salesRows, setSalesRows] = useState([]);

  const [minMethod, setMinMethod] = useState("media17");
  const [covFactor, setCovFactor] = useState("1.0");

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
      const estoqueAll = computeFromWorkbookEstoque(wb, pdvMap);
      saveSessionData({ estoque: estoqueAll, vendas: vendasAll });
      setSalesRowsAll(vendasAll);
      setStatus("Finalizando…"); setProgress(100);
    } catch (err) { console.error(err); setError(err?.message || "Falha ao processar"); }
    finally { setTimeout(()=>{ setIsLoading(false); setStatus(""); setProgress(0); }, 300); }
  }

  useEffect(() => {
    const rows = brandFilter === "Todas" ? salesRowsAll : salesRowsAll.filter(r => r.Marca === brandFilter);
    if (!rows.length) { setSalesRows([]); return; }
    const ciclosAll = Array.from(new Set(rows.map(r => r.Ciclo))).sort();
    const lastN = ciclosAll.slice(-CYCLE_WINDOW);
    const filtered = rows.filter(r => lastN.includes(r.Ciclo));
    setSalesRows(filtered);
  }, [brandFilter, salesRowsAll]);

  // estatísticas por SKU
  const statsPorSku = useMemo(() => {
    const bySkuCiclo = new Map();
    for (const r of salesRows) {
      const key = `${r.CodigoProduto}||${r.Ciclo}`;
      bySkuCiclo.set(key, (bySkuCiclo.get(key) || 0) + (r.QtdVendida || 0));
    }
    const bySku = new Map();
    for (const [key, qtd] of bySkuCiclo.entries()) {
      const [sku] = key.split("||");
      if (!bySku.has(sku)) bySku.set(sku, []);
      bySku.get(sku).push(qtd);
    }
    const out = new Map();
    for (const [sku, arrRaw] of bySku.entries()) {
      const arr = arrRaw.map(n => Number(n||0));
      const n = arr.length;
      const sum = arr.reduce((s,x)=>s+x,0);
      const mean = n ? sum/n : 0;
      const maxv = n ? Math.max(...arr) : 0;
      const p85 = percentile(arr, 85);
      let sigma = 0;
      if (n > 1) {
        const varS = arr.reduce((s,x)=>s+Math.pow(x-mean,2),0) / (n-1);
        sigma = Math.sqrt(varS);
      }
      out.set(sku, { n, mean, maxv, p85, sigma });
    }
    return out;
  }, [salesRows]);

  // map sku -> descrição (do próprio dataset de vendas pode faltar; sem problema)
  const skuDesc = useMemo(() => {
    const map = new Map();
    // tenta achar colunas de descrição se existirem em vendas (nem sempre tem)
    // deixamos vazio e fallback será "SKU <codigo>"
    return map;
  }, []);

  const sugestaoMinimo = useMemo(() => {
    const list = [];
    for (const [sku, st] of statsPorSku.entries()) {
      let base = 0;
      switch (minMethod) {
        case "media17": base = st.mean; break;
        case "max17": base = st.maxv; break;
        case "p85": base = st.p85; break;
        case "media+1sigma": base = st.mean + st.sigma; break;
        default: base = st.mean;
      }
      const sugerido = Math.max(0, Math.ceil((base || 0) * (Number(covFactor) || 1)));
      let desc = skuDesc.get(sku) || "";
      if (!desc || desc.trim() === "") desc = `SKU ${sku}`;
      list.push({ SKU: sku, Descricao: desc, CiclosUsados: st.n, EstoqueMinimoSugerido: sugerido });
    }
    list.sort((a,b)=>b.EstoqueMinimoSugerido - a.EstoqueMinimoSugerido);
    return list;
  }, [statsPorSku, minMethod, covFactor, skuDesc]);

  const minChartData = useMemo(() => {
    return (sugestaoMinimo.slice(0, 20)).map(r => ({
      SKU: r.SKU, Label: `${r.SKU} — ${r.Descricao}`, Min: r.EstoqueMinimoSugerido
    }));
  }, [sugestaoMinimo]);

  function exportMinimoXlsx() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sugestaoMinimo), "Estoque_Minimo");
    XLSX.writeFile(wb, "estoque_minimo.xlsx");
  }

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 no-print">
        <SelectDark label="Aba/Marca" value={brandFilter} onChange={(e)=>setBrandFilter(e.target.value)} options={BRAND_OPTIONS} />
        <SelectDark label="Método" value={minMethod} onChange={(e)=>setMinMethod(e.target.value)} options={["media17","max17","p85","media+1sigma"]} />
        <SelectDark label="Fator de cobertura" value={covFactor} onChange={(e)=>setCovFactor(e.target.value)} options={["0.8","1.0","1.2","1.5","2.0"]} />
        <button onClick={exportMinimoXlsx} className="rounded-lg px-3 py-2 text-sm font-medium shadow self-end" style={{ background: C_BLUE }}>
          Exportar XLSX
        </button>
      </div>

      {/* Gráfico */}
      <Card title={`Top 20 — Estoque Mínimo Sugerido (janela de ${CYCLE_WINDOW} ciclos)`} borderColor="rgba(59,130,246,.35)">
        <div style={{ width: "100%", height: 360 }}>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={minChartData} margin={{ left: 12, right: 12, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="Label" tick={{ fontSize: 11 }} interval={0} angle={-20} height={70} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Min" name="Mínimo sugerido" fill={C_GREEN} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Tabela */}
      <div className="mt-4">
        <Card title="Tabela completa" borderColor="rgba(59,130,246,.35)">
          <div className="overflow-auto rounded-lg" style={{ border: `1px solid rgba(255,255,255,0.10)` }}>
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  {["SKU","Descrição","Ciclos usados","Estoque mínimo sugerido"].map((h)=>(
                    <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sugestaoMinimo.length ? sugestaoMinimo.map((r, i)=>(
                  <tr key={r.SKU + "-" + i} className="border-t" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
                    <td className="px-3 py-2 whitespace-nowrap">{r.SKU}</td>
                    <td className="px-3 py-2">{r.Descricao}</td>
                    <td className="px-3 py-2">{r.CiclosUsados}</td>
                    <td className="px-3 py-2 text-right">{r.EstoqueMinimoSugerido.toLocaleString("pt-BR")}</td>
                  </tr>
                )) : (
                  <tr className="border-t" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
                    <td className="px-3 py-4" colSpan={4}>Sem dados suficientes.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
