export default function DashboardPreview() {
  const cards = [
    { title: 'Faturamento Total', value: 'R$ 2.450.000', color: 'from-yellow-500 to-orange-500' },
    { title: 'Lucro Total', value: 'R$ 562.500', color: 'from-green-500 to-emerald-500' },
    { title: 'Ticket Médio', value: 'R$ 315,75', color: 'from-blue-500 to-cyan-500' },
    { title: 'Clientes Ativos', value: '1.250', color: 'from-purple-500 to-pink-500' },
    { title: 'Margem Média', value: '23,15%', color: 'from-lime-500 to-green-500' },
    { title: 'Caixa Atual', value: 'R$ 318.600', color: 'from-slate-500 to-gray-500' },
  ];

  const produtos = [
    ['Monitor 24"', 92],
    ['Mouse Gamer', 80],
    ['Notebook Dell', 65],
    ['SSD 480GB', 55],
    ['Teclado Mecânico', 45],
  ];

  return (
    <div className="min-h-screen bg-black text-white flex">
      <aside className="w-64 bg-zinc-950 border-r border-yellow-500/20 p-5 hidden lg:flex flex-col justify-between">
        <div>
          <div className="mb-10">
            <h1 className="text-3xl font-black text-yellow-400">BI SERVICE</h1>
            <p className="text-yellow-600 text-sm">ERP EDITION</p>
          </div>

          <nav className="space-y-3">
            {['Executivo', 'Comercial', 'Financeiro', 'Estoque', 'Clientes', 'Produtos', 'Fiscal', 'DRE'].map((item) => (
              <div
                key={item}
                className="rounded-2xl px-4 py-3 bg-zinc-900 hover:bg-yellow-500/10 border border-zinc-800 hover:border-yellow-500/30 transition-all cursor-pointer"
              >
                {item}
              </div>
            ))}
          </nav>
        </div>

        <button className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-2xl p-4 transition-all">
          MODO TV
        </button>
      </aside>

      <main className="flex-1 p-5 md:p-8 overflow-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-black">Dashboard Executivo</h1>
            <p className="text-zinc-400">Visão geral completa da empresa</p>
          </div>

          <div className="flex gap-3">
            <button className="bg-yellow-500 text-black font-bold px-5 py-3 rounded-2xl hover:bg-yellow-400 transition-all">
              Limpar Filtros
            </button>
            <button className="bg-zinc-900 border border-zinc-800 px-5 py-3 rounded-2xl hover:border-yellow-500/40 transition-all">
              Mais Filtros
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 mb-6">
          {cards.map((card) => (
            <div
              key={card.title}
              className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-2xl"
            >
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-r ${card.color} mb-4`} />
              <p className="text-zinc-400 text-sm">{card.title}</p>
              <h2 className="text-2xl font-black mt-1">{card.value}</h2>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
          <div className="xl:col-span-2 bg-zinc-950 border border-zinc-800 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Evolução Mensal</h2>
              <div className="flex gap-3 text-sm">
                <span className="text-yellow-400">Faturamento</span>
                <span className="text-green-400">Lucro</span>
                <span className="text-red-400">Custos</span>
              </div>
            </div>

            <div className="h-72 flex items-end gap-3">
              {[35, 50, 42, 70, 65, 88, 76, 95, 82, 97, 91, 86].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t-2xl bg-gradient-to-t from-yellow-600 to-yellow-400 shadow-lg"
                    style={{ height: `${h}%` }}
                  />
                  <span className="text-xs text-zinc-500">
                    {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6">
            <h2 className="text-2xl font-bold mb-6">Top Produtos</h2>

            <div className="space-y-5">
              {produtos.map(([nome, valor]) => (
                <div key={nome}>
                  <div className="flex justify-between text-sm mb-2">
                    <span>{nome}</span>
                    <span>{valor}%</span>
                  </div>
                  <div className="h-3 bg-zinc-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full"
                      style={{ width: `${valor}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6">
            <h2 className="text-xl font-bold mb-5">Fluxo de Caixa</h2>
            <div className="h-52 flex items-end gap-2">
              {[20,45,30,60,50,75,35,85,70,95].map((h, i) => (
                <div key={i} className="flex-1 bg-green-500 rounded-t-xl" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 flex flex-col justify-center items-center">
            <h2 className="text-xl font-bold mb-4">Meta vs Realizado</h2>
            <div className="relative w-48 h-48 rounded-full border-[16px] border-yellow-500 flex items-center justify-center">
              <div className="text-center">
                <div className="text-5xl font-black">72%</div>
                <div className="text-zinc-400 mt-2">Performance</div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6">
            <h2 className="text-xl font-bold mb-5">DRE Resumido</h2>

            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Receita Bruta</span>
                <span>R$ 2.450.000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Custos</span>
                <span className="text-red-400">- R$ 1.720.000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Despesas</span>
                <span className="text-red-400">- R$ 150.000</span>
              </div>

              <div className="border-t border-zinc-800 pt-4 flex justify-between text-lg font-black text-green-400">
                <span>Lucro Líquido</span>
                <span>R$ 460.000</span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6">
            <h2 className="text-xl font-bold mb-5">Estoque</h2>

            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Normal</span>
                  <span className="text-green-400">342</span>
                </div>
                <div className="h-3 bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full w-[75%] bg-green-500 rounded-full" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Atenção</span>
                  <span className="text-yellow-400">78</span>
                </div>
                <div className="h-3 bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full w-[40%] bg-yellow-500 rounded-full" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Crítico</span>
                  <span className="text-red-400">45</span>
                </div>
                <div className="h-3 bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full w-[20%] bg-red-500 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
