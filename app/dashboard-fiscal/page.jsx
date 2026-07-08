"use client";

import React, { useMemo, useState } from "react";

const C_BLUE = "#3b82f6";
const C_GREEN = "#22c55e";
const C_AMBER = "#f59e0b";
const C_ROSE = "#ef4444";
const C_PURPLE = "#7c3aed";
const C_CYAN = "#06b6d4";
const C_CARD_BORDER = "rgba(255,255,255,0.10)";
const C_CARD_BG = "rgba(255,255,255,0.03)";
const C_TEXT = "#f8fafc";
const C_SUB = "#a8b3c7";

const produtosBase = [
  { produto: "Perfume XYZ", custo: 100, venda: 180, qtd: 120, credito: 12, imposto: 24 },
  { produto: "Produto A", custo: 80, venda: 150, qtd: 90, credito: 12, imposto: 18 },
  { produto: "Produto B", custo: 120, venda: 200, qtd: 75, credito: 12, imposto: 22 },
  { produto: "Produto C", custo: 150, venda: 250, qtd: 55, credito: 12, imposto: 20 },
  { produto: "Produto D", custo: 90, venda: 160, qtd: 140, credito: 12, imposto: 15 },
  { produto: "Produto E", custo: 135, venda: 230, qtd: 65, credito: 12, imposto: 24 },
];

const meses = [
  { mes: "Jan", valor: 18500 },
  { mes: "Fev", valor: 22100 },
  { mes: "Mar", valor: 16300 },
  { mes: "Abr", valor: 27400 },
  { mes: "Mai", valor: 37500 },
  { mes: "Jun", valor: 31200 },
];

