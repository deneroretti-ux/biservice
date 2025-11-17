// store/useDataStore.js
"use client";
import { create } from "zustand";

const KEY = "bi-service-data-v1";

export const useDataStore = create((set, get) => ({
  // datasets
  estoque: [],
  vendas: [],
  ciclos: [],

  // ui state
  brand: "Todas",
  lastFileName: "",

  // loading
  loading: false,
  progress: 0,
  status: "",

  setLoading: (loading) => set({ loading }),
  setProgress: (progress) => set({ progress }),
  setStatus: (status) => set({ status }),

  setDatasets: ({ estoque, vendas, ciclos, lastFileName }) => {
    const state = { estoque, vendas, ciclos, lastFileName };
    set(state);
    // persist
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  },

  hydrate: () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      set(parsed);
    } catch {}
  },
}));
