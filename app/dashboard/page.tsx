'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { LogOut, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import * as XLSX from 'xlsx';

/* ====== TIPOS ====== */
type Row = {
  conferente: string | null;
  cidade: string | null;
  datadia: Date | null;
  datafat?: Date | null;
  datahora: Date | null;
  qtdpedidos: number;
  qtditens: number;
};

type StatsResult = {
  totals: {
    totalPedidos: number;
    totalItens: number;
    jornadaTotal: number;
    pedidosHoraGeral: number;
  };
  charts: {
    pedidosPorConferente: { conferente: string; pedidos: number }[];
    itensPorConferente: { conferente: string; itens: number }[];
    jornadaPorConferente: { conferente: string; horas: number }[];
    pedidosHoraPorConferente: { conferente: string; pedidos_hora: number }[];
    pedidosPorCidade: { cidade: string; pedidos: number }[];
  };
  filters: {
    cidades: string[];
    conferentes: string[];
  };
};

/* ====== HELPERS DE DATA / STRING ====== */
function excelSerialToDate(n: number): Date | null {
  if (!isFinite(n)) return null;
  const ms = (n - 25569) * 86400 * 1000;
  const d = new Date(ms);
  return isNaN(+d) ? null : d;
}
function parsePtBrDate(s: string): Date | null {
  const m = s.match(
    /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!m) return null;
  const dd = +m[1];
  const MM = +m[2] - 1;
  const yyyy = +(m[3].length === 2 ? '20' + m[3] : m[3]);
  const hh = m[4] ? +m[4] : 0;
  const mm = m[5] ? +m[5] : 0;
  const ss = m[6] ? +m[6] : 0;
  const d = new Date(yyyy, MM, dd, hh, mm, ss);
  return isNaN(+d) ? null : d;
}
function parseIsoOrUs(s: string): Date | null {
  const d1 = new Date(s);
  if (!isNaN(+d1)) return d1;
  const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    const MM = +m[1] - 1;
    const dd = +m[2];
    const yyyy = +(m[3].length === 2 ? '20' + m[3] : m[3]);
    const d2 = new Date(yyyy, MM, dd);
    if (!isNaN(+d2)) return d2;
  }
  return null;
}
function toDateFlexible(v: any): Date | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return excelSerialToDate(v);
  if (v instanceof Date) return isNaN(+v) ? null : v;
  return parsePtBrDate(String(v).trim()) || parseIsoOrUs(String(v).trim()) || null;
}
function onlyDate(d: Date | null): Date | null {
  if (!d) return null;
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function normStr(v: any): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}
function extractCity(addr: any): string | null {
  const s = normStr(addr);
  if (!s) return null;
  const m = s.match(/\s-\s*([A-ZÁ-Ü\s]+?)\s-\s*[A-Z]{2}\s*$/i);
  if (m && m[1]) return m[1].toString().trim().toUpperCase();
  const parts = s.split(' - ').map((p) => p.trim());
  if (parts.length >= 2) {
    const penultimo = parts[parts.length - 2];
    if (penultimo) return penultimo.toUpperCase();
  }
  const tokens = s.split(/[,/;-]/).map((p) => p.trim()).filter(Boolean);
  return tokens.length ? tokens[tokens.length - 1].toUpperCase() : null;
}

/* mesmas colunas do backend */
const COL = { G: 6, J: 9, M: 12, W: 22, AH: 33, AI: 34 } as const;

