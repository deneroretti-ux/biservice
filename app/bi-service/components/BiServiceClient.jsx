"use client";

import React, { useEffect, useMemo, useState } from "react";
import DashboardModule from "../modules/DashboardModule";
import RateioModule from "../modules/RateioModule";
import ConsultorModule from "../modules/ConsultorModule";
import EstoqueModule from "../modules/EstoqueModule";
import FiscalModule from "../modules/FiscalModule";

const ESTOQUE_SECTIONS = [
  { key: "resumo", label: "Resumo Total" },
  { key: "vendas", label: "Análise de Vendas" },
  { key: "minimo", label: "Estoque Mínimo" },
  { key: "plano", label: "Transferência e Compras" },
];

const moduleMap = {
  dashboard: DashboardModule,
  "dashboard-rateio": RateioModule,
  "dashboard-consultor": ConsultorModule,
  "dashboard-estoque": EstoqueModule,
  "dashboard-fiscal": FiscalModule,
};

function getEstoqueSectionFromHash() {
  if (typeof window === "undefined") return "resumo";
  const hash = window.location.hash.replace("#", "");
  return ESTOQUE_SECTIONS.some((item) => item.key === hash) ? hash : "resumo";
}

export default function BiServiceClient({ initialModule = "dashboard" }) {
  const [activeModule, setActiveModule] = useState(initialModule);
  const [estoqueSection, setEstoqueSection] = useState("resumo");

  useEffect(() => {
    setActiveModule(initialModule || "dashboard");
  }, [initialModule]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function syncFromLocation() {
      const path = window.location.pathname || "";
      if (path.includes("dashboard-estoque")) {
        setActiveModule("dashboard-estoque");
        setEstoqueSection(getEstoqueSectionFromHash());
      } else if (path.includes("dashboard-rateio")) {
        setActiveModule("dashboard-rateio");
      } else if (path.includes("dashboard-consultor")) {
        setActiveModule("dashboard-consultor");
      } else if (path.includes("dashboard-fiscal")) {
        setActiveModule("dashboard-fiscal");
      } else if (path.includes("dashboard")) {
        setActiveModule("dashboard");
      }
    }

    syncFromLocation();
    window.addEventListener("hashchange", syncFromLocation);
    window.addEventListener("popstate", syncFromLocation);
    return () => {
      window.removeEventListener("hashchange", syncFromLocation);
      window.removeEventListener("popstate", syncFromLocation);
    };
  }, []);

  const CurrentModule = useMemo(() => {
    return moduleMap[activeModule] || DashboardModule;
  }, [activeModule]);

  return (
    <main className="bi-service-main">
      <div className={`bi-module-frame bi-module-${activeModule} estoque-section-${estoqueSection}`}>
        <CurrentModule activeSection={activeModule === "dashboard-estoque" ? estoqueSection : undefined} />
      </div>

      <style jsx global>{`
        html,
        body {
          background: #000000 !important;
          overflow-x: hidden !important;
        }

        .bi-service-main {
          min-width: 0;
          width: 100%;
          padding: 0;
          margin: 0;
          overflow-x: hidden;
          align-self: start;
        }

        .bi-module-frame {
          min-width: 0;
          width: 100%;
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }

        .bi-service-submenu,
        .bi-service-tabs,
        .bi-legacy-estoque nav {
          display: none !important;
        }

        .bi-module-frame > div:first-child {
          min-height: auto !important;
          height: auto !important;
          max-width: none !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
          background: transparent !important;
        }

        .bi-module-frame > div:first-child > header,
        .bi-module-frame > div:first-child > nav,
        .bi-module-frame > div:first-child > aside,
        .bi-module-frame > div:first-child > div > header,
        .bi-module-frame > div:first-child > div > nav,
        .bi-module-frame > div:first-child > div > aside {
          display: none !important;
        }

        .bi-module-frame > div:first-child > main,
        .bi-module-frame > div:first-child > section,
        .bi-module-frame > div:first-child > div,
        .bi-module-frame > div:first-child > main > div:first-child {
          max-width: none !important;
          width: 100% !important;
          margin: 0 !important;
          padding-top: 0 !important;
        }

        .bi-module-frame [class*="min-h-screen"],
        .bi-module-frame [style*="100vh"],
        .bi-module-frame [style*="100dvh"] {
          min-height: auto !important;
          height: auto !important;
        }

        .bi-module-frame .max-w-7xl,
        .bi-module-frame .max-w-[1600px],
        .bi-module-frame .container {
          max-width: none !important;
        }

        .bi-module-frame .recharts-wrapper,
        .bi-module-frame .recharts-surface {
          max-width: 100% !important;
        }

        .bi-legacy-module,
        .bi-legacy-module > div:first-child,
        .bi-legacy-module > div:first-child > div:first-child,
        .bi-legacy-module main,
        .bi-legacy-module section {
          min-width: 0 !important;
          max-width: none !important;
          width: 100% !important;
          margin: 0 !important;
          min-height: auto !important;
          height: auto !important;
          background: transparent !important;
          overflow: visible !important;
        }

        .bi-legacy-consultor header,
        .bi-legacy-consultor nav,
        .bi-legacy-consultor aside,
        .bi-legacy-consultor [role="navigation"],
        .bi-legacy-consultor [class*="sidebar"],
        .bi-legacy-consultor [class*="Sidebar"],
        .bi-legacy-consultor [class*="sideBar"],
        .bi-legacy-consultor [class*="sidenav"],
        .bi-legacy-consultor [class*="side-nav"],
        .bi-legacy-consultor [class*="menu-lateral"],
        .bi-legacy-consultor [class*="MenuLateral"],
        .bi-legacy-consultor [class*="drawer"],
        .bi-legacy-consultor [class*="Drawer"] {
          display: none !important;
        }


        .bi-legacy-consultor [style*="margin-left"],
        .bi-legacy-consultor [style*="padding-left"] {
          margin-left: 0 !important;
          padding-left: 0 !important;
        }


        .bi-legacy-consultor {
          display: block !important;
        }

        .bi-legacy-consultor main,
        .bi-legacy-consultor section,
        .bi-legacy-consultor > div {
          max-width: none !important;
          width: 100% !important;
        }

        @media print {
          .no-print,
          .bi-module-frame > div:first-child > header,
          .bi-module-frame > div:first-child > nav {
            display: none !important;
          }

          .bi-service-main {
            padding: 0 !important;
          }
        }
      `}</style>
    </main>
  );
}
