"use client";

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  ReferenceLine,
  LabelList,
} from "recharts";
import {
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
  // Visual padrão Conferente: fundo preto real e cards escuros/neutros
  bg: "#000000",
  panel: "#050505",
  panelAlt: "#111111",
  border: "rgba(255,255,255,0.12)",
  text: "#f8fafc",
  subtext: "#a8b3c7",
  navy: "#000000",
  navy2: "#0a0a0a",
  orange: "#22c55e",
  orangeSoft: "rgba(34,197,94,0.12)",
  green: "#22c55e",
  red: "#ef4444",
  blue: "#60a5fa",
};

const CONSULTOR_STORAGE_KEY = "bi-service-consultor-last-upload-v2";

const EMPTY_PARSED = {
  lojaIndicadores: [],
  acaoFluxo: [],
  idCliente: [],
  itensBoleto: [],
  boletoPromocional: [],
  boletoTurbinado: [],
  penetracaoSkin: [],
  fidelidadePenetracao: [],
  fidelidadeResgate: [],
  treinamento: [],
  servicos: [],
  metas: [],
};

const KNOWN_FILES = {
  lojaIndicadores: "loja_indicadores_de_loja",
  acaoFluxo: "acaodefluxo_performance_por_pdv_e_consultor",
  idCliente: "indicadores_id_cliente",
  itensBoleto: "loja_distribuicao_de_itens_por_boleto",
  boletoPromocional: "loja_boleto promocional",
  boletoTurbinado: "loja_boleto turbinado",
  penetracaoSkin: "loja_cuidados_faciais_iaf",
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

  const cleaned = text
    .replace(/R\$/gi, "")
    .replace(/\s+/g, "")
    .replace(/[^\d,.%-]/g, "");

  if (!cleaned) return 0;

  if (cleaned.includes("%")) {
    const pct = Number(cleaned.replace(/\./g, "").replace(",", ".").replace("%", ""));
    return Number.isFinite(pct) ? pct / 100 : 0;
  }

  const parsed = Number(cleaned.replace(/\./g, "").replace(",", "."));
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
  if (score >= 0.9) return "#f59e0b";
  return COLORS.red;
}

function scoreLabel(score) {
  if (score >= 1) return "Acima da meta";
  if (score >= 0.9) return "Em atenção";
  return "Abaixo da meta";
}

function performanceColor(ratio) {
  if (ratio >= 1) return COLORS.green;
  if (ratio >= 0.9) return COLORS.orange;
  return COLORS.red;
}

function safeRatio(value, meta, fallback = 0) {
  if (meta > 0) return value / meta;
  return fallback;
}

function safeInverseRatio(value, meta, fallback = 0) {
  if (meta > 0 && value > 0) return meta / value;
  if (meta > 0 && value === 0) return 1.3;
  return fallback;
}

function inverseGaugePercent(value, meta) {
  if (!(meta > 0)) return 0;
  if (value <= 0) return 100;
  return Math.min((meta / value) * 100, 100);
}

function normalizeRatio(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  if (num > 1 && num <= 100) return num / 100;
  return num;
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
    const rows = sheetRows(workbook.Sheets[sheetName]).slice(0, 8);
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
      cpfPercent: normalizeRatio(toNumber(row["% ATENDIMENTOS COM CPF (IAF 2026)"])),
      boletosValidosIaf: normalizeRatio(toNumber(row["% BOLETOS ID CLIENTE VALIDOS (IAF)"] || row["% BOLETOS ID CLIENTE VÁLIDOS (IAF)"])),
    }));
}

function parseItensBoleto(workbook, fileName) {
  const sheet = workbook.Sheets["CONSULTOR"];
  if (!sheet) return [];
  const rows = sheetRows(sheet);
  const headerIndex = findHeaderIndex(rows, (row) => row.includes("CONSULTOR") && row.includes("TOTAL"));
  if (headerIndex < 0) return [];
  const monthKey = inferMonthFromWorkbook(workbook, fileName);

  const consultorIndex = 0; // coluna A
  const boleto1QtdIndex = 2; // coluna C
  const boleto1PctIndex = 3; // coluna D

  return rows
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => cell !== null && cell !== ""))
    .map((row) => {
      const consultorRaw = row[consultorIndex];
      return {
        consultorKey: normalizeName(consultorRaw),
        consultor: String(consultorRaw ?? ""),
        monthKey,
        boleto1Qtd: toNumber(row[boleto1QtdIndex]),
        boleto1Pct: normalizeRatio(toNumber(row[boleto1PctIndex])),
      };
    })
    .filter((row) => row.consultorKey && row.consultorKey !== "TOTAL");
}

function parseConsultorMetricByColumn(workbook, fileName, columnIndex, valueKey) {
  const sheet = workbook.Sheets["CONSULTOR"];
  if (!sheet) return [];
  const rows = sheetRows(sheet);
  const headerIndex = findHeaderIndex(rows, (row) => row.includes("CONSULTOR"));
  if (headerIndex < 0) return [];

  const headerRow = rows[headerIndex].map((cell) => normalizeName(cell));
  const consultorIndex = headerRow.findIndex((cell) => cell === "CONSULTOR");
  const pdvIndex = headerRow.findIndex((cell) => cell === "PDV");
  const monthKey = inferMonthFromWorkbook(workbook, fileName);

  return rows
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => cell !== null && cell !== ""))
    .map((row) => ({
      pdv: String((pdvIndex >= 0 ? row[pdvIndex] : "") ?? ""),
      consultorKey: normalizeName(consultorIndex >= 0 ? row[consultorIndex] : ""),
      consultor: String((consultorIndex >= 0 ? row[consultorIndex] : "") ?? ""),
      monthKey,
      [valueKey]: normalizeRatio(toNumber(row[columnIndex])),
    }))
    .filter((row) => row.consultorKey && row.consultorKey !== "TOTAL");
}

function parseBoletoPromocional(workbook, fileName) {
  return parseConsultorMetricByColumn(workbook, fileName, 5, "bpPct");
}

function parseBoletoTurbinado(workbook, fileName) {
  return parseConsultorMetricByColumn(workbook, fileName, 5, "btPct");
}

function parsePenetracaoSkin(workbook, fileName) {
  return parseConsultorMetricByColumn(workbook, fileName, 2, "skinPct");
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
      fidelidadePenetracao: normalizeRatio(toNumber(row["% PENETRACAO DESAFIO FIDELIDADE"] || row["% PENETRAÇÃO DESAFIO FIDELIDADE"])),
    }));
}

function parseFidelidadeResgate(workbook, fileName) {
  const sheet = workbook.Sheets["CONSULTOR"];
  if (!sheet) return [];
  const rows = sheetRows(sheet);
  const headerIndex = findHeaderIndex(rows, (row) => row.includes("CP/PDV/CONSULTOR"));
  if (headerIndex < 0) return [];

  const monthKey = inferMonthFromWorkbook(workbook, fileName);
  const consultorIndex = 0; // coluna A
  const periodoAtualIndex = 2; // coluna C

  return rows
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => cell !== null && cell !== ""))
    .map((row) => {
      const consultorRaw = row[consultorIndex];
      const resgateRaw = row[periodoAtualIndex];

      let parsed = 0;
      if (typeof resgateRaw === "number") {
        parsed = resgateRaw;
      } else {
        const txt = String(resgateRaw ?? "").trim();
        if (txt) {
          parsed = Number(txt.replace(",", "."));
        }
      }

      return {
        consultorKey: normalizeName(consultorRaw),
        consultor: String(consultorRaw ?? ""),
        monthKey,
        fidelidadeResgatePct: Number.isFinite(parsed) ? normalizeRatio(parsed) : 0,
      };
    })
    .filter((row) => row.consultorKey && row.consultorKey !== "TOTAL");
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
      treinamento: normalizeRatio(toNumber(row["ADESAO IAF"] || row["ADESÃO IAF"])),
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


