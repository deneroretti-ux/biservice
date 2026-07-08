"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Wallet,
  Boxes,
  BarChart3,
  PackageSearch,
  ArrowRightLeft,
  Users,
  ClipboardCheck,
  ChevronRight,
  Trophy,
} from "lucide-react";

const BASE = "/bi-service";

const MENU = [
  {
    title: "Financeiro",
    icon: Wallet,
    color: "#d4af37",
    children: [
      { title: "Previsão", href: `${BASE}/dashboard-rateio#previsao`, icon: Wallet },
      { title: "Orçamento", href: `${BASE}/dashboard-rateio#orcamento`, icon: Wallet },
    ],
  },
  {
    title: "Fiscal / Tributário",
    href: `${BASE}/dashboard-fiscal`,
    icon: BarChart3,
    color: "#f59e0b",
  },
  {
    title: "Estoque",
    icon: Boxes,
    color: "#60a5fa",
    children: [
      { title: "Resumo Total", href: `${BASE}/dashboard-estoque#resumo`, icon: Boxes },
      { title: "Análise Vendas", href: `${BASE}/dashboard-estoque#vendas`, icon: BarChart3 },
      { title: "Estoque Mínimo", href: `${BASE}/dashboard-estoque#minimo`, icon: PackageSearch },
      { title: "Transferência e Compras", href: `${BASE}/dashboard-estoque#plano`, icon: ArrowRightLeft },
    ],
  },
  {
    title: "Consultor",
    href: `${BASE}/dashboard-consultor`,
    icon: Users,
    color: "#22c55e",
  },
  
  {
    title: "Conferente",
    href: `${BASE}/dashboard`,
    icon: ClipboardCheck,
    color: "#a855f7",
  },
];

function isActive(pathname, hash, href) {
  if (!href) return false;
  const [cleanHref, hrefHash] = href.split("#");

  if (hrefHash) {
    return pathname === cleanHref && hash === hrefHash;
  }

  return pathname === cleanHref || pathname?.startsWith(`${cleanHref}/`);
}

