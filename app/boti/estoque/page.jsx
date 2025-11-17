"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from "recharts";
import * as XLSX from "xlsx";
import {
  C_BLUE, C_GREEN, C_AMBER, C_PURPLE, PIE_COLORS,
  BRAND_OPTIONS, Card, Kpi, SelectDark,
  readFileWithProgress, saveSessionData, loadSessionData,
  fetchPdvCityMap, computeFromWorkbookEstoque, extractSalesRowsAll,
  aggregateEstoque
} from "../boti-lib";

export default function PageEstoque() {
  const fileRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [pdvMap, setPdvMap] = useState({});
  const [allRowsEstoque, setAllRowsEstoque] = useState([]);
  const [brandFilter, setBrandFilter] = useState("Todas");
  const [rowsProcessed, setRowsProcessed] = useState([]);

  const [cityFilter, setCityFilter] = useState("Todas");
  const [query, setQuery] = useState("");
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => { (async ()=> setPdvMap(await fetchPdvCityMap()))(); }, []);

  useEffect(() => {
    // tenta carregar sessão anterior
    const cache = loadSessionData();
    if (cache?.estoque) {
      setAllRowsEstoque(cache.estoque);
      setBrandFilter("Todas");
    }
  }, []);

  async function onUpload(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setError(""); setIsLoading(true); setProgress(0); setStatus("Lendo arquivo…");
    try {
      const buf = await readFileWithProgress(file, (p)=>setProgress(p));
      setStatus("Montando workbook…"); setProgress(70);
      const wb = XLSX.read(buf, { type: "array" });

      setStatus("Processando…"); setProgress(85);
      const estoqueAll = computeFromWorkbookEstoque(wb, pdvMap);
      const vendasAll  = extractSalesRowsAll(wb, pdvMap); // salva junto p/ outras páginas

      saveSessionData({ estoque: estoqueAll, vendas: vendasAll });
      setAllRowsEstoque(estoqueAll);
      setBrandFilter("Todas");
      setStatus("Finalizando…"); setProgress(100);
    } catch (err) { console.error(err); setError(err?.message || "Falha ao processar"); }
    finally { setTimeout(()=>{ setIsLoading(false); setStatus(""); setProgress(0); }, 300); }
  }

  useEffect(() => {
    const rows = brandFilter === "Todas" ? allRowsEstoque : allRowsEstoque.filter(r => r.Marca === brandFilter);
    setRowsProcessed(rows);
  }, [brandFilter, allRowsEstoque]);

  const cityOptions = useMemo(() => {
    const set = new Set(); for (const r of rowsProcessed) if (r.Cidade) set.add(r.Cidade);
    return ["Todas", ...Array.from(set).sort((a,b)=>a.localeCompare(b))];
  }, [rowsProcessed]);

  const rowsAgg = useMemo(() => aggregateEstoque(rowsProcessed, cityFilter, query), [rowsProcessed, cityFilter, query]);

  const totEst = useMemo(() => rowsAgg.reduce((s,r)=>s+(r.EstoqueAtual||0),0), [rowsAgg]);
  const totTrans = useMemo(() => rowsAgg.reduce((s,r)=>s+(r.EstoqueTransito||0),0), [rowsAgg]);
  const totPendLiq = useMemo(() => rowsAgg.reduce((s,r)=>s+(r.PendentesLiquidos||0),0), [rowsAgg]);

  return (
    <>
      {/* Upload + barra */}
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 no-print">
        <SelectDark label="Aba/Marca" value={brandFilter} onChange={(e)=>setBrandFilter(e.target.value)} options={BRAND_OPTIONS} />
        <SelectDark label="Cidade" value={cityFilter} onChange={(e)=>setCityFilter(e.target.value)} options={cityOptions} />
        <div className="md:col-span-3">
          <p className="text-xs text-white/70 mb-1">Buscar por SKU/Descrição</p>
          <input className="w-full rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 text-sm text-white" placeholder="buscar…"
            value={query} onChange={(e)=>setQuery(e.target.value)} />
        </div>
      </div>

      {error ? <p className="text-sm" style={{ color:"#f87171" }}>{error}</p> : null}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi title="Estoque Atual" value={totEst} color={C_BLUE}/>
        <Kpi title="Em Trânsito" value={totTrans} color={C_GREEN}/>
        <Kpi title="Pendentes Líquidos" value={totPendLiq} color={C_AMBER}/>
      </div>

      {/* Pizza */}
      <div className="mt-4">
        <Card title="Resumo Total (Pizza)" borderColor="rgba(59,130,246,.35)">
          <div style={{ width:"100%", height:320 }}>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={[
                  { name:"Estoque Atual", value: totEst },
                  { name:"Em Trânsito", value: totTrans },
                  { name:"Pendentes Líquidos", value: totPendLiq },
                ]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="80%" label>
                  {PIE_COLORS.map((c,i)=><Cell key={i} fill={c} />)}
                </Pie>
                <Tooltip/><Legend/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Detalhe */}
      <div className="mt-4">
        <button onClick={()=>setShowDetail(v=>!v)} className="rounded-lg px-3 py-2 text-sm font-medium no-print" style={{ background: C_PURPLE }}>
          {showDetail ? "Ocultar detalhe" : "Ver detalhe"}
        </button>
      </div>

      {showDetail && (
        <div className="mt-4">
          <Card title="Detalhe por SKU" borderColor="rgba(124,58,237,.35)">
            <div className="overflow-auto rounded-lg" style={{ border:`1px solid rgba(255,255,255,0.10)` }}>
              <table className="w-full text-sm">
                <thead className="bg-white/5">
                  <tr>
                    {["Código do Produto","Descrição do Produto","Cidade","Estoque Atual","Em Trânsito","Pedidos Pendentes","Pendentes Líquidos"].map((h)=>(<th key={h} className="text-left px-3 py-2 font-medium">{h}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {rowsAgg.map((r)=>(
                    <tr key={r.CodigoProduto + "-" + (r.Cidade||"")} className="border-t" style={{ borderColor:"rgba(255,255,255,0.10)" }}>
                      <td className="px-3 py-2 whitespace-nowrap">{r.CodigoProduto}</td>
                      <td className="px-3 py-2">{r.DescricaoProduto}</td>
                      <td className="px-3 py-2">{r.Cidade || ""}</td>
                      <td className="px-3 py-2 text-right">{r.EstoqueAtual}</td>
                      <td className="px-3 py-2 text-right">{r.EstoqueTransito}</td>
                      <td className="px-3 py-2 text-right">{r.PedidosPendentes}</td>
                      <td className="px-3 py-2 text-right">{r.PendentesLiquidos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
