"use client";

import React, { useCallback, useMemo, useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
} from "recharts";
import {
  Upload,
  Download,
  FileSpreadsheet,
  TrendingUp,
  Target,
  Users,
  Store,
  Award,
  AlertTriangle,
} from "lucide-react";

const COLORS = {
  bg: "#f3f5f7",
  panel: "#ffffff",
  panelAlt: "#f8fafc",
  border: "#d7dee7",
  text: "#0f172a",
  subtext: "#5b6777",
  navy: "#0b1733",
  navy2: "#122347",
  orange: "#f59e0b",
  orangeSoft: "#fff3d9",
  green: "#16a34a",
  red: "#dc2626",
  blue: "#7f9cc8",
};

const KNOWN_FILES = {
  lojaIndicadores: "loja_indicadores_de_loja",
  acaoFluxo: "acaodefluxo_performance_por_pdv_e_consultor",
  idCliente: "indicadores_id_cliente",
  itensBoleto: "loja_distribuicao_de_itens_por_boleto",
  fidelidadePenetracao: "programafidelidade_distribuicao_penetracao_boleto_fidelidade",
  fidelidadeResgate: "programafidelidade_distribuicao_%_boletos_com_resgate",
  treinamento: "treinamentoforcadevenda_visao_geral_treinamento_pessoa",
  servicos: "servicosloja_servicos_realizados",
  metas: "modelo-metas",
};

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeFileName(name) {
  return decodeURIComponent(name || "")
    .toLowerCase()
    .replace(/\.xlsx$/i, "")
    .replace(/^\d+_/, "");
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value).trim();
  if (!text) return 0;
  if (text.includes("%")) {
    const pct = Number(text.replace(/\./g, "").replace(",", ".").replace("%", ""));
    return Number.isFinite(pct) ? pct / 100 : 0;
  }
  const parsed = Number(text.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value || 0);
}

function formatPercent(value, digits = 2) {
  return `${formatNumber((value || 0) * 100, digits)}%`;
}

function scoreColor(score) {
  if (score >= 1) return COLORS.green;
  if (score >= 0.9) return COLORS.orange;
  return COLORS.red;
}

function scoreLabel(score) {
  if (score >= 1) return "Acima da meta";
  if (score >= 0.9) return "Em atenção";
  return "Abaixo da meta";
}

function sheetRows(sheet) {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
}

function findHeaderIndex(rows, matcher) {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i].map((cell) => normalizeName(cell));
    if (matcher(row)) return i;
  }
  return -1;
}

function buildObjects(rows, headerIndex) {
  if (headerIndex < 0 || !rows[headerIndex]) return [];
  const headers = rows[headerIndex].map((h, idx) => normalizeName(h) || `COL_${idx + 1}`);
  return rows
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => cell !== null && cell !== ""))
    .map((row) => {
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = row[idx] ?? null;
      });
      return obj;
    });
}

function inferMonthFromWorkbook(workbook, fallbackName = "") {
  const allText = workbook.SheetNames.flatMap((sheetName) => {
    const rows = sheetRows(workbook.Sheets[sheetName]).slice(0, 10);
    return rows.flat().map((v) => String(v ?? ""));
  }).join(" ");

  const range = allText.match(/(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2})\/(\d{2})\/(\d{4})/);
  if (range) return `${range[2]}/${range[3]}`;

  const fromName = fallbackName.match(/(2026|2025|2024)(\d{2})(\d{2})/);
  if (fromName) return `${fromName[2]}/${fromName[1]}`;

  return "Período";
}

function parseLojaIndicadores(workbook, fileName) {
  const sheet = workbook.Sheets["CONSULTOR"];
  if (!sheet) return [];
  const rows = sheetRows(sheet);
  const headerIndex = findHeaderIndex(rows, (row) => row.includes("CONSULTOR") && row.includes("RECEITA (R$)"));
  const items = buildObjects(rows, headerIndex);
  const monthKey = inferMonthFromWorkbook(workbook, fileName);

  return items
    .filter((row) => row.CONSULTOR && normalizeName(row.CONSULTOR) !== "TOTAL")
    .map((row) => ({
      pdv: String(row.PDV ?? ""),
      consultorKey: normalizeName(row.CONSULTOR),
      consultor: String(row.CONSULTOR ?? ""),
      monthKey,
      receita: toNumber(row["RECEITA (R$)"]),
      boletos: toNumber(row["QUANTIDADE DE BOLETOS"]),
      boletosB1: toNumber(row["QUANTIDADE DE BOLETOS B1"]),
      boletoMedio: toNumber(row["BOLETO MEDIO"] || row["BOLETO MÉDIO"]),
      itens: toNumber(row["QUANTIDADE DE ITENS"]),
      itensPorBoleto: toNumber(row["ITENS POR BOLETO"]),
      precoMedio: toNumber(row["PRECO MEDIO"] || row["PREÇO MÉDIO"]),
    }));
}

function parseAcaoFluxo(workbook, fileName) {
  const sheet = workbook.Sheets["CONSULTOR"];
  if (!sheet) return [];
  const rows = sheetRows(sheet);
  const headerIndex = findHeaderIndex(rows, (row) => row.includes("CONSULTOR") && row.includes("RESGATES"));
  const items = buildObjects(rows, headerIndex);
  const monthKey = inferMonthFromWorkbook(workbook, fileName);

  return items
    .filter((row) => row.CONSULTOR && normalizeName(row.CONSULTOR) !== "TOTAL")
    .map((row) => ({
      pdv: String(row.PDV ?? ""),
      consultorKey: normalizeName(row.CONSULTOR),
      consultor: String(row.CONSULTOR ?? ""),
      monthKey,
      resgates: toNumber(row.RESGATES),
      conversoes: toNumber(row.CONVERSOES),
    }));
}

