'use client';
import { useEffect, useMemo, useState } from 'react';
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
  LabelList
} from 'recharts';

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cidade, setCidade] = useState('');
  const [conferente, setConferente] = useState('');
  const [topN, setTopN] = useState(5);

  // Responsividade: detecta viewport < md (768px)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams({ from, to, cidade, conferente }).toString();
      const res = await fetch(`/api/stats?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar');
      setData(json);
      setErr('');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  // auto-reload quando filtros mudarem (com debounce)
  useEffect(() => {
    const t = setTimeout(() => {
      load();
    }, 300);
    return () => clearTimeout(t);
  }, [from, to, cidade, conferente]);

  const safe = (x: any) => (Array.isArray(x) ? x : []);
  const fmt2 = (x: any) => (x ? x.toLocaleString('pt-BR') : '0');

  const pedidosConf = useMemo(() => safe(data?.charts?.pedidosPorConferente).slice(0, topN), [data, topN]);
  const itensConf = useMemo(() => safe(data?.charts?.itensPorConferente).slice(0, topN), [data, topN]);
  const jornadaConf = useMemo(() => safe(data?.charts?.jornadaPorConferente).slice(0, topN), [data, topN]);
  const pedidosHoraConf = useMemo(() => safe(data?.charts?.pedidosHoraPorConferente).slice(0, topN), [data, topN]);
  const pedidosCidade = useMemo(() => safe(data?.charts?.pedidosPorCidade).slice(0, topN), [data, topN]);

  const cities = safe(data?.filters?.cidades);
  const conferentes = safe(data?.filters?.conferentes);

  return (
    <main className="max-w-7xl mx-auto p-4 md:p-6">
      {/* Cabeçalho com logo e padrão de cores (BI Service) */}
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

          {/* Botão Upload */}
          <button
            onClick={() => (window.location.href = '/area/upload')}
            className="flex items-center gap-2 px-3 md:px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-600 transition font-semibold text-white text-sm md:text-base"
          >
            <Upload size={18} />
            Upload
          </button>

          {/* 🔵 Botão Estoque → /dashboard-estoque */}
          <button
            onClick={() => router.push('/dashboard-estoque')}
            className="flex items-center gap-2 px-3 md:px-4 py-2 rounded bg-sky-500 hover:bg-sky-600 transition font-semibold text-white text-sm md:text-base"
          >
            Estoque
          </button>

          {/* Botão Sair — retorna para Home */}
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3"
      >
        <Filter label="Período (De)" type="date" value={from} onChange={setFrom} />
        <Filter label="Período (Até)" type="date" value={to} onChange={setTo} />
        <Select label="Cidade" value={cidade} onChange={setCidade} options={cities} placeholder="Todas" />
        <Select label="Conferente" value={conferente} onChange={setConferente} options={conferentes} placeholder="Todos" />
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

      {/* Erro */}
      {err && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-sm">
          {err}
        </div>
      )}

      {/* Cards de Totais */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.8 }}
        className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
      >
        <InfoCard title="Total de Pedidos" value={fmt2(data?.totals?.totalPedidos)} color="#3b82f6" />
        <InfoCard title="Total de Itens" value={fmt2(data?.totals?.totalItens)} color="#22c55e" />
        <InfoCard title="Jornada Total (h)" value={fmt2(data?.totals?.jornadaTotal)} color="#f59e0b" />
        <InfoCard title="Pedidos/Hora (geral)" value={fmt2(data?.totals?.pedidosHoraGeral)} color="#8b5cf6" />
      </motion.div>

      {/* Gráficos */}
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
          bottom: isMobile ? 48 : 56
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
        <Legend
          verticalAlign="bottom"
          wrapperStyle={{ bottom: 4 }}
          formatter={() => label}
        />
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
        <option value="" className="text-black">{placeholder}</option>
        {options.map((o: any) => (
          <option key={String(o)} value={String(o)} className="text-black">
            {String(o)}
          </option>
        ))}
      </select>
    </div>
  );
}
