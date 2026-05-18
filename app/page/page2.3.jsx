    return map;
  }, [allRowsEstoque]);

  // Metadados de promoção (descobre ciclo atual/prox a partir das promoções)
  const promoMeta = useMemo(() => {
    let nextPromoCycle = null; // ex: 202516
    const perSku = new Map(); // sku -> { cicloPromo, descontoPercent }

    for (const r of allRowsEstoque) {
      if (!r.CodigoProduto) continue;
      const sku = String(r.CodigoProduto).trim();
      if (!sku) continue;

      const ciclo = r.PromoCiclo;
      const desconto = r.PromoDescontoPercent;
      if (!ciclo) continue;

      perSku.set(sku, {
        cicloPromo: ciclo,
        descontoPercent: desconto,
      });

      if (nextPromoCycle == null || ciclo < nextPromoCycle) {
        nextPromoCycle = ciclo;
      }
    }

    let currentCycle = null;
    let nextCycleShort = null;

    if (nextPromoCycle != null) {
      const n = Number(nextPromoCycle);
      if (!Number.isNaN(n)) {
        nextCycleShort = n % 100; // 16
        currentCycle = nextCycleShort - 1; // 15
      }
    }

    return { perSku, nextPromoCycle, currentCycle, nextCycleShort };
  }, [allRowsEstoque]);

  const promoSuggestions = useMemo(() => {
    const out = [];
    if (!promoMeta.nextPromoCycle) return out;

    for (const rec of sugestaoMinimo) {
      const sku = rec.SKU;
      const meta = promoMeta.perSku.get(sku);
      if (!meta) continue;

      const baseMin = rec.EstoqueMinimoSugerido || 0;
      if (baseMin <= 0) continue;

      const desconto = meta.descontoPercent || 0;
      const classe = skuClasse.get(sku) || "";

      // boost por curva
      let fatorClasse = 1;
      const clsUpper = classe.toUpperCase();
      if (clsUpper.startsWith("A")) fatorClasse = 1.5;
      else if (clsUpper.startsWith("B")) fatorClasse = 1.2;
      else if (clsUpper.startsWith("C")) fatorClasse = 1.0;
      else fatorClasse = 0.8;

      // boost por desconto
      const fatorPromo = 1 + desconto / 100;

      const alvo = Math.max(
        baseMin,
        Math.round(baseMin * fatorPromo * fatorClasse)
      );

      // componentes de estoque global
      const comp =
        estoqueComponentesBySku.get(sku) || {
          EstoqueAtual: 0,
          EstoqueTransito: 0,
          PendentesLiquidos: 0,
        };

      const disponivel =
        (comp.EstoqueAtual || 0) +
        (comp.EstoqueTransito || 0) -
        (comp.PendentesLiquidos || 0);

      const qtdComprar = Math.max(0, alvo - disponivel);
      if (qtdComprar <= 0) continue;

      // preço médio SKU (sell in)
      let precoBase = 0;
      const priceMap = skuPrecoCidade.get(sku);
      if (priceMap && priceMap.size) {
        for (const v of priceMap.values()) {
          if (v > 0) {
            precoBase = v;
            break;
          }
        }
        if (precoBase === 0) {
          precoBase = Array.from(priceMap.values())[0] || 0;
        }
      }

      const precoPromo = precoBase * (1 - desconto / 100);
      const valorTotal = qtdComprar * precoPromo;

      out.push({
        SKU: sku,
        Descricao: rec.Descricao,
        Classe: classe,
        Desconto: desconto,
        EstoqueMinBase: baseMin,
        EstoqueAlvoPromo: alvo,

        // novos campos para exportação
        EstoqueAtualGlobal: comp.EstoqueAtual || 0,
        EstoqueTransitoGlobal: comp.EstoqueTransito || 0,
        PendentesLiquidosGlobal: comp.PendentesLiquidos || 0,

        EstoqueDisponivel: disponivel,
        QtdSugerida: qtdComprar,
        PrecoUnitPromo: precoPromo,
        ValorTotal: valorTotal,
      });
    }

    out.sort((a, b) => (b.ValorTotal || 0) - (a.ValorTotal || 0));
    return out;
  }, [
    sugestaoMinimo,
    promoMeta,
    estoqueComponentesBySku,
    skuClasse,
    skuPrecoCidade,
  ]);


  // Totais base (sem filtros de visualização)
  const promoTotals = useMemo(() => {
    let totalQtd = 0;
    let totalValor = 0;
    for (const r of promoSuggestions) {
      totalQtd += r.QtdSugerida || 0;
      totalValor += r.ValorTotal || 0;
    }
    return {
      totalQtd,
      totalValor,
      totalSkus: promoSuggestions.length,
    };
  }, [promoSuggestions]);

  // Opções de SKU para o filtro do card de promoção
  const promoSkuOptions = useMemo(() => {
    if (!promoSuggestions || !promoSuggestions.length) {
      return [{ value: "Todos", label: "Todos" }];
    }

    const skus = Array.from(
      new Set(promoSuggestions.map((r) => r.SKU))
    ).sort((a, b) => a.localeCompare(b));

    return [
      { value: "Todos", label: "Todos" },
      ...skus.map((sku) => ({
        value: sku,
        label: `${sku} - ${
          sugestaoMinimo.find((x) => x.SKU === sku)?.Descricao || ""
        }`,
      })),
    ];
  }, [promoSuggestions, sugestaoMinimo]);

  // Opções de curva para o card de promoção
  const promoCurveOptions = useMemo(() => {
    if (!promoSuggestions || !promoSuggestions.length) {
      return ["Todas"];
    }
    const set = new Set();
    for (const r of promoSuggestions) {
      const cls = (r.Classe || "").trim();
      if (cls) set.add(cls);
    }
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [promoSuggestions]);

  // Aplicar filtro por curva, SKU e horizonte (dias) na visualização de promo
  const promoSuggestionsView = useMemo(() => {
    if (!promoSuggestions || !promoSuggestions.length) return [];

    // Horizonte: considerar sugestão base como ~1 ciclo (21 dias)
    const BASE_CYCLE_DAYS = 365 / 17;
    const horizonDaysNum =
      Number(promoHorizonDays) > 0
        ? Number(promoHorizonDays)
        : BASE_CYCLE_DAYS;
    const horizonFactor = horizonDaysNum / BASE_CYCLE_DAYS;

    let list = promoSuggestions;

    // filtro por curva
    if (promoCurveFilter !== "Todas") {
      list = list.filter((r) => (r.Classe || "") === promoCurveFilter);
    }

    // filtro por SKU
    if (promoSkuFilter !== "Todos") {
      list = list.filter((r) => r.SKU === promoSkuFilter);
    }

    // aplica ajuste de horizonte (multiplica qtd e valor)
    return list.map((r) => {
      const fator = horizonFactor || 1;
      return {
        ...r,
        QtdSugerida: Math.round((r.QtdSugerida || 0) * fator),
        ValorTotal: (r.ValorTotal || 0) * fator,
      };
    });
  }, [
    promoSuggestions,
    promoCurveFilter,
    promoSkuFilter,
    promoHorizonDays,
  ]);

  const promoTotalsView = useMemo(() => {
    let totalQtd = 0;
    let totalValor = 0;
    for (const r of promoSuggestionsView) {
      totalQtd += r.QtdSugerida || 0;
      totalValor += r.ValorTotal || 0;
    }
    return {
      totalQtd,
      totalValor,
      totalSkus: promoSuggestionsView.length,
    };
  }, [promoSuggestionsView]);

  const promoChartData = useMemo(() => {
    return promoSuggestionsView.slice(0, 20).map((r) => ({
      SKU: r.SKU,
      Label: `${r.SKU} — ${r.Descricao}`,
      QtdSugerida: r.QtdSugerida,
      ValorTotal: r.ValorTotal,
    }));
  }, [promoSuggestionsView]);

  const promoResumoKpis = useMemo(() => {
    if (!promoSuggestionsView.length) {
      return {
        valorTop1: 0,
        totalTop5Qtd: 0,
        totalTop5Valor: 0,
      };
    }

    const sorted = [...promoSuggestionsView].sort(
      (a, b) => (b.ValorTotal || 0) - (a.ValorTotal || 0)
    );

    const top1 = sorted[0];
    const top5 = sorted.slice(0, 5);

    const totalTop5Qtd = top5.reduce(
      (sum, r) => sum + (r.QtdSugerida || 0),
      0
    );
    const totalTop5Valor = top5.reduce(
      (sum, r) => sum + (r.ValorTotal || 0),
      0
    );

    return {
      valorTop1: top1?.ValorTotal || 0,
      totalTop5Qtd,
      totalTop5Valor,
    };
  }, [promoSuggestionsView]);

  const { transfers, buys, totalsPlan } = useMemo(() => {
    const transfers = [];
    const buys = [];

    let totalTransfer = 0; // qtd transferida (itens)
    let totalBuy = 0; // qtd comprada (itens)
    let totalBuyValor = 0; // investimento com transferências (R$)

    let baseBuyQty = 0; // qtd que seria comprada sem transferência
    let baseBuyValor = 0; // investimento sem transferências (R$)

    let moves = 0;

    // cada EstoqueMinimoSugerido foi calculado para ~1 ciclo
    const BASE_CYCLE_DAYS = 365 / 17;
    const horizonDaysNum =
      Number(planDays) > 0 ? Number(planDays) : BASE_CYCLE_DAYS;
    const horizonFactor = horizonDaysNum / BASE_CYCLE_DAYS;

    for (const rec of sugestaoMinimo) {
      const sku = rec.SKU;
      const desc = rec.Descricao;

      const cicloDes = skuDesativacao.get(sku) ?? null;

      // OPÇÃO 4 – filtro de exibição por desativação
      if (planDesativMode === "somente_ativos") {
        // só entra SKU sem desativação ou com desativação após o ciclo atual
        if (cicloDes != null && cicloDes <= CURRENT_CYCLE) continue;
      } else if (planDesativMode === "ate_ciclo_atual") {
        // só SKUs que desativam até o ciclo atual
        if (cicloDes == null || cicloDes > CURRENT_CYCLE) continue;
      } else if (planDesativMode === "ate_prox_ciclo") {
        // só SKUs que desativam até o próximo ciclo
        if (cicloDes == null || cicloDes > CURRENT_CYCLE + 1) continue;
      }

      const baseGlobalMin = rec.EstoqueMinimoSugerido || 0;
      const globalMin = Math.max(
        0,
        Math.round(baseGlobalMin * horizonFactor)
      );

      const classe = skuClasse.get(sku) || "";
      if (planCurveFilter !== "Todas" && classe !== planCurveFilter) {
        continue;
      }

      const categoria = skuCategoria.get(sku) || "";
      if (
        planCategoryFilter !== "Todas" &&
        categoria !== planCategoryFilter
      ) {
        continue;
      }

      const citiesMap = estoqueBySkuCity.get(sku);
      if (!citiesMap || !citiesMap.size) continue;

      // Ponderação por vendas por cidade (ou igualitário)
      let weights = new Map();
      if (salesShareCity.has(sku) && salesShareCity.get(sku).size) {
        const shares = salesShareCity.get(sku);
        let sum = 0;
        for (const city of citiesMap.keys()) {
          const w = shares.get(city) || 0;
          weights.set(city, w);
          sum += w;
        }
        if (sum === 0) {
          const count = citiesMap.size;
          for (const city of citiesMap.keys()) {
            weights.set(city, 1 / count);
          }
        } else {
          for (const [city, w] of Array.from(weights.entries())) {
            weights.set(city, w / sum);
          }
        }
      } else {
        const count = citiesMap.size;
        for (const city of citiesMap.keys()) {
          weights.set(city, 1 / count);
        }
      }

      // Distribuição do mínimo por cidade
      const cities = Array.from(citiesMap.keys());
      const targets = new Map();
      let assigned = 0;
      cities.forEach((city, idx) => {
        let t = Math.floor(globalMin * (weights.get(city) || 0));
        if (idx === cities.length - 1) {
          t = Math.max(0, globalMin - assigned);
        }
        targets.set(city, t);
        assigned += t;
      });

      const sources = [];
      const sinks = [];

      for (const [city, acc] of citiesMap.entries()) {
        const available =
          (acc.EstoqueAtual || 0) +
          (acc.EstoqueTransito || 0) -
          (acc.PendLiq || 0);
        const target = targets.get(city) || 0;
        const diff = available - target;

        // CENÁRIO SEM TRANSFERÊNCIA -> tudo que faltar, eu compraria
        if (diff < 0) {
          const needed = -diff;
          const priceMap = skuPrecoCidade.get(sku);
          const valorUnitBase = priceMap?.get(city) || 0;
          const valorTotalBase = valorUnitBase * needed;

          baseBuyQty += needed;
          baseBuyValor += valorTotalBase;

          sinks.push({ city, qty: needed });
        } else if (diff > 0) {
          sources.push({ city, qty: diff });
        }
      }

      // CENÁRIO COM TRANSFERÊNCIAS -> primeiro tenta cobrir com quem tem sobra
      let i = 0;
      let j = 0;
      while (i < sources.length && j < sinks.length) {
        const give = Math.min(sources[i].qty, sinks[j].qty);
        if (give > 0) {
          transfers.push({
            SKU: sku,
            Descricao: desc,
            Origem: sources[i].city,
            Destino: sinks[j].city,
            Qtd: give,
          });
          totalTransfer += give;
          moves += 1;
        }
        sources[i].qty -= give;
        sinks[j].qty -= give;
        if (sources[i].qty === 0) i++;
        if (sinks[j].qty === 0) j++;
      }

      // O que ainda falta depois das transferências -> compra
      for (; j < sinks.length; j++) {
        const q = sinks[j].qty;
        const city = sinks[j].city;
        if (q > 0) {
          const priceMap = skuPrecoCidade.get(sku);
          const valorUnit = priceMap?.get(city) || 0;
          const valorTotal = valorUnit * q;

          const isDesativadoParaCompra =
            cicloDes != null && cicloDes <= CURRENT_CYCLE;

          // OPÇÃO 2 – se SKU desativado entra ou não no plano de compras
          if (isDesativadoParaCompra && buyDesativMode === "excluir") {
            // não cria linha de compra, só deixa registrado no cenário base
            continue;
          }

          buys.push({
            SKU: sku,
            Descricao: desc,
            Cidade: city,
            Qtd: q,
            ValorUnit: valorUnit,
            ValorTotal: valorTotal,
          });

          totalBuy += q;
          totalBuyValor += valorTotal;
        }
      }
    }

    const economiaValor = baseBuyValor - totalBuyValor;
    const economiaQty = baseBuyQty - totalBuy;

    return {
      transfers,
      buys,
      totalsPlan: {
        totalTransfer,
        totalBuy,
        totalBuyValor,
        baseBuyQty,
        baseBuyValor,
        economiaQty,
        economiaValor,
        moves,
      },
    };
  }, [
    sugestaoMinimo,
    estoqueBySkuCity,
    salesShareCity,
    skuClasse,
    skuCategoria,
    skuPrecoCidade,
    skuDesativacao,
    planCurveFilter,
    planCategoryFilter,
    planDays,
    planDesativMode,
    buyDesativMode,
  ]);

  const planCityOptions = useMemo(() => {
    const set = new Set();
    for (const inner of Array.from(estoqueBySkuCity.values())) {
      for (const city of inner.keys()) {
        if (city) set.add(city);
      }
    }
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [estoqueBySkuCity]);

  const planCurveOptions = useMemo(() => {
    const set = new Set();
    for (const rec of sugestaoMinimo) {
      const cls = skuClasse.get(rec.SKU);
      if (cls) set.add(cls);
    }
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [sugestaoMinimo, skuClasse]);

  const planCategoryOptions = useMemo(() => {
    const set = new Set();
    for (const rec of sugestaoMinimo) {
      const cat = skuCategoria.get(rec.SKU);
      if (cat) set.add(cat);
    }
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [sugestaoMinimo, skuCategoria]);

  const transfersView = useMemo(() => {
    if (planCityFilter === "Todas") return transfers;
    return transfers.filter(
      (t) =>
        t.Origem === planCityFilter || t.Destino === planCityFilter
    );
  }, [transfers, planCityFilter]);

  const buysView = useMemo(() => {
    if (planCityFilter === "Todas") return buys;
    return buys.filter((b) => b.Cidade === planCityFilter);
  }, [buys, planCityFilter]);

  const transfersByDestino = useMemo(() => {
    const map = new Map();
    for (const t of transfersView) {
      const k = t.Destino || "(sem cidade)";
      map.set(k, (map.get(k) || 0) + (t.Qtd || 0));
    }
    return Array.from(map.entries())
      .map(([Cidade, Qtd]) => ({ Cidade, Qtd }))
      .sort((a, b) => b.Qtd - a.Qtd);
  }, [transfersView]);

  const transfersTopSku = useMemo(() => {
    const map = new Map();
    for (const t of transfersView) {
      const k = `${t.SKU} — ${t.Descricao || ""}`.trim();
      map.set(k, (map.get(k) || 0) + (t.Qtd || 0));
    }
    return Array.from(map.entries())
      .map(([SKU, Qtd]) => ({ SKU, Qtd }))
      .sort((a, b) => b.Qtd - a.Qtd)
      .slice(0, 10);
  }, [transfersView]);

  const buysByCidade = useMemo(() => {
    const map = new Map();
    for (const b of buysView) {
      const k = b.Cidade || "(sem cidade)";
      const prev = map.get(k) || { Qtd: 0, Valor: 0 };
      prev.Qtd += b.Qtd || 0;
      prev.Valor += b.ValorTotal || 0;
      map.set(k, prev);
    }
    return Array.from(map.entries())
      .map(([Cidade, v]) => ({
        Cidade,
        Qtd: v.Qtd,
        Valor: v.Valor,
      }))
      .sort((a, b) => b.Valor - a.Valor);
  }, [buysView]);

  const invPorMarca = useMemo(() => {
    const map = new Map();
    for (const b of buysView) {
      const marca = skuMarca.get(b.SKU) || "SEM MARCA";
      map.set(marca, (map.get(marca) || 0) + (b.ValorTotal || 0));
    }
    return Array.from(map.entries())
      .map(([Marca, Valor]) => ({ Marca, Valor }))
      .sort((a, b) => b.Valor - a.Valor);
  }, [buysView, skuMarca]);

  const buysTopSku = useMemo(() => {
    const map = new Map();

    for (const b of buysView) {
      const sku = b.SKU || "";
      if (!sku) continue;

      const key = sku;
      const atual = map.get(key) || {
        SKU: b.SKU,
        Descricao: b.Descricao || "",
        Qtd: 0,
        ValorTotal: 0,
      };

      atual.Qtd += b.Qtd || 0;
      atual.ValorTotal += b.ValorTotal || 0;

      map.set(key, atual);
    }

    return Array.from(map.values())
      .sort((a, b) => (b.ValorTotal || 0) - (a.ValorTotal || 0))
      .slice(0, 10);
  }, [buysView]);

  function exportXlsx() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        {
          MarcaFiltro: brandFilter,
          CidadeFiltro: cityFilter,
          EstoqueAtual: totEst,
          EstoqueEmTransito: totTrans,
          PedidosPendentesLiquidos: totPendLiq,
        },
      ]),
      "ResumoTotais"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rowsAgg),
      "DetalhePorSKU"
    );
    if (cyclesForSku.length) {
      const vendasSheet = cyclesForSku.map((r) => ({
        Ciclo: r.Ciclo,
        QtdVendida: r.QtdVendida,
      }));
      vendasSheet.push({
        Ciclo: "Média (janela)",
        QtdVendida: Number(media17.toFixed(2)),
      });
      vendasSheet.push({
        Ciclo: `Máximo (${maxInfo.ciclo})`,
        QtdVendida: maxInfo.qtd,
      });
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(vendasSheet),
        "Vendas_ciclos"
      );
    }
    XLSX.writeFile(wb, "dashboard_estoque.xlsx");
  }

