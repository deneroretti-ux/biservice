"use client";

import EstoquePage from "../../dashboard-estoque/page";

export default function EstoqueModule({ activeSection = "resumo" }) {
  return (
    <div className="bi-legacy-module bi-legacy-estoque">
      <EstoquePage activeSection={activeSection} />
    </div>
  );
}
