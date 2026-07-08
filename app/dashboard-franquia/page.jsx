"use client";

import React, { useMemo, useState } from "react";

const menuItems = [
  "Executivo", "Ticket Médio", "PA", "Meta", "Sellout", "DRE", "Margem", "Ruptura",
  "Consultores", "Campanhas", "Evolução Mensal", "Comparativos entre Lojas", "Ranking", "Metas por Vendedor"
];

const lojasBase = [
  { pdv: "4546", cidade: "Centro", receita: 124627.78, meta: 118000, boletos: 781, ticket: 159.57, itens: 1811, pa: 2.32, margem: .267, ruptura: .041, sellout: 124627.78, estoque: 485, conv: .1256 },
  { pdv: "19047", cidade: "Shopping", receita: 70654.14, meta: 85000, boletos: 500, ticket: 141.31, itens: 1270, pa: 2.54, margem: .229, ruptura: .073, sellout: 70654.14, estoque: 392, conv: .2914 },
  { pdv: "6268", cidade: "Monte Azul", receita: 52975.89, meta: 61000, boletos: 402, ticket: 131.78, itens: 886, pa: 2.20, margem: .211, ruptura: .086, sellout: 52975.89, estoque: 318, conv: .1572 },
  { pdv: "14225", cidade: "Pitangueiras", receita: 77254.62, meta: 73500, boletos: 590, ticket: 130.94, itens: 1149, pa: 1.95, margem: .198, ruptura: .092, sellout: 77254.62, estoque: 355, conv: .1424 },
  { pdv: "19049", cidade: "VD", receita: 168257.12, meta: 155000, boletos: 1159, ticket: 145.17, itens: 2661, pa: 2.30, margem: .245, ruptura: .052, sellout: 168257.12, estoque: 621, conv: .1627 },
  { pdv: "11378", cidade: "Viradouro", receita: 49687.42, meta: 54000, boletos: 380, ticket: 130.76, itens: 869, pa: 2.29, margem: .188, ruptura: .103, sellout: 49687.42, estoque: 274, conv: .2885 },
];

const consultores = [
  { nome: "Erica Paulino", loja: "Shopping", venda: 6952.95, meta: 6500, ticket: 85.84, pa: 1.52, conv: .3306 },
  { nome: "Emanuella Beatriz", loja: "Shopping", venda: 5896.40, meta: 6200, ticket: 81.89, pa: 1.57, conv: .2939 },
  { nome: "Cristina Costa", loja: "Pitangueiras", venda: 5174.32, meta: 5200, ticket: 114.98, pa: 1.91, conv: .1339 },
  { nome: "Adriana Amancio", loja: "Pitangueiras", venda: 4380.92, meta: 4500, ticket: 125.17, pa: 1.57, conv: .1522 },
  { nome: "Maria Fernanda", loja: "Viradouro", venda: 4257.19, meta: 4100, ticket: 85.14, pa: 1.76, conv: .3289 },
  { nome: "Mariele Garcia", loja: "VD", venda: 4210.67, meta: 4300, ticket: 105.27, pa: 1.60, conv: .1932 },
  { nome: "Mariana Aparecida", loja: "VD", venda: 3895.10, meta: 3900, ticket: 114.56, pa: 1.71, conv: .1809 },
  { nome: "Juliana Silva", loja: "Centro", venda: 3440.00, meta: 3500, ticket: 122.86, pa: 1.54, conv: .1667 },
];

const meses = [
  { mes: "Jan", receita: 1927499, lucro: 401000, meta: 2100000 }, { mes: "Fev", receita: 1827975, lucro: 386000, meta: 2100000 },
  { mes: "Mar", receita: 2181440, lucro: 456000, meta: 2250000 }, { mes: "Abr", receita: 2426190, lucro: 510000, meta: 2400000 },
  { mes: "Mai", receita: 3097526, lucro: 672000, meta: 3000000 }, { mes: "Jun", receita: 2601480, lucro: 552000, meta: 2700000 },
  { mes: "Jul", receita: 2746804, lucro: 574000, meta: 2800000 }, { mes: "Ago", receita: 2865108, lucro: 601000, meta: 2850000 },
  { mes: "Set", receita: 2669054, lucro: 548000, meta: 2750000 }, { mes: "Out", receita: 2897201, lucro: 620000, meta: 2900000 },
  { mes: "Nov", receita: 3014880, lucro: 648000, meta: 3100000 }, { mes: "Dez", receita: 3379120, lucro: 731000, meta: 3300000 },
];