function parseIdCliente(workbook, fileName) {
  const sheet = workbook.Sheets["CONSULTOR"];
  if (!sheet) return [];
  const rows = sheetRows(sheet);
  const headerIndex = findHeaderIndex(rows, (row) => row.includes("CONSULTOR") && row.includes("ATENDIMENTOS NO ID CLIENTE"));
  const items = buildObjects(rows, headerIndex);
  const monthKey = inferMonthFromWorkbook(workbook, fileName);

  return items
    .filter((row) => row.CONSULTOR)
    .map((row) => ({
      pdv: String(row.PDV ?? ""),
      consultorKey: normalizeName(row.CONSULTOR),
      consultor: String(row.CONSULTOR ?? ""),
      monthKey,
      atendimentosId: toNumber(row["ATENDIMENTOS NO ID CLIENTE"]),
      cpfPercent: toNumber(row["% ATENDIMENTOS COM CPF (IAF 2026)"]),
      boletosValidosIaf: toNumber(row["% BOLETOS ID CLIENTE VALIDOS (IAF)"] || row["% BOLETOS ID CLIENTE VÁLIDOS (IAF)"]),
    }));
}

function parseItensBoleto(workbook, fileName) {
  const sheet = workbook.Sheets["CONSULTOR"];
  if (!sheet) return [];
  const rows = sheetRows(sheet);
  const headerIndex = findHeaderIndex(rows, (row) => row.includes("CONSULTOR") && row.includes("TOTAL"));
  const items = buildObjects(rows, headerIndex);
  const monthKey = inferMonthFromWorkbook(workbook, fileName);

  return items
    .filter((row) => row.CONSULTOR)
    .map((row) => ({
      consultorKey: normalizeName(row.CONSULTOR),
      consultor: String(row.CONSULTOR ?? ""),
      monthKey,
      boleto1Qtd: toNumber(row.QUANTIDADE),
      boleto1Pct: toNumber(row["PARTICIPACAO (%)"] || row["PARTICIPAÇÃO (%)"]),
    }));
}

function parseFidelidadePenetracao(workbook, fileName) {
  const sheet = workbook.Sheets["Consultor"] || workbook.Sheets["CONSULTOR"];
  if (!sheet) return [];
  const rows = sheetRows(sheet);
  const headerIndex = findHeaderIndex(rows, (row) => row.includes("CONSULTOR") || row.includes("QNT DE BOLETOS FIDELIDADE"));
  const items = buildObjects(rows, headerIndex);
  const monthKey = inferMonthFromWorkbook(workbook, fileName);

  return items
    .filter((row) => row.CONSULTOR || row.Consultor)
    .map((row) => ({
      consultorKey: normalizeName(row.CONSULTOR || row.Consultor),
      consultor: String(row.CONSULTOR || row.Consultor || ""),
      monthKey,
      fidelidadePenetracao: toNumber(row["% PENETRACAO DESAFIO FIDELIDADE"] || row["% PENETRAÇÃO DESAFIO FIDELIDADE"]),
    }));
}

function parseFidelidadeResgate(workbook, fileName) {
  const sheet = workbook.Sheets["CONSULTOR"];
  if (!sheet) return [];
  const rows = sheetRows(sheet);
  const headerIndex = findHeaderIndex(rows, (row) => row.includes("CP/PDV/CONSULTOR"));
  const items = buildObjects(rows, headerIndex);
  const monthKey = inferMonthFromWorkbook(workbook, fileName);

  return items
    .filter((row) => row["CP/PDV/CONSULTOR"] && normalizeName(row["CP/PDV/CONSULTOR"]) !== "TOTAL")
    .map((row) => ({
      consultorKey: normalizeName(row["CP/PDV/CONSULTOR"]),
      consultor: String(row["CP/PDV/CONSULTOR"] ?? ""),
      monthKey,
      fidelidadeResgatePct: toNumber(row["PERIODO ATUAL"] || row["PERÍODO ATUAL"]),
    }));
}

function parseTreinamento(workbook, fileName) {
  const sheet = workbook.Sheets["Visão geral de treinamentos"];
  if (!sheet) return [];
  const rows = sheetRows(sheet);
  const headerIndex = findHeaderIndex(rows, (row) => (row.includes("NOME") && row.includes("ADESAO IAF")) || row.includes("ADESÃO IAF"));
  const items = buildObjects(rows, headerIndex);
  const monthKey = inferMonthFromWorkbook(workbook, fileName);

  return items
    .filter((row) => row.NOME)
    .map((row) => ({
      pdv: String(row["CODIGO DE PDV"] || row["CÓDIGO DE PDV"] || ""),
      consultorKey: normalizeName(row.NOME),
      consultor: String(row.NOME ?? ""),
      monthKey,
      treinamento: toNumber(row["ADESAO IAF"] || row["ADESÃO IAF"]),
    }));
}