/* ====== PARSE XLSX NO CLIENT ====== */
function parseWorkbookToRows(wb: XLSX.WorkBook): Row[] {
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const mapped: Row[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const conferente = normStr(r[COL.AH]);
    const dataCell = r[COL.AI];
    const datafatCell = r[COL.M]; // coluna M (DataFaturamentoPedido)
    const cidadeAddr = r[COL.W];
    const qtdpedidos = r[COL.G] ?? 0;
    const qtditens = r[COL.J] ?? 0;

    const datahora = toDateFlexible(dataCell);
    const datafat = toDateFlexible(datafatCell);
    const datadia = onlyDate(datahora);

    const row: Row = {
      conferente,
      cidade: extractCity(cidadeAddr),
      qtdpedidos: Number(qtdpedidos) || 0,
      qtditens: Number(qtditens) || 0,
      datahora,
      datadia,
    };

    if (row.conferente || row.qtdpedidos || row.qtditens || row.datahora) {
      mapped.push(row);
    }
  }

  return mapped;
}

/* ====== AGREGAÇÃO ====== */
function buildStats(allRows: Row[], filteredRows: Row[]): StatsResult {
  let totalPedidos = 0;
  let totalItens = 0;

  const somaPedidosPorConf = new Map<string, number>();
  const somaItensPorConf = new Map<string, number>();
  const somaPedidosPorCidade = new Map<string, number>();
  const jornadaPorDiaConf = new Map<string, { min: number; max: number }>();

  for (const r of filteredRows) {
    const conf = (r.conferente ?? '—').trim();
    const cid = (r.cidade ?? '—').trim();
    const itens = Number(r.qtditens ?? 0);

    const qtd = Number(r.qtdpedidos);
    const pedidosEff = Number.isFinite(qtd) && qtd > 0 ? qtd : itens > 0 ? 1 : 0;

    totalPedidos += pedidosEff;
    totalItens += itens;

    somaPedidosPorConf.set(conf, (somaPedidosPorConf.get(conf) ?? 0) + pedidosEff);
    somaItensPorConf.set(conf, (somaItensPorConf.get(conf) ?? 0) + itens);
    somaPedidosPorCidade.set(cid, (somaPedidosPorCidade.get(cid) ?? 0) + pedidosEff);

    if (r.datadia && r.datahora) {
      const diaStr = r.datadia.toISOString().slice(0, 10);
      const key = `${conf}__${diaStr}`;
      const ts = r.datahora.getTime();
      const cur = jornadaPorDiaConf.get(key);
      if (!cur) {
        jornadaPorDiaConf.set(key, { min: ts, max: ts });
      } else {
        if (ts < cur.min) cur.min = ts;
        if (ts > cur.max) cur.max = ts;
      }
    }
  }

  const somaHorasPorConf = new Map<string, number>();
  for (const [key, mm] of jornadaPorDiaConf.entries()) {
    const [conf] = key.split('__');
    const horasDia = Math.max(0, (mm.max - mm.min) / 3_600_000);
    somaHorasPorConf.set(conf, (somaHorasPorConf.get(conf) ?? 0) + horasDia);
  }

  const pedidosPorConferente = Array.from(somaPedidosPorConf.entries())
    .map(([conferente, pedidos]) => ({ conferente, pedidos }))
    .sort((a, b) => b.pedidos - a.pedidos);

  const itensPorConferente = Array.from(somaItensPorConf.entries())
    .map(([conferente, itens]) => ({ conferente, itens }))
    .sort((a, b) => b.itens - a.itens);

  const jornadaPorConferente = Array.from(somaHorasPorConf.entries())
    .map(([conferente, horas]) => ({ conferente, horas: Number(horas.toFixed(2)) }))
    .sort((a, b) => (b.horas ?? 0) - (a.horas ?? 0));

  const pedidosHoraPorConferente = pedidosPorConferente
    .map((p) => {
      const horas = somaHorasPorConf.get(p.conferente) ?? 0;
      const pedidos_hora = horas > 0 ? p.pedidos / horas : 0;
      return { conferente: p.conferente, pedidos_hora: Number(pedidos_hora.toFixed(2)) };
    })
    .sort((a, b) => b.pedidos_hora - a.pedidos_hora);

  const pedidosPorCidade = Array.from(somaPedidosPorCidade.entries())
    .map(([cidade, pedidos]) => ({ cidade, pedidos }))
    .sort((a, b) => b.pedidos - a.pedidos);

  const cidades = Array.from(
    new Set(allRows.map((r) => (r.cidade ? String(r.cidade) : '—')))
  ).sort();
  const conferentes = Array.from(
    new Set(allRows.map((r) => (r.conferente ? String(r.conferente) : '—')))
  ).sort();

  const jornadaTotal = Array.from(somaHorasPorConf.values()).reduce(
    (a, b) => a + (b ?? 0),
    0
  );
  const pedidosHoraGeral =
    jornadaTotal > 0 ? Number((totalPedidos / jornadaTotal).toFixed(2)) : 0;

  return {
    totals: {
      totalPedidos,
      totalItens,
      jornadaTotal: Number(jornadaTotal.toFixed(2)),
      pedidosHoraGeral,
    },
    charts: {
      pedidosPorConferente,
      itensPorConferente,
      jornadaPorConferente,
      pedidosHoraPorConferente,
      pedidosPorCidade,
    },
    filters: {
      cidades,
      conferentes,
    },
  };
}