const money = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const pct = (v) =>
  `${Number(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;

function CardBox({ title, right, children, className = "", style }) {
  return (
    <section className={`f-card ${className}`} style={style}>
      {(title || right) && (
        <div className="f-card-head">
          {title ? <h2>{title}</h2> : <span />}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

function MetricCard({ title, value, subtitle, color = C_AMBER, bars }) {
  const miniLine = bars || [18, 25, 22, 32, 28, 38, 41, 50, 46, 54, 61, 42, 39, 48, 43, 56];
  const min = Math.min(...miniLine);
  const max = Math.max(...miniLine);
  const range = Math.max(1, max - min);
  const points = miniLine
    .map((v, i) => {
      const x = (i / Math.max(1, miniLine.length - 1)) * 100;
      const y = 32 - ((v - min) / range) * 24;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const areaPoints = `0,34 ${points} 100,34`;

  return (
    <div className="metric-card">
      <div className="metric-title">{title}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-sub">{subtitle}</div>
      <svg className="metric-line" viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true">
        <polygon points={areaPoints} fill={color} opacity="0.16" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function Step({ title, value, detail, color = C_AMBER }) {
  return (
    <div className="flow-step" style={{ borderColor: `${color}55` }}>
      <span className="flow-title">{title}</span>
      <span className="flow-value">{value}</span>
      {detail ? <span className="flow-detail">{detail}</span> : null}
    </div>
  );
}

export default function FiscalTributarioPage() {
  const [credito, setCredito] = useState(12);
  const [imposto, setImposto] = useState(18);

  const linhas = useMemo(
    () =>
      produtosBase.map((p) => {
        const cred = p.custo * (p.credito / 100);
        const imp = p.venda * (p.imposto / 100);
        const liq = Math.max(0, imp - cred);
        const lucro = p.venda - p.custo - liq;
        const margem = p.venda ? (lucro / p.venda) * 100 : 0;
        return { ...p, cred, imp, liq, lucro, margem };
      }),
    []
  );

  const total = useMemo(() => {
    const compras = 1000000;
    const venda = 1250000;
    const creditos = 150000;
    const debito = 187500;
    const liquido = debito - creditos;
    const margemBruta = 420000;
    const margemLiquida = 282500;
    return { compras, venda, creditos, debito, liquido, margemBruta, margemLiquida };
  }, []);

  const sim = useMemo(() => {
    const creditos = total.compras * (credito / 100);
    const debito = total.venda * (imposto / 100);
    const liquido = Math.max(0, debito - creditos);
    const margemLiquida = total.venda ? ((total.venda - total.compras - liquido) / total.venda) * 100 : 0;
    return { creditos, debito, liquido, margemLiquida };
  }, [credito, imposto, total]);

  const maxMes = Math.max(...meses.map((m) => m.valor));
  const impactos = [...linhas].sort((a, b) => b.imposto - a.imposto).slice(0, 5);

  return (
    <main className="fiscal-page">
      <div className="f-filters f-filters-top">
          <select defaultValue="maio">
            <option value="maio">01/05/2024 - 31/05/2024</option>
          </select>
          <select defaultValue="todos">
            <option value="todos">Todos os Produtos</option>
          </select>
          <button type="button">↻ Atualizar Dados</button>
      </div>

      <section className="metric-grid">
        <MetricCard title="FATURAMENTO (VENDA)" value={money(total.venda)} subtitle="100% do total" color={C_PURPLE} />
        <MetricCard title="CRÉDITOS (RESSARCIMENTO)" value={money(total.creditos)} subtitle="12% sobre compras" color={C_GREEN} />
        <MetricCard title="IMPOSTO PREVISTO (DÉBITO)" value={money(total.debito)} subtitle="15% sobre vendas" color={C_ROSE} />
        <MetricCard title="IMPOSTO LÍQUIDO" value={money(total.liquido)} subtitle="Débito - Crédito" color={C_AMBER} />
        <MetricCard title="MARGEM BRUTA" value={money(total.margemBruta)} subtitle="33,60% sobre vendas" color={C_CYAN} />
        <MetricCard title="MARGEM LÍQUIDA" value={money(total.margemLiquida)} subtitle="22,60% sobre vendas" color={C_GREEN} />
      </section>

      <section className="main-grid">
        <CardBox title="FLUXO FISCAL DA OPERAÇÃO">
          <div className="flow-grid">
            <Step title="CUSTO DAS COMPRAS" value={money(total.compras)} color={C_PURPLE} />
            <span className="arrow">→</span>
            <Step title="CRÉDITOS RECEBIDOS" value={money(total.creditos)} detail="12%" color={C_GREEN} />
            <span className="arrow">→</span>
            <Step title="IMPOSTO NA VENDA" value={money(total.debito)} detail="15% - 24%" color={C_ROSE} />
            <span className="arrow">→</span>
            <Step title="IMPOSTO LÍQUIDO" value={money(total.liquido)} detail="A PAGAR" color={C_AMBER} />
            <span className="arrow">→</span>
            <Step title="LUCRO LÍQUIDO" value={money(total.margemLiquida)} detail="22,60%" color={C_BLUE} />
          </div>
          <div className="info-line">
            ⓘ Você recuperou {money(total.creditos)} em créditos e ainda terá que pagar {money(total.liquido)} de imposto líquido.
          </div>
        </CardBox>

        <CardBox title="IMPOSTO PREVISTO POR MÊS">
          <div className="bar-chart">
            {meses.map((m) => (
              <div className="bar-col" key={m.mes}>
                <em>{money(m.valor).replace(",00", "")}</em>
                <span style={{ height: `${(m.valor / maxMes) * 78}%` }} />
                <b>{m.mes}</b>
              </div>
            ))}
          </div>
        </CardBox>
      </section>

      <section className="content-grid">
        <CardBox
          title="SIMULAÇÃO POR PRODUTO"
          right={<button className="ghost-btn" type="button">Ver todos os produtos</button>}
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Custo Unit.</th>
                  <th>Venda Unit.</th>
                  <th>Crédito (12%)</th>
                  <th>Imposto (15% - 24%)</th>
                  <th>Imposto Líquido</th>
                  <th>Lucro Líquido</th>
                  <th>Margem Real</th>
                </tr>
              </thead>
              <tbody>
                {linhas.slice(0, 5).map((r) => (
                  <tr key={r.produto}>
                    <td>{r.produto}</td>
                    <td>{money(r.custo)}</td>
                    <td>{money(r.venda)}</td>
                    <td>{money(r.cred)}</td>
                    <td>{money(r.imp)}</td>
                    <td>{money(r.liq)}</td>
                    <td className="ok">{money(r.lucro)}</td>
                    <td className="ok">{pct(r.margem)}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td>TOTAL</td>
                  <td>{money(540)}</td>
                  <td>{money(940)}</td>
                  <td>{money(64.8)}</td>
                  <td>{money(220.8)}</td>
                  <td>{money(156)}</td>
                  <td className="ok">{money(203.6)}</td>
                  <td className="ok">24,10%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <small>* Alíquotas simuladas: Crédito 12% sobre compras | Imposto sobre vendas de 15% a 24%.</small>
        </CardBox>

        <CardBox title="PRODUTOS MAIS IMPACTADOS PELO IMPOSTO">
          <div className="impact-list">
            <div className="impact-header">
              <span>Produto</span>
              <span>Alíquota Efetiva</span>
              <span>Impacto no Preço</span>
              <span>Imposto Líquido</span>
            </div>
            {impactos.map((r) => (
              <div className="impact-row" key={r.produto}>
                <span>{r.produto}</span>
                <b>{r.imposto}%</b>
                <div className="track"><div style={{ width: `${r.imposto * 4}%` }} /></div>
                <strong>{money(r.liq)}</strong>
              </div>
            ))}
          </div>
        </CardBox>
      </section>

      <CardBox className="sim-card">
        <div className="sim-left">
          <div className="sim-title"><h2>SIMULADOR DE CENÁRIOS</h2></div>
          <div className="range-row">
            <label className="range-box">
              Alíquota de Crédito (Compras)
              <strong>{credito}%</strong>
              <input type="range" min="0" max="20" value={credito} onChange={(e) => setCredito(Number(e.target.value))} />
              <div><span>0%</span><span>20%</span></div>
            </label>
            <label className="range-box">
              Alíquota de Imposto (Vendas)
              <strong>{imposto}%</strong>
              <input type="range" min="12" max="24" value={imposto} onChange={(e) => setImposto(Number(e.target.value))} />
              <div><span>12%</span><span>24%</span></div>
            </label>
          </div>
        </div>
        <button className="calc-btn" type="button">↻ Recalcular<br />Cenário</button>
        <div className="results">
          <h3>RESULTADO DA SIMULAÇÃO</h3>
          <div className="result-grid">
            <p><small>Créditos Obtidos</small><b className="ok">{money(sim.creditos)}</b></p>
            <p><small>Imposto a Pagar</small><b className="bad">{money(sim.debito)}</b></p>
            <p><small>Imposto Líquido</small><b className="warn">{money(sim.liquido)}</b></p>
            <p><small>Margem Líquida</small><b className="ok">{pct(sim.margemLiquida)}</b></p>
          </div>
        </div>
        <button className="compare-btn" type="button">Comparar<br />Cenários</button>
      </CardBox>

      <style jsx global>{`
        .fiscal-page {
          width: 100%;
          min-height: 100vh;
          padding: 10px 12px 16px;
          box-sizing: border-box;
          background: #000000;
          color: ${C_TEXT};
          font-family: Inter, "Segoe UI", Arial, sans-serif;
          overflow-x: hidden;
          font-weight: 400;
        }

        .f-topbar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          padding: 0 0 10px;
          margin-bottom: 10px;
          border-bottom: 1px solid rgba(212,175,55,0.22);
        }

        .f-topbar h1 {
          margin: 0 0 7px;
          color: #ffffff;
          font-size: 20px;
          line-height: 1.05;
          font-weight: 700;
          letter-spacing: -0.2px;
        }

        .f-topbar p {
          margin: 0;
          color: ${C_SUB};
          font-size: 12px;
          line-height: 1.25;
          font-weight: 400;
        }

        .f-filters {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .f-filters-top {
          margin: 10px 0 14px 0;
          padding-top: 6px;
        }

        .f-filters select,
        .f-filters button,
        .ghost-btn,
        .calc-btn,
        .compare-btn {
          height: 34px;
          border-radius: 12px;
          border: 1px solid ${C_CARD_BORDER};
          background: #111111;
          color: #f8fafc;
          padding: 0 12px;
          font-size: 12px;
          font-weight: 600;
          outline: none;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        }

        .f-filters select { min-width: 190px; }
        .f-filters button {
          border-color: rgba(212,175,55,0.75);
          background: linear-gradient(135deg, #d4af37, #d99a12);
          color: #061018;
        }

        .calc-btn {
          border-color: rgba(212,175,55,0.45);
          background: rgba(255,255,255,0.03);
          color: #d4af37;
        }

        .metric-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 10px;
          margin-top: 18px;
          margin-bottom: 24px;
          padding-bottom: 2px;
        }

        .metric-card,
        .f-card {
          border: 1px solid ${C_CARD_BORDER};
          background: ${C_CARD_BG};
          border-radius: 16px;
          box-shadow: 0 10px 28px rgba(0,0,0,0.28);
          backdrop-filter: blur(2px);
        }

        .metric-card {
          height: 112px;
          min-height: 112px;
          padding: 10px 12px 0;
          overflow: hidden;
          position: relative;
          box-sizing: border-box;
        }

        .metric-title {
          color: rgba(255,255,255,0.70);
          font-size: 10px;
          line-height: 1.15;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.25px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .metric-value {
          margin-top: 10px;
          color: rgba(255,255,255,0.92);
          font-size: 21px;
          line-height: 1;
          font-weight: 550;
          letter-spacing: -0.35px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .metric-sub {
          margin-top: 8px;
          color: rgba(255,255,255,0.56);
          font-size: 10px;
          line-height: 1.1;
          font-weight: 400;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .metric-line {
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: 10px;
          width: calc(100% - 24px);
          height: 34px;
          overflow: visible;
          filter: drop-shadow(0 0 8px rgba(255,255,255,0.10));
          opacity: 0.95;
        }

        .f-card {
          padding: 12px 14px;
          min-width: 0;
          width: 100%;
          box-sizing: border-box;
        }

        .f-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }

        .f-card-head h2,
        .sim-title h2 {
          margin: 0;
          color: rgba(255,255,255,0.90);
          font-size: 13px;
          line-height: 1.1;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.15px;
        }

        .main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(360px, 0.85fr);
          gap: 10px;
          margin-top: 0;
          margin-bottom: 10px;
          clear: both;
        }

        .content-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(360px, 0.85fr);
          gap: 10px;
          margin-bottom: 10px;
        }

        .flow-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(112px, 1fr));
          gap: 8px 18px;
          align-items: center;
          position: relative;
        }

        .flow-step {
          min-height: 80px;
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 16px;
          background: rgba(255,255,255,0.035);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 7px;
          padding: 10px 8px;
          text-align: center;
        }

        .flow-title {
          color: rgba(255,255,255,0.78);
          font-size: 10px;
          line-height: 1.2;
          font-weight: 600;
          text-transform: uppercase;
        }

        .flow-value {
          color: #fff;
          font-size: 12px;
          line-height: 1;
          font-weight: 500;
          white-space: nowrap;
        }

        .flow-detail {
          color: rgba(255,255,255,0.60);
          font-size: 10px;
          line-height: 1;
          font-weight: 400;
        }

        .arrow {
          display: none;
        }

        .info-line {
          margin-top: 12px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 13px;
          background: rgba(255,255,255,0.025);
          color: ${C_SUB};
          padding: 9px 10px;
          font-size: 11px;
          line-height: 1.25;
          font-weight: 400;
        }

        .bar-chart {
          height: 174px;
          max-width: 640px;
          margin: 0 auto;
          border-bottom: 1px solid rgba(255,255,255,0.10);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 26px;
          padding: 10px 10px 0;
        }

        .bar-col {
          height: 100%;
          width: 58px;
          min-width: 58px;
          flex: 0 0 58px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          align-items: center;
          gap: 7px;
        }

        .bar-col em {
          color: rgba(255,255,255,0.86);
          font-size: 10px;
          font-style: normal;
          font-weight: 500;
          white-space: nowrap;
        }

        .bar-col span {
          width: 34px;
          border-radius: 0;
          background: #ef4444;
          box-shadow: none;
        }

        .bar-col b {
          color: rgba(255,255,255,0.72);
          font-size: 10px;
          font-weight: 500;
        }

        .ghost-btn {
          height: 30px;
          border-radius: 11px;
          background: rgba(255,255,255,0.04);
          font-size: 11px;
          color: rgba(255,255,255,0.86);
        }

        .table-wrap {
          width: 100%;
          overflow: auto;
          border-radius: 12px;
        }

        .table-wrap table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          color: rgba(255,255,255,0.86);
        }

        .table-wrap th,
        .table-wrap td {
          border-top: 1px solid rgba(255,255,255,0.08);
          border-right: 1px solid rgba(255,255,255,0.04);
          padding: 8px 8px;
          text-align: left;
          white-space: nowrap;
          font-weight: 400;
        }

        .table-wrap th {
          color: rgba(255,255,255,0.70);
          font-size: 10px;
          font-weight: 600;
          background: rgba(255,255,255,0.025);
        }

        .total-row td {
          background: rgba(212,175,55,0.065);
          font-weight: 600;
        }

        .ok { color: ${C_GREEN} !important; }
        .bad { color: ${C_ROSE} !important; }
        .warn { color: ${C_AMBER} !important; }

        .f-card small {
          display: block;
          margin-top: 9px;
          color: ${C_SUB};
          font-size: 11px;
          line-height: 1.25;
          font-weight: 400;
        }

        .impact-list {
          display: grid;
          gap: 11px;
          max-width: 620px;
          margin: 0 auto;
          padding-top: 4px;
        }

        .impact-header,
        .impact-row {
          display: grid;
          grid-template-columns: 115px 90px minmax(180px, 1fr) 105px;
          gap: 12px;
          align-items: center;
          font-size: 11px;
        }

        .impact-header {
          color: rgba(255,255,255,0.70);
          font-weight: 600;
          margin-bottom: 2px;
        }

        .impact-row {
          color: rgba(255,255,255,0.86);
          font-weight: 400;
        }

        .impact-row b {
          color: #fff;
          font-weight: 600;
        }

        .impact-row strong {
          color: #fff;
          text-align: right;
          font-weight: 500;
        }

        .track {
          height: 12px;
          border-radius: 0;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
          max-width: 260px;
          width: 100%;
        }

        .track div {
          height: 100%;
          border-radius: 0;
          background: #ef4444;
        }

        .sim-card {
          display: grid;
          grid-template-columns: 390px 108px minmax(0, 1fr) 128px;
          gap: 14px;
          align-items: center;
          padding-top: 10px;
          padding-bottom: 10px;
        }

        .sim-left {
          min-width: 0;
        }

        .range-row {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .range-box {
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.03);
          border-radius: 14px;
          padding: 7px 10px;
          color: rgba(255,255,255,0.74);
          font-size: 10px;
          font-weight: 500;
          height: 74px;
          box-sizing: border-box;
        }

        .range-box strong {
          display: block;
          color: #ffffff;
          text-align: center;
          font-size: 13px;
          font-weight: 550;
          margin: 4px 0 3px;
        }

        .range-box input {
          width: 100%;
          accent-color: #d4af37;
        }

        .range-box div {
          display: flex;
          justify-content: space-between;
          color: ${C_SUB};
          font-size: 10px;
          font-weight: 400;
        }

        .calc-btn,
        .compare-btn {
          height: 58px;
          border-radius: 14px;
          font-size: 10px;
          line-height: 1.15;
        }

        .compare-btn {
          border-color: rgba(212,175,55,0.45);
          background: rgba(255,255,255,0.03);
          color: #d4af37;
        }

        .sim-title h2 {
          margin-bottom: 8px;
        }

        .results h3 {
          margin: 0 0 8px;
          color: rgba(255,255,255,0.86);
          font-size: 11px;
          line-height: 1;
          font-weight: 600;
          text-transform: uppercase;
        }

        .result-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          background: rgba(255,255,255,0.025);
          overflow: hidden;
        }

        .result-grid p {
          margin: 0;
          padding: 10px 12px;
          border-right: 1px solid rgba(255,255,255,0.08);
        }

        .result-grid p:last-child { border-right: 0; }

        .result-grid small {
          display: block;
          margin-bottom: 8px;
          color: ${C_SUB};
          font-size: 10px;
          font-weight: 400;
        }

        .result-grid b {
          color: #fff;
          font-size: 15px;
          line-height: 1;
          font-weight: 550;
        }

        @media (max-width: 1320px) {
          .metric-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .main-grid, .content-grid { grid-template-columns: 1fr; }
          .sim-card { grid-template-columns: 1fr 1fr; }
          .sim-left, .results { grid-column: 1 / -1; }
        }

        @media (max-width: 760px) {
          .f-filters { margin-top: 12px; }
          .f-filters select, .f-filters button { width: 100%; }
          .metric-grid { grid-template-columns: 1fr; }
          .flow-grid { grid-template-columns: 1fr; }
          .sim-card { grid-template-columns: 1fr; }
          .bar-chart { gap: 10px; padding-left: 0; padding-right: 0; }
          .bar-col span { width: 32px; }
          .impact-header, .impact-row { grid-template-columns: 1fr 70px; }
          .impact-header span:nth-child(3), .impact-header span:nth-child(4), .impact-row .track, .impact-row strong { display: none; }
        }
      `}</style>
    </main>
  );
}
