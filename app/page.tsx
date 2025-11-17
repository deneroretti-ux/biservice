'use client';

import Image from 'next/image';
// Removi Links de ações ilustrativas para manter sem navegação
import { Upload, BarChart3, Filter, LayoutDashboard } from 'lucide-react';

export default function Home() {
  const features = [
    {
      icon: Upload,
      title: 'Upload substitutivo',
      desc: 'Importe o arquivo e o sistema limpa os dados anteriores automaticamente.',
      actionLabel: 'Enviar agora', // ilustrativo
    },
    {
      icon: BarChart3,
      title: 'Visual claro',
      desc: 'Gráficos por conferente e cidade, com rótulos numéricos e Top N.',
      actionLabel: 'Ver dashboard', // ilustrativo
    },
    {
      icon: Filter,
      title: 'Filtros ágeis',
      desc: 'Período, cidade e conferente — tudo integrado ao cálculo dos cartões.',
      actionLabel: 'Aplicar filtros', // ilustrativo
    },
  ];

  return (
    <main className="min-h-screen bg-[#0B1220] text-white">
      {/* Cabeçalho */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-4 md:px-10 py-4 md:py-6 bg-[#0a0f1a]">
        <div className="flex items-center gap-2 md:gap-3">
          <img
            src="/logo/logo.png"
            alt="BI Service Logo"
            className="w-12 h-12 md:w-20 md:h-20 object-contain"
          />
          <h1 className="text-xl md:text-3xl font-bold md:translate-y-1">
            <span className="text-white">BI</span>{' '}
            <span className="text-blue-400">Service</span>
          </h1>
        </div>

        {/* Só esse navega */}
        <a
          href="/login"
          className="self-start md:self-auto bg-gray-800 hover:bg-gray-700 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl transition-all duration-200 text-sm md:text-base"
        >
          Entrar
        </a>
      </header>

      {/* Seção principal */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 pb-16">
        {/* Hero */}
        <div className="text-center">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
            Seu painel de conferência{' '}
            <span className="text-blue-400">sem atrito</span>
          </h1>
          <p className="mt-3 md:mt-4 text-white/70 max-w-2xl mx-auto leading-relaxed text-sm md:text-base">
            Tudo que você precisa para monitorar pedidos, itens e produtividade.
            Simples de operar, bonito de apresentar.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            {/* Botões ilustrativos (sem navegação) */}
            <button
              type="button"
              aria-disabled
              className="px-5 py-3 rounded-xl bg-emerald-500/60 border border-white/10 shadow inline-flex gap-2 items-center cursor-not-allowed"
              title="Ilustrativo"
            >
              <Upload size={18} /> Upload
            </button>
            <button
              type="button"
              aria-disabled
              className="px-5 py-3 rounded-xl bg-white/10 border border-white/10 inline-flex gap-2 items-center cursor-not-allowed"
              title="Ilustrativo"
            >
              <LayoutDashboard size={18} /> Dashboard
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="mt-10 md:mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {features.map((f, i) => (
            <div
              key={i}
              className="rounded-2xl p-5 border border-white/10 bg-white/5 hover:bg-white/10 transition"
            >
              <f.icon className="opacity-80" size={24} />
              <div className="mt-3 font-semibold text-lg">{f.title}</div>
              <div className="text-sm opacity-70 mt-1">{f.desc}</div>

              {/* Ação ilustrativa */}
              <button
                type="button"
                aria-disabled
                className="inline-block mt-4 text-sm px-3 py-2 rounded-lg bg-white/10 border border-white/10 transition cursor-not-allowed"
                title="Ilustrativo"
              >
                {f.actionLabel}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Rodapé */}
      <footer className="border-t border-white/10 bg-white/5">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 text-center text-white/60 text-xs md:text-sm">
          © {new Date().getFullYear()} BI Service — Painel de Conferência
        </div>
      </footer>
    </main>
  );
}
