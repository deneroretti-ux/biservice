"use client";

import { useEffect } from "react";
import { useDashboardSection } from "../layout";

export default function SugestaoEstoqueMinimoPage() {
  const { setSection } = useDashboardSection();

  useEffect(() => {
    setSection("minimo");
  }, [setSection]);

  return null;
}
