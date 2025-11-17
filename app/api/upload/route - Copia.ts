import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/withAuth';
import { promises as fs } from 'fs';
import path from 'path';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

/* ====== helpers de data ====== */
function excelSerialToDate(n: number): Date | null {
  if (!isFinite(n)) return null;
  const ms = (n - 25569) * 86400 * 1000;
  const d = new Date(ms);
  return isNaN(+d) ? null : d;
}
function parsePtBrDate(s: string): Date | null {
  const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  const dd = +m[1], MM = +m[2] - 1, yyyy = +(m[3].length === 2 ? '20' + m[3] : m[3]);
  const hh = m[4] ? +m[4] : 0, mm = m[5] ? +m[5] : 0, ss = m[6] ? +m[6] : 0;
  const d = new Date(yyyy, MM, dd, hh, mm, ss);
  return isNaN(+d) ? null : d;
}
function parseIsoOrUs(s: string): Date | null {
  const d1 = new Date(s);
  if (!isNaN(+d1)) return d1;
  const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    const MM = +m[1] - 1, dd = +m[2], yyyy = +(m[3].length === 2 ? '20' + m[3] : m[3]);
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
  x.setHours(0,0,0,0);
  return x;
}

/* ====== helpers diversos ====== */
function normStr(v: any): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/** Extrai a cidade do endereço no formato “... - CIDADE - UF” */
function extractCity(addr: any): string | null {
  const s = normStr(addr);
  if (!s) return null;
  // tenta “ - CIDADE - UF” (fim)
  const m = s.match(/\s-\s*([A-ZÁ-Ü\s]+?)\s-\s*[A-Z]{2}\s*$/i);
  if (m && m[1]) return m[1].toString().trim().toUpperCase();
  // fallback: pega penúltimo segmento se houver muitos " - "
  const parts = s.split(' - ').map(p => p.trim());
  if (parts.length >= 2) {
    const penultimo = parts[parts.length - 2];
    if (penultimo) return penultimo.toUpperCase();
  }
  // último recurso: pega a última palavra com letras
  const tokens = s.split(/[,/;-]/).map(p => p.trim()).filter(Boolean);
  return tokens.length ? tokens[tokens.length - 1].toUpperCase() : null;
}

/* ====== leitura de planilha ======
   Priorizamos XLSX por posição de coluna (G=6, J=9, W=22, AH=33, AI=34).
   Se vier CSV, caímos no parser por cabeçalho (menos garantido). */
const COL = { G:6, J:9, W:22, AH:33, AI:34 };

async function parseFileToRows(filename: string, buffer: Buffer) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    // linha 0 = cabeçalho; dados começam na linha 1
    const mapped = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const conferente = normStr(r[COL.AH]);
      const dataCell = r[COL.AI];
      const cidadeAddr = r[COL.W];
      const qtdpedidos = r[COL.G] ?? 0;
      const qtditens = r[COL.J] ?? 0;

      const datahora = toDateFlexible(dataCell);
      const datadia = onlyDate(datahora);

      mapped.push({
        conferente,
        cidade: extractCity(cidadeAddr),
        qtdpedidos: Number(qtdpedidos) || 0,
        qtditens: Number(qtditens) || 0,
        datahora,
        datadia,
      });
    }
    return mapped.filter(r => r.conferente || r.qtdpedidos || r.qtditens || r.datahora);
  }

  // CSV (fallback por cabeçalho)
  const text = buffer.toString('utf-8');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  const data = (parsed.data as any[]).filter(Boolean);
  return data.map((r) => {
    const conferente = normStr(r['CONFERENTE'] ?? r['conferente'] ?? r['AH']);
    const dataRaw = r['DATA'] ?? r['data'] ?? r['AI'];
    const cidadeAddr = r['CIDADE'] ?? r['cidade'] ?? r['W'];
    const qtdpedidos = Number(r['PEDIDOS'] ?? r['G'] ?? 0) || 0;
    const qtditens = Number(r['ITENS'] ?? r['J'] ?? 0) || 0;
    const datahora = toDateFlexible(dataRaw);
    const datadia = onlyDate(datahora);
    return { conferente, cidade: extractCity(cidadeAddr), qtdpedidos, qtditens, datahora, datadia };
  });
}

/* ====== handler ====== */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let upId: number | null = null;

  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const tenantName = (form.get('tenant') as string) || 'Default';
    if (!file) return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());

    // prepara pasta/public path
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    const fname = `${Date.now()}-${file.name}`.replace(/[^a-zA-Z0-9._-]/g, '_');
    const diskPath = path.join(uploadDir, fname);
    const publicPath = `/uploads/${fname}`;
    await fs.writeFile(diskPath, buf);

    // tenant (sem exigir unique)
    const tenant = (await prisma.tenant.findFirst({ where: { name: tenantName } })) ??
                   (await prisma.tenant.create({ data: { name: tenantName } }));

    // cria upload
    const up = await prisma.upload.create({
      data: { filePath: publicPath, tenantId: tenant.id, status: 'processing' },
      select: { id: true },
    });
    upId = up.id;

    // parse & insert
    const rows = await parseFileToRows(fname, buf);
    const chunk = 500;
    let imported = 0;

    for (let i = 0; i < rows.length; i += chunk) {
      const batch = rows.slice(i, i + chunk);
      await prisma.fatoConferencia.createMany({
        data: batch.map(b => ({
          tenantId: tenant.id,
          uploadId: up.id,
          conferente: b.conferente,
          cidade: b.cidade,
          qtdpedidos: b.qtdpedidos,
          qtditens: b.qtditens,
          datahora: b.datahora,
          datadia: b.datadia,
        })),
      });
      imported += batch.length;
    }

    await prisma.upload.update({
      where: { id: up.id },
      data: { status: 'done', log: `Linhas importadas: ${rows.length}` },
    });

    return NextResponse.json({ ok: true, upload: { id: up.id, filePath: publicPath }, imported: rows.length });
  } catch (err: any) {
    console.error('UPLOAD_ERROR:', err);
    if (upId) {
      await prisma.upload.update({
        where: { id: upId },
        data: { status: 'error', log: String(err?.message || err).slice(0, 500) },
      });
    }
    return NextResponse.json({ error: 'Falha no upload/importação' }, { status: 500 });
  }
}
