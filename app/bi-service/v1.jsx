export default function BiServicePage() {
  const whatsapp = "https://wa.me/5517999999999?text=Ol%C3%A1%2C%20quero%20conhecer%20o%20BI%20Service%20Agr%C3%ADcola";

  const benefits = [
    { title: "Custo por caixa", text: "Veja rapidamente quanto custa produzir cada caixa." },
    { title: "Controle total", text: "Insumos, mão de obra, produção e plantio em um só painel." },
    { title: "Decisão rápida", text: "Identifique desperdícios e pontos de atenção em segundos." },
  ];

  const plans = [
    { name: "Básico", price: "R$ 147/mês", items: ["Dashboard padrão", "Upload manual", "Indicadores principais"] },
    { name: "Profissional", price: "R$ 347/mês", featured: true, items: ["Dashboard completo", "Suporte WhatsApp", "Ajuste de planilha", "Atualização mensal"] },
    { name: "Premium", price: "R$ 697/mês", items: ["Personalização", "Relatório PDF", "Comparativo de safra", "Modo TV"] },
  ];

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.glowOne} />
        <div style={styles.glowTwo} />

        <header style={styles.header}>
          <div style={styles.brandMini}>
            <img src="/logo_Bi_Service.png" alt="BI Service" style={styles.logoMini} />
            <span>BI Service</span>
          </div>
          <a href={whatsapp} target="_blank" style={styles.topButton}>Falar no WhatsApp</a>
        </header>

        <div style={styles.heroGrid}>
          <div style={styles.heroText}>
            <div style={styles.badge}>BI Service Agrícola</div>
            <h1 style={styles.h1}>Controle inteligente da sua lavoura</h1>
            <p style={styles.subtitle}>
              Transformamos sua planilha em um painel profissional para acompanhar custos,
              produção, insumos, mão de obra e rentabilidade com clareza.
            </p>
            <div style={styles.ctaRow}>
              <a href={whatsapp} target="_blank" style={styles.primaryButton}>Quero uma demonstração</a>
              <a href="#planos" style={styles.secondaryButton}>Ver planos</a>
            </div>
            <div style={styles.statsRow}>
              <div><strong>+ clareza</strong><span>nos custos</span></div>
              <div><strong>+ controle</strong><span>na produção</span></div>
              <div><strong>+ decisão</strong><span>com dados</span></div>
            </div>
          </div>

          <div style={styles.logoCard}>
            <img src="/logo_Bi_Service.png" alt="BI Service" style={styles.logoHero} />
          </div>
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.sectionTitle}>Você tem dados... mas precisa de visão</div>
        <div style={styles.problemGrid}>
          <div style={styles.problemCard}>Não sabe quanto custa produzir por pé ou por caixa.</div>
          <div style={styles.problemCard}>Não enxerga quais produtos mais pesam no custo.</div>
          <div style={styles.problemCard}>Perde tempo analisando planilhas manualmente.</div>
        </div>
      </section>

      <section style={styles.dashboardSection}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.eyebrow}>A solução</div>
            <h2 style={styles.h2}>Um dashboard visual, direto e pronto para apresentar</h2>
          </div>
          <a href={whatsapp} target="_blank" style={styles.smallGoldButton}>Solicitar modelo</a>
        </div>
        <div style={styles.dashboardFrame}>
          <img src="/dashboard_agricola.png" alt="Dashboard BI Service Agrícola" style={styles.dashboardImg} />
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.cards3}>
          {benefits.map((b, i) => (
            <div key={i} style={styles.benefitCard}>
              <div style={styles.iconCircle}>{i + 1}</div>
              <h3 style={styles.h3}>{b.title}</h3>
              <p style={styles.cardText}>{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.sectionTitle}>Como funciona</div>
        <div style={styles.steps}>
          <div style={styles.step}><b>1</b><span>Cliente envia a planilha</span></div>
          <div style={styles.step}><b>2</b><span>O BI Service organiza os dados</span></div>
          <div style={styles.step}><b>3</b><span>O painel mostra tudo em gráficos</span></div>
        </div>
      </section>

      <section id="planos" style={styles.section}>
        <div style={styles.sectionTitle}>Planos de investimento</div>
        <div style={styles.planGrid}>
          {plans.map((plan) => (
            <div key={plan.name} style={plan.featured ? styles.planFeatured : styles.planCard}>
              {plan.featured && <div style={styles.tag}>Mais escolhido</div>}
              <h3 style={plan.featured ? styles.planTitleDark : styles.planTitle}>{plan.name}</h3>
              <div style={plan.featured ? styles.priceDark : styles.price}>{plan.price}</div>
              <ul style={plan.featured ? styles.listDark : styles.list}>
                {plan.items.map((item) => <li key={item}>✓ {item}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <div style={styles.setupBox}>Implantação inicial a partir de <b>R$ 500</b> — configuração, ajustes e primeira entrega.</div>
      </section>

      <section style={styles.finalCta}>
        <h2 style={styles.h2}>Dados que geram resultados</h2>
        <p style={styles.subtitle}>Leve gestão visual para sua lavoura e tome decisões com segurança.</p>
        <a href={whatsapp} target="_blank" style={styles.primaryButton}>Falar com a BI Service</a>
      </section>
    </main>
  );
}

const gold = "#D4AF37";
const gold2 = "#F2D16B";
const panel = "rgba(15, 23, 42, .78)";
const border = "rgba(212, 175, 55, .28)";

const styles = {
  page: { minHeight: "100vh", background: "#050711", color: "#fff", fontFamily: "Inter, Arial, sans-serif", overflowX: "hidden" },
  hero: { position: "relative", padding: "28px 42px 80px", background: "radial-gradient(circle at top left, #14213d 0, #050711 42%, #02030a 100%)" },
  glowOne: { position: "absolute", top: 80, right: -120, width: 360, height: 360, background: "rgba(212,175,55,.18)", borderRadius: "50%", filter: "blur(70px)" },
  glowTwo: { position: "absolute", bottom: -80, left: -140, width: 320, height: 320, background: "rgba(34,197,94,.12)", borderRadius: "50%", filter: "blur(80px)" },
  header: { position: "relative", zIndex: 2, maxWidth: 1180, margin: "0 auto 70px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  brandMini: { display: "flex", gap: 12, alignItems: "center", fontWeight: 800, letterSpacing: ".4px" },
  logoMini: { width: 46, height: 46, borderRadius: "50%", objectFit: "cover" },
  topButton: { color: "#111", background: gold, padding: "12px 18px", borderRadius: 999, textDecoration: "none", fontWeight: 800, boxShadow: "0 0 28px rgba(212,175,55,.25)" },
  heroGrid: { position: "relative", zIndex: 2, maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "1.15fr .85fr", gap: 42, alignItems: "center" },
  badge: { display: "inline-block", color: gold2, border: `1px solid ${border}`, background: "rgba(212,175,55,.08)", padding: "8px 14px", borderRadius: 999, fontWeight: 800, marginBottom: 18 },
  h1: { fontSize: "clamp(42px, 6vw, 76px)", lineHeight: .95, margin: "0 0 20px", letterSpacing: "-2px" },
  subtitle: { color: "#CBD5E1", fontSize: 18, lineHeight: 1.65, maxWidth: 680, margin: "0 0 26px" },
  ctaRow: { display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 30 },
  primaryButton: { display: "inline-block", background: `linear-gradient(135deg, ${gold2}, ${gold})`, color: "#090909", padding: "15px 24px", borderRadius: 14, textDecoration: "none", fontWeight: 900, boxShadow: "0 14px 40px rgba(212,175,55,.28)" },
  secondaryButton: { display: "inline-block", border: "1px solid rgba(255,255,255,.18)", color: "#fff", padding: "15px 24px", borderRadius: 14, textDecoration: "none", fontWeight: 800, background: "rgba(255,255,255,.04)" },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, maxWidth: 620 },
  logoCard: { background: "linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.02))", border: `1px solid ${border}`, borderRadius: 34, padding: 32, display: "flex", justifyContent: "center", boxShadow: "0 24px 80px rgba(0,0,0,.45)" },
  logoHero: { width: "100%", maxWidth: 420, borderRadius: "50%" },
  section: { maxWidth: 1180, margin: "0 auto", padding: "54px 42px" },
  sectionTitle: { fontSize: 34, fontWeight: 900, marginBottom: 24, color: "#fff" },
  problemGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 },
  problemCard: { background: panel, border: "1px solid rgba(255,255,255,.10)", borderRadius: 20, padding: 24, color: "#DDE6F5", fontSize: 17, lineHeight: 1.45 },
  dashboardSection: { maxWidth: 1180, margin: "0 auto", padding: "54px 42px" },
  sectionHeader: { display: "flex", justifyContent: "space-between", gap: 20, alignItems: "end", marginBottom: 24 },
  eyebrow: { color: gold2, fontWeight: 900, textTransform: "uppercase", letterSpacing: "1.4px", fontSize: 13 },
  h2: { fontSize: 36, lineHeight: 1.1, margin: "8px 0 0" },
  smallGoldButton: { background: gold, color: "#111", textDecoration: "none", padding: "12px 18px", borderRadius: 12, fontWeight: 900 },
  dashboardFrame: { border: `1px solid ${border}`, borderRadius: 24, padding: 10, background: "rgba(255,255,255,.04)", boxShadow: "0 30px 90px rgba(0,0,0,.55)" },
  dashboardImg: { width: "100%", display: "block", borderRadius: 18 },
  cards3: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 },
  benefitCard: { background: panel, border: `1px solid ${border}`, borderRadius: 22, padding: 26 },
  iconCircle: { width: 44, height: 44, borderRadius: "50%", background: gold, color: "#111", display: "grid", placeItems: "center", fontWeight: 900, marginBottom: 16 },
  h3: { color: gold2, fontSize: 22, margin: "0 0 10px" },
  cardText: { color: "#CBD5E1", lineHeight: 1.55, margin: 0 },
  steps: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 },
  step: { display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.10)", borderRadius: 18, padding: 22 },
  planGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 },
  planCard: { position: "relative", background: "rgba(15, 23, 42, .92)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 24, padding: 28, minHeight: 250 },
  planFeatured: { position: "relative", background: `linear-gradient(135deg, ${gold2}, ${gold})`, color: "#111", borderRadius: 24, padding: 28, minHeight: 250, transform: "scale(1.04)", boxShadow: "0 28px 70px rgba(212,175,55,.28)" },
  tag: { position: "absolute", top: -14, right: 22, background: "#111", color: gold2, padding: "8px 12px", borderRadius: 999, fontSize: 12, fontWeight: 900 },
  planTitle: { color: "#fff", fontSize: 24, margin: "0 0 8px" },
  planTitleDark: { color: "#111", fontSize: 24, margin: "0 0 8px" },
  price: { color: gold2, fontSize: 30, fontWeight: 900, marginBottom: 18 },
  priceDark: { color: "#111", fontSize: 30, fontWeight: 900, marginBottom: 18 },
  list: { listStyle: "none", padding: 0, margin: 0, color: "#DDE6F5", lineHeight: 2 },
  listDark: { listStyle: "none", padding: 0, margin: 0, color: "#111", lineHeight: 2, fontWeight: 700 },
  setupBox: { marginTop: 26, background: "rgba(212,175,55,.08)", border: `1px solid ${border}`, borderRadius: 18, padding: 20, color: "#F8FAFC", textAlign: "center" },
  finalCta: { textAlign: "center", maxWidth: 980, margin: "0 auto", padding: "70px 42px 90px" },
};