function parseServicos(workbook, fileName) {
  const sheet = workbook.Sheets["CONSULTOR"];
  if (!sheet) return [];
  const rows = sheetRows(sheet);
  const headerIndex = findHeaderIndex(rows, (row) => (row.includes("CONSULTOR") && row.includes("NOME DO SERVICO")) || row.includes("NOME DO SERVIÇO"));
  const items = buildObjects(rows, headerIndex);
  const monthKey = inferMonthFromWorkbook(workbook, fileName);

  return items
    .filter((row) => row.CONSULTOR)
    .map((row) => ({
      pdv: String(row.PDV ?? ""),
      consultorKey: normalizeName(row.CONSULTOR),
      consultor: String(row.CONSULTOR ?? ""),
      monthKey,
      quantidadeServicos: toNumber(row["QUANTIDADE DE SERVICOS COMPLETOS"] || row["QUANTIDADE DE SERVIÇOS COMPLETOS"]),
    }));
}


function parseMetas(workbook) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rows
    .filter((row) => row["Consultor"] || row["PDV"])
    .map((row) => ({
      pdv: String(row["PDV"] ?? "").trim(),
      consultorKey: normalizeName(row["Consultor"]),
      consultor: String(row["Consultor"] ?? "").trim(),
      metaReceita: toNumber(row["Meta Receita"]),
      metaTicketMedio: toNumber(row["Meta Ticket Medio"]),
      metaItensPorBoleto: toNumber(row["Meta Itens/Boleto"]),
      metaConversao: toNumber(row["Meta Conversao"]),
      metaB1: toNumber(row["Meta B1"]),
      metaFidelidadePenetracao: toNumber(row["Meta Fidelidade Penetracao"]),
      metaFidelidadeResgate: toNumber(row["Meta Fidelidade Resgate"]),
      metaTreinamento: toNumber(row["Meta Treinamento"]),
    }));
}

