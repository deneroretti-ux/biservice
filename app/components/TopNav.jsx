// components/TopNav.jsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { useDataStore } from "@/store/useDataStore";
import { parseWorkbookFromFile } from "@/lib/parser";
import { C_BLUE, C_GREEN, C_AMBER, C_ROSE, C_CARD_BORDER } from "@/components/Theme";

export default function TopNav() {
  const fileRef = useRef(null);
  const { loading, progress, status, setLoading, setProgress, setStatus, setDatasets, lastFileName } = useDataStore();

  async function onUpload(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setLoading(true); setProgress(0); setStatus("Lendo arquivo…");
    try {
      // FileReader progress (visual)
      await new Promise((resolve) => {
        const fr = new FileReader();
        fr.onprogress = (evt) => { if (evt.lengthComputable) setProgress(Math.min(95, Math.round((evt.loaded/evt.total)*100))); };
        fr.onload = resolve;
        fr.readAsArrayBuffer(file);
      });
      setStatus("Processando abas…"); setProgress(97);

      const { estoque, vendas, ciclos } = await parseWorkbookFromFile(file);

      setDatasets({ estoque, vendas, ciclos, lastFileName: file.name });
      setStatus("Pronto!"); setProgress(100);
    } catch (err) {
      console.error(err);
      setStatus("Erro ao processar o arquivo");
    } finally {
      setTimeout(()=>{ setLoading(false); setStatus(""); setProgress(0); }, 500);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0c1118]/80 backdrop-blur px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl overflow-hidden ring-1 ring-sky-500/40 bg-sky-500/10 grid place-items-center">
            <Image src="/logo/logo.svg" alt="BI Service" width={28} height={28} priority />
          </div>
          <div className="leading-tight">
            <div className="text-sm text-white/70">BI Service Beta</div>
            <h1 className="text-xl font-bold"><span className="text-white">Portal</span> <span style={{ color: C_GREEN }}>Boti</span></h1>
            {lastFileName ? <div className="text-xs text-white/60 mt-1 truncate max-w-[320px]">Arquivo: {lastFileName}</div> : null}
          </div>
        </div>

        <nav className="flex items-center gap-2">
          <Link href="/estoque" className="rounded-lg px-3 py-2 text-sm font-medium shadow bg-white/10 hover:bg-white/20">Estoque</Link>
          <Link href="/vendas"  className="rounded-lg px-3 py-2 text-sm font-medium shadow bg-white/10 hover:bg-white/20">Vendas</Link>
          <Link href="/minimo"  className="rounded-lg px-3 py-2 text-sm font-medium shadow bg-white/10 hover:bg-white/20">Mínimo</Link>
          <Link href="/plano"   className="rounded-lg px-3 py-2 text-sm font-medium shadow bg-white/10 hover:bg-white/20">Plano</Link>

          <label className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium shadow ml-2" style={{ background: C_GREEN }}>
            <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-90"><path fill="currentColor" d="M19 15v4H5v-4H3v6h18v-6zM11 3v10.17l-3.59-3.58L6 11l6 6l6-6l-1.41-1.41L13 13.17V3z"/></svg>
            Upload
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onUpload} className="hidden" />
          </label>
        </nav>
      </div>

      {loading && (
        <div className="mt-3 h-1 w-full bg-white/10 rounded">
          <div className="h-1 rounded" style={{ width: `${progress}%`, background: C_BLUE, transition: "width .2s" }} />
          <div className="text-xs text-white/70 mt-1 px-1">{status}</div>
        </div>
      )}
    </header>
  );
}
