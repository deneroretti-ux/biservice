"use client";
import Link from "next/link";
import Image from "next/image";
import { C_CARD_BORDER } from "./boti-lib";

export default function BotiLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#0c1118] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0c1118]/80 backdrop-blur px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl overflow-hidden ring-1 ring-sky-500/40 bg-sky-500/10 grid place-items-center">
              <Image src="/logo/logo.svg" alt="BI Service" width={28} height={28} priority />
            </div>
            <div className="leading-tight">
              <div className="text-sm text-white/70">BI Service Beta</div>
              <h1 className="text-xl font-bold">Boti – Operações</h1>
            </div>
          </div>
          <nav className="flex gap-2 text-sm">
            <Link className="rounded-lg px-3 py-2 bg-white/10 hover:bg-white/20" href="/boti/estoque">Estoque</Link>
            <Link className="rounded-lg px-3 py-2 bg-white/10 hover:bg-white/20" href="/boti/vendas">Vendas</Link>
            <Link className="rounded-lg px-3 py-2 bg-white/10 hover:bg-white/20" href="/boti/estoque-minimo">Estoque Mínimo</Link>
            <Link className="rounded-lg px-3 py-2 bg-white/10 hover:bg-white/20" href="/boti/plano">Transferências/Compras</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {children}
      </main>

      <style jsx global>{`
        @media print { .no-print { display: none !important; } }
        select, select option { color: #fff; background-color: #0f172a; }
        .card { border: 1px solid ${C_CARD_BORDER}; border-radius: 1rem; }
      `}</style>
    </div>
  );
}
