// components/Theme.js
export const CYCLE_WINDOW = 17;

export const C_BLUE = "#3b82f6";
export const C_GREEN = "#22c55e";
export const C_AMBER = "#f59e0b";
export const C_ROSE = "#ef4444";
export const C_PURPLE = "#7c3aed";
export const C_CARD_BORDER = "rgba(255,255,255,0.10)";
export const C_CARD_BG = "rgba(255,255,255,0.03)";
export const PIE_COLORS = [C_BLUE, C_GREEN, C_AMBER];

export function Card({ title, borderColor = C_CARD_BORDER, children, right = null }) {
  return (
    <section className="rounded-2xl p-4 shadow-sm" style={{ border:`1px solid ${borderColor}`, background:C_CARD_BG }}>
      <div className="flex items-end justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>{right}
      </div>
      {children}
    </section>
  );
}
export function Kpi({ title, value, color = C_BLUE, raw = false }) {
  const display = raw ? String(value ?? "") : Number(value || 0).toLocaleString("pt-BR");
  return (
    <div className="rounded-2xl p-4" style={{ border:`1px solid ${C_CARD_BORDER}`, background:C_CARD_BG }}>
      <p className="text-xs text-white/70">{title}</p>
      <p className="text-3xl font-extrabold mt-1" style={{ color }}>{display}</p>
    </div>
  );
}
export function SelectDark({ label, value, onChange, options, className = "" }) {
  return (
    <div className={className}>
      <p className="text-xs text-white/70 mb-1">{label}</p>
      <div className="relative">
        <select value={value} onChange={onChange}
          className="w-full appearance-none rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 text-sm text-white pr-9"
          style={{ colorScheme:"dark" }}>
          {options.map((opt) => (
            <option key={opt} value={opt} className="text-white" style={{ color:"#fff", backgroundColor:"#0f172a" }}>
              {opt}
            </option>
          ))}
        </select>
        <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-80" width="16" height="16" viewBox="0 0 24 24">
          <path fill="currentColor" d="M7 10l5 5l5-5z" />
        </svg>
      </div>
    </div>
  );
}