const campanhas = [
  { nome: "Boleto Promocional", elegiveis: 1899, convertidos: 500, taxa: .2633, receita: 57166 },
  { nome: "Boleto Turbinado", elegiveis: 3800, convertidos: 934, taxa: .2455, receita: 98610 },
  { nome: "Fidelidade Resgate", elegiveis: 3642, convertidos: 2008, taxa: .5513, receita: 142700 },
  { nome: "Penetração Fidelidade", elegiveis: 3642, convertidos: 579, taxa: .1590, receita: 68440 },
];

const money = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);
const num = (v, d=0) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: d }).format(v || 0);
const pct = (v, d=1) => `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: d }).format((v || 0)*100)}%`;
const sum = (arr, k) => arr.reduce((a,b)=>a+(Number(b[k])||0),0);

function Kpi({ icon, label, value, sub, positive=true }){
  return <div className="kpi"><div className="ico">{icon}</div><div><span>{label}</span><strong>{value}</strong><small className={positive?"pos":"neg"}>{sub}</small></div></div>;
}
function Bars({ data, label="cidade", value="receita", formatter=money, max=8, danger=false }){
  const rows=[...data].sort((a,b)=>(b[value]||0)-(a[value]||0)).slice(0,max); const m=Math.max(...rows.map(r=>r[value]||0),1);
  return <div className="bars">{rows.map((r,i)=><div className="bar" key={i}><div className="barTop"><span>{r[label]}</span><b>{formatter(r[value])}</b></div><div className="track"><i className={danger?"danger":""} style={{width:`${((r[value]||0)/m)*100}%`}} /></div></div>)}</div>;
}
function Line({ data, y="receita" }){
  const W=760,H=250,P=26,max=Math.max(...data.map(d=>d[y])),min=Math.min(...data.map(d=>d[y]));
  const pts=data.map((d,i)=>`${P+i*(W-P*2)/(data.length-1)},${H-P-((d[y]-min)/Math.max(max-min,1))*(H-P*2)}`).join(" ");
  return <svg className="line" viewBox={`0 0 ${W} ${H}`}><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stopColor="#ffce45"/><stop offset="1" stopColor="#7ee35d"/></linearGradient></defs><polyline points={pts} fill="none" stroke="url(#g)" strokeWidth="5" strokeLinecap="round"/>{data.map((d,i)=>{const [x,yy]=pts.split(" ")[i].split(",").map(Number);return <g key={d.mes}><circle cx={x} cy={yy} r="5"/><text x={x} y={H-4} textAnchor="middle">{d.mes}</text></g>})}</svg>;
}
function Gauge({ value, label }){ const deg=Math.min(180,Math.max(0,value*180)); return <div className="gauge"><div className="arc"><span style={{transform:`rotate(${deg-90}deg)`}} /></div><strong>{pct(value,1)}</strong><small>{label}</small></div> }
function Table({ rows }){ return <table><thead><tr><th>Loja</th><th>Receita</th><th>Meta</th><th>% Meta</th><th>Ticket</th><th>PA</th><th>Margem</th></tr></thead><tbody>{rows.map(r=><tr key={r.pdv}><td>{r.cidade}</td><td>{money(r.receita)}</td><td>{money(r.meta)}</td><td className={r.receita>=r.meta?"pos":"neg"}>{pct(r.receita/r.meta,0)}</td><td>{money(r.ticket)}</td><td>{num(r.pa,2)}</td><td>{pct(r.margem)}</td></tr>)}</tbody></table> }
function Section({ active, lojas, receita, meta, ticket, pa, margem, ruptura }){
  const common = {
    "Ticket Médio": <><div className="grid2"><div className="panel"><h3>Ticket médio por loja</h3><Bars data={lojas} value="ticket" formatter={money}/></div><div className="panel"><h3>Diagnóstico</h3><Gauge value={ticket/147} label="meta de ticket"/><p>Mostra quais lojas precisam aumentar composição de cesta, combos e venda adicional.</p></div></div></>,
    "PA": <><div className="grid2"><div className="panel"><h3>PA / Itens por boleto</h3><Bars data={lojas} value="pa" formatter={(v)=>num(v,2)}/></div><div className="panel"><h3>Leitura rápida</h3><Gauge value={pa/2.41} label="meta PA"/><p>PA baixo indica venda muito unitária. Ideal para campanha de kits, adicionais e cuidados completos.</p></div></div></>,
    "Meta": <><div className="grid2"><div className="panel"><h3>Meta vs realizado por loja</h3><Bars data={lojas.map(l=>({...l, ating:l.receita/l.meta}))} value="ating" formatter={(v)=>pct(v,0)}/></div><div className="panel"><h3>Atingimento geral</h3><Gauge value={receita/meta} label="realizado no mês"/><p>Farol para o franqueado saber o quanto falta vender para bater a meta.</p></div></div></>,
    "Sellout": <><div className="grid2"><div className="panel"><h3>Sellout por loja</h3><Bars data={lojas} value="sellout" formatter={money}/></div><div className="panel"><h3>Campanhas que puxam sellout</h3>{campanhas.map(c=><div className="mini" key={c.nome}><b>{c.nome}</b><span>{money(c.receita)}</span></div>)}</div></div></>,
    "DRE": <><div className="grid2"><div className="panel"><h3>DRE resumido do mês</h3><div className="dre"><p><span>Receita Bruta</span><b>{money(receita)}</b></p><p><span>(-) Deduções</span><b>-{money(receita*.049)}</b></p><p><span>(-) CMV estimado</span><b>-{money(receita*.57)}</b></p><p><span>(-) Despesas</span><b>-{money(receita*.14)}</b></p><h2><span>Lucro líquido</span><b>{money(receita*.241)}</b></h2></div></div><div className="panel"><h3>Lucro por loja</h3><Bars data={lojas.map(l=>({...l,lucro:l.receita*l.margem}))} value="lucro" formatter={money}/></div></div></>,
    "Margem": <><div className="grid2"><div className="panel"><h3>Margem por loja</h3><Bars data={lojas} value="margem" formatter={(v)=>pct(v)}/></div><div className="panel"><h3>Margem média</h3><Gauge value={margem/.25} label="referência 25%"/><p>Ajuda a enxergar lojas que vendem bem, mas deixam pouco resultado.</p></div></div></>,
    "Ruptura": <><div className="grid2"><div className="panel"><h3>Ruptura estimada por loja</h3><Bars data={lojas} value="ruptura" formatter={(v)=>pct(v)} danger/></div><div className="panel"><h3>Estoque em atenção</h3><Bars data={lojas} value="estoque" formatter={(v)=>num(v)} /></div></div></>,
    "Consultores": <><div className="grid2"><div className="panel"><h3>Ranking de consultores</h3><Bars data={consultores} label="nome" value="venda" formatter={money}/></div><div className="panel"><h3>Performance individual</h3><table><tbody>{consultores.slice(0,6).map(c=><tr key={c.nome}><td>{c.nome}</td><td>{pct(c.venda/c.meta,0)}</td><td>{pct(c.conv)}</td></tr>)}</tbody></table></div></div></>,
    "Campanhas": <><div className="grid2"><div className="panel"><h3>Conversão por campanha</h3><Bars data={campanhas} label="nome" value="taxa" formatter={(v)=>pct(v)} /></div><div className="panel"><h3>Receita por campanha</h3><Bars data={campanhas} label="nome" value="receita" formatter={money}/></div></div></>,
    "Evolução Mensal": <><div className="panel"><h3>Evolução mensal completa</h3><Line data={meses}/></div></>,
    "Comparativos entre Lojas": <><div className="panel"><h3>Comparativo completo entre lojas</h3><Table rows={lojas}/></div></>,
    "Ranking": <><div className="grid2"><div className="panel"><h3>Ranking lojas</h3><Bars data={lojas}/></div><div className="panel"><h3>Ranking vendedores</h3><Bars data={consultores} label="nome" value="venda" formatter={money}/></div></div></>,
    "Metas por Vendedor": <><div className="panel"><h3>Metas por vendedor</h3><table><thead><tr><th>Consultor</th><th>Loja</th><th>Vendido</th><th>Meta</th><th>Atingimento</th></tr></thead><tbody>{consultores.map(c=><tr key={c.nome}><td>{c.nome}</td><td>{c.loja}</td><td>{money(c.venda)}</td><td>{money(c.meta)}</td><td className={c.venda>=c.meta?"pos":"neg"}>{pct(c.venda/c.meta,0)}</td></tr>)}</tbody></table></div></>,
  };
  if(active!=="Executivo") return common[active] || null;
  return <><div className="grid3"><div className="panel wide"><h3>Evolução mensal</h3><Line data={meses}/></div><div className="panel"><h3>Meta vs realizado</h3><Gauge value={receita/meta} label="realizado mês"/><div className="mini"><b>Meta</b><span>{money(meta)}</span></div><div className="mini"><b>Realizado</b><span>{money(receita)}</span></div></div></div><div className="grid3"><div className="panel"><h3>Ranking lojas</h3><Bars data={lojas}/></div><div className="panel"><h3>Consultores</h3><Bars data={consultores} label="nome" value="venda" formatter={money}/></div><div className="panel"><h3>Campanhas</h3><Bars data={campanhas} label="nome" value="taxa" formatter={(v)=>pct(v)}/></div></div><div className="panel"><h3>Comparativo entre lojas</h3><Table rows={lojas}/></div></>;
}

