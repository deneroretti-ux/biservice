         <div style={{ width: "100%", height: 360, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart
                data={cyclesForSku}
                margin={{ left: 12, right: 12, top: 10, bottom: 10 }}
                onClick={(state) => {
                  if (state && state.activeLabel)
                    setSelectedCycle(state.activeLabel);
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="Ciclo" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="QtdVendida"
                  name="Qtd Vendida"
                  fill={C_BLUE}
                />
                <ReferenceLine
                  y={media17 || 0}
                  stroke={C_AMBER}
                  strokeDasharray="4 4"
                  label={{
                    value: "Média",
                    fill: "#fff",
                    position: "top",
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>


        </>
      )}
      {(activeSection === "minimo") && (
        <>
      {/* MÍNIMO */}
      <div className="max-w-7xl mx-auto px-6 mt-10 space-y-4">
        <Card
          title="Sugestão de Estoque Mínimo (17 ciclos)"
          borderColor="rgba(34,197,94,.35)"
          right={
            <div className="flex flex-col items-end gap-2 no-print">
              {/* Linha de filtros principais */}
              <div className="flex items-center gap-2">
                <SelectDark
                  label="Método"
                  value={minMethod}
                  onChange={(e) => setMinMethod(e.target.value)}
                  options={[
                    { value: "media17", label: "Média 17 ciclos" },
                    { value: "max17", label: "Máximo 17 ciclos" },
                    { value: "p85", label: "Percentil 85" },
                    { value: "media+1sigma", label: "Média + 1σ" },
                  ]}
                />

                <SelectDark
                  label="Fator de cobertura"
                  value={covFactor}
                  onChange={(e) => setCovFactor(e.target.value)}
                  options={[
                    { value: "0.5", label: "Cobertura 0,5 ciclo" },
                    { value: "0.75", label: "Cobertura 0,75 ciclo" },
                    { value: "1.0", label: "Cobertura 1 ciclo (padrão)" },
                    { value: "1.25", label: "Cobertura 1,25 ciclo" },
                    { value: "1.5", label: "Cobertura 1,5 ciclo" },
                    { value: "2.0", label: "Cobertura 2 ciclos" },
                  ]}
                />

                <button
                  onClick={() => setShowMinDetail((v) => !v)}
                  className="rounded-lg px-3 py-2 text-xs sm:text-sm font-medium shadow"
                  style={{ background: C_PURPLE }}
                >
                  {showMinDetail ? "Ocultar detalhe" : "Ver detalhe"}
                </button>
              </div>

              {/* Cenário rápido */}
              <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] mt-1">
                <span className="text-white/50 mr-1">Cenário rápido:</span>

                {/* Conservador */}
                <button
                  type="button"
                  onClick={() => {
                    // Conservador = mais estoque
                    setMinMethod("max17");
                    setCovFactor("1.5");
                  }}
                  className={`px-3 py-1.5 rounded-full border text-[11px] transition-colors
                    ${
                      minMethod === "max17" && covFactor === "1.5"
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                        : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                >
                  Conservador
                </button>

                {/* Neutro */}
                <button
                  type="button"
                  onClick={() => {
                    // Neutro = padrão
                    setMinMethod("media17");
                    setCovFactor("1.0");
                  }}
                  className={`px-3 py-1.5 rounded-full border text-[11px] transition-colors
                    ${
                      minMethod === "media17" && covFactor === "1.0"
                        ? "border-sky-400 bg-sky-500/20 text-sky-100"
                        : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                >
                  Neutro
                </button>

                {/* Agressivo */}
                <button
                  type="button"
                  onClick={() => {
                    // Agressivo = menos estoque, mais risco
                    setMinMethod("p85");
                    setCovFactor("0.75");
                  }}
                  className={`px-3 py-1.5 rounded-full border text-[11px] transition-colors
                    ${
                      minMethod === "p85" && covFactor === "0.75"
                        ? "border-amber-400 bg-amber-500/20 text-amber-100"
                        : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                >
                  Agressivo
                </button>
              </div>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Kpi
              title="Top 1 Estoque Mínimo"
              value={sugestaoMinimo[0]?.EstoqueMinimoSugerido || 0}
              color={C_GREEN}
            />
            <Kpi
              title="Top 5 (soma)"
              value={sugestaoMinimo
                .slice(0, 5)
                .reduce(
                  (s, r) => s + (r.EstoqueMinimoSugerido || 0),
                  0
                )}
              color={C_BLUE}
            />
            <Kpi
              title="Qtd SKUs com mínimo > 0"
              value={
                sugestaoMinimo.filter(
                  (r) => (r.EstoqueMinimoSugerido || 0) > 0
                ).length
              }
              color={C_AMBER}
            />
          </div>

          <div style={{ width: "100%", height: 360, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart
                data={minChartData}
                margin={{ left: 12, right: 12, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="SKU" hide />
                <YAxis />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const item = payload[0].payload; // { SKU, Label, Min }

                    return (
                      <div
                        className="rounded-lg px-3 py-2 text-xs shadow"
                        style={{
                          background: "#ffffff",
                          color: C_GREEN,
                          border: `1px solid ${C_GREEN}`,
                        }}
                      >
                        {/* SKU + Descrição */}
                        <div className="font-semibold mb-1">{item.Label}</div>

                        <div>
                          Estoque mínimo sugerido:{" "}
                          <span className="font-bold">{item.Min}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend />
                <Bar
                  dataKey="Min"
                  name="Estoque mínimo sugerido"
                  fill={C_GREEN}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {showMinDetail && (
            <div
              className="mt-6 overflow-auto rounded-lg"
              style={{ border: `1px solid ${C_CARD_BORDER}` }}
            >
              <table className="w-full text-sm">
                <thead className="bg-white/5">
                  <tr>
                    {[
                      "SKU",
                      "Descrição",
                      "Ciclos usados",
                      "Mínimo sugerido",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-3 py-2 font-medium"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sugestaoMinimo.map((r) => (
                    <tr
                      key={r.SKU}
                      className="border-t"
                      style={{ borderColor: C_CARD_BORDER }}
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.SKU}
                      </td>
                      <td className="px-3 py-2">
                        {r.Descricao}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.CiclosUsados}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.EstoqueMinimoSugerido}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>


        </>
      )}
      {(activeSection === "plano") && (
        <>
      {/* PLANO TRANSFERÊNCIAS & COMPRAS */}
      <div className="max-w-7xl mx-auto px-6 mt-10 mb-10 space-y-4">
        <Card borderColor="rgba(239,68,68,.35)">
          {/* Título centralizado + filtros */}
          <div className="no-print mb-4">
            <h2 className="text-lg font-semibold text-center mb-3">
              Plano de Transferências &amp; Compras
            </h2>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <SelectDark
                label="Cidade (filtro plano)"
                value={planCityFilter}
                onChange={(e) => setPlanCityFilter(e.target.value)}
                options={planCityOptions}
              />

              <SelectDark
                label="Curva SKU"
                value={planCurveFilter}
                onChange={(e) => setPlanCurveFilter(e.target.value)}
                options={planCurveOptions}
              />

              <SelectDark
                label="Categoria"
                value={planCategoryFilter}
                onChange={(e) => setPlanCategoryFilter(e.target.value)}
                options={planCategoryOptions}
              />

              <SelectDark
                label="Horizonte (dias)"
                value={String(planDays)}
                onChange={(e) => setPlanDays(e.target.value)}
                options={[
                  { value: "7", label: "7 dias" },
                  { value: "14", label: "14 dias" },
                  { value: "17", label: "17 dias" },
                  { value: "21", label: "21 dias (padrão)" },
                  { value: "30", label: "30 dias" },
                  { value: "45", label: "45 dias" },
                  { value: "60", label: "60 dias" },
                  { value: "90", label: "90 dias" },
                ]}
                className="w-40"
              />

              <SelectDark
                label="Desativação (filtro)"
                value={planDesativMode}
                onChange={(e) => setPlanDesativMode(e.target.value)}
                options={[
                  { value: "todos", label: "Todos os SKUs" },
                  { value: "somente_ativos", label: "Somente ativos" },
                  {
                    value: "ate_ciclo_atual",
                    label: `Só que desativam até C${CURRENT_CYCLE}`,
                  },
                  {
                    value: "ate_prox_ciclo",
                    label: `Até C${CURRENT_CYCLE + 1}`,
                  },
                ]}
                className="w-44"
              />

              <SelectDark
                label="Compras p/ desativados"
                value={buyDesativMode}
                onChange={(e) => setBuyDesativMode(e.target.value)}
                options={[
                  { value: "excluir", label: "Não comprar" },
                  { value: "incluir", label: "Incluir nas compras" },
                ]}
                className="w-40"
              />

              <button
                onClick={() => setPlanTab("transfer")}
                className={`rounded-lg px-3 py-2 text-xs sm:text-sm font-medium shadow ${
                  planTab === "transfer" ? "bg-emerald-500" : "bg-white/10"
                }`}
              >
                Transferências
              </button>

              <button
                onClick={() => setPlanTab("compras")}
                className={`rounded-lg px-3 py-2 text-xs sm:text-sm font-medium shadow ${
                  planTab === "compras" ? "bg-emerald-500" : "bg-white/10"
                }`}
              >
                Compras
              </button>

              <button
                onClick={() => setShowPlanDetail((v) => !v)}
                className="rounded-lg px-3 py-2 text-xs sm:text-sm font-medium shadow"
                style={{ background: C_PURPLE }}
              >
                {showPlanDetail ? "Ocultar detalhe" : "Ver detalhe"}
              </button>

              <button
                onClick={exportPlanXlsx}
                className="rounded-lg px-3 py-2 text-xs sm:text-sm font-medium shadow"
             >
                Exportar Plano XLSX
              </button>
            </div>
          </div>

          {/* KPIs do plano (já respeitando filtro de cidade) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Kpi
              title="Total a transferir (itens)"
              value={transfersView.reduce((s, t) => s + (t.Qtd || 0), 0)}
              color={C_GREEN}
            />
            <Kpi
              title="Movimentos de transferência"
              value={transfersView.length}
              color={C_BLUE}
            />
            <Kpi
              title="Total a comprar (itens)"
              value={buysView.reduce((s, b) => s + (b.Qtd || 0), 0)}
              color={C_ROSE}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Kpi
              title="Investimento com transferências (R$)"
              value={buysView
                .reduce((s, b) => s + (b.ValorTotal || 0), 0)
                .toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              color={C_ROSE}
              raw
            />
            <Kpi
              title="Investimento sem transferências (R$)"
              value={totalsPlan.baseBuyValor.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
              color={C_AMBER}
              raw
            />
            <Kpi
              title="Economia obtida (R$)"
              value={(
                totalsPlan.baseBuyValor -
                buysView.reduce((s, b) => s + (b.ValorTotal || 0), 0)
              ).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
              color={C_GREEN}
              raw
            />
          </div>

          {planTab === "transfer" ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <Card
                  title="Transferências por Cidade de Destino"
                  borderColor="rgba(34,197,94,.35)"
                >
                  <div style={{ width: "100%", height: 300 }}>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={transfersByDestino}
                        margin={{
                          left: 12,
                          right: 12,
                          top: 10,
                          bottom: 10,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="Cidade" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="Qtd"
                          name="Qtd a transferir"
                          fill={C_GREEN}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card
                  title="Top 10 SKUs para Transferir"
                  borderColor="rgba(34,197,94,.35)"
                >
                  <div style={{ width: "100%", height: 300 }}>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={transfersTopSku}
                        margin={{
                          left: 12,
                          right: 12,
                          top: 10,
                          bottom: 10,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="SKU" hide />
                        <YAxis />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length)
                              return null;
                            const item = payload[0].payload;

                            return (
                              <div
                                className="rounded-lg px-3 py-2 text-xs shadow"
                                style={{
                                  background: "#ffffff",
                                  color: C_BLUE,
                                  border: `1px solid ${C_BLUE}`,
                                }}
                              >
                                <div className="font-semibold mb-1">
                                  {item.SKU}
                                </div>
                                <div>
                                  Qtd a transferir:{" "}
                                  <span className="font-bold">
                                    {item.Qtd}
                                  </span>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Legend />
                        <Bar
                          dataKey="Qtd"
                          name="Qtd a transferir"
                          fill={C_BLUE}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              {showPlanDetail && (
                <div
                  className="mt-6 overflow-auto rounded-lg"
                  style={{ border: `1px solid ${C_CARD_BORDER}` }}
                >
                  <table className="w-full text-sm">
                    <thead className="bg-white/5">
                      <tr>
                        {[
                          "SKU",
                          "Descrição",
                          "Classe",
                          "Categoria",
                          "Desativação",
                          "Origem",
                          "Destino",
                          "Qtd a transferir",
                        ].map((h) => (
                          <th
                            key={h}
                            className="text-left px-3 py-2 font-medium"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {transfersView.length ? (
                        transfersView.map((r, idx) => {
                          const cicloDes = skuDesativacao.get(r.SKU);
                          return (
                            <tr
                              key={idx}
                              className="border-t"
                              style={{ borderColor: C_CARD_BORDER }}
                            >
                              <td className="px-3 py-2 whitespace-nowrap">
                                {r.SKU}
                              </td>
                              <td className="px-3 py-2">
                                {r.Descricao}
                              </td>
                              <td className="px-3 py-2">
                                {skuClasse.get(r.SKU) || ""}
                              </td>
                              <td className="px-3 py-2">
                                {skuCategoria.get(r.SKU) || ""}
                              </td>
                              <td className="px-3 py-2">
                                {cicloDes ? (
                                  <span
                                    className={
                                      cicloDes <= CURRENT_CYCLE
                                        ? "text-red-400 font-semibold"
                                        : cicloDes === CURRENT_CYCLE + 1
                                        ? "text-amber-300 font-semibold"
                                        : "text-white"
                                    }
                                  >
                                    {`C${cicloDes}${
                                      cicloDes <= CURRENT_CYCLE
                                        ? " (desativado)"
                                        : cicloDes === CURRENT_CYCLE + 1
                                        ? " (próx. ciclo)"
                                        : ""
                                    }`}
                                  </span>
                                ) : (
                                  ""
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {r.Origem}
                              </td>
                              <td className="px-3 py-2">
                                {r.Destino}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {r.Qtd}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr
                          className="border-t"
                          style={{ borderColor: C_CARD_BORDER }}
                        >
                          <td className="px-3 py-4" colSpan={8}>
                            Nenhuma transferência necessária.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <Card
                  title="Compras por Cidade (R$)"
                  borderColor="rgba(239,68,68,.35)"
                >
                  <div style={{ width: "100%", height: 300 }}>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={buysByCidade}
                        margin={{
                          left: 12,
                          right: 12,
                          top: 10,
                          bottom: 10,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="Cidade" />
                        <YAxis />
                        <Tooltip
                          formatter={(value) => [
                            value.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }),
                            "Investimento",
                          ]}
                        />
                        <Legend />
                        <Bar
                          dataKey="Valor"
                          name="Investimento (R$)"
                          fill={C_ROSE}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card
                  title="Investimento por Marca (R$)"
                  borderColor="rgba(239,68,68,.35)"
                >
                  <div style={{ width: "100%", height: 300 }}>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={invPorMarca}
                        margin={{
                          left: 12,
                          right: 12,
                          top: 10,
                          bottom: 10,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="Marca" />
                        <YAxis />
                        <Tooltip
                          formatter={(value) => [
                            value.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }),
                            "Investimento",
                          ]}
                        />
                        <Legend />
                        <Bar
                          dataKey="Valor"
                          name="Investimento (R$)"
                          fill={C_BLUE}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <div className="mt-4">
                <Card
                  title="Top 10 SKUs para Comprar (R$)"
                  borderColor="rgba(239,68,68,0.35)"
                >
                  <div
                    className="overflow-auto rounded-lg"
                    style={{ border: `1px solid ${C_CARD_BORDER}` }}
                  >
                    <table className="w-full text-sm">
                      <thead className="bg-white/5">
                        <tr>
                          {[
                            "SKU",
                            "Descrição",
                            "Qtd a comprar",
                            "Investimento (R$)",
                          ].map((h) => (
                            <th
                              key={h}
                              className="text-left px-3 py-2 font-medium"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {buysTopSku.length ? (
                          buysTopSku.map((r) => (
                            <tr
                              key={r.SKU}
                              className="border-t"
                              style={{ borderColor: C_CARD_BORDER }}
                            >
                              <td className="px-3 py-2 whitespace-nowrap">
                                {r.SKU}
                              </td>
                              <td className="px-3 py-2">{r.Descricao}</td>
                              <td className="px-3 py-2 text-right">
                                {r.Qtd}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {(r.ValorTotal ?? 0).toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                })}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr
                            className="border-t"
                            style={{ borderColor: C_CARD_BORDER }}
                          >
                            <td className="px-3 py-4" colSpan={4}>
                              Nenhuma compra necessária.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              {showPlanDetail && (
                <div
                  className="mt-6 overflow-auto rounded-lg"
                  style={{ border: `1px solid ${C_CARD_BORDER}` }}
                >
                  <table className="w-full text-sm">
                    <thead className="bg-white/5">
                      <tr>
                        {[
                          "SKU",
                          "Descrição",
                          "Classe",
                          "Categoria",
                          "Desativação",
                          "Cidade",
                          "Qtd a comprar",
                          "Valor unitário",
                          "Total compra",
                        ].map((h) => (
                          <th
                            key={h}
                            className="text-left px-3 py-2 font-medium"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {buysView.length ? (
                        buysView.map((r, idx) => {
                          const cicloDes = skuDesativacao.get(r.SKU);
                          return (
                            <tr
                              key={idx}
                              className="border-t"
                              style={{ borderColor: C_CARD_BORDER }}
                            >
                              <td className="px-3 py-2 whitespace-nowrap">
                                {r.SKU}
                              </td>
                              <td className="px-3 py-2">
                                {r.Descricao}
                              </td>
                              <td className="px-3 py-2">
                                {skuClasse.get(r.SKU) || ""}
                              </td>
                              <td className="px-3 py-2">
                                {skuCategoria.get(r.SKU) || ""}
                              </td>
                              <td className="px-3 py-2">
                                {cicloDes ? (
                                  <span
                                    className={
                                      cicloDes <= CURRENT_CYCLE
                                        ? "text-red-400 font-semibold"
                                        : cicloDes === CURRENT_CYCLE + 1
                                        ? "text-amber-300 font-semibold"
                                        : "text-white"
                                    }
                                  >
                                    {`C${cicloDes}${
                                      cicloDes <= CURRENT_CYCLE
                                        ? " (desativado)"
                                        : cicloDes === CURRENT_CYCLE + 1
                                        ? " (próx. ciclo)"
                                        : ""
                                    }`}
                                  </span>
                                ) : (
                                  ""
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {r.Cidade}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {r.Qtd}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {(r.ValorUnit ?? 0).toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                })}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {(r.ValorTotal ?? 0).toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                })}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr
                          className="border-t"
                          style={{ borderColor: C_CARD_BORDER }}
                        >
                          <td className="px-3 py-4" colSpan={9}>
                            Nenhuma compra necessária.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Card>
      </div>


        </>
      )}
      {(activeSection === "promo") && (
        <>
      {/* SUGESTÃO DE COMPRA - SKUs EM PROMOÇÃO (PRÓXIMO CICLO) */}
      {promoSuggestionsView.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 mt-6 mb-10 space-y-4">
          <Card borderColor="rgba(34,197,94,.35)">
            {/* Título + filtros no topo, igual plano */}
            <div className="no-print mb-4 flex flex-col items-center justify-center text-center gap-2">
              <div className="flex flex-col items-center justify-center text-center">
                <h2 className="text-xl font-semibold">
                  Sugestão de Compra – SKUs em Promoção (Próximo Ciclo C16)
                </h2>

                <p className="text-xs text-white/60 mt-1">
                  Considerando promoções do próximo ciclo e consumo base
                  estimado a partir do ciclo atual C15.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <SelectDark
                  label="Horizonte (dias)"
                  value={promoHorizonDays}
                  onChange={(e) => setPromoHorizonDays(e.target.value)}
                  options={[
                    { value: "7", label: "7 dias" },
                    { value: "14", label: "14 dias" },
                    { value: "17", label: "17 dias" },
                    { value: "21", label: "21 dias (padrão)" },
                    { value: "30", label: "30 dias" },
                    { value: "45", label: "45 dias" },
                    { value: "60", label: "60 dias" },
                    { value: "90", label: "90 dias" },
                  ]}
                  className="w-40"
                />

                <SelectDark
                  label="Curva SKU"
                  value={promoCurveFilter}
                  onChange={(e) => setPromoCurveFilter(e.target.value)}
                  options={promoCurveOptions}
                  className="w-32"
                />

                <SelectDark
                  label="SKU"
                  value={promoSkuFilter}
                  onChange={(e) => setPromoSkuFilter(e.target.value)}
                  options={promoSkuOptions}
                  className="w-56"
                />

                <button
                  onClick={() => setShowPromoDetail((v) => !v)}
                  className="rounded-lg px-3 py-2 text-xs sm:text-sm font-medium shadow"
                  style={{ background: C_PURPLE }}
                >
                  {showPromoDetail ? "Ocultar detalhe" : "Ver detalhe"}
                </button>

                <button
                  onClick={exportPromoXlsx}
                  className="rounded-lg px-3 py-2 text-xs sm:text-sm font-medium shadow"
                  style={{ background: C_BLUE }}
                >
                  Exportar Promo XLSX
                </button>
              </div>
            </div>

            {/* KPIs do card de promoção */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <Kpi
                title="SKUs em promoção (com compra sugerida)"
                value={promoTotalsView.totalSkus}
                color={C_BLUE}
              />
              <Kpi
                title="Total de itens sugeridos"
                value={promoTotalsView.totalQtd}
                color={C_GREEN}
              />
              <Kpi
                title="Investimento sugerido (R$)"
                value={promoTotalsView.totalValor.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
                color={C_AMBER}
                raw
              />
            </div>

            {/* KPIs adicionais (Top 1 / Top 5) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <Kpi
                title="Top 1 SKU (R$)"
                value={promoResumoKpis.valorTop1.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
                color={C_ROSE}
                raw
              />
              <Kpi
                title="Top 5 SKUs - Itens"
                value={promoResumoKpis.totalTop5Qtd}
                color={C_GREEN}
              />
              <Kpi
                title="Top 5 SKUs - Investimento (R$)"
                value={promoResumoKpis.totalTop5Valor.toLocaleString(
                  "pt-BR",
                  {
                    style: "currency",
                    currency: "BRL",
                  }
                )}
                color={C_BLUE}
                raw
              />
            </div>

            {/* Gráfico de barras dos SKUs em promoção */}
            <div style={{ width: "100%", height: 360, marginTop: 16 }}>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart
                  data={promoChartData}
                  margin={{
                    left: 12,
                    right: 12,
                    top: 10,
                    bottom: 10,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="SKU" hide />
                  <YAxis />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length)
                        return null;
                      const item = payload[0].payload;

                      return (
                        <div
                          className="rounded-lg px-3 py-2 text-xs shadow"
                          style={{
                            background: "#ffffff",
                            color: C_BLUE,
                            border: `1px solid ${C_BLUE}`,
                          }}
                        >
                          <div className="font-semibold mb-1">
                            {item.Label}
                          </div>
                          <div>
                            Qtd sugerida:{" "}
                            <span className="font-bold">
                              {item.QtdSugerida}
                            </span>
                          </div>
                          <div>
                            Investimento sugerido:{" "}
                            <span className="font-bold">
                              {item.ValorTotal.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="ValorTotal"
                    name="Investimento sugerido (R$)"
                    fill={C_BLUE}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detalhe em tabela */}
            {showPromoDetail && (
              <div
                className="mt-6 overflow-auto rounded-lg"
                style={{ border: `1px solid ${C_CARD_BORDER}` }}
              >
                <table className="w-full text-sm">
                  <thead className="bg-white/5">
                    <tr>
                      {[
                        "SKU",
                        "Descrição",
                        "Classe",
                        "Desconto (%)",
                        "Mínimo base",
                        "Alvo promo",
                        "Estoque disponível",
                        "Qtd sugerida compra",
                        "Preço unit. promo (R$)",
                        "Total sugerido (R$)",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left px-3 py-2 font-medium"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {promoSuggestionsView.map((r) => (
                      <tr
                        key={r.SKU}
                        className="border-t"
                        style={{ borderColor: C_CARD_BORDER }}
                      >
                        <td className="px-3 py-2 whitespace-nowrap">
                          {r.SKU}
                        </td>
                        <td className="px-3 py-2">{r.Descricao}</td>
                        <td className="px-3 py-2">{r.Classe}</td>
                        <td className="px-3 py-2 text-right">
                          {r.Desconto}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.EstoqueMinBase}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.EstoqueAlvoPromo}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.EstoqueDisponivel}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.QtdSugerida}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.PrecoUnitPromo.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.ValorTotal.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      
        </>
      )}
<style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        select,
        select option {
          color: #fff;
          background-color: #0f172a;
        }
      `}</style>
    </div>
  );
}
