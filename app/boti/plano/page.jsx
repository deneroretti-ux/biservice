"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend
} from "recharts";
import * as XLSX from "xlsx";
import {
  C_BLUE, C_GREEN, C_AMBER, C_PURPLE, BRAND_OPTIONS, Card, Kpi, SelectDark,
  readFileWithProgress, saveSessionData, loadSessionData,
  fetchPdvCityMap, extractSalesRowsAll, computeFromWorkbookEstoque,
  percentile
} from "../boti-lib";

export default function PagePlano() {
  const fileRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [pdvMap, setPdvMap] = useState({});
  const [rowsEstoque, setRowsEstoque] = useState([]);
  const [rowsVendas, setRowsVendas] = useState([]);
  const [brandFilter, setBrandFilter] = useState("Todas");

  const [minMethod] = useState("media17");
  const [covFactor] = useState("1.0");

  const [planCityFilter, setPlanCityFilter] = useState("Todas");

  useEffect(() => { (async ()=> setPdvMap(await fetchPdvCityMap()))(); }, []);
  useEffect(() => {
    const cache = loadSessionData();
    if (cache?.estoque) setRowsEstoque(cache.estoque);
    if (cache?.vendas) setRowsVendas(cache.vendas);
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
      setRowsEstoque(estoqueAll); setRowsVendas(vendasAll);
      setStatus("Finalizando…"); setProgress(100);
    } catch (err) { console.error(err); setError(err?.message || "Falha ao processar"); }
    finally { setTimeout(()=>{ setIsLoading(false); setStatus(""); setProgress(0); }, 300); }
  }

  const estoqueMarca = useMemo(() => brandFilter === "Todas" ? rowsEstoque : rowsEstoque.filter(r => r.Marca === brandFilter), [rowsEstoque, brandFilter]);
  const vendasMarca  = useMemo(() => brandFilter === "Todas" ? rowsVendas  : rowsVendas.filter(r => r.Marca === brandFilter),  [rowsVendas, brandFilter]);

  // estatísticas por SKU (para mínimo sugerido)
  const statsPorSku = useMemo(() => {
    const bySkuCiclo = new Map();
    for (const r of vendasMarca) {
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
      if (n > 1) { const varS = arr.reduce((s,x)=>s+Math.pow(x-mean,2),0) / (n-1); sigma = Math.sqrt(varS); }
      out.set(sku, { n, mean, maxv, p85, sigma });
    }
    return out;
  }, [vendasMarca]);

  const skuMeta = useMemo(() => {
    const map = new Map();
    for (const r of estoqueMarca) {
      if (r.CodigoProduto && r.DescricaoProduto) map.set(r.CodigoProduto, r.DescricaoProduto);
    }
    return map;
  }, [estoqueMarca]);

  const sugestaoMinimo = useMemo(() => {
    const list = [];
    for (const [sku, st] of statsPorSku.entries()) {
      let base = 0;
      switch (minMethod) { case "media17": base = st.mean; break; case "max17": base = st.maxv; break; case "p85": base = st.p85; break; case "media+1sigma": base = st.mean + st.sigma; break; default: base = st.mean; }
      const sugerido = Math.max(0, Math.ceil((base || 0) * (Number(covFactor) || 1)));
      let desc = skuMeta.get(sku) || `SKU ${sku}`;
      list.push({ SKU: sku, Descricao: desc, EstoqueMinimoSugerido: sugerido });
    }
    return list;
  }, [statsPorSku, minMethod, covFactor, skuMeta]);

  // shares por cidade a partir de vendas
  const salesShareCity = useMemo(() => {
    const map = new Map();
    for (const r of vendasMarca) {
      const sku = r.CodigoProduto;
      const cidade = (r.Cidade || "").trim();
      if (!cidade) continue;
      if (!map.has(sku)) map.set(sku, new Map());
      const inner = map.get(sku);
      inner.set(cidade, (inner.get(cidade) || 0) + (r.QtdVendida || 0));
    }
    const share = new Map();
    for (const [sku, byCity] of map.entries()) {
      const total = Array.from(byCity.values()).reduce((s,v)=>s+v,0);
      const innerShare = new Map();
      if (total > 0) { for (const [city, v] of byCity.entries()) innerShare.set(city, v/total); }
      share.set(sku, innerShare);
    }
    return share;
  }, [vendasMarca]);

  const estoqueBySkuCity = useMemo(() => {
    const by = new Map();
    for (const r of estoqueMarca) {
      const sku = r.CodigoProduto;
      const city = r.Cidade || "";
      if (!by.has(sku)) by.set(sku, new Map());
      const inner = by.get(sku);
      if (!inner.has(city)) inner.set(city, { EstoqueAtual:0, EstoqueTransito:0, PendLiq:0 });
      const acc = inner.get(city);
      acc.EstoqueAtual += r.EstoqueAtual || 0;
      acc.EstoqueTransito += r.EstoqueTransito || 0;
      acc.PendLiq += r.PendentesLiquidos || 0;
    }
    return by;
  }, [estoqueMarca]);

  const { transfers, buys, totalsPlan } = useMemo(() => {
    const transfers = []; const buys = [];
    let totalTransfer = 0, totalBuy = 0, moves = 0;

    for (const rec of sugestaoMinimo) {
      const { SKU: sku, Descricao: desc, EstoqueMinimoSugerido: globalMin } = rec;
      const citiesMap = estoqueBySkuCity.get(sku); if (!citiesMap || !citiesMap.size) continue;

      let weights = new Map();
      if (salesShareCity.has(sku) && salesShareCity.get(sku).size) {
        const shares = salesShareCity.get(sku);
        let sum = 0;
        for (const city of citiesMap.keys()) { const w = shares.get(city) || 0; weights.set(city, w); sum += w; }
        if (sum === 0) { const count = citiesMap.size; for (const city of citiesMap.keys()) weights.set(city, 1/count); }
        else { for (const [city, w] of Array.from(weights.entries())) weights.set(city, w/sum); }
      } else { const count = citiesMap.size; for (const city of citiesMap.keys()) weights.set(city, 1/count); }

      const cities = Array.from(citiesMap.keys());
      const targets = new Map(); let assigned = 0;
      cities.forEach((city, idx) => {
        let t = Math.floor(globalMin * (weights.get(city) || 0));
        if (idx === cities.length - 1) t = Math.max(0, globalMin - assigned);
        targets.set(city, t); assigned += t;
      });

      const sources = []; const sinks = [];
      for (const [city, acc] of citiesMap.entries()) {
        const available = (acc.EstoqueAtual || 0) + (acc.EstoqueTransito || 0) - (acc.PendLiq || 0);
        const target = targets.get(city) || 0;
        const diff = available - target;
        if (diff > 0) sources.push({ city, qty: diff });
        else if (diff < 0) sinks.push({ city, qty: -diff });
      }

      let i = 0, j = 0;
      while (i < sources.length && j < sinks.length) {
        const give = Math.min(sources[i].qty, sinks[j].qty);
        if (give > 0) { transfers.push({ SKU: sku, Descricao: desc, Origem: sources[i].city, Destino: sinks[j].city, Qtd: give }); totalTransfer += give; moves += 1; }
        sources[i].qty -= give; sinks[j].qty -= give;
        if (sources[i].qty === 0) i++; if (sinks[j].qty === 0) j++;
      }
      for (; j < sinks.length; j++) { const q = sinks[j].qty; if (q > 0) { buys.push({ SKU: sku, Descricao: desc, Cidade: sinks[j].city, Qtd: q }); totalBuy += q; } }
    }
    return { transfers, buys, totalsPlan: { totalTransfer, totalBuy, moves } };
  }, [sugestaoMinimo, estoqueBySkuCity, salesShareCity]);

  const planCityOptions = useMemo(() => {
    const set = new Set();
    for (const inner of Array.from(estoqueBySkuCity.values())) { for (const city of inner.keys()) if (city) set.add(city); }
    return ["Todas", ...Array.from(set).sort((a,b)=>a.localeCompare(b))];
  }, [estoqueBySkuCity]);

  const transfersView = useMemo(() => planCityFilter==="Todas" ? transfers : transfers.filter(t => t.Origem===planCityFilter || t.Destino===planCityFilter), [transfers, planCityFilter]);
  const buysView = useMemo(() => planCityFilter==="Todas" ? buys : buys.filter(b => b.Cidade===planCityFilter), [buys, planCityFilter]);

  const transfersByDestino = useMemo(() => {
    const map = new Map();
    for (const t of transfersView) { const k = t.Destino || "(sem cidade)"; map.set(k, (map.get(k) || 0) + (t.Qtd || 0)); }
    return Array.from(map.entries()).map(([Cidade, Qtd]) => ({ Cidade, Qtd })).sort((a,b)=>b.Qtd - a.Qtd);
  }, [transfersView]);
  const transfersTopSku = useMemo(() => {
    const map = new Map();
    for (const t of transfersView) { const k = `${t.SKU} — ${t.Descricao || ""}`.trim(); map.set(k, (map.get(k) || 0) + (t.Qtd || 0)); }
    return Array.from(map.entries()).map(([SKU, Qtd]) => ({ SKU, Qtd })).sort((a,b)=>b.Qtd - a.Qtd).slice(0,10);
  }, [transfersView]);
  const buysByCidade = useMemo(() => {
    const map = new Map();
    for (const b of buysView) { const k = b.Cidade || "(sem cidade)"; map.set(k, (map.get(k) || 0) + (b.Qtd || 0)); }
    return Array.from(map.entries()).map(([Cidade, Qtd]) => ({ Cidade, Qtd })).sort((a,b)=>b.Qtd - a.Qtd);
  }, [buysView]);

  function exportPlanXlsx() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(transfersView), "Transferencias");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buysView), "Compras");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { TotalTransferir: totalsPlan.totalTransfer, Movimentos: totalsPlan.moves, TotalComprar: totalsPlan.totalBuy },
      { CidadeFiltroPlano: planCityFilter, MarcaFiltro: brandFilter, Metodo: minMethod, Cobertura: covFactor }
    ]), "Resumo");
    XLSX.writeFile(wb, "plano_transferencia_compra.xlsx");
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

      {/* Filtros do plano */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 no-print">
        <SelectDark label="Aba/Marca" value={brandFilter} onChange={(e)=>setBrandFilter(e.target.value)} options={BRAND_OPTIONS} />
        <SelectDark label="Cidade (Plano)" value={planCityFilter} onChange={(e)=>setPlanCityFilter(e.target.value)} options={planCityOptions} />
        <button onClick={exportPlanXlsx} className="rounded-lg px-3 py-2 text-sm font-medium shadow self-end" style={{ background: C_BLUE }}>
          Exportar Plano
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Kpi title="Total a transferir" value={totalsPlan.totalTransfer} color={C_GREEN}/>
        <Kpi title="Movimentos" value={totalsPlan.moves} color={C_BLUE}/>
        <Kpi title="Total a comprar" value={totalsPlan.totalBuy} color={C_AMBER}/>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card title="Transferências por Cidade (Destino)" borderColor="rgba(34,197,94,.35)">
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={transfersByDestino} margin={{ left: 12, right: 12, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="Cidade" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Qtd" name="Qtd a transferir" fill={C_GREEN} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Top 10 SKUs para Transferir" borderColor="rgba(34,197,94,.35)">
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={transfersTopSku} margin={{ left: 12, right: 12, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="SKU" tick={{ fontSize: 11 }} interval={0} angle={-20} height={70} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Qtd" name="Qtd a transferir" fill={C_BLUE} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Compras por Cidade" borderColor="rgba(245,158,11,.35)">
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={buysByCidade} margin={{ left: 12, right: 12, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="Cidade" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Qtd" name="Qtd a comprar" fill={C_AMBER} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Tabelas */}
      <Card title="Transferências sugeridas" borderColor="rgba(34,197,94,.35)">
        <div className="overflow-auto rounded-lg" style={{ border: `1px solid rgba(255,255,255,0.10)` }}>
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr>{["SKU","Descrição","Origem","Destino","Quantidade"].map(h=>(<th key={h} className="text-left px-3 py-2 font-medium">{h}</th>))}</tr>
            </thead>
            <tbody>
              {transfersView.length ? transfersView.map((r,i)=>(
                <tr key={i} className="border-t" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
                  <td className="px-3 py-2 whitespace-nowrap">{r.SKU}</td>
                  <td className="px-3 py-2">{r.Descricao}</td>
                  <td className="px-3 py-2">{r.Origem}</td>
                  <td className="px-3 py-2">{r.Destino}</td>
                  <td className="px-3 py-2 text-right">{r.Qtd}</td>
                </tr>
              )) : <tr className="border-t" style={{ borderColor: "rgba(255,255,255,0.10)" }}><td className="px-3 py-4" colSpan={5}>Nenhuma transferência.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4">
        <Card title="Compras sugeridas" borderColor="rgba(245,158,11,.35)">
          <div className="overflow-auto rounded-lg" style={{ border: `1px solid rgba(255,255,255,0.10)` }}>
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>{["SKU","Descrição","Cidade","Quantidade"].map(h=>(<th key={h} className="text-left px-3 py-2 font-medium">{h}</th>))}</tr>
              </thead>
              <tbody>
                {buysView.length ? buysView.map((r,i)=>(
                  <tr key={i} className="border-t" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
                    <td className="px-3 py-2 whitespace-nowrap">{r.SKU}</td>
                    <td className="px-3 py-2">{r.Descricao}</td>
                    <td className="px-3 py-2">{r.Cidade}</td>
                    <td className="px-3 py-2 text-right">{r.Qtd}</td>
                  </tr>
                )) : <tr className="border-t" style={{ borderColor: "rgba(255,255,255,0.10)" }}><td className="px-3 py-4" colSpan={4}>Nenhuma compra.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
