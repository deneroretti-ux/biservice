"use client";

import DashboardPage from "../../dashboard/page";

export default function DashboardModule() {
  return (
    <div className="bi-legacy-module bi-legacy-dashboard bi-service-conferente-clean">
      <DashboardPage />

      <style jsx global>{`
        /* Remove o cabeçalho antigo do Dashboard Conferente dentro do BI Service */
        .bi-service-conferente-clean main > div > div:first-child,
        .bi-service-conferente-clean main > div > header:first-child,
        .bi-service-conferente-clean main > div > section:first-child {
          display: none !important;
        }

        .bi-service-conferente-clean img[src*="logo"],
        .bi-service-conferente-clean img[alt*="BI"],
        .bi-service-conferente-clean img[alt*="Logo"] {
          display: none !important;
        }

        .bi-service-conferente-clean h1,
        .bi-service-conferente-clean h1 * {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