function exportPlanXlsx() {
  const wb = XLSX.utils.book_new();

  // Transferências com Classe e Categoria
  const transfersExport = transfersView.map((r) => ({
    ...r,
    Classe: skuClasse.get(r.SKU) || "",
    Categoria: skuCategoria.get(r.SKU) || "",
  }));

  // Compras com Classe, Categoria e componentes de estoque
  const buysExport = buysView.map((r) => {
    const comp =
      estoqueComponentesBySku.get(r.SKU) || {
        EstoqueAtual: 0,
        EstoqueTransito: 0,
        PendentesLiquidos: 0,
      };

    const disponivel =
      (comp.EstoqueAtual || 0) +
      (comp.EstoqueTransito || 0) -
      (comp.PendentesLiquidos || 0);

    return {
      ...r,
      Classe: skuClasse.get(r.SKU) || "",
      Categoria: skuCategoria.get(r.SKU) || "",
      EstoqueAtualGlobal: comp.EstoqueAtual || 0,
      EstoqueTransitoGlobal: comp.EstoqueTransito || 0,
      PendentesLiquidosGlobal: comp.PendentesLiquidos || 0,
      EstoqueDisponivelGlobal: disponivel,
    };
  });

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(transfersExport),
    "Transferencias"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(buysExport),
    "Compras"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        TotalTransferir: totalsPlan.totalTransfer,
        Movimentos: totalsPlan.moves,
        TotalComprarItens: totalsPlan.totalBuy,
        InvestimentoComTransferencias: totalsPlan.totalBuyValor,
        InvestimentoSemTransferencias: totalsPlan.baseBuyValor,
        EconomiaValor: totalsPlan.economiaValor,
      },
      {
        ModoDistribuicao:
          "vendas (fallback igualitário se sem vendas por cidade)",
        CidadeFiltroPlano: planCityFilter,
        MarcaFiltro: brandFilter,
        ClasseFiltroPlano: planCurveFilter,
        CategoriaFiltroPlano: planCategoryFilter,
        HorizonteDias: Number(planDays) || 0,
        DesativacaoFiltroPlano: planDesativMode,
        ComprasDesativados: buyDesativMode,
      },
    ]),
    "Resumo"
  );

  XLSX.writeFile(wb, "plano_transferencia_compra.xlsx");
}

  function exportPromoXlsx() {
    if (!promoSuggestionsView.length) return;

    const wb = XLSX.utils.book_new();

    // Detalhe por SKU (incluindo componentes de estoque)
    const promoExport = promoSuggestionsView.map((r) => ({
      SKU: r.SKU,
      Descricao: r.Descricao,
      Classe: r.Classe,
      Categoria: skuCategoria.get(r.SKU) || "",
      DescontoPercent: r.Desconto,
      EstoqueMinBase: r.EstoqueMinBase,
      EstoqueAlvoPromo: r.EstoqueAlvoPromo,

      EstoqueAtualGlobal: r.EstoqueAtualGlobal || 0,
      EstoqueTransitoGlobal: r.EstoqueTransitoGlobal || 0,
      PendentesLiquidosGlobal: r.PendentesLiquidosGlobal || 0,
      EstoqueDisponivel: r.EstoqueDisponivel || 0,

      QtdSugerida: r.QtdSugerida,
      PrecoUnitPromo: r.PrecoUnitPromo,
      ValorTotal: r.ValorTotal,
    }));

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(promoExport),
      "Sugestao_Promocao"
    );

    // Resumo + filtros atuais do card
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        {
          HorizonteDias: Number(promoHorizonDays) || 0,
          SkuFiltro: promoSkuFilter,
          TotalSkus: promoTotalsView.totalSkus,
          TotalQtd: promoTotalsView.totalQtd,
          TotalValor: promoTotalsView.totalValor,
          NextPromoCycle: promoMeta.nextPromoCycle || null,
        },
      ]),
      "Resumo"
    );

    XLSX.writeFile(wb, "sugestao_compra_promocao.xlsx");
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-[#0c1118] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0c1118]/80 backdrop-blur px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl overflow-hidden ring-1 ring-sky-500/40 bg-sky-500/10 grid place-items-center">
              <Image
                src="/logo/logo.png"
                alt="BI Service"
                width={80}
                height={80}
                priority
              />
            </div>
            <div className="leading-tight">
              <div className="text-sm text-white/70">BI Service Beta</div>
              <h1 className="text-xl font-bold">
                <span>Dashboard</span>{" "}
                <span style={{ color: C_GREEN }}>de Estoque</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 no-print">
            <label
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium shadow"
              style={{ background: C_GREEN }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                className="opacity-90"
              >
                <path
                  fill="currentColor"
                  d="M19 15v4H5v-4H3v6h18v-6zM11 3v10.17l-3.59-3.58L6 11l6 6l6-6l-1.41-1.41L13 13.17V3z"
                />
              </svg>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={onUpload}
                className="hidden"
              />
            </label>

            <a
              href="/dashboard"
              className="rounded-lg px-3 py-2 text-sm font-medium shadow"
              style={{ background: C_PURPLE }}
            >
              Conferência
            </a>
            <a
              href="/"
              className="rounded-lg px-3 py-2 text-sm font-medium shadow inline-flex items-center gap-2"
              style={{ background: C_ROSE }}
            >
              Sair
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12 4l1.41 1.41L9.83 9H20v2H9.83l3.58 3.59L12 16l-6-6z"
                />
              </svg>
            </a>
          </div>
        </div>

        {isLoading && (
          <div className="mt-3 h-1 w-full bg-white/10 rounded">
            <div
              className="h-1 rounded"
              style={{
                width: `${progress}%`,
                background: C_BLUE,
                transition: "width .2s",
              }}
            />
          </div>
        )}
      </header>
      <nav className="mt-4 max-w-7xl mx-auto flex flex-wrap gap-2 text-xs sm:text-sm">
        {[
          {
            id: "resumo",
            label: "Resumo Total",
          },
          {
            id: "vendas",
            label: "Análise de Vendas",
          },
          {
            id: "minimo",
            label: "Sugestão Estoque Mínimo",
          },
          {
            id: "plano",
            label: "Plano de Transferências & Compras",
          },
          {
            id: "promo",
            label: "Sugestão Promoção",
          },
        ].map((tab) => {
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id)}
              className={`px-3 py-1.5 rounded-full border text-[11px] sm:text-xs transition-colors ${
                isActive
                  ? "bg-sky-500/30 border-sky-400 text-sky-50"
                  : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {isLoading && (
        <div className="fixed inset-0 z-10 bg-black/60 backdrop-blur-sm grid place-items-center no-print">
          <div
            className="w-full max-w-md rounded-2xl p-6"
            style={{ background: "#0f172a", border: `1px solid ${C_CARD_BORDER}` }}
          >
            <div className="flex items-center gap-3 mb-3">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                className="animate-spin"
              >
                <path
                  fill="currentColor"
                  d="M12 1a11 11 0 1 0 11 11A11.013 11.013 0 0 0 12 1Zm0 19a8 8 0 1 1 8-8a8.009 8.009 0 0 1-8 8Z"
                />
                <path
                  fill="currentColor"
                  d="M12 4a8 8 0 0 1 8 8h3A11 11 0 0 0 12 1Z"
                />
              </svg>
              <h2 className="text-lg font-semibold">Processando arquivo</h2>
            </div>
            <p className="text-sm text-white/80 mb-3">
              {status || "Aguarde…"}
            </p>
            <div className="h-2 w-full bg-white/10 rounded">
              <div
                className="h-2 rounded"
                style={{
                  width: `${progress}%`,
                  background: C_GREEN,
                  transition: "width .2s",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {activeSection === "resumo" && (
        <>
      {/* RESUMO TOTAL COMPLETO DENTRO DO CARD AZUL */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4 no-print">
        <Card
          title="Resumo Total"
          borderColor="rgba(59,130,246,.35)"
        >
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <SelectDark
              label="Aba/Marca"
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              options={brandOptions}
            />
            <SelectDark
              label="Cidade"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              options={cityOptions}
            />
            <div className="md:col-span-3">
              <p className="text-xs text-white/70 mb-1">
                Buscar por SKU/Descrição
              </p>

              <input
                className="w-full rounded-lg border border-white/20 px-3 py-2 text-sm"
                style={{ backgroundColor: "#0f172a", color: "#ffffff" }}
                placeholder="buscar…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={() => {
                setBrandFilter("Todas");
                setCityFilter("Todas");
                setQuery("");
                setSkuSel("Todos");
                setSelectedCycle("Todos");
                setSalesCityFilter("Todas");
                setPlanCityFilter("Todas");
                setPlanCurveFilter("Todas");
                setPlanCategoryFilter("Todas");
                setPlanDesativMode("todos");
                setBuyDesativMode("excluir");
              }}
              className="rounded-lg px-3 py-2 text-sm font-medium"
              style={{ background: "rgba(148,163,184,.5)" }}
            >
              Limpar filtros
            </button>
            <button
              onClick={() => setShowDetail((v) => !v)}
              className="rounded-lg px-3 py-2 text-sm font-medium"
              style={{ background: C_PURPLE }}
            >
              {showDetail ? "Ocultar detalhe" : "Ver detalhe"}
            </button>
            <button
              onClick={exportXlsx}
              className="rounded-lg px-3 py-2 text-sm font-medium shadow"
              style={{ background: C_BLUE }}
            >
              Exportar XLSX
            </button>
          </div>

          {/* Erro */}
          {error ? (
            <p className="text-sm mt-2" style={{ color: "#f87171" }}>
              {error}
            </p>
          ) : null}

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <Kpi title="Estoque Atual" value={totEst} color={C_BLUE} />
            <Kpi title="Em Trânsito" value={totTrans} color={C_GREEN} />
            <Kpi
              title="Pendentes Líquidos"
              value={totPendLiq}
              color={C_AMBER}
            />
          </div>

          {/* Pizza */}
          <div className="mt-6">
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Estoque Atual", value: totEst },
                      { name: "Em Trânsito", value: totTrans },
                      { name: "Pendentes Líquidos", value: totPendLiq },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius="80%"
                    label
                  >
                    {PIE_COLORS.map((c, i) => (
                      <Cell key={i} fill={c} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detalhe por SKU */}
          {showDetail && (
            <div className="mt-6">
              <div
                className="overflow-auto rounded-lg"
                style={{ border: `1px solid ${C_CARD_BORDER}` }}
              >
                <table className="w-full text-sm">
                  <thead className="bg-white/5">
                    <tr>
                      {[
                        "Código do Produto",
                        "Descrição do Produto",
                        "Cidade",
                        "Estoque Atual",
                        "Em Trânsito",
                        "Pedidos Pendentes",
                        "Pendentes Líquidos",
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
                    {rowsAgg.map((r) => (
                      <tr
                        key={r.CodigoProduto + "-" + (r.Cidade || "")}
                        className="border-t"
                        style={{ borderColor: C_CARD_BORDER }}
                      >
                        <td className="px-3 py-2 whitespace-nowrap">
                          {r.CodigoProduto}
                        </td>
                        <td className="px-3 py-2">
                          {r.DescricaoProduto}
                        </td>
                        <td className="px-3 py-2">
                          {r.Cidade || ""}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.EstoqueAtual}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.EstoqueTransito}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.PedidosPendentes}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.PendentesLiquidos}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      </div>


        </>
      )}
      {(activeSection === "vendas") && (
        <>
      {/* VENDAS 17 CICLOS */}
      <div className="max-w-7xl mx-auto px-6 mt-10 space-y-4">
        <Card
          title="Análise de Vendas (últimos 17 ciclos)"
          borderColor="rgba(59,130,246,.35)"
          right={
            <div className="flex items-end gap-2 no-print">
              <span
                className="hidden sm:inline text-xs rounded-md px-2 py-1"
                style={{
                  background: "rgba(59,130,246,.15)",
                  border: "1px solid rgba(59,130,246,.35)",
                }}
              >
                Filtrando: <b>{skuSel}</b> · <b>{selectedCycle}</b> ·{" "}
                <b>{brandFilter}</b> · <b>{salesCityFilter}</b>
              </span>
              <button
                onClick={() => setShowCycleDetail((v) => !v)}
                className="rounded-lg px-3 py-2 text-xs sm:text-sm font-medium shadow"
                style={{ background: C_PURPLE }}
              >
                {showCycleDetail ? "Ocultar detalhe" : "Ver detalhe"}
              </button>
              <button
                onClick={exportXlsx}
                className="rounded-lg px-3 py-2 text-xs sm:text-sm font-medium shadow"
                style={{ background: C_BLUE }}
              >
                Exportar XLSX
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <SelectDark
              label="SKU (Produto)"
              value={skuSel}
              onChange={(e) => setSkuSel(e.target.value)}
              options={skuOptions}
            />
            <SelectDark
              label="Ciclo (para detalhe)"
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              options={cycleOptions}
            />
            <SelectDark
              label="Loja (Cidade vendas)"
              value={salesCityFilter}
              onChange={(e) => setSalesCityFilter(e.target.value)}
              options={SALES_CITY_OPTIONS}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Kpi
              title="Média (janela)"
              value={Number(media17 || 0).toLocaleString("pt-BR", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}
              color={C_BLUE}
              raw
            />
            <Kpi
              title="Ciclo com maior venda"
              value={maxInfo.ciclo || "-"}
              color={C_GREEN}
              raw
            />
            <Kpi
              title="Qtd máxima nesse ciclo"
              value={maxInfo.qtd || 0}
              color={C_AMBER}
            />
          </div>

          {showCycleDetail && (
            <Card
              title="Resumo do Filtro"
              borderColor="rgba(124,58,237,.35)"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Kpi
                  title="Média por ciclo (filtro)"
                  value={resumoFiltro.mediaTexto}
                  color={C_BLUE}
                  raw
                />
                <Kpi
                  title="Máximo no filtro (Qtd)"
                  value={resumoFiltro.maxQtdTexto}
                  color={C_AMBER}
                  raw
                />
                <Kpi
                  title="Onde ocorreu o máximo"
                  value={resumoFiltro.maxLabel}
                  color={C_GREEN}
                  raw
                  size="sm"
                />
              </div>
            </Card>
          )}

