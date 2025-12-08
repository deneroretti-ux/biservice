"use client";

import { useEffect } from "react";
import { useDashboardSection } from "../layout";

export default function ResumoTotalPage() {
  const { setSection } = useDashboardSection();

  useEffect(() => {
    setSection("resumo");
  }, [setSection]);

  return null;
}
