'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

type Row = {
  conferente: string | null;
  cidade: string | null;
  datadia: Date | null;
  datahora: Date | null;
  qtdpedidos: number;
  qtditens: number;
};

// ==== MESMOS HELPERS DO DASHBOARD (pode extrair pra um arquivo comum depois) ====
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
  const dd = +m[1],
    MM = +m[2] - 1,
    yyyy = +(m[3].length === 2 ? '20' + m[3] : m[3]);
  const hh = m[4] ? +m[4] : 0,
    mm = m[5] ? +m[5] : 0,
    ss = m[6] ? +m[6] : 0;
  const d = new Date(yyyy, MM, dd, hh, mm, ss);
  return isNaN(+d) ? null : d;
}
function parseIsoOrUs(s: string): Date | null {
  const d1 = new Date(s);
  if (!isNaN(+d1)) return d1;
  const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    const MM = +m[1] - 1,
      dd = +m[2],
      yyyy = +(m[3].length === 2 ? '20' + m[3] : m[3]);
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

const COL = { G: 6, J: 9, W: 22, AH: 33, AI: 34 } as const;

function parseWorkbookToRows(wb: XLSX.WorkBook): Row[] {
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const mapped: Row[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const conferente = normStr(r[COL.AH]);
    const dataCell = r[COL.AI];
    const cidadeAddr = r[COL.W];
    const qtdpedidos = r[COL.G] ?? 0;
    const qtditens = r[COL.J] ?? 0;

    const datahora = toDateFlexible(dataCell);
    const datadia = onlyDate(datahora);

    const row: Row = {
      conferente,
      cidade: extractCity(cidadeAddr),
      qtdpedidos: Number(qtdpedidos) || 0,
      qtditens: Number(qtditens) || 0,
      datahora,
      datadia
    };

    if (row.conferente || row.qtdpedidos || row.qtditens || row.datahora) {
      mapped.push(row);
    }
  }

  return mapped;
}

export default function UploadConferenciaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMsg('');

    try {
      // 1) Lê a planilha no browser
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const rows = parseWorkbookToRows(wb);

      if (!rows.length) {
        setMsg('Não encontrei linhas válidas na planilha.');
        setLoading(false);
        return;
      }

      // 2) Salva versão serializável no localStorage
      const serializable = rows.map((r) => ({
        ...r,
        datadia: r.datadia ? r.datadia.toISOString() : null,
        datahora: r.datahora ? r.datahora.toISOString() : null
      }));

      if (typeof window !== 'undefined') {
        localStorage.setItem('conferenciaRows', JSON.stringify(serializable));
      }

      // 3) (Opcional) enviar pro backend também
      const formData = new FormData();
      formData.append('file', file);
      try {
        await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
      } catch (err) {
        console.warn('Falha ao enviar para /api/upload (ignorado para o dashboard).', err);
      }

      setMsg(`Planilha carregada! Linhas lidas: ${rows.length}. Redirecionando...`);

      // 4) Vai para o dashboard de conferência
      setTimeout(() => {
        router.push('/dashboard');
      }, 800);
    } catch (error: any) {
      console.error(error);
      setMsg(error?.message || 'Erro ao processar a planilha');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <main className="max-w-xl mx-auto p-4 md:p-6">
      <h1 className="text-xl md:text-2xl font-bold mb-4">Upload de Conferência</h1>

      <label className="block">
        <span className="block mb-2">Selecione o arquivo XLSX/CSV:</span>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="block w-full text-sm text-white
                     file:mr-4 file:py-2 file:px-4
                     file:rounded-full file:border-0
                     file:text-sm file:font-semibold
                     file:bg-emerald-500 file:text-white
                     hover:file:bg-emerald-600"
        />
      </label>

      {loading && (
        <div className="mt-4 text-sm text-blue-200">
          Processando arquivo...
        </div>
      )}

      {msg && (
        <div className="mt-4 text-sm text-white/80">
          {msg}
        </div>
      )}
    </main>
  );
}
