'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Upload as UploadIcon,
  CheckCircle2,
  XCircle,
  LogOut,
  BarChart3,
  Boxes,
} from 'lucide-react';
import * as XLSX from 'xlsx';

// helpers do bloco BOTI / Estoque
import {
  readFileWithProgress,
  fetchPdvCityMap,
  computeFromWorkbookEstoque,
  extractSalesRowsAll,
  saveSessionData,
} from '@/app/boti/boti-lib';

type MsgState = { ok: boolean; text: string } | null;

/* ========= HELPERS PARA CONFERÊNCIA (APENAS PARA O DASHBOARD) ========= */

type ConfRow = {
  conferente: string | null;
  cidade: string | null;
  datadia: Date | null;
  datahora: Date | null;
  qtdpedidos: number;
  qtditens: number;
};

// Mesmos helpers de data usados no dashboard/conferência
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

// mesmas colunas usadas no backend/dashboard conferência
const CONF_COL = { G: 6, J: 9, W: 22, AH: 33, AI: 34 } as const;

/**
 * Lê o arquivo de CONFERÊNCIA no client, extrai as linhas
 * e salva em localStorage.conferenciaRows
 * para o dashboard de conferência usar.
 */
async function processConferenciaFileAndStore(file: File) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return;

  const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: null,
  });

  const mapped: ConfRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const conferente = normStr(r[CONF_COL.AH]);
    const dataCell = r[CONF_COL.AI];
    const cidadeAddr = r[CONF_COL.W];
    const qtdpedidos = r[CONF_COL.G] ?? 0;
    const qtditens = r[CONF_COL.J] ?? 0;

    const datahora = toDateFlexible(dataCell);
    const datadia = onlyDate(datahora);

    const row: ConfRow = {
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

  if (!mapped.length) return;

  const serializable = mapped.map((r) => ({
    ...r,
    datadia: r.datadia ? r.datadia.toISOString() : null,
    datahora: r.datahora ? r.datahora.toISOString() : null,
  }));

  if (typeof window !== 'undefined') {
    localStorage.setItem('conferenciaRows', JSON.stringify(serializable));
  }
}

/* ========= COMPONENTE PRINCIPAL ========= */

