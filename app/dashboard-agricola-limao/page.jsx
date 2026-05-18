"use client";

import "./agricola.css";
import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, LabelList, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ComposedChart, Customized, Rectangle,
} from "recharts";

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const COLORS = ["#4ade80", "#fb923c", "#60a5fa", "#a78bfa", "#facc15", "#22d3ee", "#f472b6", "#94a3b8"];
const EMPTY_FILTERS = { ano:"Todos", mes:"Todos", safra:"Todos", area:"Todos", categoria:"Todos", produto:"Todos", funcionario:"Todos", motivo:"Todos", tipo:"Todos" };

function norm(v){return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();}
function round2(v){return Math.round((Number(v||0)+Number.EPSILON)*100)/100;}
function money(v){return round2(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
function num(v,d=0){return round2(v).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});}
function perc(v){return `${num(v,1)}%`;}
function parseNumber(v){
  if(typeof v==="number") return Number.isFinite(v)?v:0;
  if(v==null||v==="") return 0;
  let s=String(v).trim().replace(/R\$/gi,"").replace(/\s/g,"");
  if(s.includes(",")) s=s.replace(/\./g,"").replace(",",".");
  const n=Number(s.replace(/[^0-9.-]/g,"")); return Number.isFinite(n)?n:0;
}
function parseDate(v){
  if(!v) return null;
  if(v instanceof Date && !isNaN(v)) return v;
  if(typeof v==="number"){const d=XLSX.SSF.parse_date_code(v); if(d) return new Date(d.y,d.m-1,d.d);}
  const s=String(v).trim(); const m=s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if(m){const yy=m[3].length===2?2000+Number(m[3]):Number(m[3]); return new Date(yy,Number(m[2])-1,Number(m[1]));}
  const d=new Date(s); return isNaN(d)?null:d;
}
function getCell(row, aliases){
  const keys=Object.keys(row||{});
  for(const a of aliases){
    const na=norm(a); const found=keys.find(k=>norm(k)===na || norm(k).includes(na) || na.includes(norm(k)));
    if(found) return row[found];
  }
  return "";
}
function tipoPadrao(v, sheetName, row){
  const raw=String(v||"").trim(); if(raw) return raw;
  const s=norm(sheetName+" "+Object.keys(row||{}).join(" ")+" "+Object.values(row||{}).slice(0,5).join(" "));
  if(s.includes("producao")||s.includes("caixa")||s.includes("colheita")) return "Produção";
  if(s.includes("funcionario")||s.includes("mao de obra")||s.includes("hora")) return "Mão de Obra";
  if(s.includes("produto")||s.includes("insumo")||s.includes("defensivo")||s.includes("adubo")) return "Insumos";
  return "Custos Gerais";
}
function buildRows(workbook, fileName){
  const out=[]; let params={pes:57520, pesPlantio:4102};
  workbook.SheetNames.forEach(sheetName=>{
    const ws=workbook.Sheets[sheetName];
    const rows=XLSX.utils.sheet_to_json(ws,{defval:"",raw:false});
    if(norm(sheetName).includes("param")){
      rows.forEach(r=>{const k=norm(getCell(r,["Parametro","Parâmetro","Indicador","Campo"])); const val=parseNumber(getCell(r,["Valor","Quantidade","Qtd"])); if(k.includes("total de pes")) params.pes=val||params.pes; if(k.includes("plantio")) params.pesPlantio=val||params.pesPlantio;});
      return;
    }
    rows.forEach((r,idx)=>{
      const dt=parseDate(getCell(r,["Data","Dt","Emissão","Emissao"]));
      let ano=String(getCell(r,["Ano"] )|| (dt?dt.getFullYear():"") || "Sem data");
      let mesTxt=String(getCell(r,["Mês","Mes"] )|| "").trim();
      let mesIndex=dt?dt.getMonth():MONTHS.findIndex(m=>norm(m)===norm(mesTxt));
      if(mesIndex<0) mesIndex=99; if(!mesTxt && mesIndex<12) mesTxt=MONTHS[mesIndex]; if(!mesTxt) mesTxt="Sem data";
      const tipo=tipoPadrao(getCell(r,["Tipo de Custo","Tipo","Grupo"]),sheetName,r);
      const categoria=String(getCell(r,["Categoria","Classe"] )|| tipo).trim() || tipo;
      const motivo=String(getCell(r,["Motivo / Aplicação","Motivo","Aplicação","Aplicacao","Atividade","Serviço","Servico"] )|| categoria).trim() || categoria;
      const produto=String(getCell(r,["Produto / Atividade","Produto","Atividade","Insumo","Defensivo","Material","Item","Descrição","Descricao"] )|| motivo).trim() || "Não informado";
      const funcionario=String(getCell(r,["Funcionário","Funcionario","Colaborador","Nome"] )|| "-").trim() || "-";
      const area=String(getCell(r,["Área / Poço","Area / Poco","Área","Area","Poço","Poco","Talhão","Talhao","Setor"] )|| "-").trim() || "-";
      const safra=String(getCell(r,["Safra"] )|| "Atual").trim() || "Atual";
      const unidade=String(getCell(r,["Unidade","Un"] )|| "").trim();
      const quantidade=parseNumber(getCell(r,["Quantidade","Qtd","Qtde","Caixas","Cx","Horas","Kg"]));
      const valorUnit=parseNumber(getCell(r,["Valor Unitário","Valor Unitario","Vl Unit","Unitário","Unitario","Preço","Preco"]));
      let valor=parseNumber(getCell(r,["Valor Total","Total","Valor","Vlr","Custo"])); if(!valor && quantidade && valorUnit) valor=quantidade*valorUnit; valor=round2(valor);
      const pesoKg=parseNumber(getCell(r,["Peso Total KG","Peso KG","KG Total","Peso"]));
      const plantioFlag=norm(getCell(r,["Plantio Novo","Plantio"]));
      const isPlantio=plantioFlag.includes("sim") || norm(sheetName+" "+fileName+" "+tipo+" "+categoria).includes("plantio");
      if(!valor && !quantidade && !produto) return;
      out.push({id:`${fileName}-${sheetName}-${idx}`, origem:fileName, aba:sheetName, data:dt?dt.toISOString().slice(0,10):"", ano, mes:mesTxt, mesIndex, safra, tipo, categoria, motivo, produto, funcionario, area, unidade, quantidade, valorUnit, valor, pesoKg, isPlantio, params});
    });
  });
  return out;
}
function unique(rows,key){return ["Todos",...Array.from(new Set(rows.map(r=>r[key]).filter(Boolean))).sort()];}
function groupSum(rows,key,top=10,field="valor"){const m=new Map(); rows.forEach(r=>m.set(r[key]||"Não informado",(m.get(r[key]||"Não informado")||0)+(r[field]||0))); return [...m.entries()].map(([name,value])=>({name,value:round2(value)})).sort((a,b)=>b.value-a.value).slice(0,top);}
function withColors(data){return data.map((item,i)=>({...item,fill:COLORS[i%COLORS.length]}));}
function Select({label,value,options,onChange}){return <label className="ag-field"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}>{options.map(op=><option key={op} value={op}>{op}</option>)}</select></label>;}
function Card({title,value,sub,icon}){return <div className="ag-card"><div className="ag-icon">{icon}</div><div><p>{title}</p><strong>{value}</strong><small>{sub}</small></div></div>;}
function ChartBox({title,children}){return <section className="ag-box"><h3>{title}</h3><div className="ag-chart">{children}</div></section>;}