/* =============== PAGE =============== */

export default function DashboardPage() {
  const router = useRouter();

  const [allRows, setAllRows] = useState<Row[]>([]);
  const [data, setData] = useState<StatsResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cidade, setCidade] = useState('');
  const [conferente, setConferente] = useState('');
  const [topN, setTopN] = useState(5);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [modoTelao, setModoTelao] = useState(false);

  // Telão responsivo por escala (base 1920x1080)
  const BASE_W = 1920;
  const BASE_H = 1080;
  const [vp, setVp] = useState({ w: 1920, h: 1080 });

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const scaleTelao = useMemo(() => {
    const sw = vp.w / BASE_W;
    const sh = vp.h / BASE_H;
    return Math.min(sw, sh);
  }, [vp.w, vp.h]);

  const monthLabel = useMemo(() => {
    const monthNames = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    const d =
      allRows.find((r) => r?.datafat instanceof Date && !isNaN(+r.datafat))?.datafat ||
      allRows.find((r) => r?.datadia instanceof Date && !isNaN(+r.datadia))?.datadia ||
      null;
    if (!d) return '';
    return (monthNames[d.getMonth()] || '').toLowerCase();
  }, [allRows]);

  const [diaDe, setDiaDe] = useState<number>(1);
  const [diaAte, setDiaAte] = useState<number>(31);

  // no modo telão, aplica range de dias no mesmo mês detectado (coluna M)
  useEffect(() => {
    if (!modoTelao) return;
    const d =
      allRows.find((r) => r?.datafat instanceof Date && !isNaN(+r.datafat))?.datafat ||
      allRows.find((r) => r?.datadia instanceof Date && !isNaN(+r.datadia))?.datadia ||
      null;
    if (!d) return;

    const y = d.getFullYear();
    const m = d.getMonth();
    const dim = new Date(y, m + 1, 0).getDate();
    const clamp = (v: number) => Math.max(1, Math.min(dim, v || 1));
    const a = clamp(diaDe);
    const b = clamp(diaAte);
    const start = new Date(y, m, Math.min(a, b));
    const end = new Date(y, m, Math.max(a, b));

    const iso = (dt: Date) => dt.toISOString().slice(0, 10);
    setFrom(iso(start));
    setTo(iso(end));
  }, [modoTelao, diaDe, diaAte, allRows]);


  // 🔹 pega dados vindos da /area/upload (localStorage.conferenciaRows)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (allRows.length) return;

    const raw = localStorage.getItem('conferenciaRows');
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as any[];
      const rows: Row[] = parsed.map((r) => ({
        conferente: r.conferente ?? null,
        cidade: r.cidade ?? null,
        qtdpedidos: Number(r.qtdpedidos ?? 0),
        qtditens: Number(r.qtditens ?? 0),
        datadia: r.datadia ? new Date(r.datadia) : null,
        datahora: r.datahora ? new Date(r.datahora) : null,
      }));

      if (rows.length) {
        setAllRows(rows);
      }
    } catch (e) {
      console.error('Erro carregando conferenciaRows do localStorage', e);
    }
  }, [allRows.length]);

  // Responsivo
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Recalcula stats
  useEffect(() => {
    if (!allRows.length) {
      setData(null);
      return;
    }

    const filtered = allRows.filter((r) => {
      let ok = true;

      if (from) {
        const dFrom = new Date(`${from}T00:00:00`);
        if (!r.datadia || r.datadia < dFrom) ok = false;
      }
      if (to) {
        const dTo = new Date(`${to}T23:59:59.999`);
        if (!r.datadia || r.datadia > dTo) ok = false;
      }
      if (cidade) {
        const cid = (r.cidade ?? '—').trim();
        if (cid !== cidade) ok = false;
      }
      if (conferente) {
        const conf = (r.conferente ?? '—').trim();
        if (conf !== conferente) ok = false;
      }

      return ok;
    });

    const stats = buildStats(allRows, filtered);
    setData(stats);
    setErr('');
  }, [allRows, from, to, cidade, conferente]);

  /* ====== Upload local direto no dashboard ====== */
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    setLoading(true);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const rows = parseWorkbookToRows(wb);
      if (!rows.length) {
        setErr('Não encontrei linhas válidas na planilha.');
        setAllRows([]);
      } else {
        const serializable = rows.map((r) => ({
          ...r,
          datadia: r.datadia ? r.datadia.toISOString() : null,
          datahora: r.datahora ? r.datahora.toISOString() : null,
        }));
        if (typeof window !== 'undefined') {
          localStorage.setItem('conferenciaRows', JSON.stringify(serializable));
        }
        setAllRows(rows);
      }
    } catch (error: any) {
      console.error(error);
      setErr(error?.message || 'Erro ao ler a planilha');
      setAllRows([]);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const safeArray = (x: any) => (Array.isArray(x) ? x : []);
  const fmt2 = (x: any) =>
    x !== null && x !== undefined ? Number(x).toLocaleString('pt-BR') : '0';

  const pedidosConf = useMemo(
    () => safeArray(data?.charts?.pedidosPorConferente).slice(0, topN),
    [data, topN]
  );
  const itensConf = useMemo(
    () => safeArray(data?.charts?.itensPorConferente).slice(0, topN),
    [data, topN]
  );
  const jornadaConf = useMemo(
    () => safeArray(data?.charts?.jornadaPorConferente).slice(0, topN),
    [data, topN]
  );
  const pedidosHoraConf = useMemo(
    () => safeArray(data?.charts?.pedidosHoraPorConferente).slice(0, topN),
    [data, topN]
  );
  const pedidosCidade = useMemo(
    () => safeArray(data?.charts?.pedidosPorCidade).slice(0, topN),
    [data, topN]
  );

  const cities = safeArray(data?.filters?.cidades);
  const conferentes = safeArray(data?.filters?.conferentes);

  return (
    <main className={modoTelao ? "w-screen h-screen overflow-hidden p-3" : "max-w-7xl mx-auto p-4 md:p-6"}>

      <div className={modoTelao ? "h-screen overflow-hidden" : ""}>
        {modoTelao && (
          <div className="w-screen h-screen overflow-hidden">
            <div
              style={{
                width: BASE_W,
                height: BASE_H,
                transform: `scale(${scaleTelao})`,
                transformOrigin: "top left",
              }}
            >

        {modoTelao && (
          <div className="mt-2 grid grid-cols-12 gap-2 items-stretch">
            <div className="col-span-3 rounded-xl border border-white/10 bg-white/5 p-2">
              <div className="text-xs opacity-70 mb-1">Dia</div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={diaDe}
                  onChange={(e) => setDiaDe(Number(e.target.value || 1))}
                  className="w-16 bg-white/10 border border-white/10 rounded px-2 py-1 text-white text-sm"
                />
                <span className="opacity-60 text-sm">a</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={diaAte}
                  onChange={(e) => setDiaAte(Number(e.target.value || 31))}
                  className="w-16 bg-white/10 border border-white/10 rounded px-2 py-1 text-white text-sm"
                />
              </div>
            </div>

            <div className="col-span-5 rounded-xl border border-white/10 bg-white/5 p-2 flex items-center justify-center relative">
              {/* TELAO_TOGGLE_BTN */}
              <button
                onClick={() => setModoTelao(false)}
                className="absolute top-2 right-2 rounded bg-white/10 border border-white/10 px-3 py-1 text-xs text-white hover:bg-white/15"
                title="Voltar para modo normal"
              >
                Modo Normal
              </button>
              <div className="text-5xl font-semibold tracking-wide" style={{ textTransform: "lowercase" }}>
                {monthLabel || ""}
              </div>
              <div className="text-xs opacity-60 ml-3">Mês</div>
            </div>

            <div className="col-span-4 grid grid-cols-2 gap-2">
              <InfoCard title="Total Pedidos" value={data?.totals?.totalPedidos ?? 0} color="#60a5fa" />
              <InfoCard title="Total Itens" value={data?.totals?.totalItens ?? 0} color="#34d399" />
              <InfoCard title="Jornada Total (h)" value={data?.totals?.jornadaTotal ?? 0} color="#fbbf24" />
              <InfoCard title="Média Pedidos por Hora" value={data?.totals?.pedidosHoraGeral ?? 0} color="#a78bfa" />
            </div>
          </div>
        )}

        {/* TELÃO: GRID GRAFICOS 1920x1080 */}
        {modoTelao && (
          <div
            className="mt-2 grid grid-rows-2 gap-2"
            style={{ height: BASE_H - 210 }}
          >
            {/* Linha 1 */}
            <div className="grid grid-cols-2 gap-2 min-h-0">
              <div className="min-h-0">
                <AnimatedChart title="Pedidos por Conferente" data={data?.charts?.pedidosPorConferente ?? []} color="#60a5fa" dataKey="pedidos" label="pedidos" isMobile={false} modoTelao={true} />
              </div>
              <div className="min-h-0">
                <AnimatedChart title="Itens por Conferente" data={data?.charts?.itensPorConferente ?? []} color="#34d399" dataKey="itens" label="itens" isMobile={false} modoTelao={true} />
              </div>
            </div>

            {/* Linha 2 */}
            <div className="grid grid-cols-3 gap-2 min-h-0">
              <div className="min-h-0">
                <AnimatedChart title="Jornada de Horas por Conferente" data={data?.charts?.jornadaPorConferente ?? []} color="#fbbf24" dataKey="horas" label="horas" isMobile={false} modoTelao={true} />
              </div>
              <div className="min-h-0">
                <AnimatedChart title="Pedidos por Hora por Conferente" data={data?.charts?.pedidosHoraPorConferente ?? []} color="#a78bfa" dataKey="pedidos_hora" label="pedidos_hora" isMobile={false} modoTelao={true} />
              </div>
              <div className="min-h-0">
                <AnimatedChart title="Pedidos por Cidade" data={data?.charts?.pedidosPorCidade ?? []} color="#f472b6" dataKey="pedidos" label="cidades" isMobile={false} modoTelao={true} />
              </div>
            </div>
          </div>
        )}
            </div>
          </div>
        )}


        <div className="">

      {/* Cabeçalho */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 border-b border-white/10 pb-3 md:pb-4 mb-4"
      >
        <div className="flex items-center gap-2 md:gap-3">
          <img src="/logo/logo.png" alt="BI Service" className="w-10 h-10 md:w-20 md:h-20" />
          <h1 className="text-xl md:text-2xl font-bold">
            <span className="text-white">Dashboard </span>
            <span className="text-blue-400">de Conferência</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <label className="text-xs md:text-sm opacity-80">Top N</label>
          <select
            value={topN}
            onChange={(e) => setTopN(parseInt(e.target.value, 10))}
            className="bg-white text-black border border-gray-300 rounded px-2 md:px-3 py-1.5 md:py-2
                       focus:outline-none focus:ring-2 focus:ring-blue-400 [color-scheme:light] text-sm md:text-base"
          >
            {[5, 10, 15, 20].map((n) => (
              <option key={n} value={n} className="text-black">
                {n}
              </option>
            ))}
          </select>

          <button
            onClick={() => setModoTelao((v) => !v)}
            className="h-[42px] rounded bg-white/10 border border-white/10 px-3 text-sm text-white hover:bg-white/15"
          >
            {modoTelao ? "Modo Normal" : "Modo Telão"}
          </button>

          {/* Upload local (NÃO mexe no fluxo de estoque) */}
          <label className="flex items-center gap-2 px-3 md:px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-600 transition font-semibold text-white text-sm md:text-base cursor-pointer">
            <Upload size={18} />
            Upload local
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          <button
            onClick={() => router.push('/dashboard-estoque')}
            className="flex items-center gap-2 px-3 md:px-4 py-2 rounded bg-sky-500 hover:bg-sky-600 transition font-semibold text-white text-sm md:text-base"
          >
            Estoque
          </button>

          <button
            onClick={async () => {
              try {
                await fetch('/api/auth/logout', { method: 'POST' });
              } catch {}
              localStorage.removeItem('token');
              window.location.href = '/';
            }}
            className="flex items-center gap-2 px-3 md:px-4 py-2 rounded bg-red-600 hover:bg-red-700 transition font-semibold text-white text-sm md:text-base"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </motion.div>

      {/* Filtros */}
      {!modoTelao && (
      <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3"
      >
        <Filter label="Período (De)" type="date" value={from} onChange={setFrom} />
        <Filter label="Período (Até)" type="date" value={to} onChange={setTo} />
        <Select label="Cidade" value={cidade} onChange={setCidade} options={cities} placeholder="Todas" />
        <Select
          label="Conferente"
          value={conferente}
          onChange={setConferente}
          options={conferentes}
          placeholder="Todos"
        />
        <div className="flex items-end">
          <button
            onClick={() => {
              setCidade('');
              setConferente('');
              setFrom('');
              setTo('');
            }}
            className="w-full h-[42px] rounded bg-white/10 border border-white/10"
          >
            Limpar filtros
          </button>
        </div>
      </motion.div>

      {/* Mensagens */}
      {err && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-sm">
          {err}
        </div>
      )}

      {loading && (
        <div className="mt-4 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-blue-200 text-sm">
          Processando planilha...
        </div>
      )}

      {!loading && !err && !allRows.length && (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
          Envie o arquivo pela página de Upload ou use o botão &quot;Upload local&quot; para carregar a
          planilha de conferência.
        </div>
      )}

      {/* Cards + Gráficos */}
      {data && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
          >
            <InfoCard title="Total de Pedidos" value={fmt2(data.totals.totalPedidos)} color="#3b82f6" />
            <InfoCard title="Total de Itens" value={fmt2(data.totals.totalItens)} color="#22c55e" />
            <InfoCard title="Jornada Total (h)" value={fmt2(data.totals.jornadaTotal)} color="#f59e0b" />
            <InfoCard title="Pedidos/Hora (geral)" value={fmt2(data.totals.pedidosHoraGeral)} color="#8b5cf6" />
          </motion.div>

          <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
            <AnimatedChart
              title="Pedidos por Conferente"
              data={pedidosConf}
              color="#3b82f6"
              dataKey="pedidos"
              label="pedidos"
              isMobile={isMobile}
            />
            <AnimatedChart
              title="Itens por Conferente"
              data={itensConf}
              color="#22c55e"
              dataKey="itens"
              label="itens"
              isMobile={isMobile}
            />
            <AnimatedChart
              title="Jornada (horas) por Conferente"
              data={jornadaConf}
              color="#f59e0b"
              dataKey="horas"
              label="horas"
              isMobile={isMobile}
            />
            <AnimatedChart
              title="Pedidos por Hora por Conferente"
              data={pedidosHoraConf}
              color="#8b5cf6"
              dataKey="pedidos_hora"
              label="pedidos_hora"
              isMobile={isMobile}
            />
            <div className="xl:col-span-2">
              <AnimatedChart
                title="Pedidos por Cidade"
                data={pedidosCidade}
                color="#ec4899"
                dataKey="pedidos"
                label="Cidades"
                isMobile={isMobile}
              />
            </div>
          </div>
        </>
      )}

      </>
      )}

        </div>
      </div>

    </main>
  );
}

