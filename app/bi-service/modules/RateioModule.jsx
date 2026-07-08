"use client";

import RateioPage from "../../dashboard-rateio/page";

export default function RateioModule() {
  return (
    <div className="bi-legacy-module bi-legacy-rateio rateio-filtros-dark-force">
      <RateioPage />

      <style jsx global>{`
        .bi-legacy-rateio,
        .bi-legacy-rateio * {
          color-scheme: dark;
        }

        /* PADRÃO CONFERENTE - CAMPOS DE FILTRO DO RATEIO */
        .bi-legacy-rateio input,
        .bi-legacy-rateio select,
        .bi-legacy-rateio textarea {
          background: #1a1a1a !important;
          background-color: #1a1a1a !important;
          color: #ffffff !important;
          border: 1px solid rgba(255,255,255,0.14) !important;
          border-radius: 6px !important;
          height: 50px !important;
          min-height: 50px !important;
          padding: 0 14px !important;
          font-size: 16px !important;
          font-weight: 400 !important;
          box-shadow: none !important;
          outline: none !important;
          opacity: 1 !important;
        }

        .bi-legacy-rateio input::placeholder,
        .bi-legacy-rateio textarea::placeholder {
          color: rgba(255,255,255,0.55) !important;
          opacity: 1 !important;
        }

        .bi-legacy-rateio select option {
          background: #1a1a1a !important;
          color: #ffffff !important;
        }

        .bi-legacy-rateio input:disabled,
        .bi-legacy-rateio select:disabled,
        .bi-legacy-rateio textarea:disabled {
          background: #1a1a1a !important;
          background-color: #1a1a1a !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          border-color: rgba(255,255,255,0.14) !important;
          opacity: 1 !important;
          cursor: default !important;
        }

        .bi-legacy-rateio input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(1) opacity(0.55) !important;
          cursor: pointer;
        }

        .bi-legacy-rateio input:-webkit-autofill,
        .bi-legacy-rateio input:-webkit-autofill:hover,
        .bi-legacy-rateio input:-webkit-autofill:focus,
        .bi-legacy-rateio textarea:-webkit-autofill,
        .bi-legacy-rateio select:-webkit-autofill {
          -webkit-text-fill-color: #ffffff !important;
          -webkit-box-shadow: 0 0 0px 1000px #1a1a1a inset !important;
          transition: background-color 9999s ease-in-out 0s !important;
        }

        .bi-legacy-rateio label,
        .bi-legacy-rateio .text-xs,
        .bi-legacy-rateio .text-sm,
        .bi-legacy-rateio p {
          font-weight: 400 !important;
        }

        /* Botão Limpar filtros no mesmo estilo do Conferente */
        .bi-legacy-rateio button {
          border-radius: 6px !important;
          font-weight: 400 !important;
        }

        .bi-legacy-rateio button[class*="bg-white"],
        .bi-legacy-rateio button[class*="border-white"] {
          background: #1a1a1a !important;
          border: 1px solid rgba(255,255,255,0.14) !important;
          color: #ffffff !important;
        }
      `}</style>
    </div>
  );
}