function exportarModeloMetas(rows) {
  const headers = [
    "PDV",
    "Consultor",
    "Meta Receita",
    "Meta Ticket Medio",
    "Meta Itens/Boleto",
    "Meta Conversao",
    "Meta B1",
    "Meta Fidelidade Penetracao",
    "Meta Fidelidade Resgate",
    "Meta Treinamento",
  ];

  const data = [
    headers,
    ...rows.map((row) => [
      row.pdv || "",
      row.consultor || "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [
    { wch: 12 }, { wch: 32 }, { wch: 14 }, { wch: 18 }, { wch: 18 },
    { wch: 16 }, { wch: 12 }, { wch: 28 }, { wch: 24 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Metas");
  XLSX.writeFile(wb, "modelo-metas-gerado.xlsx");
}

function parseWorkbook(fileName, workbook) {
  const normalized = normalizeFileName(fileName);
  if (normalized.includes(KNOWN_FILES.lojaIndicadores)) return { type: "lojaIndicadores", rows: parseLojaIndicadores(workbook, fileName) };
  if (normalized.includes(KNOWN_FILES.acaoFluxo)) return { type: "acaoFluxo", rows: parseAcaoFluxo(workbook, fileName) };
  if (normalized.includes(KNOWN_FILES.idCliente)) return { type: "idCliente", rows: parseIdCliente(workbook, fileName) };
  if (normalized.includes(KNOWN_FILES.itensBoleto)) return { type: "itensBoleto", rows: parseItensBoleto(workbook, fileName) };
  if (normalized.includes(KNOWN_FILES.fidelidadePenetracao)) return { type: "fidelidadePenetracao", rows: parseFidelidadePenetracao(workbook, fileName) };
  if (normalized.includes(KNOWN_FILES.fidelidadeResgate)) return { type: "fidelidadeResgate", rows: parseFidelidadeResgate(workbook, fileName) };
  if (normalized.includes(KNOWN_FILES.treinamento)) return { type: "treinamento", rows: parseTreinamento(workbook, fileName) };
  if (normalized.includes(KNOWN_FILES.servicos)) return { type: "servicos", rows: parseServicos(workbook, fileName) };
  if (normalized.includes(KNOWN_FILES.metas) || normalized.includes("metas")) return { type: "metas", rows: parseMetas(workbook) };
  return { type: "desconhecido", rows: [] };
}

function aggregateData(parsed) {
  const map = new Map();
  const timelineMap = new Map();

  const ensure = (key, label, pdv = "") => {
    if (!map.has(key)) {
      map.set(key, {
        consultorKey: key,
        consultor: label,
        pdv,
        receita: 0,
        boletos: 0,
        boletosB1: 0,
        itens: 0,
        resgates: 0,
        conversoes: 0,
        atendimentosId: 0,
        fidelidadePenetracao: null,
        fidelidadeResgatePct: null,
        treinamento: null,
        boletosValidosIaf: null,
        cpfPercent: null,
        ticketMedio: 0,
        precoMedio: 0,
        itensPorBoleto: 0,
        servicos: 0,
        metas: {
          receita: 0,
          ticketMedio: 0,
          itensPorBoleto: 0,
          conversao: 0,
          b1: 0,
          fidelidadePenetracao: 0,
          fidelidadeResgate: 0,
          treinamento: 0,
        },
      });
    }
    return map.get(key);
  };

  Object.entries(parsed).forEach(([type, rows]) => {
    rows.forEach((row) => {
      const key = row.consultorKey;
      if (!key) return;
      const target = ensure(key, row.consultor, row.pdv || "");
      if (!target.pdv && row.pdv) target.pdv = row.pdv;

      let monthItem = null;
      if (row.monthKey) {
        if (!timelineMap.has(key)) timelineMap.set(key, new Map());
        const monthMap = timelineMap.get(key);
        if (!monthMap.has(row.monthKey)) monthMap.set(row.monthKey, { monthKey: row.monthKey, receita: 0 });
        monthItem = monthMap.get(row.monthKey);
      }

      if (type === "lojaIndicadores") {
        target.receita += row.receita || 0;
        target.boletos += row.boletos || 0;
        target.boletosB1 += row.boletosB1 || 0;
        target.itens += row.itens || 0;
        target.ticketMedio = row.boletoMedio || target.ticketMedio;
        target.precoMedio = row.precoMedio || target.precoMedio;
        target.itensPorBoleto = row.itensPorBoleto || target.itensPorBoleto;
        if (monthItem) monthItem.receita += row.receita || 0;
      }
      if (type === "acaoFluxo") {
        target.resgates += row.resgates || 0;
        target.conversoes += row.conversoes || 0;
      }
      if (type === "idCliente") {
        target.atendimentosId += row.atendimentosId || 0;
        target.cpfPercent = row.cpfPercent || target.cpfPercent;
        target.boletosValidosIaf = row.boletosValidosIaf || target.boletosValidosIaf;
      }
      if (type === "itensBoleto") {
        target.boletosB1 = Math.max(target.boletosB1, row.boleto1Qtd || 0);
      }
      if (type === "fidelidadePenetracao") target.fidelidadePenetracao = row.fidelidadePenetracao ?? target.fidelidadePenetracao;
      if (type === "fidelidadeResgate") target.fidelidadeResgatePct = row.fidelidadeResgatePct ?? target.fidelidadeResgatePct;
      if (type === "treinamento") target.treinamento = row.treinamento ?? target.treinamento;
      if (type === "servicos") target.servicos += row.quantidadeServicos || 0;
      if (type === "metas") {
        target.metas = {
          receita: row.metaReceita || 0,
          ticketMedio: row.metaTicketMedio || 0,
          itensPorBoleto: row.metaItensPorBoleto || 0,
          conversao: row.metaConversao || 0,
          b1: row.metaB1 || 0,
          fidelidadePenetracao: row.metaFidelidadePenetracao || 0,
          fidelidadeResgate: row.metaFidelidadeResgate || 0,
          treinamento: row.metaTreinamento || 0,
        };
      }
    });
  });

  const ranked = Array.from(map.values()).map((item) => {
    const b1Pct = item.boletos > 0 ? item.boletosB1 / item.boletos : 0;
    const conversao = item.resgates > 0 ? item.conversoes / item.resgates : 0;
    const metas = item.metas || {};

    const scoreReceita = metas.receita > 0 ? Math.min(item.receita / metas.receita, 1.3) : (item.receita > 0 ? 1 : 0);
    const scoreTicket = metas.ticketMedio > 0 ? Math.min(item.ticketMedio / metas.ticketMedio, 1.3) : (item.ticketMedio ? Math.min(item.ticketMedio / 140, 1.3) : 0);
    const scoreItens = metas.itensPorBoleto > 0 ? Math.min(item.itensPorBoleto / metas.itensPorBoleto, 1.3) : (item.itensPorBoleto ? Math.min(item.itensPorBoleto / 2.2, 1.3) : 0);
    const scoreConversao = metas.conversao > 0 ? Math.min(conversao / metas.conversao, 1.3) : (conversao ? Math.min(conversao / 0.19, 1.3) : 0);
    const scoreB1 = metas.b1 > 0 ? Math.min(b1Pct / metas.b1, 1.3) : (b1Pct ? Math.min(b1Pct / 0.30, 1.3) : 0);
    const scoreFidelidadePenetracao = metas.fidelidadePenetracao > 0 ? Math.min((item.fidelidadePenetracao || 0) / metas.fidelidadePenetracao, 1.3) : (item.fidelidadePenetracao ? Math.min(item.fidelidadePenetracao / 0.16, 1.3) : 0);
    const scoreFidelidadeResgate = metas.fidelidadeResgate > 0 ? Math.min((item.fidelidadeResgatePct || 0) / metas.fidelidadeResgate, 1.3) : (item.fidelidadeResgatePct ? Math.min(item.fidelidadeResgatePct / 0.10, 1.3) : 0);
    const scoreTreinamento = metas.treinamento > 0 ? Math.min((item.treinamento || 0) / metas.treinamento, 1.3) : (item.treinamento || 0);

    const parts = [
      scoreReceita,
      scoreTicket,
      scoreItens,
      scoreConversao,
      scoreB1,
      scoreFidelidadePenetracao,
      scoreFidelidadeResgate,
      scoreTreinamento,
      item.cpfPercent ? Math.min(item.cpfPercent / 1, 1.3) : 0,
    ];

    const score = parts.reduce((a, b) => a + b, 0) / parts.length;
    return {
      ...item,
      b1Pct,
      conversao,
      score,
      scorePct: Math.min((score / 1.1) * 100, 100),
    };
  }).sort((a, b) => b.score - a.score);

  const monthSeries = ranked.flatMap((item) => {
    const mm = timelineMap.get(item.consultorKey) || new Map();
    return Array.from(mm.values()).map((m) => ({
      consultorKey: item.consultorKey,
      monthKey: m.monthKey,
      receita: m.receita,
      score: item.score * 100,
    }));
  });

  return { ranked, monthSeries };
}

function Card({ children, style }) {
  return <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 18, boxShadow: "0 4px 18px rgba(15,23,42,0.06)", ...style }}>{children}</div>;
}

function MetricCard({ title, value, subtitle, gaugeColor = COLORS.orange, percent = 0, icon }) {
  const Icon = icon;
  const safe = Math.max(0, Math.min(100, percent || 0));
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.text }}>{title}</div>
        {Icon ? <Icon size={18} color={COLORS.subtext} /> : null}
      </div>
      <div style={{ fontSize: 18, color: COLORS.subtext, marginBottom: 10 }}>{value}</div>
      <div style={{ height: 10, background: "#edf1f5", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${safe}%`, height: "100%", background: gaugeColor, borderRadius: 999 }} />
      </div>
      <div style={{ marginTop: 10, fontSize: 13, color: COLORS.subtext }}>{subtitle}</div>
    </Card>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.subtext, marginBottom: 8 }}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          height: 44,
          borderRadius: 12,
          border: `1px solid ${COLORS.border}`,
          padding: "0 14px",
          fontSize: 15,
          color: COLORS.text,
          background: "#fff",
          outline: "none",
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}


function exportarRelatorioConsultores(rows) {
  const headers = [
    "PDV",
    "Consultor",
    "Receita",
    "Meta Receita",
    "Ating. Receita",
    "Boletos",
    "B1",
    "Meta B1",
    "Ating. B1",
    "Boleto Medio",
    "Meta Boleto Medio",
    "Ating. Boleto Medio",
    "Itens/Boleto",
    "Meta Itens/Boleto",
    "Ating. Itens/Boleto",
    "Conversao",
    "Meta Conversao",
    "Ating. Conversao",
    "Fidelidade Penetracao",
    "Meta Fidelidade Penetracao",
    "Ating. Fidelidade Penetracao",
    "Fidelidade Resgate",
    "Meta Fidelidade Resgate",
    "Ating. Fidelidade Resgate",
    "Treinamento",
    "Meta Treinamento",
    "Ating. Treinamento",
    "Score",
    "Status"
  ];

  const pct = (value, meta) => (meta > 0 ? value / meta : null);

  const getStatus = (score) => {
    if (score >= 1) return "🟢 Acima da meta";
    if (score >= 0.9) return "🟡 Em atenção";
    return "🔴 Abaixo da meta";
  };

  const data = rows.map((item) => [
    item.pdv || "",
    item.consultor || "",
    item.receita || 0,
    item.metas?.receita || 0,
    pct(item.receita || 0, item.metas?.receita || 0),
    item.boletos || 0,
    item.b1Pct || 0,
    item.metas?.b1 || 0,
    pct(item.b1Pct || 0, item.metas?.b1 || 0),
    item.ticketMedio || 0,
    item.metas?.ticketMedio || 0,
    pct(item.ticketMedio || 0, item.metas?.ticketMedio || 0),
    item.itensPorBoleto || 0,
    item.metas?.itensPorBoleto || 0,
    pct(item.itensPorBoleto || 0, item.metas?.itensPorBoleto || 0),
    item.conversao || 0,
    item.metas?.conversao || 0,
    pct(item.conversao || 0, item.metas?.conversao || 0),
    item.fidelidadePenetracao || 0,
    item.metas?.fidelidadePenetracao || 0,
    pct(item.fidelidadePenetracao || 0, item.metas?.fidelidadePenetracao || 0),
    item.fidelidadeResgatePct || 0,
    item.metas?.fidelidadeResgate || 0,
    pct(item.fidelidadeResgatePct || 0, item.metas?.fidelidadeResgate || 0),
    item.treinamento || 0,
    item.metas?.treinamento || 0,
    pct(item.treinamento || 0, item.metas?.treinamento || 0),
    item.score || 0,
    getStatus(item.score || 0),
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

  ws["!cols"] = [
    { wch: 12 }, { wch: 32 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 },
    { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 16 },
    { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 24 },
    { wch: 22 }, { wch: 18 }, { wch: 22 }, { wch: 20 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 18 },
  ];

  const percentCols = [5, 8, 11, 14, 17, 20, 23, 26, 27];  // 1-based columns for attainment/score-like fields except score
  for (let rowIdx = 2; rowIdx <= data.length + 1; rowIdx++) {
    for (const col of percentCols) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx - 1, c: col - 1 });
      if (ws[cellRef] && typeof ws[cellRef].v === "number") {
        ws[cellRef].z = "0.0%";
      }
    }
    const scoreRef = XLSX.utils.encode_cell({ r: rowIdx - 1, c: 27 });
      }

  // format score column as percentage
  for (let rowIdx = 2; rowIdx <= data.length + 1; rowIdx++) {
    const scoreRef = XLSX.utils.encode_cell({ r: rowIdx - 1, c: 27 });
    if (ws[scoreRef] && typeof ws[scoreRef].v === "number") {
      ws[scoreRef].z = "0.0%";
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, "Relatorio Consultores");
  XLSX.writeFile(wb, "relatorio-consultores.xlsx");
}


export default function Page() {
  const [parsed, setParsed] = useState({
    lojaIndicadores: [],
    acaoFluxo: [],
    idCliente: [],
    itensBoleto: [],
    fidelidadePenetracao: [],
    fidelidadeResgate: [],
    treinamento: [],
    servicos: [],
    metas: [],
  });
  const [filesLoaded, setFilesLoaded] = useState([]);
  const [fPdv, setFPdv] = useState("todos");
  const [fConsultor, setFConsultor] = useState("todos");
  const [metricTab, setMetricTab] = useState("score");
  const [rankingType, setRankingType] = useState("consultor");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);

  const handleFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);
    const next = {
      lojaIndicadores: [],
      acaoFluxo: [],
      idCliente: [],
      itensBoleto: [],
      fidelidadePenetracao: [],
      fidelidadeResgate: [],
      treinamento: [],
      servicos: [],
      metas: [],
    };

    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const parsedFile = parseWorkbook(file.name, workbook);
      if (parsedFile.type !== "desconhecido") {
        next[parsedFile.type] = [...next[parsedFile.type], ...parsedFile.rows];
      }
    }

    setParsed(next);
    setFilesLoaded(files.map((f) => f.name));
  }, []);


  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    setIsDragging(true);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length) {
      handleFiles(files);
    }
  }, [handleFiles]);



  const aggregated = useMemo(() => aggregateData(parsed), [parsed]);

  const pdvs = useMemo(() => Array.from(new Set(aggregated.ranked.map((i) => i.pdv).filter(Boolean))).sort(), [aggregated]);

  const consultores = useMemo(() => {
    return aggregated.ranked
      .filter((item) => fPdv === "todos" || item.pdv === fPdv)
      .map((item) => item.consultor)
      .sort((a, b) => a.localeCompare(b));
  }, [aggregated, fPdv]);

  const filtered = useMemo(() => {
    return aggregated.ranked.filter((item) => {
      if (fPdv !== "todos" && item.pdv !== fPdv) return false;
      if (fConsultor !== "todos" && item.consultor !== fConsultor) return false;
      return true;
    });
  }, [aggregated, fPdv, fConsultor]);

  const current = filtered[0] || null;

  const average = useMemo(() => {
    if (!filtered.length) return null;
    const total = filtered.reduce((acc, item) => {
      acc.receita += item.receita;
      acc.score += item.score;
      acc.conv += item.conversao;
      acc.b1 += item.b1Pct;
      acc.ticket += item.ticketMedio;
      return acc;
    }, { receita: 0, score: 0, conv: 0, b1: 0, ticket: 0 });

    return {
      receita: total.receita / filtered.length,
      score: total.score / filtered.length,
      conv: total.conv / filtered.length,
      b1: total.b1 / filtered.length,
      ticket: total.ticket / filtered.length,
    };
  }, [filtered]);

  const monthlySeries = useMemo(() => {
    if (!current) return [];
    return aggregated.monthSeries
      .filter((item) => item.consultorKey === current.consultorKey)
      .sort((a, b) => String(a.monthKey || "").localeCompare(String(b.monthKey || "")));
  }, [aggregated, current]);

  
  const rankingPdvData = useMemo(() => {
    const map = new Map();
    filtered.forEach((item) => {
      if (!item.pdv) return;
      if (!map.has(item.pdv)) {
        map.set(item.pdv, {
          pdv: item.pdv,
          receita: 0,
          score: 0,
          conversao: 0,
          b1: 0,
          count: 0,
        });
      }
      const acc = map.get(item.pdv);
      acc.receita += item.receita;
      acc.score += item.score;
      acc.conversao += item.conversao;
      acc.b1 += item.b1Pct;
      acc.count += 1;
    });

    return Array.from(map.values())
      .map((i) => ({
        nome: i.pdv,
        valor:
          metricTab === "score" ? (i.score / i.count) * 100 :
          metricTab === "receita" ? i.receita :
          metricTab === "conversao" ? (i.conversao / i.count) * 100 :
          (i.b1 / i.count) * 100,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);
  }, [filtered, metricTab]);

  const rankingData = useMemo(() => {
    return filtered
      .map((item) => ({
        nome: item.consultor.split(" ").slice(0, 2).join(" "),
        valor:
          metricTab === "score" ? item.score * 100 :
          metricTab === "receita" ? item.receita :
          metricTab === "conversao" ? item.conversao * 100 :
          item.b1Pct * 100,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);
  }, [filtered, metricTab]);

  const baseMetas = useMemo(() => {
    return aggregated.ranked
      .map((item) => ({
        pdv: item.pdv || "",
        consultor: item.consultor || "",
      }))
      .filter((item) => item.consultor)
      .sort((a, b) => {
        const pdvCmp = String(a.pdv).localeCompare(String(b.pdv));
        if (pdvCmp !== 0) return pdvCmp;
        return String(a.consultor).localeCompare(String(b.consultor));
      });
  }, [aggregated]);


  const relatorioRows = useMemo(() => {
    return [...filtered].sort((a, b) => b.score - a.score);
  }, [filtered]);


  const noData = !aggregated.ranked.length;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text }}>
      <div style={{ background: COLORS.navy, borderBottom: `4px solid ${COLORS.orange}` }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "18px 22px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#d7e2f3" }}>BI Service</div>
          <div style={{ fontSize: 34, fontWeight: 900, color: "#fff", lineHeight: 1.1, marginTop: 4 }}>Dashboard Consultor</div>
          <div style={{ fontSize: 14, color: "#c7d3ea", marginTop: 6 }}>Visual no padrão executivo, com contraste forte e leitura limpa.</div>
        </div>
      </div>

      <div style={{ maxWidth: 1440, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 12, marginBottom: 12, alignItems: "stretch" }}>
          <Card style={{ padding: 10, background: `linear-gradient(135deg, ${COLORS.panel} 0%, ${COLORS.orangeSoft} 100%)`, minHeight: 92, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.subtext }}>Visão do consultor</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: COLORS.text, marginTop: 4, lineHeight: 1.1 }}>Performance consolidada</div>
          </Card>

          <Card style={{ padding: 10, minHeight: 92, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.subtext }}>Importar planilhas</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button
                  onClick={() => exportarModeloMetas(baseMetas)}
                  disabled={!baseMetas.length}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    border: `1px solid ${baseMetas.length ? COLORS.blue : COLORS.border}`,
                    background: baseMetas.length ? COLORS.blue : COLORS.panelAlt,
                    color: baseMetas.length ? "#fff" : COLORS.subtext,
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: baseMetas.length ? "pointer" : "not-allowed",
                    opacity: baseMetas.length ? 1 : 0.7,
                  }}
                  title="Gerar base de metas com todos os PDVs e consultores carregados"
                >
                  <Download size={14} />
                  Gerar base de metas
                </button>
                <button
                  onClick={() => exportarRelatorioConsultores(relatorioRows)}
                  disabled={!relatorioRows.length}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    border: `1px solid ${relatorioRows.length ? COLORS.green : COLORS.border}`,
                    background: relatorioRows.length ? COLORS.green : COLORS.panelAlt,
                    color: relatorioRows.length ? "#fff" : COLORS.subtext,
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: relatorioRows.length ? "pointer" : "not-allowed",
                    opacity: relatorioRows.length ? 1 : 0.7,
                  }}
                  title="Exportar relatório de consultores com resultados e status"
                >
                  <FileSpreadsheet size={14} />
                  Exportar relatório
                </button>
              </div>
            </div>
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? COLORS.blue : COLORS.border}`,
                background: isDragging ? "#eef4ff" : COLORS.panelAlt,
                borderRadius: 14,
                minHeight: 66,
                padding: "10px 12px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.15s ease",
                userSelect: "none",
              }}
            >
              <Upload size={18} color={isDragging ? COLORS.blue : COLORS.orange} />
              <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.text, marginTop: 4, pointerEvents: "none" }}>
                {isDragging ? "Solte os arquivos aqui" : "Selecionar ou arrastar arquivos .xlsx"}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".xlsx"
                style={{ display: "none" }}
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
            {!!filesLoaded.length && (
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ background: COLORS.orangeSoft, color: COLORS.text, border: `1px solid #f4d28a`, padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                  📁 {filesLoaded.length} {filesLoaded.length === 1 ? "arquivo carregado" : "arquivos carregados"}
                </span>
                <span style={{ background: COLORS.panelAlt, color: COLORS.text, border: `1px solid ${COLORS.border}`, padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                  🧾 {baseMetas.length} {baseMetas.length === 1 ? "linha para meta" : "linhas para metas"}
                </span>
                <span style={{ background: "#eefbf3", color: COLORS.text, border: `1px solid #b7e4c7`, padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                  📊 {relatorioRows.length} {relatorioRows.length === 1 ? "linha no relatório" : "linhas no relatório"}
                </span>
              </div>
            )}
          </Card>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 220px 260px", gap: 16, marginBottom: 16 }}>
          <Card style={{ padding: 16 }}>
            <SelectField label="PDV" value={fPdv} onChange={(value) => { setFPdv(value); setFConsultor("todos"); }} options={[{ value: "todos", label: "Todos" }, ...pdvs.map((p) => ({ value: p, label: p }))]} />
          </Card>
          <Card style={{ padding: 16 }}>
            <SelectField label="Consultor" value={fConsultor} onChange={setFConsultor} options={[{ value: "todos", label: "Todos" }, ...consultores.map((c) => ({ value: c, label: c }))]} />
          </Card>
          <Card style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.subtext }}>Consultores</div>
            <div style={{ fontSize: 34, fontWeight: 900, color: COLORS.text, marginTop: 12 }}>{filtered.length}</div>
          </Card>
          <Card style={{ padding: 16, background: current ? COLORS.panel : COLORS.panelAlt }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.subtext }}>Status do destaque</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: current ? scoreColor(current.score) : COLORS.subtext, marginTop: 10 }}>
              {current ? scoreLabel(current.score) : "Sem dados"}
            </div>
            <div style={{ fontSize: 13, color: COLORS.subtext, marginTop: 8, fontWeight: 700 }}>
              {current ? current.consultor : ""}
            </div>
          </Card>
        </div>

        {!noData && current ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 16, marginBottom: 16 }}>
              <MetricCard title="Receita" value={formatCurrency(current.receita)} subtitle={current.metas?.receita ? `Meta: ${formatCurrency(current.metas.receita)}` : `PDV ${current.pdv || "-"}`} percent={current.metas?.receita ? Math.min((current.receita / current.metas.receita) * 100, 100) : current.scorePct} gaugeColor={COLORS.orange} icon={TrendingUp} />
              <MetricCard title="Boletos" value={formatNumber(current.boletos)} subtitle={`B1: ${formatPercent(current.b1Pct)}`} percent={current.b1Pct * 100} gaugeColor={COLORS.green} icon={Target} />
              <MetricCard title="Boleto Médio" value={formatCurrency(current.ticketMedio)} subtitle={current.metas?.ticketMedio ? `Meta: ${formatCurrency(current.metas.ticketMedio)}` : `Preço médio: ${formatCurrency(current.precoMedio)}`} percent={current.metas?.ticketMedio ? Math.min((current.ticketMedio / current.metas.ticketMedio) * 100, 100) : (current.ticketMedio / 140) * 100} gaugeColor={COLORS.green} icon={Store} />
              <MetricCard title="Itens/Boleto" value={formatNumber(current.itensPorBoleto, 2)} subtitle={current.metas?.itensPorBoleto ? `Meta: ${formatNumber(current.metas.itensPorBoleto, 2)}` : `Itens: ${formatNumber(current.itens)}`} percent={current.metas?.itensPorBoleto ? Math.min((current.itensPorBoleto / current.metas.itensPorBoleto) * 100, 100) : (current.itensPorBoleto / 2.2) * 100} gaugeColor={COLORS.orange} icon={Users} />
              