function MenuItem({ item, pathname, hash, onHashNavigate, nested = false }) {
  const Icon = item.icon || ChevronRight;
  const active = isActive(pathname, hash, item.href);

  if (!item.href) {
    return (
      <div style={{ marginTop: nested ? 2 : 8 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: nested ? "5px 9px" : "7px 10px",
            color: "rgba(255,255,255,0.72)",
            fontSize: nested ? 11 : 12,
            fontWeight: 900,
            textTransform: nested ? "none" : "uppercase",
            letterSpacing: nested ? 0 : 0.35,
          }}
        >
          <span
            style={{
              width: 30,
              height: 30,
              display: "grid",
              placeItems: "center",
              borderRadius: 12,
              background: `${item.color || "#d4af37"}18`,
              border: `1px solid ${item.color || "#d4af37"}55`,
              boxShadow: `0 0 18px ${item.color || "#d4af37"}14`,
            }}
          >
            <Icon size={15} color={item.color || "#d4af37"} />
          </span>
          <span>{item.title}</span>
        </div>
        <div style={{ display: "grid", gap: 4, marginTop: 4, paddingLeft: 10 }}>
          {(item.children || []).map((child) => (
            <MenuItem key={child.title} item={{ ...child, color: item.color }} pathname={pathname} hash={hash} onHashNavigate={onHashNavigate} nested />
          ))}
        </div>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={(e) => {
        if (item.href?.includes("#")) {
          e.preventDefault();

          const [, nextHash = ""] = item.href.split("#");
          onHashNavigate?.(nextHash);

          if (typeof window !== "undefined") {
            window.location.href = item.href;
          }
        }
      }}
      style={{
        textDecoration: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: nested ? "7px 9px" : "9px 11px",
        borderRadius: nested ? 12 : 15,
        color: active ? "#061018" : "rgba(255,255,255,0.84)",
        background: active
          ? "linear-gradient(135deg, #d4af37, #d99a12)"
          : "rgba(255,255,255,0.035)",
        border: active ? "1px solid rgba(212,175,55,0.90)" : "1px solid rgba(255,255,255,0.08)",
        boxShadow: active ? "0 12px 24px rgba(212,175,55,0.18)" : "inset 0 1px 0 rgba(255,255,255,0.04)",
        fontSize: nested ? 11 : 13,
        fontWeight: 900,
        transition: "all .18s ease",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span
          style={{
            width: nested ? 24 : 30,
            height: nested ? 24 : 30,
            display: "grid",
            placeItems: "center",
            borderRadius: nested ? 9 : 11,
            background: active ? "rgba(0,0,0,0.12)" : `${item.color || "#d4af37"}18`,
            border: active ? "1px solid rgba(0,0,0,0.12)" : `1px solid ${item.color || "#d4af37"}50`,
          }}
        >
          <Icon size={nested ? 13 : 16} color={active ? "#061018" : item.color || "#d4af37"} />
        </span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
      </span>
      {!nested && <ChevronRight size={14} opacity={0.75} />}
    </Link>
  );
}

export default function BiServiceLayout({ children }) {
  const pathname = usePathname();
  const year = useMemo(() => new Date().getFullYear(), []);
  const [hash, setHash] = useState("");
  const [tvMode, setTvMode] = useState(false);

  useEffect(() => {
    function syncHash() {
      const currentHash = window.location.hash.replace("#", "") || "";
      const isEstoque = window.location.pathname.includes("dashboard-estoque");
      setHash(isEstoque ? currentHash || "resumo" : currentHash);
    }

    syncHash();
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);

    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncHash);
    };
  }, []);

  useEffect(() => {
    function syncTvMode() {
      setTvMode(!!document.fullscreenElement);
    }

    syncTvMode();
    document.addEventListener("fullscreenchange", syncTvMode);

    return () => {
      document.removeEventListener("fullscreenchange", syncTvMode);
    };
  }, []);


  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#fff", display: "flex", overflow: "hidden" }}>
      <aside
        style={{
          width: 248,
          minWidth: 248,
          height: "100vh",
          position: "sticky",
          top: 0,
          background: "#000000",
          borderRight: "1px solid rgba(212,175,55,0.30)",
          boxShadow: "14px 0 46px rgba(0,0,0,0.32)",
          padding: "12px 10px",
          display: tvMode ? "none" : "flex",
          flexDirection: "column",
          zIndex: 20,
          overflow: "hidden",
        }}
      >
        <Link href={`${BASE}/dashboard-rateio#previsao`} style={{ textDecoration: "none", color: "inherit" }}>
          <div
            style={{
              padding: "0px 4px 2px",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <img
              src="/logo-bi-service.png"
              alt="BI Service"
              style={{
                width: "100%",
                maxWidth: 220,
                height: "auto",
                objectFit: "contain",
                filter: "drop-shadow(0 0 18px rgba(212,175,55,0.22))",
              }}
            />
          </div>
        </Link>

        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.52), transparent)", margin: "0 0 10px" }} />

        <nav style={{ display: "grid", gap: 6, overflowY: "auto", overflowX: "hidden", paddingRight: 1 }}>
          {MENU.map((item) => (
            <MenuItem key={item.title} item={item} pathname={pathname} hash={hash} onHashNavigate={setHash} />
          ))}
        </nav>

        <div style={{ marginTop: "auto", paddingTop: 10 }}>
          <button
            type="button"
            onClick={() => {
              if (typeof document !== "undefined") {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen?.();
                  setTvMode(true);
                } else {
                  document.exitFullscreen?.();
                  setTvMode(false);
                }
              }
            }}
            style={{
              width: "100%",
              border: "1px solid rgba(212,175,55,0.36)",
              background: "linear-gradient(135deg, rgba(212,175,55,0.14), rgba(212,175,55,0.06))",
              color: "#d4af37",
              borderRadius: 15,
              padding: "11px 10px",
              fontWeight: 1000,
              cursor: "pointer",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 14 }}>
              <Trophy size={16} /> MODO TV
            </span>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 10, marginTop: 2 }}>Tela cheia</div>
          </button>
          <div style={{ color: "rgba(255,255,255,0.34)", fontSize: 9, textAlign: "center", marginTop: 9 }}>BI Service • {year}</div>
        </div>
      </aside>

      <main
        style={{
          flex: 1,
          width: tvMode ? "100vw" : undefined,
          minWidth: 0,
          height: "100vh",
          overflow: "auto",
          background: "#000000",
        }}
      >
        {children}
      </main>
    </div>
  );
}