export default function UploadPage() {
  const router = useRouter();

  // ====== UPLOAD CONFERÊNCIA (API /api/upload) ======
  const confInputRef = useRef<HTMLInputElement | null>(null);
  const [confFile, setConfFile] = useState<File | null>(null);
  const [sendingConf, setSendingConf] = useState(false);
  const [progressConf, setProgressConf] = useState(0);
  const [etaConf, setEtaConf] = useState<string | null>(null);
  const [startedAtConf, setStartedAtConf] = useState<number | null>(null);
  const [msgConf, setMsgConf] = useState<MsgState>(null);

  // ====== UPLOAD ESTOQUE ======
  const estoqueInputRef = useRef<HTMLInputElement | null>(null);
  const [estoqueFile, setEstoqueFile] = useState<File | null>(null);
  const [sendingEstoque, setSendingEstoque] = useState(false);
  const [progressEstoque, setProgressEstoque] = useState(0);
  const [msgEstoque, setMsgEstoque] = useState<MsgState>(null);

  // bloqueia acesso sem token
  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) router.replace('/login');
  }, [router]);

  // ========= HANDLERS CONFERÊNCIA =========
  function onPickConfFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setConfFile(f);
  }

  async function doUploadConferencia() {
    if (!confFile) {
      setMsgConf({ ok: false, text: 'Selecione o arquivo de conferência primeiro.' });
      return;
    }
    setMsgConf(null);
    setSendingConf(true);
    setProgressConf(0);
    setEtaConf(null);
    setStartedAtConf(Date.now());

    try {
      // 🔹 Já prepara os dados pro dashboard de conferência (localStorage)
      try {
        await processConferenciaFileAndStore(confFile);
      } catch (err) {
        console.error('Erro ao processar conferência para dashboard:', err);
      }

      const token = localStorage.getItem('token') || '';
      const fd = new FormData();
      fd.append('tenant', 'Default');
      fd.append('file', confFile);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload', true);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setProgressConf(pct);

          if (startedAtConf && e.loaded > 0) {
            const elapsed = (Date.now() - startedAtConf) / 1000;
            const rate = e.loaded / elapsed; // bytes/s
            const remaining = e.total - e.loaded;
            const seconds = remaining / (rate || 1);
            if (isFinite(seconds)) {
              const m = Math.floor(seconds / 60);
              const s = Math.round(seconds % 60);
              setEtaConf(`${m}m ${s}s`);
            }
          }
        }
      };

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            setMsgConf({ ok: true, text: 'Upload concluído com sucesso!' });
            // (opcional) aqui já está pronto para o dashboard ler do localStorage
          } else {
            setMsgConf({
              ok: false,
              text: xhr.responseText || 'Falha ao enviar arquivo de conferência.',
            });
          }
          setSendingConf(false);
          setProgressConf(100);
          setEtaConf(null);
        }
      };

      xhr.onerror = () => {
        setSendingConf(false);
        setMsgConf({ ok: false, text: 'Erro de rede ao enviar arquivo.' });
      };

      xhr.send(fd);
    } catch (err: any) {
      setSendingConf(false);
      setMsgConf({ ok: false, text: err?.message || 'Falha ao enviar arquivo.' });
    }
  }

  // ========= HANDLERS ESTOQUE (NÃO MEXI EM NADA) =========
  function onPickEstoqueFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setEstoqueFile(f);
  }

  async function doUploadEstoque() {
    if (!estoqueFile) {
      setMsgEstoque({ ok: false, text: 'Selecione o arquivo de estoque primeiro.' });
      return;
    }
    setMsgEstoque(null);
    setSendingEstoque(true);
    setProgressEstoque(0);

    try {
      const buf = (await readFileWithProgress(
        estoqueFile,
        (p: number) => setProgressEstoque(p),
      )) as ArrayBuffer;

      const wb = XLSX.read(buf, { type: 'array' });

      const pdvMap = await fetchPdvCityMap();
      const estoqueAll = computeFromWorkbookEstoque(wb, pdvMap);
      const vendasAll = extractSalesRowsAll(wb, pdvMap);

      const payload = { estoque: estoqueAll, vendas: vendasAll };

      // mantém a gravação via helper (caso use em outro lugar)
      saveSessionData(payload);

      // ✅ guarda em memória global, sem limite de tamanho
      if (typeof window !== 'undefined') {
        (window as any).__BI_BOTI_DATA__ = payload;
      }

      setMsgEstoque({
        ok: true,
        text: 'Arquivo de estoque processado! Abra os dashboards para visualizar.',
      });
      setProgressEstoque(100);
    } catch (err: any) {
      console.error(err);
      setMsgEstoque({
        ok: false,
        text: err?.message || 'Falha ao processar arquivo de estoque.',
      });
    } finally {
      setSendingEstoque(false);
    }
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('token');
    router.push('/');
  }

  return (
    <main className="min-h-screen bg-[#0a0f1a]">
      {/* HEADER */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-4 md:pt-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <img src="/logo/logo.png" alt="BI Service" className="w-12 h-12 md:w-16 md:h-16" />
            <h1 className="text-lg md:text-2xl font-bold">
              <span className="text-white">BI</span>{' '}
              <span className="text-blue-400">Service</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs md:text-sm"
            >
              <BarChart3 size={16} />
              Conferência
            </button>
            <button
              onClick={() => router.push('/dashboard-estoque')}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs md:text-sm"
            >
              <Boxes size={16} />
              Estoque
            </button>
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-xs md:text-sm"
            >
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 pb-24">
        <motion.div
          className="mt-6 md:mt-8 mb-3 md:mb-4"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            <span className="text-white">Upload</span>{' '}
            <span className="text-blue-400">de Arquivos</span>
          </h2>
          <p className="text-xs md:text-sm text-white/70 mt-2">
            Envie o arquivo de <strong>Conferência</strong> (Dashboard Conferência) e o arquivo de{' '}
            <strong>Estoque</strong> (dashboards de Estoque / Vendas / Mínimo / Plano).
          </p>
        </motion.div>

        {/* CARD 1 – CONFERÊNCIA */}
        <motion.div
          className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6 mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
        >
          <h3 className="text-lg md:text-xl font-semibold mb-1">
            Arquivo de <span className="text-blue-400">Conferência</span>
          </h3>

          <p className="text-xs md:text-sm text-white/70 mb-4">
            Esse arquivo alimenta os dashboards de <strong>Conferência</strong>.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              type="button"
              onClick={() => confInputRef.current?.click()}
              disabled={sendingConf}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 bg-black/30 hover:bg-black/40 text-sm md:text-base"
            >
              <UploadIcon size={18} />
              {confFile ? 'Trocar arquivo de conferência' : 'Selecionar arquivo de conferência'}
            </button>

            {confFile && (
              <div className="flex-1 text-xs md:text-sm text-white/80 truncate">
                <span className="font-medium">{confFile.name}</span>{' '}
                <span className="text-white/50">
                  ({(confFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
            )}

            <input
              ref={confInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={onPickConfFile}
              disabled={sendingConf}
            />
          </div>

          {sendingConf && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1 text-xs md:text-sm">
                <span className="text-white/70">Enviando conferência…</span>
                <span className="text-white/60">{progressConf}%</span>
              </div>
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-blue-500 transition-all"
                  style={{ width: `${progressConf}%` }}
                />
              </div>
              {etaConf && (
                <div className="text-[11px] md:text-xs text-white/60 mt-1">
                  Estimativa: {etaConf}
                </div>
              )}
            </div>
          )}

          {msgConf && (
            <div
              className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                msgConf.ok
                  ? 'bg-green-500/10 text-green-300 border border-green-400/20'
                  : 'bg-red-500/10 text-red-300 border border-red-400/20'
              }`}
            >
              {msgConf.ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              {msgConf.text}
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={doUploadConferencia}
              disabled={!confFile || sendingConf}
              className={`inline-flex justify-center items-center gap-2 px-4 py-2 rounded-lg border transition text-sm md:text-base ${
                !confFile || sendingConf
                  ? 'cursor-not-allowed opacity-60 border-white/10 bg-white/10'
                  : 'border-blue-500/40 bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <UploadIcon size={18} />
              {sendingConf ? 'Enviando...' : 'Enviar conferência'}
            </button>

            {msgConf?.ok && (
              <button
                onClick={() => router.push('/dashboard')}
                className="inline-flex justify-center items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm md:text-base"
              >
                <BarChart3 size={18} />
                Ir para Dashboard Conferência
              </button>
            )}
          </div>
        </motion.div>

        {/* CARD 2 – ESTOQUE (INTACTO) */}
        <motion.div
          className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <h3 className="text-lg md:text-xl font-semibold mb-3">
            Arquivo de <span className="text-green-400">Estoque</span> (Boti)
          </h3>
          <p className="text-xs md:text-sm text-white/70 mb-3">
            Esse arquivo alimenta os dashboards de <strong>Estoque</strong>,{' '}
            <strong>Vendas</strong>, <strong>Estoque Mínimo</strong> e{' '}
            <strong>Plano de Transferências &amp; Compras</strong>.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              type="button"
              onClick={() => estoqueInputRef.current?.click()}
              disabled={sendingEstoque}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 bg-black/30 hover:bg-black/40 text-sm md:text-base"
            >
              <UploadIcon size={18} />
              {estoqueFile ? 'Trocar arquivo de estoque' : 'Selecionar arquivo de estoque'}
            </button>
            {estoqueFile && (
              <div className="flex-1 text-xs md:text-sm text-white/80 truncate">
                <span className="font-medium">{estoqueFile.name}</span>{' '}
                <span className="text-white/50">
                  ({(estoqueFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
            )}
            <input
              ref={estoqueInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={onPickEstoqueFile}
              disabled={sendingEstoque}
            />
          </div>

          {sendingEstoque && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1 text-xs md:text-sm">
                <span className="text-white/70">Processando estoque…</span>
                <span className="text-white/60">{progressEstoque}%</span>
              </div>
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-green-500 transition-all"
                  style={{ width: `${progressEstoque}%` }}
                />
              </div>
            </div>
          )}

          {msgEstoque && (
            <div
              className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                msgEstoque.ok
                  ? 'bg-green-500/10 text-green-300 border border-green-400/20'
                  : 'bg-red-500/10 text-red-300 border border-red-400/20'
              }`}
            >
              {msgEstoque.ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              {msgEstoque.text}
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={doUploadEstoque}
              disabled={!estoqueFile || sendingEstoque}
              className={`inline-flex justify-center items-center gap-2 px-4 py-2 rounded-lg border transition text-sm md:text-base ${
                !estoqueFile || sendingEstoque
                  ? 'cursor-not-allowed opacity-60 border-white/10 bg-white/10'
                  : 'border-green-500/40 bg-green-600 hover:bg-green-700'
              }`}
            >
              <UploadIcon size={18} />
              {sendingEstoque ? 'Processando...' : 'Processar estoque'}
            </button>

            {msgEstoque?.ok && (
              <button
                onClick={() => router.push('/dashboard-estoque')}
                className="inline-flex justify-center items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm md:text-base"
              >
                <Boxes size={18} />
                Ir para Dashboard Estoque
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </main>
  );
}
