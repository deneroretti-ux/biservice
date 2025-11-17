"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";

export default function Page() {
  const [resumo, setResumo] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [query, setQuery] = useState("");
  const [onlyPromo, setOnlyPromo] = useState(false);
  const [onlyLanc, setOnlyLanc] = useState(false);
  const [selectedSku, setSelectedSku] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [r1, r2] = await Promise.all([
          fetch("/data/boticario_resumo.json"),
          fetch("/data/boticario_historico.json"),
        ]);
        if (!r1.ok) throw new Error("Falha ao carregar boticario_resumo.json");
        if (!r2.ok) throw new Error("Falha ao carregar boticario_historico.json");
        const j1 = await r1.json();
        const j2 = await r2.json();
        if (!mounted) return;
        setResumo(j1);
        setHistorico(j2);
        if (j1?.[0]?.CodigoProduto) setSelectedSku(j1[0].CodigoProduto);
      } catch (e) {
        setError(e?.message || "Erro inesperado ao carregar dados");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    let arr = [...resumo];
    if (query) {
      const q = query.toLowerCase();
      arr = arr.filter((r) =>
        (String(r.CodigoProduto || "").toLowerCase().includes(q)) ||
        (String(r.DescricaoProduto || "").toLowerCase().includes(q))
      );
    }
    if (onlyPromo) arr = arr.filter((r) => !!r.PromocaoProxCiclo);
    if (onlyLanc) arr = arr.filter((r) => !!r.EhLancamento);
    return arr;
  }, [resumo, query, onlyPromo, onlyLanc]);

  const kpis = useMemo(() => {
    if (!filtered.length) return { skus: 0, estoque: 0, excesso: 0, media: 0 };
    const skus = filtered.length;
    const estoque = filtered.reduce((sum, r) => sum + (r.EstoqueTotalDisponivel || 0), 0);
    const excesso = filtered.reduce((sum, r) => sum + (r.ExcessoParaTransferir || 0), 0);
    const media = filtered.reduce((sum, r) => sum + (r.MediaVendas_17c_ou_Disponivel || 0), 0) / skus;
    return { skus, estoque, excesso, media };
  }, [filtered]);

  const topExcesso = useMemo(() => {
    const arr = [...filtered].sort((a, b) => (b.ExcessoParaTransferir || 0) - (a.ExcessoParaTransferir || 0));
    return arr.slice(0, 20).map((r) => ({ sku: r.CodigoProduto, descricao: r.DescricaoProduto, excesso: r.ExcessoParaTransferir || 0 }));
  }, [filtered]);

  const topEstoque = useMemo(() => {
    const arr = [...filtered]
      .sort((a, b) => (b.EstoqueTotalDisponivel || 0) - (a.EstoqueTotalDisponivel || 0))
      .slice(0, 15)
      .map((r) => ({ sku: r.CodigoProduto, atual: r.EstoqueAtual || 0, transito: r.EstoqueTransito || 0, pendente: r.PedidosPendentes || 0 }));
    return arr;
  }, [filtered]);

  const selectedHistory = useMemo(() => {
    if (!selectedSku) return [];
    const row = historico.find((h) => String(h.CodigoProduto) === String(selectedSku));
    if (!row) return [];
    const entries = Object.entries(row).filter(([k]) => k.toLowerCase().includes("historico de vendas do ciclo"));
    const parsed = entries
      .map(([k, v]) => {
        const m = k.match(/(\\d{6}|\\d{5}|\\d{4})/);
        const codigo = m ? m[1] : k;
        return { key: k, codigo, vendas: Number(v) || 0 };
      })
      .sort((a, b) => Number(a.codigo) - Number(b.codigo))
      .slice(-17);
    return parsed.map((p) => ({ ciclo: String(p.codigo), vendas: p.vendas }));
  }, [historico, selectedSku]);

  const resetFilters = () => { setQuery(""); setOnlyPromo(false); setOnlyLanc(false); };

  if (loading) return <div className="p-6"><p className="text-sm opacity-70">Carregando dados…</p></div>;
  if (error) return <div className="p-6"><p className="text-sm text-red-600">{error}</p><p className="text-xs opacity-70 mt-2">Coloque os JSONs em /public/data/</p></div>;

  return (
    <div className="p-6 space-y-6">
      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold tracking-tight">
        BI Service Beta · Planejamento (BOTICÁRIO)
      </motion.h1>

      <div className="border rounded-xl p-4 shadow-sm flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-2 w-full md:w-1/2">
          <input placeholder="Buscar por SKU ou descrição…" className="border rounded-md px-3 py-2 w-full text-sm" value={query} onChange={(e)=>setQuery(e.target.value)} />
          <button className="border rounded-md px-3 py-2 text-sm" onClick={resetFilters}>Limpar</button>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={onlyPromo} onChange={(e)=>setOnlyPromo(e.target.checked)} />
            Somente Promoção
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={onlyLanc} onChange={(e)=>setOnlyLanc(e.target.checked)} />
            Somente Lançamento
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi title="SKUs" value={kpis.skus} />
        <Kpi title="Estoque Total" value={Math.round(kpis.estoque)} />
        <Kpi title="Excesso Total" value={Math.round(kpis.excesso)} />
        <Kpi title="Média 17 ciclos" value={Number(kpis.media.toFixed(2))} />
      </div>

      <Section title="Top 20 – Excesso para Transferir (SKU)">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topExcesso}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sku" tick={{ fontSize: 12 }} interval={0} angle={-25} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="excesso" name="Excesso" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Top 15 – Composição de Estoque (Atual × Trânsito × Pendente)">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topEstoque}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sku" tick={{ fontSize: 12 }} interval={0} angle={-25} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="atual" name="Estoque Atual" />
              <Bar dataKey="transito" name="Em Trânsito" />
              <Bar dataKey="pendente" name="Pedidos Pendentes" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Histórico (últimos até 17 ciclos) – SKU selecionado">
        <div className="flex items-center gap-2 mb-2 text-sm">
          <label htmlFor="skuSelect">SKU:</label>
          <select id="skuSelect" className="border rounded-md px-2 py-1" value={selectedSku || ""} onChange={(e)=>setSelectedSku(e.target.value)}>
            {filtered.map((r)=>(<option key={r.CodigoProduto} value={r.CodigoProduto}>{r.CodigoProduto} — {(r.DescricaoProduto||"").slice(0,60)}</option>))}
          </select>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={selectedHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="ciclo" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="vendas" name="Vendas" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Tabela – Prioridades para Transferência (Top 100)">
        <div className="overflow-auto border rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["SKU","Descrição","Estoque Atual","Em Trânsito","Pendentes","Total Disp.","Média 17c","Pico (ciclo)","Pico (qtd)","Excesso","Promoção","Lançamento"].map((h)=>(
                  <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...filtered].sort((a,b)=>(b.ExcessoParaTransferir||0)-(a.ExcessoParaTransferir||0)).slice(0,100).map((r)=>(
                <tr key={r.CodigoProduto} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap">{r.CodigoProduto}</td>
                  <td className="px-3 py-2">{r.DescricaoProduto}</td>
                  <td className="px-3 py-2 text-right">{r.EstoqueAtual ?? 0}</td>
                  <td className="px-3 py-2 text-right">{r.EstoqueTransito ?? 0}</td>
                  <td className="px-3 py-2 text-right">{r.PedidosPendentes ?? 0}</td>
                  <td className="px-3 py-2 text-right">{r.EstoqueTotalDisponivel ?? 0}</td>
                  <td className="px-3 py-2 text-right">{Number((r.MediaVendas_17c_ou_Disponivel||0).toFixed(2))}</td>
                  <td className="px-3 py-2 text-right">{r.CicloPico || "-"}</td>
                  <td className="px-3 py-2 text-right">{r.QtdPico ?? 0}</td>
                  <td className="px-3 py-2 text-right">{r.ExcessoParaTransferir ?? 0}</td>
                  <td className="px-3 py-2">{r.PromocaoProxCiclo ? "Y":"N"}</td>
                  <td className="px-3 py-2">{r.EhLancamento ? "Y":"N"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="border rounded-xl p-4 shadow-sm">{children}</div>
    </motion.section>
  );
}

function Kpi({ title, value }) {
  return (
    <div className="border rounded-xl p-4 shadow-sm">
      <p className="text-xs opacity-70">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

// Helpers
function selectedHistoryData(historico, selectedSku) {
  if (!selectedSku) return [];
  const row = historico.find((h) => String(h.CodigoProduto) === String(selectedSku));
  if (!row) return [];
  const entries = Object.entries(row).filter(([k]) => k.toLowerCase().includes("historico de vendas do ciclo"));
  const parsed = entries
    .map(([k, v]) => {
      const m = k.match(/(\\d{6}|\\d{5}|\\d{4})/);
      const codigo = m ? m[1] : k;
      return { key: k, codigo: Number(codigo), ciclo: String(codigo), vendas: Number(v) || 0 };
    })
    .sort((a, b) => a.codigo - b.codigo)
    .slice(-17)
    .map((p) => ({ ciclo: p.ciclo, vendas: p.vendas }));
  return parsed;
}