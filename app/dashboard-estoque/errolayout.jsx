"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import DashboardEstoquePage from "./page";

const SectionContext = createContext({
  section: "resumo",
  setSection: () => {},
});

export function useDashboardSection() {
  return useContext(SectionContext);
}

export default function DashboardEstoqueLayout({ children }) {
  const [section, setSection] = useState("resumo");

  // fallback: se não tiver child específico, mantém "resumo"
  useEffect(() => {
    if (!children) setSection("resumo");
  }, [children]);

  return (
    <SectionContext.Provider value={{ section, setSection }}>
      <DashboardEstoquePage section={section} />
      {children}
    </SectionContext.Provider>
  );
}