export default function DashboardFranquiaPro(){
  const [active,setActive]=useState("Executivo"); const [loja,setLoja]=useState("TODAS");
  const lojas=useMemo(()=>loja==="TODAS"?lojasBase:lojasBase.filter(l=>l.cidade===loja),[loja]);
  const receita=sum(lojas,"receita"), meta=sum(lojas,"meta"), boletos=sum(lojas,"boletos"), itens=sum(lojas,"itens");
  const ticket=receita/boletos, pa=itens/boletos, margem=lojas.reduce((a,l)=>a+l.margem,0)/lojas.length, ruptura=lojas.reduce((a,l)=>a+l.ruptura,0)/lojas.length;
  return <main className="wrap"><style jsx>{`
    .wrap{min-height:100vh;background:radial-gradient(circle at 80% 0,#241a05 0,#070707 34%,#030303 100%);color:#f5f2e8;font-family:Inter,Arial,sans-serif;display:flex}.side{width:250px;border-right:1px solid #3d2a0a;background:linear-gradient(180deg,#080808,#0e0b05);padding:22px 10px;position:sticky;top:0;height:100vh}.brand{display:flex;gap:12px;align-items:center;padding:0 14px 20px;border-bottom:1px solid #332306}.logo{font-size:31px;color:#ffc22e}.brand b{font-size:21px}.brand small{color:#ffc22e;font-weight:800}.nav{display:flex;flex-direction:column;gap:6px;margin-top:18px}.nav button{border:0;background:transparent;color:#d9d2c1;text-align:left;padding:12px 14px;border-radius:9px;font-weight:700;cursor:pointer}.nav button:hover,.nav .on{background:linear-gradient(90deg,#6b4b12,#1a1306);color:#fff}.content{flex:1;padding:20px 24px 28px}.top{display:flex;justify-content:space-between;gap:16px;align-items:start;border-bottom:1px solid #342405;padding-bottom:13px}.top h1{margin:0;font-size:26px}.top p{margin:4px 0 0;color:#bbb3a2}.filters{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:14px 0;background:linear-gradient(180deg,#171717,#0d0d0d);border:1px solid #2b2b2b;border-radius:10px;padding:12px}.field{border:1px solid #343434;border-radius:7px;background:#151515;padding:8px}.field label{display:block;font-size:10px;color:#c9c1af;text-transform:uppercase}.field select{width:100%;background:transparent;color:#fff;border:0;outline:0;margin-top:4px}.kpis{display:grid;grid-template-columns:repeat(7,1fr);gap:9px}.kpi{background:linear-gradient(180deg,#191919,#101010);border:1px solid #292929;border-radius:10px;padding:12px;display:flex;gap:10px;align-items:center;box-shadow:0 15px 35px #0008}.ico{width:41px;height:41px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,#ffce3a,#825100);font-size:20px}.kpi span{display:block;font-size:10px;color:#ddd;text-transform:uppercase}.kpi strong{font-size:19px;display:block;margin:3px 0}.kpi small,.pos{color:#70e45e}.neg{color:#ff6868}.grid3{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:10px;margin-top:10px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.panel{background:linear-gradient(180deg,#181818,#0d0d0d);border:1px solid #303030;border-radius:10px;padding:14px;box-shadow:0 15px 35px #0007}.wide{grid-column:span 2}.panel h3{margin:0 0 13px;font-size:15px;text-transform:uppercase}.bars{display:flex;flex-direction:column;gap:10px}.barTop{display:flex;justify-content:space-between;gap:10px;font-size:12px}.barTop span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.track{height:11px;background:#252525;border-radius:999px;overflow:hidden}.track i{height:100%;display:block;background:linear-gradient(90deg,#ffc13d,#a97310);border-radius:999px}.track i.danger{background:linear-gradient(90deg,#ff473d,#ffcf3d)}.line{height:250px;width:100%}.line circle{fill:#fff}.line text{font-size:12px;fill:#c9c1af}.gauge{text-align:center}.arc{height:112px;border-radius:120px 120px 0 0;background:conic-gradient(from 270deg,#65db4c 0 110deg,#ffcd2e 110deg 150deg,#eee 150deg 180deg,#222 180deg);position:relative;overflow:hidden}.arc:after{content:"";position:absolute;inset:28px 32px 0;background:#111;border-radius:100px 100px 0 0}.arc span{position:absolute;z-index:2;bottom:0;left:50%;width:4px;height:93px;background:#fff;transform-origin:bottom}.gauge strong{font-size:36px;display:block;margin-top:-26px;position:relative;z-index:3}.gauge small{color:#c8bfae}.mini,.dre p,.dre h2{display:flex;justify-content:space-between;border-bottom:1px solid #292929;padding:9px 0;margin:0}.dre h2{color:#79e45d}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:9px;border-bottom:1px solid #282828;text-align:left}th{color:#c9c1af;text-transform:uppercase;font-size:11px}@media(max-width:1200px){.kpis{grid-template-columns:repeat(2,1fr)}.grid2,.grid3{grid-template-columns:1fr}.wide{grid-column:auto}.filters{grid-template-columns:1fr 1fr}.side{position:relative;height:auto}.wrap{display:block}}`}</style>
    <aside className="side"><div className="brand"><div className="logo">▰▰▰</div><div><b>BI SERVICE</b><br/><small>ERP EDITION</small></div></div><nav className="nav">{menuItems.map(m=><button key={m} onClick={()=>setActive(m)} className={active===m?"on":""}> {m}</button>)}</nav></aside>
    <section className="content"><div className="top"><div><h1>DASHBOARD {active.toUpperCase()}</h1><p>Visão profissional separada por KPI, loja, campanha e vendedor.</p></div><div><small>Atualizado em:</small><br/><b>07/05/2025 08:45:30</b></div></div>
      <div className="filters"><div className="field"><label>Loja</label><select value={loja} onChange={e=>setLoja(e.target.value)}><option>TODAS</option>{lojasBase.map(l=><option key={l.cidade}>{l.cidade}</option>)}</select></div><div className="field"><label>Ano</label><select><option>2025</option></select></div><div className="field"><label>Mês</label><select><option>Maio</option><option>Abril</option></select></div><div className="field"><label>Consultor</label><select><option>Todos</option></select></div><div className="field"><label>Campanha</label><select><option>Todas</option></select></div></div>
      <div className="kpis"><Kpi icon="$" label="Faturamento" value={money(receita)} sub="↑ 18,6% vs anterior"/><Kpi icon="🎯" label="Meta" value={pct(receita/meta,0)} sub={`${money(meta)} mês`}/><Kpi icon="🧾" label="Ticket médio" value={money(ticket)} sub="meta R$ 147"/><Kpi icon="🛍️" label="PA" value={num(pa,2)} sub="itens por boleto"/><Kpi icon="📦" label="Sellout" value={money(sum(lojas,"sellout"))} sub="venda loja"/><Kpi icon="%" label="Margem" value={pct(margem)} sub="média"/><Kpi icon="⚠" label="Ruptura" value={pct(ruptura)} sub="atenção" positive={ruptura<.08}/></div>
      <Section active={active} lojas={lojas} receita={receita} meta={meta} ticket={ticket} pa={pa} margem={margem} ruptura={ruptura}/>
    </section></main>;
}