<MetricCard
  title="Fidelidade - Penetração"
  value={formatPercent(current.fidelidadePenetracao || 0)}
  subtitle={current.metas?.fidelidadePenetracao ? `Meta: ${formatPercent(current.metas.fidelidadePenetracao)}` : "Desafio fidelidade"}
  percent={current.metas?.fidelidadePenetracao ? Math.min(((current.fidelidadePenetracao || 0) / current.metas.fidelidadePenetracao) * 100, 100) : (current.fidelidadePenetracao || 0) * 500}
  gaugeColor={COLORS.green}
  icon={Award}
/>

<MetricCard
  title="Fidelidade - Resgate"
  value={formatPercent(current.fidelidadeResgatePct || 0)}
  subtitle={current.metas?.fidelidadeResgate ? `Meta: ${formatPercent(current.metas.fidelidadeResgate)}` : "Uso de benefícios"}
  percent={current.metas?.fidelidadeResgate ? Math.min(((current.fidelidadeResgatePct || 0) / current.metas.fidelidadeResgate) * 100, 100) : (current.fidelidadeResgatePct || 0) * 500}
  gaugeColor={COLORS.orange}
  icon={Award}
/>

              <MetricCard title="Treinamento" value={formatPercent(current.treinamento || 0)} subtitle={current.metas?.treinamento ? `Meta: ${formatPercent(current.metas.treinamento)}` : `CPF válido IAF: ${formatPercent(current.boletosValidosIaf || 0)}`} percent={current.metas?.treinamento ? Math.min(((current.treinamento || 0) / current.metas.treinamento) * 100, 100) : (current.treinamento || 0) * 100} gaugeColor={COLORS.orange} icon={AlertTriangle} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.9fr", gap: 16, marginBottom: 16 }}>
              <Card style={{ padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>Ranking de consultores</div>
                    <div style={{ fontSize: 13, color: COLORS.subtext }}>Top 10 dentro do filtro atual</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "nowrap", width: "100%" }}>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button onClick={() => setRankingType("consultor")} style={{
                        border: `1px solid ${rankingType === "consultor" ? COLORS.blue : COLORS.border}`,
                        background: rankingType === "consultor" ? COLORS.blue : COLORS.panelAlt,
                        color: rankingType === "consultor" ? "#fff" : COLORS.text,
                        borderRadius: 999,
                        padding: "8px 14px",
                        fontWeight: 800,
                        cursor: "pointer"
                      }}>Consultores</button>
                      <button onClick={() => setRankingType("pdv")} style={{
                        border: `1px solid ${rankingType === "pdv" ? COLORS.blue : COLORS.border}`,
                        background: rankingType === "pdv" ? COLORS.blue : COLORS.panelAlt,
                        color: rankingType === "pdv" ? "#fff" : COLORS.text,
                        borderRadius: 999,
                        padding: "8px 14px",
                        fontWeight: 800,
                        cursor: "pointer"
                      }}>PDVs</button>
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "nowrap", flexShrink: 0 }}>
                    {[
                      ["score", "Score"],
                      ["receita", "Receita"],
                      ["conversao", "Conversão"],
                      ["b1", "B1"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setMetricTab(key)}
                        style={{
                          border: `1px solid ${metricTab === key ? COLORS.orange : COLORS.border}`,
                          background: metricTab === key ? COLORS.orange : COLORS.panelAlt,
                          color: metricTab === key ? "#fff" : COLORS.text,
                          borderRadius: 999,
                          padding: "8px 14px",
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                    </div>
                  </div>
                </div>
                <div style={{ height: 360 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rankingType === "consultor" ? rankingData : rankingPdvData} layout="vertical" margin={{ left: 30, right: 10, top: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="nome" type="category" width={120} />
                      <Tooltip formatter={(value) => metricTab === "receita" ? formatCurrency(Number(value)) : formatNumber(Number(value), 1)} />
                      <Bar dataKey="valor" fill={COLORS.blue} radius={[0, 12, 12, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card style={{ padding: 18 }}>
                <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 14 }}>Comparativo com a média</div>
                {average ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    {[
                      ["Receita", formatCurrency(current.receita), formatCurrency(average.receita), current.receita >= average.receita],
                      ["Score", formatPercent(current.score), formatPercent(average.score), current.score >= average.score],
                      ["Ticket médio", formatCurrency(current.ticketMedio), formatCurrency(average.ticket), current.ticketMedio >= average.ticket],
                      ["Conversão", formatPercent(current.conversao), formatPercent(average.conv), current.conversao >= average.conv],
                      ["B1", formatPercent(current.b1Pct), formatPercent(average.b1), current.b1Pct >= average.b1],
                    ].map(([label, mine, avg, ok]) => (
                      <div key={label} style={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 14 }}>
                        <div style={{ fontSize: 13, color: COLORS.subtext, fontWeight: 700 }}>{label}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                          <div style={{ fontWeight: 900, fontSize: 18 }}>{mine}</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: ok ? COLORS.green : COLORS.red }}>Média {avg}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <div style={{ color: COLORS.subtext }}>Sem base suficiente.</div>}
              </Card>
            </div>
          </>
        ) : (
          <Card style={{ padding: 28, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: COLORS.text }}>Importe as planilhas para começar</div>
            <div style={{ fontSize: 15, color: COLORS.subtext, marginTop: 8 }}>
              Esta versão foi refeita com contraste forte para ficar visível no seu projeto.
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