function metaValue(row, aliases, formatter = toNumber) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias)) return formatter(row[alias]);
  }
  return formatter("");
}

function parseMetas(workbook) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  return rows
    .slice(1)
    .map((row) => ({
      pdv: String(row[0] ?? "").trim(),
      consultorKey: normalizeName(row[1]),
      consultor: String(row[1] ?? "").trim(),

      metaReceita: toNumber(row[2]),
      metaTicketMedio: toNumber(row[3]),
      metaItensPorBoleto: toNumber(row[4]),
      metaConversao: normalizeRatio(toNumber(row[5])),
      metaB1: normalizeRatio(toNumber(row[6])),

      // Colunas do arquivo metas.xlsx:
      // H = Meta Fidelidade Penetracao (0.20 = 20%)
      // I = Meta Fidelidade Resgate
      // J = Meta Treinamento
      // O = Meta Boleto Turbinado
      // P = Meta Boleto promocional
      // S = Skin
      metaFidelidadePenetracao: normalizeRatio(toNumber(row[7])),
      metaFidelidadeResgate: normalizeRatio(toNumber(row[8])),
      metaTreinamento: normalizeRatio(toNumber(row[9])),
      metaBt: normalizeRatio(toNumber(row[14])),
      metaBp: normalizeRatio(toNumber(row[15])),
      metaSkin: normalizeRatio(toNumber(row[18])),
    }))
    .filter((row) => row.consultorKey);
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
    "Meta BP",
    "Meta BT",
    "Meta Penetracao Skin",
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
      "",
      "",
      "",
    ]),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [
    { wch: 12 }, { wch: 32 }, { wch: 14 }, { wch: 18 }, { wch: 18 },
    { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 },
    { wch: 28 }, { wch: 24 }, { wch: 18 },
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
  if (normalized.includes(KNOWN_FILES.boletoPromocional)) return { type: "boletoPromocional", rows: parseBoletoPromocional(workbook, fileName) };
  if (normalized.includes(KNOWN_FILES.boletoTurbinado)) return { type: "boletoTurbinado", rows: parseBoletoTurbinado(workbook, fileName) };
  if (normalized.includes(KNOWN_FILES.penetracaoSkin)) return { type: "penetracaoSkin", rows: parsePenetracaoSkin(workbook, fileName) };
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
        bpPct: null,
        btPct: null,
        skinPct: null,
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
        b1PctImported: null,
        metas: {
          receita: 0,
          ticketMedio: 0,
          itensPorBoleto: 0,
          conversao: 0,
          b1: 0,
          bp: 0,
          bt: 0,
          skin: 0,
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
        target.b1PctImported = row.boleto1Pct ?? target.b1PctImported;
      }
      if (type === "boletoPromocional") target.bpPct = row.bpPct ?? target.bpPct;
      if (type === "boletoTurbinado") target.btPct = row.btPct ?? target.btPct;
      if (type === "penetracaoSkin") target.skinPct = row.skinPct ?? target.skinPct;
      if (type === "fidelidadePenetracao") target.fidelidadePenetracao = row.fidelidadePenetracao ?? target.fidelidadePenetracao;
      if (type === "fidelidadeResgate") target.fidelidadeResgatePct = row.fidelidadeResgatePct ?? target.fidelidadeResgatePct;
      if (type === "treinamento") target.treinamento = row.treinamento ?? target.treinamento;
      if (type === "servicos") target.servicos += row.quantidadeServicos || 0;
      if (type === "metas") {
        const rowPdv = String(row.pdv || "").trim();
        const targetPdv = String(target.pdv || "").trim();
        const samePdv = !rowPdv || !targetPdv || rowPdv === targetPdv;

        if (samePdv) {
          target.metas = {
            receita: row.metaReceita ?? 0,
            ticketMedio: row.metaTicketMedio ?? 0,
            itensPorBoleto: row.metaItensPorBoleto ?? 0,
            conversao: row.metaConversao ?? 0,
            b1: row.metaB1 ?? 0,
            bp: row.metaBp ?? 0,
            bt: row.metaBt ?? 0,
            skin: row.metaSkin ?? 0,
            fidelidadePenetracao: row.metaFidelidadePenetracao ?? 0,
            fidelidadeResgate: row.metaFidelidadeResgate ?? 0,
            treinamento: row.metaTreinamento ?? 0,
          };
        }
      }
    });
  });

  const ranked = Array.from(map.values()).map((item) => {
    const b1Pct = item.b1PctImported ?? (item.boletos > 0 ? item.boletosB1 / item.boletos : 0);
    const bpPct = item.bpPct || 0;
    const btPct = item.btPct || 0;
    const skinPct = item.skinPct || 0;
    const conversao = item.resgates > 0 ? item.conversoes / item.resgates : 0;
    const metas = item.metas || {};

    const scoreReceita = metas.receita > 0 ? Math.min(item.receita / metas.receita, 1.3) : (item.receita > 0 ? 1 : 0);
    const scoreTicket = metas.ticketMedio > 0 ? Math.min(item.ticketMedio / metas.ticketMedio, 1.3) : (item.ticketMedio ? Math.min(item.ticketMedio / 140, 1.3) : 0);
    const scoreItens = metas.itensPorBoleto > 0 ? Math.min(item.itensPorBoleto / metas.itensPorBoleto, 1.3) : (item.itensPorBoleto ? Math.min(item.itensPorBoleto / 2.2, 1.3) : 0);
    const scoreConversao = metas.conversao > 0 ? Math.min(conversao / metas.conversao, 1.3) : (conversao ? Math.min(conversao / 0.19, 1.3) : 0);
    const scoreB1 = metas.b1 > 0 ? Math.min(safeInverseRatio(b1Pct, metas.b1, 0), 1.3) : (b1Pct ? Math.min(0.30 / b1Pct, 1.3) : 0);
    const scoreBp = metas.bp > 0 ? Math.min(bpPct / metas.bp, 1.3) : (bpPct ? Math.min(bpPct / 0.10, 1.3) : 0);
    const scoreBt = metas.bt > 0 ? Math.min(btPct / metas.bt, 1.3) : (btPct ? Math.min(btPct / 0.10, 1.3) : 0);
    const scoreSkin = metas.skin > 0 ? Math.min(skinPct / metas.skin, 1.3) : (skinPct ? Math.min(skinPct / 0.10, 1.3) : 0);
    const scoreFidelidadePenetracao = metas.fidelidadePenetracao > 0 ? Math.min((item.fidelidadePenetracao || 0) / metas.fidelidadePenetracao, 1.3) : (item.fidelidadePenetracao ? Math.min(item.fidelidadePenetracao / 0.16, 1.3) : 0);
    const scoreFidelidadeResgate = metas.fidelidadeResgate > 0 ? Math.min((item.fidelidadeResgatePct || 0) / metas.fidelidadeResgate, 1.3) : (item.fidelidadeResgatePct ? Math.min(item.fidelidadeResgatePct / 0.10, 1.3) : 0);
    const scoreTreinamento = metas.treinamento > 0 ? Math.min((item.treinamento || 0) / metas.treinamento, 1.3) : (item.treinamento || 0);

    const parts = [
      scoreReceita,
      scoreTicket,
      scoreItens,
      scoreConversao,
      scoreB1,
      scoreBp,
      scoreBt,
      scoreSkin,
      scoreFidelidadePenetracao,
      scoreFidelidadeResgate,
      scoreTreinamento,
      item.cpfPercent ? Math.min(item.cpfPercent / 1, 1.3) : 0,
    ];

    const score = parts.reduce((a, b) => a + b, 0) / parts.length;
    return {
      ...item,
      b1Pct,
      bpPct,
      btPct,
      skinPct,
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
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 18,
        boxShadow: "0 10px 28px rgba(0,0,0,0.32)",
        backdropFilter: "blur(2px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function MetricCard({ title, value, subtitle, gaugeColor = COLORS.orange, percent = 0, icon }) {
  const Icon = icon;
  const safe = Math.max(0, Math.min(100, percent || 0));
  return (
    <Card
      style={{
        padding: "10px 12px",
        minHeight: 88,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
        borderRadius: 18,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "0 auto 0 0",
          width: 3,
          background: gaugeColor,
          opacity: 0.75,
        }}
      />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: "rgba(255,255,255,0.64)",
            lineHeight: 1.15,
            textTransform: "uppercase",
            letterSpacing: 0.45,
          }}
        >
          {title}
        </div>
        {Icon ? (
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 11,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.045)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon size={13} color={gaugeColor} />
          </div>
        ) : null}
      </div>
      <div
        style={{
          marginTop: 5,
          fontSize: 19,
          color: "rgba(255,255,255,0.92)",
          fontWeight: 550,
          lineHeight: 1,
          letterSpacing: -0.25,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </div>
      <div style={{ marginTop: 7, height: 5, background: "rgba(255,255,255,0.10)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${safe}%`, height: "100%", background: gaugeColor, borderRadius: 999, boxShadow: `0 0 10px ${gaugeColor}44` }} />
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 9,
          color: "rgba(255,255,255,0.52)",
          fontWeight: 400,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {subtitle}
      </div>
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
          minWidth: 0,
          height: 34,
          borderRadius: 12,
          border: `1px solid ${COLORS.border}`,
          padding: "0 9px",
          fontSize: 12,
          color: COLORS.text,
          background: COLORS.panelAlt,
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



function RankingTooltip({ active, payload, label, metricTab }) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload || {};
  const valor = Number(item.valor || 0);
  const metaValor = Number(item.metaValor || 0);
  const atingimento = Number(item.atingimento || 0);

  const formatMetricValue = (v) => {
    if (metricTab === "receita") return formatCurrency(v);
    return `${formatNumber(v, 2)}%`;
  };

  return (
    <div style={{
      background: COLORS.panel,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 12,
      padding: 10,
      boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
      minWidth: 190
    }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: COLORS.text, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 12, color: COLORS.subtext, marginBottom: 4 }}>
        Realizado: <span style={{ color: COLORS.text, fontWeight: 800 }}>{formatMetricValue(valor)}</span>
      </div>
      <div style={{ fontSize: 12, color: COLORS.subtext, marginBottom: 4 }}>
        Meta: <span style={{ color: COLORS.text, fontWeight: 800 }}>{formatMetricValue(metaValor)}</span>
      </div>
      <div style={{ fontSize: 12, color: COLORS.subtext }}>
        Atingimento: <span style={{ color: performanceColor(atingimento), fontWeight: 900 }}>{formatPercent(atingimento || 0, 1)}</span>
      </div>
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
    "BP",
    "Meta BP",
    "Ating. BP",
    "BT",
    "Meta BT",
    "Ating. BT",
    "Penetracao Skin",
    "Meta Penetracao Skin",
    "Ating. Penetracao Skin",
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
  const pctInverse = (value, meta) => (meta > 0 ? (value > 0 ? meta / value : 1) : null);

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
    pctInverse(item.b1Pct || 0, item.metas?.b1 || 0),
    item.bpPct || 0,
    item.metas?.bp || 0,
    pct(item.bpPct || 0, item.metas?.bp || 0),
    item.btPct || 0,
    item.metas?.bt || 0,
    pct(item.btPct || 0, item.metas?.bt || 0),
    item.skinPct || 0,
    item.metas?.skin || 0,
    pct(item.skinPct || 0, item.metas?.skin || 0),
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
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 12 },
    { wch: 16 }, { wch: 16 }, { wch: 18 },
    { wch: 14 }, { wch: 18 }, { wch: 16 },
    { wch: 12 }, { wch: 14 }, { wch: 14 },
    { wch: 20 }, { wch: 24 }, { wch: 22 },
    { wch: 18 }, { wch: 22 }, { wch: 20 },
    { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 18 },
  ];

  const percentCols = [5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 33, 34];  // 1-based columns for attainment/score-like fields except score
  for (let rowIdx = 2; rowIdx <= data.length + 1; rowIdx++) {
    for (const col of percentCols) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx - 1, c: col - 1 });
      if (ws[cellRef] && typeof ws[cellRef].v === "number") {
        ws[cellRef].z = "0.0%";
      }
    }
    const scoreRef = XLSX.utils.encode_cell({ r: rowIdx - 1, c: 33 });
      }

  // format score column as percentage
  for (let rowIdx = 2; rowIdx <= data.length + 1; rowIdx++) {
    const scoreRef = XLSX.utils.encode_cell({ r: rowIdx - 1, c: 33 });
    if (ws[scoreRef] && typeof ws[scoreRef].v === "number") {
      ws[scoreRef].z = "0.0%";
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, "Relatorio Consultores");
  XLSX.writeFile(wb, "relatorio-consultores.xlsx");
}