/* ---------- COMPONENTES ---------- */

function InfoCard({ title, value, color }: { title: string; value: string | number; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-white/10 p-4 bg-white/5"
    >
      <div className="text-sm opacity-70">{title}</div>
      <div className="text-2xl font-semibold mt-1" style={{ color }}>
        {value}
      </div>
    </motion.div>
  );
}

function Chart({ data, color, dataKey, label, isMobile }: any) {
  if (!data || data.length === 0)
    return (
      <div className="h-[300px] md:h-[340px] flex items-center justify-center text-sm opacity-70">
        Sem dados
      </div>
    );

  return (
    <ResponsiveContainer width="100%" height={isMobile ? 300 : 340}>
      <BarChart
        data={data}
        margin={{
          left: 8,
          right: isMobile ? 12 : 24,
          top: isMobile ? 20 : 28,
          bottom: isMobile ? 48 : 56,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis
          dataKey={dataKey === 'pedidos' && label === 'Cidades' ? 'cidade' : 'conferente'}
          stroke="#ccc"
          interval={0}
          angle={isMobile ? 20 : 30}
          textAnchor="start"
          height={isMobile ? 72 : 88}
          tick={{ fontSize: isMobile ? 9 : 10 }}
          tickMargin={isMobile ? 6 : 8}
          padding={{ left: 8, right: isMobile ? 24 : 40 }}
          tickFormatter={(v: string) => (isMobile && v?.length > 14 ? v.slice(0, 12) + '…' : v)}
        />
        <YAxis
          stroke="#ccc"
          domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
          tick={{ fontSize: isMobile ? 10 : 12 }}
        />
        <Tooltip />
        <Legend verticalAlign="bottom" wrapperStyle={{ bottom: 4 }} formatter={() => label} />
        <Bar dataKey={dataKey} fill={color} animationDuration={800}>
          <LabelList
            dataKey={dataKey}
            position="top"
            offset={isMobile ? 6 : 8}
            fill="#fff"
            fontSize={isMobile ? 11 : 12}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function AnimatedChart({ title, data, color, dataKey, label, isMobile }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
      className="rounded-2xl border border-white/10 p-4 md:p-4 bg-white/5"
    >
      <h3 className="font-semibold mb-2 text-base md:text-lg">{title}</h3>
      <Chart data={data} color={color} dataKey={dataKey} label={label} isMobile={isMobile} />
    </motion.div>
  );
}

function Filter({ label, type, value, onChange }: any) {
  return (
    <div className="flex flex-col">
      <label className="text-sm mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white/10 border border-white/10 rounded px-2 py-2 text-white"
      />
    </div>
  );
}

function Select({ label, value, onChange, options, placeholder }: any) {
  return (
    <div className="flex flex-col">
      <label className="text-sm mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white/10 border border-white/10 rounded px-2 py-2 text-white"
      >
        <option value="" className="text-black">
          {placeholder}
        </option>
        {options.map((o: any) => (
          <option key={String(o)} value={String(o)} className="text-black">
            {String(o)}
          </option>
        ))}
      </select>
    </div>
  );
}
