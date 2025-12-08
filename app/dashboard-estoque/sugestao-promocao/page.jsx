"use client";

import { useEffect } from "react";
import { useDashboardSection } from "../layout";

export default function SugestaoPromocaoPage() {
  const { setSection } = useDashboardSection();

  useEffect(() => {
    setSection("promo");
  }, [setSection]);

  return null;
}