export default function Page() {
  const [parsed, setParsed] = useState(EMPTY_PARSED);
  const [filesLoaded, setFilesLoaded] = useState([]);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [restoreMessage, setRestoreMessage] = useState("");
  const [fPdv, setFPdv] = useState("todos");
  const [fConsultor, setFConsultor] = useState("todos");
  const [metricTab, setMetricTab] = useState("score");
  const [rankingType, setRankingType] = useState("consultor");
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modoTelao, setModoTelao] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(CONSULTOR_STORAGE_KEY);
      if (!raw) return;

      const saved = JSON.parse(raw);
      if (!saved?.parsed) return;

      setParsed({ ...EMPTY_PARSED, ...saved.parsed });
      setFilesLoaded(Array.isArray(saved.filesLoaded) ? saved.filesLoaded : []);
      setLastSavedAt(saved.savedAt || null);
      setRestoreMessage("Último upload restaurado automaticamente.");
    } catch (error) {
      console.warn("Não foi possível restaurar o último upload do Consultor.", error);
      window.localStorage.removeItem(CONSULTOR_STORAGE_KEY);
    }
  }, []);

  const limparDadosSalvos = useCallback(() => {
    setParsed(EMPTY_PARSED);
    setFilesLoaded([]);
    setLastSavedAt(null);
    setRestoreMessage("Dados salvos removidos.");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CONSULTOR_STORAGE_KEY);
    }
  }, []);

  
const handleFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    setIsProcessing(true);
    setRestoreMessage("");
    try {
    const next = { ...EMPTY_PARSED };

    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const parsedFile = parseWorkbook(file.name, workbook);
      if (parsedFile.type !== "desconhecido") {
        next[parsedFile.type] = [...next[parsedFile.type], ...parsedFile.rows];
      }
    }

    const loadedNames = files.map((f) => f.name);
    const savedAt = new Date().toISOString();

    setParsed(next);
    setFilesLoaded(loadedNames);
    setLastSavedAt(savedAt);
    setRestoreMessage("Dados salvos neste navegador.");

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          CONSULTOR_STORAGE_KEY,
          JSON.stringify({ parsed: next, filesLoaded: loadedNames, savedAt })
        );
      } catch (error) {
        console.warn("Não foi possível salvar o último upload do Consultor.", error);
        setRestoreMessage("Dados carregados, mas não foi possível salvar no navegador.");
      }
    }
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const collectFilesFromItems = useCallback(async (items) => {
    const files = [];

    const walkEntry = async (entry) => {
      if (!entry) return;

      if (entry.isFile) {
        await new Promise((resolve) => {
          entry.file((file) => {
            if (file && /\.xlsx$/i.test(file.name)) files.push(file);
            resolve();
          });
        });
        return;
      }

      if (entry.isDirectory) {
        const reader = entry.createReader();

        const readEntriesBatch = () =>
          new Promise((resolve, reject) => {
            reader.readEntries(resolve, reject);
          });

        while (true) {
          const entries = await readEntriesBatch();
          if (!entries.length) break;
          for (const child of entries) {
            await walkEntry(child);
          }
        }
      }
    };

    for (const item of Array.from(items || [])) {
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (entry) {
        await walkEntry(entry);
      }
    }

    return files;
  }, []);

  const handleDropZoneDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const items = e.dataTransfer?.items;
    if (items?.length) {
      const hasDirectory = Array.from(items).some((item) => {
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        return entry?.isDirectory;
      });

      if (hasDirectory) {
        const folderFiles = await collectFilesFromItems(items);
        if (folderFiles.length) {
          await handleFiles(folderFiles);
          return;
        }
      }
    }

    const files = Array.from(e.dataTransfer?.files || []).filter((file) => /\.xlsx$/i.test(file.name));
    if (files.length) {
      await handleFiles(files);
    }
  }, [collectFilesFromItems, handleFiles]);



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

  const handleDrop = useCallback(async (e) => {
    await handleDropZoneDrop(e);
  }, [handleDropZoneDrop]);



  const aggregated = useMemo(() => aggregateData(parsed), [parsed]);

  const pdvs = useMemo(
    () =>
      Array.from(
        new Set(
          aggregated.ranked
            .map((i) => String(i.pdv || "").trim())
            .filter((v) => v && v.toUpperCase() !== "TOTAL" && v.toUpperCase() !== "TODOS")
        )
      ).sort(),
    [aggregated]
  );

  const consultores = useMemo(() => {
    return aggregated.ranked
      .filter((item) => (fPdv === "todos" || item.pdv === fPdv))
      .map((item) => String(item.consultor || "").trim())
      .filter((name) => name && normalizeName(name) !== "TODOS" && normalizeName(name) !== "TOTAL")
      .sort((a, b) => a.localeCompare(b));
  }, [aggregated, fPdv]);

  const filtered = useMemo(() => {
    return aggregated.ranked.filter((item) => {
      const pdv = String(item.pdv || "").trim();
      const consultor = String(item.consultor || "").trim();
      if (!consultor || normalizeName(consultor) === "TODOS" || normalizeName(consultor) === "TOTAL") return false;
      if (pdv && (pdv.toUpperCase() === "TOTAL" || pdv.toUpperCase() === "TODOS")) return false;
      if (fPdv !== "todos" && pdv !== fPdv) return false;
      if (fConsultor !== "todos" && consultor !== fConsultor) return false;
      return true;
    });
  }, [aggregated, fPdv, fConsultor]);


  const current = useMemo(() => {
    if (!filtered.length) return null;

    // Quando não há consultor específico selecionado, os cards mostram o consolidado do filtro atual.
    // Ex.: todos os consultores, ou todos os consultores de um PDV.
    if (fConsultor === "todos") {
      const total = filtered.reduce((acc, item) => {
        acc.receita += item.receita || 0;
        acc.boletos += item.boletos || 0;
        acc.boletosB1 += item.boletosB1 || 0;
        acc.itens += item.itens || 0;
        acc.resgates += item.resgates || 0;
        acc.conversoes += item.conversoes || 0;
        acc.atendimentosId += item.atendimentosId || 0;
        acc.servicos += item.servicos || 0;
        acc.ticketMedio += item.ticketMedio || 0;
        acc.precoMedio += item.precoMedio || 0;
        acc.itensPorBoleto += item.itensPorBoleto || 0;
        acc.b1Pct += item.b1Pct || 0;
        acc.bpPct += item.bpPct || 0;
        acc.btPct += item.btPct || 0;
        acc.skinPct += item.skinPct || 0;
        acc.conversao += item.conversao || 0;
        acc.fidelidadePenetracao += item.fidelidadePenetracao || 0;
        acc.fidelidadeResgatePct += item.fidelidadeResgatePct || 0;
        acc.treinamento += item.treinamento || 0;
        acc.boletosValidosIaf += item.boletosValidosIaf || 0;
        acc.cpfPercent += item.cpfPercent || 0;
        acc.score += item.score || 0;

        acc.metas.receita += item.metas?.receita || 0;
        acc.metas.ticketMedio += item.metas?.ticketMedio || 0;
        acc.metas.itensPorBoleto += item.metas?.itensPorBoleto || 0;
        acc.metas.conversao += item.metas?.conversao || 0;
        acc.metas.b1 += item.metas?.b1 || 0;
        acc.metas.bp += item.metas?.bp || 0;
        acc.metas.bt += item.metas?.bt || 0;
        acc.metas.skin += item.metas?.skin || 0;
        acc.metas.fidelidadePenetracao += item.metas?.fidelidadePenetracao || 0;
        acc.metas.fidelidadeResgate += item.metas?.fidelidadeResgate || 0;
        acc.metas.treinamento += item.metas?.treinamento || 0;
        return acc;
      }, {
        consultorKey: "TOTAL_FILTRO",
        consultor: fPdv === "todos" ? "Todos os consultores" : `Total ${fPdv}`,
        pdv: fPdv === "todos" ? "" : fPdv,
        receita: 0,
        boletos: 0,
        boletosB1: 0,
        itens: 0,
        resgates: 0,
        conversoes: 0,
        atendimentosId: 0,
        servicos: 0,
        ticketMedio: 0,
        precoMedio: 0,
        itensPorBoleto: 0,
        b1Pct: 0,
        bpPct: 0,
        btPct: 0,
        skinPct: 0,
        conversao: 0,
        fidelidadePenetracao: 0,
        fidelidadeResgatePct: 0,
        treinamento: 0,
        boletosValidosIaf: 0,
        cpfPercent: 0,
        score: 0,
        metas: {
          receita: 0,
          ticketMedio: 0,
          itensPorBoleto: 0,
          conversao: 0,
          b1: 0,
          bp: 0,
          bt: 0,
          skin: 0,
          fidelidadePenetracao: 0,
          fidelidadeResgate: 0,
          treinamento: 0,
        },
      });

      const count = filtered.length || 1;
      return {
        ...total,
        // Indicadores percentuais e médios são média dos consultores filtrados.
        ticketMedio: total.ticketMedio / count,
        precoMedio: total.precoMedio / count,
        itensPorBoleto: total.itensPorBoleto / count,
        b1Pct: total.b1Pct / count,
        bpPct: total.bpPct / count,
        btPct: total.btPct / count,
        skinPct: total.skinPct / count,
        conversao: total.conversao / count,
        fidelidadePenetracao: total.fidelidadePenetracao / count,
        fidelidadeResgatePct: total.fidelidadeResgatePct / count,
        treinamento: total.treinamento / count,
        boletosValidosIaf: total.boletosValidosIaf / count,
        cpfPercent: total.cpfPercent / count,
        score: total.score / count,
        scorePct: Math.min(((total.score / count) / 1.1) * 100, 100),
        metas: {
          ...total.metas,
          // Receita continua como meta total do filtro.
          // As demais metas ficam FIXAS: pega a primeira meta válida encontrada no filtro,
          // evitando que a meta mude por média ou por consultores sem meta.
          ticketMedio: filtered.find((i) => i.metas?.ticketMedio > 0)?.metas?.ticketMedio || 0,
          itensPorBoleto: filtered.find((i) => i.metas?.itensPorBoleto > 0)?.metas?.itensPorBoleto || 0,
          conversao: filtered.find((i) => i.metas?.conversao > 0)?.metas?.conversao || 0,
          b1: filtered.find((i) => i.metas?.b1 > 0)?.metas?.b1 || 0,
          bp: filtered.find((i) => i.metas?.bp > 0)?.metas?.bp || 0,
          bt: filtered.find((i) => i.metas?.bt > 0)?.metas?.bt || 0,
          skin: filtered.find((i) => i.metas?.skin > 0)?.metas?.skin || 0,
          fidelidadePenetracao: filtered.find((i) => i.metas?.fidelidadePenetracao > 0)?.metas?.fidelidadePenetracao || 0,
          fidelidadeResgate: filtered.find((i) => i.metas?.fidelidadeResgate > 0)?.metas?.fidelidadeResgate || 0,
          treinamento: filtered.find((i) => i.metas?.treinamento > 0)?.metas?.treinamento || 0,
        },
      };
    }

    return filtered[0] || null;
  }, [filtered, fConsultor, fPdv]);

  const average = useMemo(() => {
    if (!filtered.length) return null;
    const total = filtered.reduce((acc, item) => {
      acc.receita += item.receita;
      acc.score += item.score;
      acc.conv += item.conversao;
      acc.b1 += item.b1Pct;
      acc.bp += item.bpPct || 0;
      acc.bt += item.btPct || 0;
      acc.skin += item.skinPct || 0;
      acc.fidelidadePenetracao += item.fidelidadePenetracao || 0;
      acc.fidelidadeResgate += item.fidelidadeResgatePct || 0;
      acc.ticket += item.ticketMedio;
      return acc;
    }, { receita: 0, score: 0, conv: 0, b1: 0, bp: 0, bt: 0, skin: 0, fidelidadePenetracao: 0, fidelidadeResgate: 0, ticket: 0 });

    return {
      receita: total.receita / filtered.length,
      score: total.score / filtered.length,
      conv: total.conv / filtered.length,
      b1: total.b1 / filtered.length,
      bp: total.bp / filtered.length,
      bt: total.bt / filtered.length,
      skin: total.skin / filtered.length,
      fidelidadePenetracao: total.fidelidadePenetracao / filtered.length,
      fidelidadeResgate: total.fidelidadeResgate / filtered.length,
      ticket: total.ticket / filtered.length,
    };
  }, [filtered]);

  const monthlySeries = useMemo(() => {
    if (!current || current.consultorKey === "TOTAL_FILTRO") return [];
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
          receitaMeta: 0,
          score: 0,
          conversao: 0,
          conversaoMeta: 0,
          b1: 0,
          b1Meta: 0,
          bp: 0,
          bpMeta: 0,
          bt: 0,
          btMeta: 0,
          skin: 0,
          skinMeta: 0,
          count: 0,
        });
      }
      const acc = map.get(item.pdv);
      acc.receita += item.receita || 0;
      acc.receitaMeta += item.metas?.receita || 0;
      acc.score += item.score || 0;
      acc.conversao += item.conversao || 0;
      acc.conversaoMeta += item.metas?.conversao || 0;
      acc.b1 += item.b1Pct || 0;
      acc.b1Meta += item.metas?.b1 || 0;
      acc.bp += item.bpPct || 0;
      acc.bpMeta += item.metas?.bp || 0;
      acc.bt += item.btPct || 0;
      acc.btMeta += item.metas?.bt || 0;
      acc.skin += item.skinPct || 0;
      acc.skinMeta += item.metas?.skin || 0;
      acc.count += 1;
    });

    return Array.from(map.values())
      .map((i) => {
        const avgScore = i.score / i.count;
        const avgConversao = i.conversao / i.count;
        const avgB1 = i.b1 / i.count;
        const avgBp = i.bp / i.count;
        const avgBt = i.bt / i.count;
        const avgSkin = i.skin / i.count;
        const ratio =
          metricTab === "score" ? avgScore :
          metricTab === "receita" ? safeRatio(i.receita, i.receitaMeta, i.receita > 0 ? 1 : 0) :
          metricTab === "conversao" ? safeRatio(avgConversao, i.conversaoMeta / i.count, avgConversao ? avgConversao / 0.19 : 0) :
          metricTab === "b1" ? safeRatio(avgB1, i.b1Meta / i.count, avgB1 ? avgB1 / 0.30 : 0) :
          metricTab === "bp" ? safeRatio(avgBp, i.bpMeta / i.count, avgBp ? avgBp / 0.10 : 0) :
          metricTab === "bt" ? safeRatio(avgBt, i.btMeta / i.count, avgBt ? avgBt / 0.10 : 0) :
          safeRatio(avgSkin, i.skinMeta / i.count, avgSkin ? avgSkin / 0.10 : 0);

        return {
          nome: i.pdv,
          valor:
            metricTab === "score" ? avgScore * 100 :
            metricTab === "receita" ? i.receita :
            metricTab === "conversao" ? avgConversao * 100 :
            metricTab === "b1" ? avgB1 * 100 :
            metricTab === "bp" ? avgBp * 100 :
            metricTab === "bt" ? avgBt * 100 :
            avgSkin * 100,
          metaValor:
            metricTab === "score" ? 100 :
            metricTab === "receita" ? i.receitaMeta :
            metricTab === "conversao" ? (i.conversaoMeta / i.count) * 100 :
            metricTab === "b1" ? (i.b1Meta / i.count) * 100 :
            metricTab === "bp" ? (i.bpMeta / i.count) * 100 :
            metricTab === "bt" ? (i.btMeta / i.count) * 100 :
            (i.skinMeta / i.count) * 100,
          atingimento: ratio,
          cor: metricTab === "score" ? scoreColor(avgScore) : performanceColor(ratio),
          filtroPdv: i.pdv,
          filtroConsultor: "todos",
        };
      })
      .sort((a, b) => b.valor - a.valor)
      .slice(0, filtered.length);
  }, [filtered, metricTab]);

  const rankingData = useMemo(() => {
    return filtered
      .map((item) => {
        const ratio =
          metricTab === "score" ? item.score :
          metricTab === "receita" ? safeRatio(item.receita || 0, item.metas?.receita || 0, item.receita > 0 ? 1 : 0) :
          metricTab === "conversao" ? safeRatio(item.conversao || 0, item.metas?.conversao || 0, item.conversao ? item.conversao / 0.19 : 0) :
          metricTab === "b1" ? safeRatio(item.b1Pct || 0, item.metas?.b1 || 0, item.b1Pct ? item.b1Pct / 0.30 : 0) :
          metricTab === "bp" ? safeRatio(item.bpPct || 0, item.metas?.bp || 0, item.bpPct ? item.bpPct / 0.10 : 0) :
          metricTab === "bt" ? safeRatio(item.btPct || 0, item.metas?.bt || 0, item.btPct ? item.btPct / 0.10 : 0) :
          safeRatio(item.skinPct || 0, item.metas?.skin || 0, item.skinPct ? item.skinPct / 0.10 : 0);

        return {
          nome: item.consultor.split(" ").slice(0, 2).join(" "),
          valor:
            metricTab === "score" ? item.score * 100 :
            metricTab === "receita" ? item.receita :
            metricTab === "conversao" ? item.conversao * 100 :
            metricTab === "b1" ? item.b1Pct * 100 :
            metricTab === "bp" ? (item.bpPct || 0) * 100 :
            metricTab === "bt" ? (item.btPct || 0) * 100 :
            (item.skinPct || 0) * 100,
          metaValor:
            metricTab === "score" ? 100 :
            metricTab === "receita" ? (item.metas?.receita || 0) :
            metricTab === "conversao" ? (item.metas?.conversao || 0) * 100 :
            metricTab === "b1" ? (item.metas?.b1 || 0) * 100 :
            metricTab === "bp" ? (item.metas?.bp || 0) * 100 :
            metricTab === "bt" ? (item.metas?.bt || 0) * 100 :
            (item.metas?.skin || 0) * 100,
          atingimento: ratio,
          cor: metricTab === "score" ? scoreColor(item.score) : performanceColor(ratio),
          filtroPdv: item.pdv || "todos",
          filtroConsultor: item.consultor,
        };
      })
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);
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



  const currentRatios = useMemo(() => {
    if (!current) return null;
    return {
      receita: safeRatio(current.receita || 0, current.metas?.receita || 0, current.receita > 0 ? 1 : 0),
      boletoMedio: safeRatio(current.ticketMedio || 0, current.metas?.ticketMedio || 0, current.ticketMedio ? current.ticketMedio / 140 : 0),
      itensPorBoleto: safeRatio(current.itensPorBoleto || 0, current.metas?.itensPorBoleto || 0, current.itensPorBoleto ? current.itensPorBoleto / 2.2 : 0),
      fidelidadePenetracao: safeRatio(current.fidelidadePenetracao || 0, current.metas?.fidelidadePenetracao || 0, current.fidelidadePenetracao ? current.fidelidadePenetracao / 0.16 : 0),
      fidelidadeResgate: safeRatio(current.fidelidadeResgatePct || 0, current.metas?.fidelidadeResgate || 0, current.fidelidadeResgatePct ? current.fidelidadeResgatePct / 0.10 : 0),
      treinamento: safeRatio(current.treinamento || 0, current.metas?.treinamento || 0, current.treinamento || 0),
      b1: safeInverseRatio(current.b1Pct || 0, current.metas?.b1 || 0, current.b1Pct ? 0.30 / current.b1Pct : 0),
      bp: safeRatio(current.bpPct || 0, current.metas?.bp || 0, current.bpPct ? current.bpPct / 0.10 : 0),
      bt: safeRatio(current.btPct || 0, current.metas?.bt || 0, current.btPct ? current.btPct / 0.10 : 0),
      skin: safeRatio(current.skinPct || 0, current.metas?.skin || 0, current.skinPct ? current.skinPct / 0.10 : 0),
    };
  }, [current]);


  const averageRatios = useMemo(() => {
    if (!average) return null;
    const metaAvg = filtered.length
      ? filtered.reduce((acc, item) => {
          acc.receita += item.metas?.receita || 0;
          acc.ticketMedio += item.metas?.ticketMedio || 0;
          acc.conversao += item.metas?.conversao || 0;
          acc.b1 += item.metas?.b1 || 0;
          acc.bp += item.metas?.bp || 0;
          acc.bt += item.metas?.bt || 0;
          acc.skin += item.metas?.skin || 0;
          acc.fidelidadePenetracao += item.metas?.fidelidadePenetracao || 0;
          acc.fidelidadeResgate += item.metas?.fidelidadeResgate || 0;
          acc.count += 1;
          return acc;
        }, { receita: 0, ticketMedio: 0, conversao: 0, b1: 0, bp: 0, bt: 0, skin: 0, fidelidadePenetracao: 0, fidelidadeResgate: 0, count: 0 })
      : null;

    if (!metaAvg || !metaAvg.count) return null;

    return {
      receita: safeRatio(average.receita || 0, metaAvg.receita / metaAvg.count, average.receita > 0 ? 1 : 0),
      ticketMedio: safeRatio(average.ticket || 0, metaAvg.ticketMedio / metaAvg.count, average.ticket ? average.ticket / 140 : 0),
      conversao: safeRatio(average.conv || 0, metaAvg.conversao / metaAvg.count, average.conv ? average.conv / 0.19 : 0),
      b1: safeInverseRatio(average.b1 || 0, metaAvg.b1 / metaAvg.count, average.b1 ? 0.30 / average.b1 : 0),
      bp: safeRatio(average.bp || 0, metaAvg.bp / metaAvg.count, average.bp ? average.bp / 0.10 : 0),
      bt: safeRatio(average.bt || 0, metaAvg.bt / metaAvg.count, average.bt ? average.bt / 0.10 : 0),
      skin: safeRatio(average.skin || 0, metaAvg.skin / metaAvg.count, average.skin ? average.skin / 0.10 : 0),
      fidelidadePenetracao: safeRatio(average.fidelidadePenetracao || 0, metaAvg.fidelidadePenetracao / metaAvg.count, average.fidelidadePenetracao ? average.fidelidadePenetracao / 0.16 : 0),
      fidelidadeResgate: safeRatio(average.fidelidadeResgate || 0, metaAvg.fidelidadeResgate / metaAvg.count, average.fidelidadeResgate ? average.fidelidadeResgate / 0.10 : 0),
      score: average.score || 0,
    };
  }, [average, filtered]);


  const rankingMetaValue = useMemo(() => {
    const data = rankingType === "consultor" ? rankingData : rankingPdvData;
    if (!data.length) return 0;
    const metas = data.map((d) => Number(d.metaValor || 0)).filter((v) => Number.isFinite(v) && v > 0);
    if (!metas.length) return 0;
    return metas[0];
  }, [rankingType, rankingData, rankingPdvData]);

  const rankingSelectedData = rankingType === "consultor" ? rankingData : rankingPdvData;

  const rankingChartHeight = useMemo(() => {
    const base = modoTelao ? 285 : 235;
    const rows = rankingSelectedData.length || 0;
    return Math.max(base, rows * 24);
  }, [rankingSelectedData, modoTelao]);

  const noData = !aggregated.ranked.length;

  return (
    <div
      className={modoTelao ? "consultor-tv-mode" : ""}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        minHeight: "100vh",
        height: modoTelao ? "100vh" : "auto",
        background: "#000000",
        color: COLORS.text,
        overflowX: "hidden",
        overflowY: modoTelao ? "hidden" : "auto",
        position: "relative",
      }}
    >
      <style jsx global>{`
        * { box-sizing: border-box; }
        html, body { background: #000000 !important; }
        body { color: #f8fafc; }
        html, body { background: #000000; }
        .consultor-tv-mode { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .consultor-tv-mode .recharts-cartesian-axis-tick-value { font-size: 11px; }
        .consultor-tv-mode .consultor-metrics-grid > div { min-height: 86px; }
        .consultor-tv-mode .consultor-title-small { font-size: 13px !important; }
        .consultor-tv-mode .consultor-ranking-scroll { max-height: calc(100vh - 255px); overflow: auto; }
        .consultor-tv-mode .consultor-normal-header { display: none !important; }
        .consultor-tv-mode .consultor-content-wrap { padding: 4px !important; }
        .consultor-tv-mode .consultor-metrics-grid { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; }
        .consultor-tv-mode .consultor-main-grid { grid-template-columns: 1fr 1fr !important; }
        .consultor-tv-mode .consultor-chart-card { padding: 8px !important; }
        .consultor-tv-mode .consultor-tv-exit { display: block !important; }
        .consultor-tv-exit { display: none; }
        @media (max-width: 1180px) {
          .recharts-wrapper, .recharts-surface { max-width: 100% !important; }
        }
        @media (max-width: 900px) {
          body { overflow-x: hidden; }
          button { white-space: nowrap; }
        }
      `}</style>
      {(isDragging || isProcessing) && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: isProcessing ? "rgba(0,0,0,0.78)" : "rgba(0,0,0,0.72)",
            border: isDragging ? `3px dashed ${COLORS.blue}` : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              background: COLORS.panel,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 18,
              padding: "18px 26px",
              boxShadow: "0 18px 60px rgba(0,0,0,0.42)",
              fontSize: 18,
              fontWeight: 900,
              color: COLORS.text,
            }}
          >
            {isProcessing ? "Processando planilhas..." : "Solte os arquivos .xlsx aqui"}
          </div>
        </div>
      )}

      <button
        className="consultor-tv-exit"
        onClick={() => setModoTelao(false)}
        style={{
          position: "fixed",
          top: 10,
          right: 10,
          zIndex: 10000,
          border: `1px solid ${COLORS.border}`,
          background: "rgba(8,18,36,0.92)",
          color: COLORS.text,
          borderRadius: 12,
          padding: "8px 12px",
          fontWeight: 900,
          cursor: "pointer",
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        }}
      >
        Modo Normal
      </button>

      <div className="consultor-content-wrap" style={{ width: "100%", maxWidth: "100vw", margin: "0 auto", padding: "clamp(4px, 0.6vw, 10px)", boxSizing: "border-box" }}>
        <div className="consultor-normal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ color: COLORS.subtext, fontSize: 12, fontWeight: 800 }}>
            {restoreMessage || (filesLoaded.length ? `${filesLoaded.length} arquivo(s) carregado(s)` : "Arraste as planilhas em qualquer área da página")}
          </div>
          <button
            onClick={() => setModoTelao(true)}
            style={{
              border: `1px solid ${COLORS.border}`,
              background: COLORS.panelAlt,
              color: COLORS.text,
              borderRadius: 12,
              padding: "8px 14px",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Modo Telão
          </button>
        </div>
        <div className={modoTelao ? "consultor-normal-header" : ""} style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 1fr) minmax(110px, 140px)", gap: "clamp(5px, 0.6vw, 10px)", marginBottom: "clamp(5px, 0.6vw, 10px)" }}>
          <Card style={{ padding: 6 }}>
            <SelectField label="PDV" value={fPdv} onChange={(value) => { setFPdv(value); setFConsultor("todos"); }} options={[{ value: "todos", label: "Todos" }, ...pdvs.map((p) => ({ value: p, label: p }))]} />
          </Card>
          <Card style={{ padding: 6 }}>
            <SelectField label="Consultor" value={fConsultor} onChange={setFConsultor} options={[{ value: "todos", label: "Todos" }, ...consultores.map((c) => ({ value: c, label: c }))]} />
          </Card>
          <Card style={{ padding: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.subtext }}>Consultores</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: COLORS.text, marginTop: 2 }}>{filtered.length}</div>
          </Card>
        </div>

        {!noData && current ? (
          <>
            <div className="consultor-metrics-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: "clamp(5px, 0.6vw, 10px)", marginBottom: "clamp(5px, 0.6vw, 10px)" }}>
              <MetricCard title="Receita" value={formatCurrency(current.receita)} subtitle={current.metas?.receita ? `Meta: ${formatCurrency(current.metas.receita)}` : "Meta não informada"} percent={current.metas?.receita ? Math.min((current.receita / current.metas.receita) * 100, 100) : current.scorePct} gaugeColor={performanceColor(currentRatios?.receita || 0)} icon={TrendingUp} />
              <MetricCard title="B1" value={formatPercent(current.b1Pct)} subtitle={current.metas?.b1 ? `Meta: ${formatPercent(current.metas.b1)}` : `Boletos: ${formatNumber(current.boletos)}`} percent={current.metas?.b1 ? inverseGaugePercent(current.b1Pct, current.metas.b1) : 0} gaugeColor={performanceColor(currentRatios?.b1 || 0)} icon={Target} />
              <MetricCard title="BP" value={formatPercent(current.bpPct || 0)} subtitle={`Meta: ${formatPercent(current?.metas?.bp || 0)}`} percent={current.metas?.bp ? Math.min(((current.bpPct || 0) / current.metas.bp) * 100, 100) : (current.bpPct || 0) * 500} gaugeColor={performanceColor(currentRatios?.bp || 0)} icon={Target} />
              <MetricCard title="BT" value={formatPercent(current.btPct || 0)} subtitle={current.metas?.bt ? `Meta: ${formatPercent(current.metas.bt)}` : "Boleto turbinado"} percent={current.metas?.bt ? Math.min(((current.btPct || 0) / current.metas.bt) * 100, 100) : (current.btPct || 0) * 500} gaugeColor={performanceColor(currentRatios?.bt || 0)} icon={Target} />
              <MetricCard title="Boleto Médio" value={formatCurrency(current.ticketMedio)} subtitle={current.metas?.ticketMedio ? `Meta: ${formatCurrency(current.metas.ticketMedio)}` : `Preço médio: ${formatCurrency(current.precoMedio)}`} percent={current.metas?.ticketMedio ? Math.min((current.ticketMedio / current.metas.ticketMedio) * 100, 100) : (current.ticketMedio / 140) * 100} gaugeColor={performanceColor(currentRatios?.boletoMedio || 0)} icon={Store} />
              <MetricCard title="Itens/Boleto" value={formatNumber(current.itensPorBoleto, 2)} subtitle={current.metas?.itensPorBoleto ? `Meta: ${formatNumber(current.metas.itensPorBoleto, 2)}` : `Itens: ${formatNumber(current.itens)}`} percent={current.metas?.itensPorBoleto ? Math.min((current.itensPorBoleto / current.metas.itensPorBoleto) * 100, 100) : (current.itensPorBoleto / 2.2) * 100} gaugeColor={performanceColor(currentRatios?.itensPorBoleto || 0)} icon={Users} />
              <MetricCard title="Penetração Skin" value={formatPercent(current.skinPct || 0)} subtitle={`Meta: ${formatPercent(current?.metas?.skin || 0)}`} percent={current.metas?.skin ? Math.min(((current.skinPct || 0) / current.metas.skin) * 100, 100) : (current.skinPct || 0) * 500} gaugeColor={performanceColor(currentRatios?.skin || 0)} icon={Award} />
              <MetricCard title="Fidelidade - Penetração" value={formatPercent(current.fidelidadePenetracao || 0)} subtitle={current.metas?.fidelidadePenetracao ? `Meta: ${formatPercent(current.metas.fidelidadePenetracao)}` : "Desafio fidelidade"} percent={current.metas?.fidelidadePenetracao ? Math.min(((current.fidelidadePenetracao || 0) / current.metas.fidelidadePenetracao) * 100, 100) : (current.fidelidadePenetracao || 0) * 500} gaugeColor={performanceColor(currentRatios?.fidelidadePenetracao || 0)} icon={Award} />
              <MetricCard title="Fidelidade - Resgate" value={formatPercent(current.fidelidadeResgatePct || 0)} subtitle={current.metas?.fidelidadeResgate ? `Meta: ${formatPercent(current.metas.fidelidadeResgate)}` : "Uso de benefícios"} percent={current.metas?.fidelidadeResgate ? Math.min(((current.fidelidadeResgatePct || 0) / current.metas.fidelidadeResgate) * 100, 100) : (current.fidelidadeResgatePct || 0) * 500} gaugeColor={performanceColor(currentRatios?.fidelidadeResgate || 0)} icon={Award} />
              <MetricCard title="Treinamento" value={formatPercent(current.treinamento || 0)} subtitle={current.metas?.treinamento ? `Meta: ${formatPercent(current.metas.treinamento)}` : `CPF válido IAF: ${formatPercent(current.boletosValidosIaf || 0)}`} percent={current.metas?.treinamento ? Math.min(((current.treinamento || 0) / current.metas.treinamento) * 100, 100) : (current.treinamento || 0) * 100} gaugeColor={performanceColor(currentRatios?.treinamento || 0)} icon={AlertTriangle} />
            </div>

            <div className="consultor-main-grid" style={{ display: "grid", gridTemplateColumns: "0.98fr 1.02fr", gap: 6, marginBottom: 6 }}>
              <Card style={{ padding: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 900 }}>Ranking de consultores</div>
                    <div style={{ fontSize: 12, color: COLORS.subtext }}>Top 8 dentro do filtro atual • linha tracejada = meta</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "nowrap", width: "100%" }}>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button onClick={() => setRankingType("consultor")} style={{
                        border: `1px solid ${rankingType === "consultor" ? COLORS.blue : COLORS.border}`,
                        background: rankingType === "consultor" ? COLORS.blue : COLORS.panelAlt,
                        color: rankingType === "consultor" ? "#fff" : COLORS.text,
                        borderRadius: 999,
                        padding: "6px 12px",
                        fontWeight: 400,
                        fontSize: 12,
                        cursor: "pointer"
                      }}>Consultores</button>
                      <button onClick={() => setRankingType("pdv")} style={{
                        border: `1px solid ${rankingType === "pdv" ? COLORS.blue : COLORS.border}`,
                        background: rankingType === "pdv" ? COLORS.blue : COLORS.panelAlt,
                        color: rankingType === "pdv" ? "#fff" : COLORS.text,
                        borderRadius: 999,
                        padding: "6px 12px",
                        fontWeight: 400,
                        fontSize: 12,
                        cursor: "pointer"
                      }}>PDVs</button>
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", flexShrink: 0 }}>
                    {[
                      ["score", "Score"],
                      ["receita", "Receita"],
                      ["conversao", "Conversão"],
                      ["b1", "B1"],
                      ["bp", "BP"],
                      ["bt", "BT"],
                      ["skin", "Skin"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setMetricTab(key)}
                        style={{
                          border: `1px solid ${metricTab === key ? COLORS.orange : COLORS.border}`,
                          background: metricTab === key ? COLORS.orange : COLORS.panelAlt,
                          color: metricTab === key ? "#fff" : COLORS.text,
                          borderRadius: 999,
                          padding: "6px 12px",
                          fontWeight: 400,
                          cursor: "pointer",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                    </div>
                  </div>
                </div>
                <div className="consultor-ranking-scroll" style={{ height: modoTelao ? 410 : 380, overflow: "hidden" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rankingSelectedData} margin={{ left: 8, right: 24, top: 34, bottom: 72 }} onClick={(state) => {
                      const payload = state?.activePayload?.[0]?.payload;
                      if (!payload) return;

                      if (rankingType === "consultor") {
                        const sameConsultor = fConsultor !== "todos" && payload.filtroConsultor === fConsultor;
                        const samePdv = fPdv !== "todos" && payload.filtroPdv === fPdv;

                        if (sameConsultor && samePdv) {
                          setFPdv("todos");
                          setFConsultor("todos");
                          return;
                        }

                        if (payload.filtroPdv) setFPdv(payload.filtroPdv);
                        if (payload.filtroConsultor) setFConsultor(payload.filtroConsultor);
                      } else {
                        const samePdv = fPdv !== "todos" && payload.filtroPdv === fPdv;

                        if (samePdv && fConsultor === "todos") {
                          setFPdv("todos");
                          setFConsultor("todos");
                          return;
                        }

                        if (payload.filtroPdv) {
                          setFPdv(payload.filtroPdv);
                          setFConsultor("todos");
                        }
                      }
                    }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.16)" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="nome"
                        type="category"
                        interval={0}
                        angle={-35}
                        textAnchor="end"
                        height={78}
                        tick={{ fontSize: 10, fill: "rgba(255,255,255,0.78)" }}
                        tickLine={{ stroke: "rgba(255,255,255,0.45)" }}
                        axisLine={{ stroke: "rgba(255,255,255,0.65)" }}
                      />
                      <YAxis
                        type="number"
                        tick={{ fontSize: 11, fill: "rgba(255,255,255,0.82)" }}
                        tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                        axisLine={{ stroke: "rgba(255,255,255,0.65)" }}
                        domain={[0, (dataMax) => Math.ceil(Number(dataMax || 0) * 1.15)]}
                      />
                      {rankingMetaValue > 0 ? <ReferenceLine y={rankingMetaValue} stroke="rgba(255,255,255,0.78)" strokeDasharray="4 4" ifOverflow="extendDomain" /> : null}
                      <Tooltip
                        cursor={{ fill: "rgba(255,255,255,0.04)" }}
                        contentStyle={{ background: "#0b0b0b", border: `1px solid ${COLORS.border}`, borderRadius: 12, color: COLORS.text }}
                        formatter={(value) => metricTab === "receita" ? formatCurrency(Number(value)) : `${formatNumber(Number(value), 1)}%`}
                      />
                      <Bar dataKey="valor" name={metricTab === "receita" ? "receita" : metricTab} barSize={54} radius={[0, 0, 0, 0]} cursor="pointer">
                        {rankingSelectedData.map((entry, index) => (
                          <Cell key={`ranking-cell-${index}`} fill={entry?.cor || performanceColor(entry?.atingimento || 0)} />
                        ))}
                        <LabelList
                          dataKey="valor"
                          position="top"
                          fill="#ffffff"
                          fontSize={11}
                          formatter={(value) => metricTab === "receita" ? formatCurrency(Number(value)).replace("R$", "R$") : formatNumber(Number(value), 0)}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card style={{ padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.2px", color: COLORS.text, opacity: 0.88, marginBottom: 12 }}>Comparativo com a média</div>
                {average ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", alignItems: "stretch" }}>
                    {[
                      ["Receita", formatCurrency(current.receita), formatCurrency(average.receita), performanceColor(currentRatios?.receita || 0), performanceColor(averageRatios?.receita || 0)],
                      ["Ticket médio", formatCurrency(current.ticketMedio), formatCurrency(average.ticket), performanceColor(currentRatios?.boletoMedio || 0), performanceColor(averageRatios?.ticketMedio || 0)],
                      ["Conversão", formatPercent(current.conversao), formatPercent(average.conv), performanceColor(safeRatio(current.conversao || 0, current.metas?.conversao || 0, current.conversao ? current.conversao / 0.19 : 0)), performanceColor(averageRatios?.conversao || 0)],
                      ["B1", formatPercent(current.b1Pct), formatPercent(average.b1), performanceColor(currentRatios?.b1 || 0), performanceColor(averageRatios?.b1 || 0)],
                      ["BP", formatPercent(current.bpPct || 0), formatPercent(average.bp || 0), performanceColor(currentRatios?.bp || 0), performanceColor(averageRatios?.bp || 0)],
                      ["BT", formatPercent(current.btPct || 0), formatPercent(average.bt || 0), performanceColor(currentRatios?.bt || 0), performanceColor(averageRatios?.bt || 0)],
                      ["Penetração Skin", formatPercent(current.skinPct || 0), formatPercent(average.skin || 0), performanceColor(currentRatios?.skin || 0), performanceColor(averageRatios?.skin || 0)],
                      ["Fidelidade - Penetração", formatPercent(current.fidelidadePenetracao || 0), formatPercent(average.fidelidadePenetracao || 0), performanceColor(currentRatios?.fidelidadePenetracao || 0), performanceColor(averageRatios?.fidelidadePenetracao || 0)],
                      ["Fidelidade - Resgate", formatPercent(current.fidelidadeResgatePct || 0), formatPercent(average.fidelidadeResgate || 0), performanceColor(currentRatios?.fidelidadeResgate || 0), performanceColor(averageRatios?.fidelidadeResgate || 0)],
                    ].map(([label, mine, avg, mineColor, avgColor]) => (
                      <div key={label} style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 12, minHeight: 86, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                        <div style={{ fontSize: 10, color: COLORS.subtext, fontWeight: 500, letterSpacing: "0.35px", textTransform: "uppercase", lineHeight: 1.08, opacity: 0.72 }}>{label}</div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3, marginTop: 6 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: "-0.25px", color: mineColor, lineHeight: 1.05 }}>{mine}</div>
                          <div style={{ fontSize: 10, fontWeight: 400, color: avgColor, lineHeight: 1.05, opacity: 0.78 }}>Média {avg}</div>
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
            <div style={{ fontSize: 12, color: COLORS.subtext, marginTop: 8 }}>
              Arraste as planilhas .xlsx em qualquer área da página para carregar automaticamente.
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
