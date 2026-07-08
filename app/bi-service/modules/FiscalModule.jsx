"use client";

import FiscalPage from "../../dashboard-fiscal/page";

export default function FiscalModule() {
  return (
    <div className="bi-legacy-module bi-legacy-fiscal">
      <FiscalPage />

      <style jsx global>{`
        .bi-legacy-fiscal,
        .bi-legacy-fiscal * {
          color-scheme: dark;
        }

        .bi-module-dashboard-fiscal .fiscalPage {
          min-height: auto !important;
        }
      `}</style>
    </div>
  );
}
