"use client";

import { useEffect } from "react";
import { useDashboardSection } from "../layout";

export default function PlanoTransferenciaComprasPage() {
  const { setSection } = useDashboardSection();

  useEffect(() => {
    setSection("plano");
  }, [setSection]);

  return null;
}