function DonutCenterLabel({ total, active, cx = "50%", cy = "50%" }) {
  const label = active?.name || "Total";
  const value = active?.value ?? total;
  const pct = active && total ? (active.value / total) * 100 : null;

  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" pointerEvents="none">
      <tspan x={cx} dy={pct == null ? "-8" : "-18"} className="ag-donut-center-title">
        {label}
      </tspan>
      <tspan x={cx} dy="26" className="ag-donut-center-value">
        {money(value)}
      </tspan>
      {pct != null && (
        <tspan x={cx} dy="22" className="ag-donut-center-pct">
          {num(pct,1)}% do total
        </tspan>
      )}
    </text>
  );
}

function DonutCenterCustomized({ total, active }) {
  return (
    <Customized
      component={({ width, height }) => (
        <DonutCenterLabel
          total={total}
          active={active}
          cx={width / 2}
          cy={height / 2}
        />
      )}
    />
  );
}

function DonutCenterOverlay({ total }) {
  return (
    <div className="ag-donut-center-html">
      <strong>Total</strong>
      <span>{money(total)}</span>
    </div>
  );
}

function DonutLegend({ data, total }) {
  return (
    <div className="ag-donut-legend">
      {data.map((item, index) => {
        const pct = total ? (item.value / total) * 100 : 0;
        return (
          <div className="ag-donut-legend-item" key={`${item.name}-${index}`}>
            <span className="ag-donut-legend-dot" style={{ background: item.fill }} />
            <div>
              <strong>{item.name}</strong>
              <span>{money(item.value)} ({num(pct,1)}%)</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BarValueLabel({ x, y, width, value, color = "#f8fafc" }) {
  if (value == null) return null;
  return (
    <text
      x={x + width + 8}
      y={y + 13}
      className="ag-bar-value"
      textAnchor="start"
      style={{ fill: color }}
    >
      {money(value)}
    </text>
  );
}

function PowerBIActiveBar(props) {
  const { x = 0, y = 0, width = 0, height = 0, fill } = props;
  return (
    <Rectangle
      {...props}
      x={x - 2}
      y={y - 2}
      width={width + 5}
      height={height + 4}
      fill={fill}
      radius={[0, 10, 10, 0]}
      className="ag-bar-active"
    />
  );
}

function PremiumTooltip({ active, payload, label, metricName, fixedColor, valueFormatter }) {
  if (!active || !payload || !payload.length) return null;

  const rows = payload.filter(Boolean);
  const title = label || rows[0]?.payload?.name || rows[0]?.name || "Detalhe";

  return (
    <div className="ag-tooltip-premium-ui">
      <div className="ag-tooltip-title">{title}</div>
      <div className="ag-tooltip-lines">
        {rows.map((item, index) => {
          const color = fixedColor || item.color || item.stroke || item.fill || item?.payload?.fill || "#4ade80";
          const name = metricName || item.name || "Valor";
          const formatted = valueFormatter ? valueFormatter(item.value, item.name, item) : money(item.value);
          return (
            <div className="ag-tooltip-row" key={`${name}-${index}`}>
              <span className="ag-tooltip-name">{name}:</span>
              <strong className="ag-tooltip-value" style={{ color }}>{formatted}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BarTooltip({ active, payload, label, color = "#f8fafc" }) {
  return (
    <PremiumTooltip
      active={active}
      payload={payload}
      label={label}
      fixedColor={color}
      metricName="Valor"
    />
  );
}


function CleanPieTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0];
  const color = item?.payload?.fill || item?.color || "#ffffff";
  const totalValue = item?.payload?.total || 0;
  const pct = totalValue ? (Number(item.value || 0) / totalValue) * 100 : null;

  return (
    <div className="ag-clean-pie-tooltip" style={{ "--pieColor": color }}>
      <div className="ag-clean-pie-head">
        <span className="ag-clean-pie-dot" />
        <strong>{item.name}</strong>
      </div>
      <div className="ag-clean-pie-row"><span>Valor</span><b>{money(item.value)}</b></div>
      {pct != null && <div className="ag-clean-pie-row"><span>Participação</span><b>{num(pct,1)}%</b></div>}
    </div>
  );
}


export default function DashboardAgricolaLimao(){
  const [rows,setRows]=useState([]); const [files,setFiles]=useState([]); const [filters,setFilters]=useState(EMPTY_FILTERS); const [autoStatus,setAutoStatus]=useState("Aguardando leitura automática..."); const [lastUpdate,setLastUpdate]=useState(""); const [activeCat,setActiveCat]=useState(null); const [activePlantioCat,setActivePlantioCat]=useState(null);
  async function carregarAutomatico(){
    try{
<<<<<<< HEAD
      const fileName="agricola-demo.xlsx";
      setAutoStatus("Carregando dados demonstrativos online...");
      const res=await fetch(`/dados/${fileName}?t=${Date.now()}`,{cache:"no-store"});
      if(!res.ok){
        setRows([]);
        setFiles([]);
        setAutoStatus(`Erro: arquivo demonstrativo não encontrado em /public/dados/${fileName}`);
        return;
      }
=======
      setAutoStatus("Lendo arquivo da pasta C:\\Users\\BiService\\Desktop\\TESTE...");
      const res=await fetch(`/api/agricola-dados?t=${Date.now()}`,{cache:"no-store"});
      if(!res.ok){
        const msg=await res.text();
        setRows([]);
        setFiles([]);
        setAutoStatus(`Erro: ${msg || res.status}`);
        return;
      }
      const fileName=decodeURIComponent(res.headers.get("x-file-name")||"agricola.xlsx");
>>>>>>> dcd52f4 (atualiza projeto com supabase)
      const buffer=await res.arrayBuffer();
      const wb=XLSX.read(buffer,{type:"array",cellDates:true});
      const linhas=buildRows(wb,fileName);
      setRows(linhas);
<<<<<<< HEAD
      setFiles([`${fileName} (demo online)`]);
      setLastUpdate(new Date().toLocaleString("pt-BR"));
      setAutoStatus(`Dados demonstrativos carregados: ${fileName}`);
    }catch(err){
      setRows([]);
      setFiles([]);
      setAutoStatus(`Erro ao carregar demonstração: ${err?.message || err}`);
=======
      setFiles([`${fileName} (automático)`]);
      setLastUpdate(new Date().toLocaleString("pt-BR"));
      setAutoStatus(`Arquivo carregado automaticamente: ${fileName}`);
    }catch(err){
      setAutoStatus(`Erro na leitura automática: ${err?.message || err}`);
>>>>>>> dcd52f4 (atualiza projeto com supabase)
    }
  }

  useEffect(()=>{
    carregarAutomatico();
    const timer=setInterval(carregarAutomatico,30*60*1000);
    return ()=>clearInterval(timer);
  },[]);
  const filtered=useMemo(()=>rows.filter(r=>(filters.ano==="Todos"||r.ano===filters.ano)&&(filters.mes==="Todos"||r.mes===filters.mes)&&(filters.safra==="Todos"||r.safra===filters.safra)&&(filters.area==="Todos"||r.area===filters.area)&&(filters.categoria==="Todos"||r.categoria===filters.categoria)&&(filters.produto==="Todos"||r.produto===filters.produto)&&(filters.funcionario==="Todos"||r.funcionario===filters.funcionario)&&(filters.motivo==="Todos"||r.motivo===filters.motivo)&&(filters.tipo==="Todos"||r.tipo===filters.tipo)),[rows,filters]);
  const costRows=filtered.filter(r=>!norm(r.tipo).includes("producao"));
  const prodRows=filtered.filter(r=>norm(r.tipo).includes("producao")||norm(r.unidade).includes("cx")||norm(r.unidade).includes("caixa"));
  const total=costRows.reduce((s,r)=>s+r.valor,0), insumos=costRows.filter(r=>norm(r.tipo).includes("insumo")||r.isPlantio).reduce((s,r)=>s+r.valor,0), mao=costRows.filter(r=>norm(r.tipo).includes("mao")||norm(r.tipo).includes("mão")).reduce((s,r)=>s+r.valor,0), gerais=Math.max(0,total-insumos-mao);
  const producao=prodRows.reduce((s,r)=>s+(r.quantidade||0),0), pesoKg=prodRows.reduce((s,r)=>s+(r.pesoKg||0),0), pes=(rows.find(r=>r.params)?.params?.pes)||57520, pesPlantio=(rows.find(r=>r.params)?.params?.pesPlantio)||4102;
  const custoPe=pes?total/pes:0, custoCaixa=producao?total/producao:0;
  const mensal=useMemo(()=>MONTHS.map((m,i)=>{const rs=costRows.filter(r=>r.mesIndex===i), pr=prodRows.filter(r=>r.mesIndex===i); const t=rs.reduce((s,r)=>s+r.valor,0), cx=pr.reduce((s,r)=>s+r.quantidade,0); return {mes:m, Insumos:rs.filter(r=>norm(r.tipo).includes("insumo")||r.isPlantio).reduce((s,r)=>s+r.valor,0), "Mão de Obra":rs.filter(r=>norm(r.tipo).includes("mao")||norm(r.tipo).includes("mão")).reduce((s,r)=>s+r.valor,0), "Custos Gerais":Math.max(0,rs.reduce((s,r)=>s+r.valor,0)-rs.filter(r=>norm(r.tipo).includes("insumo")||r.isPlantio).reduce((s,r)=>s+r.valor,0)-rs.filter(r=>norm(r.tipo).includes("mao")||norm(r.tipo).includes("mão")).reduce((s,r)=>s+r.valor,0)), Total:t, Caixas:cx, "Custo por Caixa":cx?t/cx:0, "Custo por Pé":pes?t/pes:0};}),[filtered]);
  const cat=withColors(groupSum(costRows,"tipo",8)).map(d=>({...d,total})), topProd=groupSum(costRows,"produto",10), topMot=groupSum(costRows,"motivo",10), topFunc=groupSum(costRows.filter(r=>r.funcionario!=="-"),"funcionario",10);
  const plantio=costRows.filter(r=>r.isPlantio), plantioTotal=plantio.reduce((s,r)=>s+r.valor,0), plantioMensal=MONTHS.map((m,i)=>({mes:m,value:plantio.filter(r=>r.mesIndex===i).reduce((s,r)=>s+r.valor,0)})), plantioCat=withColors(groupSum(plantio,"categoria",8)).map(d=>({...d,total:plantioTotal})), plantioProd=groupSum(plantio,"produto",6);
  function clear(){setRows([]);setFiles([]);setFilters(EMPTY_FILTERS);} function resetFilters(){setFilters(EMPTY_FILTERS);} function exportCSV(){const header=["Data","Ano","Mês","Safra","Área / Poço","Tipo de Custo","Categoria","Produto / Atividade","Motivo / Aplicação","Quantidade","Unidade","Valor Unitário","Valor Total","Funcionário","Peso Total KG","Plantio Novo","Origem","Aba"]; const csv=[header.join(";"),...filtered.map(r=>[r.data,r.ano,r.mes,r.safra,r.area,r.tipo,r.categoria,r.produto,r.motivo,r.quantidade,r.unidade,r.valorUnit,r.valor,r.funcionario,r.pesoKg,r.isPlantio?"Sim":"Não",r.origem,r.aba].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(";"))].join("\n"); const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="dashboard-agricola-limao.csv"; a.click();}
  return <main className="ag-page">
    <header className="ag-top"><div className="ag-brand" style={{display:"flex",alignItems:"center",gap:"10px"}}>
  <img src="/logo-bi.png" alt="BI Service" style={{width:"32px",height:"32px",borderRadius:"6px",objectFit:"cover"}} />
  <span>BI Service Agrícola</span>
</div><div className="ag-menu">☰</div></header>
    <section className="ag-head"><div><h1>Dashboard Agrícola — Limão 🍋</h1><p>Visão completa de custos, produção, insumos, mão de obra e plantio.</p></div><div className="ag-actions"><button onClick={carregarAutomatico}>Atualizar Agora</button><button onClick={exportCSV} disabled={!filtered.length}>Exportar CSV</button><button onClick={clear}>Limpar</button></div></section>
    <section className="ag-auto"><strong>Atualização automática</strong><span>{autoStatus}</span><small>{lastUpdate?`Última atualização: ${lastUpdate}`:"Atualiza automaticamente a cada 30 minutos"}</small><em>{files.length?files.join(", "):"Nenhum arquivo carregado"}</em></section>
    <section className="ag-filters">
      <Select label="Ano" value={filters.ano} options={unique(rows,"ano")} onChange={v=>setFilters({...filters,ano:v})}/>
      <Select label="Mês" value={filters.mes} options={["Todos",...MONTHS]} onChange={v=>setFilters({...filters,mes:v})}/>
      <Select label="Safra" value={filters.safra} options={unique(rows,"safra")} onChange={v=>setFilters({...filters,safra:v})}/>
      <Select label="Área / Poço" value={filters.area} options={unique(rows,"area")} onChange={v=>setFilters({...filters,area:v})}/>
      <Select label="Categoria" value={filters.categoria} options={unique(rows,"categoria")} onChange={v=>setFilters({...filters,categoria:v})}/>
      <Select label="Produto" value={filters.produto} options={unique(rows,"produto")} onChange={v=>setFilters({...filters,produto:v})}/>
      <Select label="Funcionário" value={filters.funcionario} options={unique(rows,"funcionario")} onChange={v=>setFilters({...filters,funcionario:v})}/>
      <Select label="Motivo / Atividade" value={filters.motivo} options={unique(rows,"motivo")} onChange={v=>setFilters({...filters,motivo:v})}/>
      <Select label="Tipo de Custo" value={filters.tipo} options={unique(rows,"tipo")} onChange={v=>setFilters({...filters,tipo:v})}/>
      <button className="ag-clean" onClick={resetFilters}>Limpar Filtros</button>
    </section>
    <section className="ag-cards"><Card icon="💲" title="Total Gasto" value={money(total)} sub="100% do total"/><Card icon="🌳" title="Custo por Pé" value={money(custoPe)} sub={`${num(pes)} pés`}/><Card icon="📦" title="Custo por Caixa" value={money(custoCaixa)} sub={`${num(producao)} caixas`}/><Card icon="📊" title="Produção Total" value={`${num(producao)} cx`} sub={`${num(pesoKg)} kg`}/><Card icon="🧪" title="Total Insumos" value={money(insumos)} sub={total?`${perc(insumos/total*100)} do total`:"0%"}/><Card icon="👷" title="Mão de Obra" value={money(mao)} sub={total?`${perc(mao/total*100)} do total`:"0%"}/><Card icon="⚙️" title="Custos Gerais" value={money(gerais)} sub={total?`${perc(gerais/total*100)} do total`:"0%"}/></section>
    <section className="ag-grid ag-grid-2"><ChartBox title="Evolução Mensal dos Custos (R$)"><ResponsiveContainer><LineChart data={mensal}><CartesianGrid strokeDasharray="3 3" stroke="#263a55"/><XAxis dataKey="mes"/><YAxis tickFormatter={(v)=>num(v,0)}/><Tooltip cursor={false} content={<PremiumTooltip />} wrapperStyle={{ outline:"none", zIndex:30 }} /><Legend/><Line type="monotone" dataKey="Insumos" stroke="#4ade80" strokeWidth={3} dot={{r:4,fill:"#4ade80"}} activeDot={{r:7,stroke:"#f8fafc",strokeWidth:2}}/><Line type="monotone" dataKey="Mão de Obra" stroke="#fb923c" strokeWidth={3} dot={{r:4,fill:"#fb923c"}} activeDot={{r:7,stroke:"#f8fafc",strokeWidth:2}}/><Line type="monotone" dataKey="Custos Gerais" stroke="#a78bfa" strokeWidth={3} dot={{r:4,fill:"#a78bfa"}} activeDot={{r:7,stroke:"#f8fafc",strokeWidth:2}}/><Line type="monotone" dataKey="Total" stroke="#60a5fa" strokeWidth={4} dot={{r:5,fill:"#60a5fa"}} activeDot={{r:8,stroke:"#f8fafc",strokeWidth:2}}/></LineChart></ResponsiveContainer></ChartBox><section className="ag-box ag-donut-box"><h3>Custos por Categoria</h3><div className="ag-donut-layout"><div className="ag-donut-chart"><ResponsiveContainer><PieChart><defs><filter id="donutGlow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#000000" floodOpacity="0.55"/></filter></defs><Pie data={cat} dataKey="value" nameKey="name" innerRadius={76} outerRadius={125} paddingAngle={3} cornerRadius={4} label={false} filter="url(#donutGlow)" onMouseEnter={(data)=>setActiveCat(data)} onMouseLeave={()=>setActiveCat(null)}>{cat.map((d,i)=><Cell key={i} fill={d.fill} className="ag-donut-slice"/>)}</Pie><Tooltip cursor={false} content={<CleanPieTooltip/>} wrapperStyle={{ outline:"none", transform:"translate(28px, -12px)", zIndex:20 }}/></PieChart></ResponsiveContainer><DonutCenterOverlay total={total} active={activeCat}/></div><DonutLegend data={cat} total={total}/></div></section></section>
    <section className="ag-grid ag-grid-3"><ChartBox title="Top 10 Produtos por Custo (R$)"><ResponsiveContainer><BarChart data={topProd} layout="vertical" margin={{right:90,left:10}}><defs><linearGradient id="barGreen" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#22c55e"/><stop offset="100%" stopColor="#86efac"/></linearGradient></defs><XAxis type="number" tickFormatter={(v)=>num(v,0)}/><YAxis dataKey="name" type="category" width={150} interval={0} tick={{fontSize:12,fill:"#e5f2ff",fontWeight:800}}/><Tooltip cursor={false} content={<BarTooltip color="#86efac" />} wrapperStyle={{ outline:"none", zIndex:30 }} /><Bar dataKey="value" fill="url(#barGreen)" radius={[0,8,8,0]} isAnimationActive={true} animationBegin={80} animationDuration={1250} animationEasing="ease-out" activeBar={<PowerBIActiveBar/>}><LabelList dataKey="value" content={<BarValueLabel color="#86efac"/>} /></Bar></BarChart></ResponsiveContainer></ChartBox><ChartBox title="Top 10 Motivos / Atividades (R$)"><ResponsiveContainer><BarChart data={topMot} layout="vertical" margin={{right:90,left:10}}><defs><linearGradient id="barBlue" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#3b82f6"/><stop offset="100%" stopColor="#93c5fd"/></linearGradient></defs><XAxis type="number" tickFormatter={(v)=>num(v,0)}/><YAxis dataKey="name" type="category" width={150} interval={0} tick={{fontSize:12,fill:"#e5f2ff",fontWeight:800}}/><Tooltip cursor={false} content={<BarTooltip color="#93c5fd" />} wrapperStyle={{ outline:"none", zIndex:30 }} /><Bar dataKey="value" fill="url(#barBlue)" radius={[0,8,8,0]} isAnimationActive={true} animationBegin={130} animationDuration={1250} animationEasing="ease-out" activeBar={<PowerBIActiveBar/>}><LabelList dataKey="value" content={<BarValueLabel color="#93c5fd"/>} /></Bar></BarChart></ResponsiveContainer></ChartBox><ChartBox title="Mão de Obra por Funcionário (R$)"><ResponsiveContainer><BarChart data={topFunc} layout="vertical" margin={{right:90,left:10}}><defs><linearGradient id="barOrange" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#f97316"/><stop offset="100%" stopColor="#fdba74"/></linearGradient></defs><XAxis type="number" tickFormatter={(v)=>num(v,0)}/><YAxis dataKey="name" type="category" width={150} interval={0} tick={{fontSize:12,fill:"#e5f2ff",fontWeight:800}}/><Tooltip cursor={false} content={<BarTooltip color="#fdba74" />} wrapperStyle={{ outline:"none", zIndex:30 }} /><Bar dataKey="value" fill="url(#barOrange)" radius={[0,8,8,0]} isAnimationActive={true} animationBegin={180} animationDuration={1250} animationEasing="ease-out" activeBar={<PowerBIActiveBar/>}><LabelList dataKey="value" content={<BarValueLabel color="#fdba74"/>} /></Bar></BarChart></ResponsiveContainer></ChartBox></section>
    <section className="ag-grid ag-grid-3"><ChartBox title="Produção x Custo"><ResponsiveContainer><ComposedChart data={mensal}><CartesianGrid strokeDasharray="3 3" stroke="#263a55"/><XAxis dataKey="mes"/><YAxis yAxisId="left" tickFormatter={(v)=>num(v,0)}/><YAxis yAxisId="right" orientation="right" tickFormatter={(v)=>num(v,0)}/><Tooltip cursor={false} content={<PremiumTooltip valueFormatter={(v,name)=> name==='Caixas' ? num(v,0) : money(v)} />} wrapperStyle={{ outline:"none", zIndex:30 }} /><Legend/><Bar yAxisId="left" dataKey="Caixas" fill="#4ade80" radius={[7,7,0,0]}/><Bar yAxisId="right" dataKey="Total" fill="#60a5fa" radius={[7,7,0,0]}/><Line yAxisId="right" dataKey="Custo por Caixa" stroke="#fb923c" strokeWidth={3}/></ComposedChart></ResponsiveContainer></ChartBox><ChartBox title="Custo por Pé (R$)"><ResponsiveContainer><AreaChart data={mensal}><defs><linearGradient id="gradPe" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4ade80" stopOpacity={0.34}/><stop offset="95%" stopColor="#4ade80" stopOpacity={0.03}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#263a55"/><XAxis dataKey="mes"/><YAxis tickFormatter={(v)=>num(v,2)}/><Tooltip cursor={false} content={<PremiumTooltip />} wrapperStyle={{ outline:"none", zIndex:30 }} /><Area type="monotone" dataKey="Custo por Pé" stroke="#4ade80" fill="url(#gradPe)" strokeWidth={3} dot={{r:5,fill:"#4ade80",stroke:"#173b27",strokeWidth:2}} activeDot={{r:7,stroke:"#f8fafc",strokeWidth:2}} label={({x,y,value})=><text x={x} y={y-12} textAnchor="middle" className="ag-chart-value">{num(value,2)}</text>} isAnimationActive={true} animationDuration={1200} animationEasing="ease-out"/></AreaChart></ResponsiveContainer></ChartBox><ChartBox title="Custo por Caixa (R$)"><ResponsiveContainer><AreaChart data={mensal}><defs><linearGradient id="gradCaixa" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#fb923c" stopOpacity={0.34}/><stop offset="95%" stopColor="#fb923c" stopOpacity={0.03}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#263a55"/><XAxis dataKey="mes"/><YAxis tickFormatter={(v)=>num(v,0)}/><Tooltip cursor={false} content={<PremiumTooltip />} wrapperStyle={{ outline:"none", zIndex:30 }} /><Area type="monotone" dataKey="Custo por Caixa" stroke="#fb923c" fill="url(#gradCaixa)" strokeWidth={3} dot={{r:5,fill:"#fb923c",stroke:"#422006",strokeWidth:2}} activeDot={{r:7,stroke:"#f8fafc",strokeWidth:2}} label={({x,y,value})=><text x={x} y={y-12} textAnchor="middle" className="ag-chart-value">{num(value,2)}</text>} isAnimationActive={true} animationDuration={1200} animationEasing="ease-out"/></AreaChart></ResponsiveContainer></ChartBox></section>
    <section className="ag-plantio"><h2>🌱 Plantio Novo</h2><div className="ag-mini"><Card icon="💰" title="Total Gasto" value={money(plantioTotal)} sub="Plantio Novo"/><Card icon="🌳" title="Quantidade de Pés" value={num(pesPlantio)} sub="base parâmetros"/><Card icon="📌" title="Custo por Pé" value={money(pesPlantio?plantioTotal/pesPlantio:0)} sub="plantio novo"/><Card icon="📅" title="Período" value={plantio.length?`${plantio[0].mes}/${plantio[0].ano}`:"-"} sub="início detectado"/></div><div className="ag-grid ag-grid-plantio"><ChartBox title="Gasto Mensal no Plantio Novo (R$)"><ResponsiveContainer><AreaChart data={plantioMensal}><defs><linearGradient id="gradPlantio" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4ade80" stopOpacity={0.34}/><stop offset="95%" stopColor="#4ade80" stopOpacity={0.03}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#263a55"/><XAxis dataKey="mes"/><YAxis tickFormatter={(v)=>num(v,0)}/><Tooltip cursor={false} content={<PremiumTooltip />} wrapperStyle={{ outline:"none", zIndex:30 }} /><Area type="monotone" dataKey="value" name="Gasto" stroke="#4ade80" fill="url(#gradPlantio)" strokeWidth={3} dot={{r:5,fill:"#4ade80",stroke:"#173b27",strokeWidth:2}} activeDot={{r:7,stroke:"#f8fafc",strokeWidth:2}} isAnimationActive={true} animationDuration={1200} animationEasing="ease-out"/></AreaChart></ResponsiveContainer></ChartBox><ChartBox title="Custo por Tipo de Aplicação"><ResponsiveContainer><PieChart><defs><filter id="donutGlow2" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#000000" floodOpacity="0.55"/></filter></defs><Pie data={plantioCat} dataKey="value" nameKey="name" innerRadius={62} outerRadius={108} paddingAngle={3} cornerRadius={4} label={false} filter="url(#donutGlow2)" onMouseEnter={(data)=>setActivePlantioCat(data)} onMouseLeave={()=>setActivePlantioCat(null)}>{plantioCat.map((d,i)=><Cell key={i} fill={d.fill} className="ag-donut-slice"/>)}</Pie><Tooltip cursor={false} content={<CleanPieTooltip/>} wrapperStyle={{ outline:"none", transform:"translate(28px, -12px)", zIndex:20 }}/><Legend/></PieChart></ResponsiveContainer><DonutCenterOverlay total={plantioTotal} active={activePlantioCat}/></ChartBox><ChartBox title="Produtos Mais Utilizados (R$)"><ResponsiveContainer><BarChart data={plantioProd} layout="vertical" margin={{right:90,left:10}}><defs><linearGradient id="barPlantio" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#22c55e"/><stop offset="100%" stopColor="#86efac"/></linearGradient></defs><XAxis type="number" tickFormatter={(v)=>num(v,0)}/><YAxis dataKey="name" type="category" width={150} interval={0} tick={{fontSize:12,fill:"#e5f2ff",fontWeight:800}}/><Tooltip cursor={false} content={<BarTooltip color="#86efac" />} wrapperStyle={{ outline:"none", zIndex:30 }} /><Bar dataKey="value" fill="url(#barPlantio)" radius={[0,8,8,0]} isAnimationActive={true} animationBegin={220} animationDuration={1250} animationEasing="ease-out" activeBar={<PowerBIActiveBar/>}><LabelList dataKey="value" content={<BarValueLabel color="#86efac"/>} /></Bar></BarChart></ResponsiveContainer></ChartBox></div></section>
    <section className="ag-bottom"><section className="ag-table"><h3>Lançamentos Detalhados</h3><div><table><thead><tr><th>Data</th><th>Tipo</th><th>Produto / Atividade</th><th>Motivo / Aplicação</th><th>Quantidade</th><th>Unidade</th><th>Valor Unit.</th><th>Valor Total</th><th>Funcionário</th><th>Área / Poço</th></tr></thead><tbody>{filtered.slice(0,300).map(r=><tr key={r.id}><td>{r.data||"-"}</td><td>{r.tipo}</td><td>{r.produto}</td><td>{r.motivo}</td><td>{num(r.quantidade,2)}</td><td>{r.unidade}</td><td>{money(r.valorUnit)}</td><td>{money(r.valor)}</td><td>{r.funcionario}</td><td>{r.area}</td></tr>)}</tbody></table></div><p>Total de registros: {filtered.length}</p></section><aside className="ag-resumo"><h3>Resumo Geral</h3><p><span>Total de Pés</span><b>{num(pes)}</b></p><p><span>Área Total (ha)</span><b>62,45</b></p><p><span>Produção Total</span><b>{num(producao)} cx</b></p><p><span>Peso Total (kg)</span><b>{num(pesoKg)}</b></p><p><span>Custo Total</span><b>{money(total)}</b></p><p><span>Custo por Pé</span><b>{money(custoPe)}</b></p><p><span>Custo por Caixa</span><b>{money(custoCaixa)}</b></p></aside></section>
  </main>;
}

