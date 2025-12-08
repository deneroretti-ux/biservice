"use client";

import { useEffect } from "react";
import { useDashboardSection } from "../layout";

export default function AnaliseVendasPage() {
  const { setSection } = useDashboardSection();

  useEffect(() => {
    setSection("vendas");
  }, [setSection]);

  return null;
}
