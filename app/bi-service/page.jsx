export default function BiService() {
  const whatsapp =
    "https://wa.me/5517996040168?text=Ol%C3%A1,%20quero%20ver%20o%20BI%20Service%20Agr%C3%ADcola%20funcionando";

  return (
    <main className="bs-page">
      <style>{`
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { margin: 0; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes floatLogo {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-14px); }
        }

        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 28px rgba(212,175,55,.16); }
          50% { box-shadow: 0 0 60px rgba(212,175,55,.34); }
        }

        .bs-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at 18% 8%, rgba(212,175,55,.18), transparent 30%),
            radial-gradient(circle at 88% 10%, rgba(212,175,55,.12), transparent 34%),
            linear-gradient(180deg, #05070f 0%, #080b14 48%, #05070f 100%);
          color: #fff;
          font-family: Arial, Helvetica, sans-serif;
          overflow-x: hidden;
        }

        .bs-wrap {
          width: min(1180px, calc(100% - 40px));
          margin: 0 auto;
        }

        .bs-header {
          height: 86px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(212,175,55,.22);
          animation: fadeUp .7s ease both;
        }

        .bs-brand {
          display: flex;
          align-items: center;
          gap: 14px;
          font-weight: 900;
          letter-spacing: .4px;
        }

        .bs-brand img {
          width: 54px;
          height: 54px;
          object-fit: contain;
          border-radius: 50%;
          box-shadow: 0 0 28px rgba(212,175,55,.18);
        }

        .bs-whats,
        .bs-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          color: #080b14;
          background: linear-gradient(135deg, #ffe27a, #d4af37);
          border: 0;
          cursor: pointer;
          font-weight: 900;
          box-shadow: 0 18px 44px rgba(212,175,55,.25);
          transition: transform .18s ease, filter .18s ease;
        }

        .bs-whats {
          padding: 14px 24px;
          border-radius: 999px;
        }

        .bs-whats:hover,
        .bs-btn-primary:hover {
          transform: translateY(-2px) scale(1.02);
          filter: brightness(1.08);
        }

        .bs-hero {
          display: grid;
          grid-template-columns: 1.05fr .95fr;
          gap: 54px;
          align-items: center;
          padding: 70px 0 58px;
        }

        .bs-left { animation: fadeUp .8s ease .1s both; }
        .bs-right { animation: fadeUp .8s ease .25s both; }

        .bs-badge {
          display: inline-flex;
          border: 1px solid rgba(212,175,55,.55);
          color: #ffe27a;
          background: rgba(212,175,55,.08);
          padding: 10px 16px;
          border-radius: 999px;
          font-weight: 900;
          margin-bottom: 24px;
        }

        h1 {
          margin: 0;
          font-size: clamp(42px, 6vw, 78px);
          line-height: .94;
          letter-spacing: -3px;
          max-width: 700px;
        }

        .gold { color: #ffe27a; }

        .bs-hero p,
        .bs-lead {
          color: #d6d9e6;
          font-size: 20px;
          line-height: 1.65;
          max-width: 680px;
          margin: 26px 0 0;
        }

        .bs-actions {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          margin-top: 34px;
        }

        .bs-btn-primary,
        .bs-btn-secondary {
          min-height: 56px;
          padding: 0 26px;
          border-radius: 15px;
          font-weight: 900;
        }

        .bs-btn-secondary {
          display: inline-flex;
          text-decoration: none;
          align-items: center;
          justify-content: center;
          color: #fff;
          border: 1px solid rgba(255,255,255,.22);
          background: rgba(255,255,255,.04);
          transition: transform .18s ease, background .18s ease;
        }

        .bs-btn-secondary:hover {
          background: rgba(255,255,255,.08);
          transform: translateY(-2px);
        }

        .bs-mini {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
          margin-top: 34px;
          color: #fff;
          font-weight: 900;
        }

        .bs-mini span::before {
          content: "+";
          color: #ffe27a;
          margin-right: 6px;
        }

        .bs-logo-card {
          border: 1px solid rgba(212,175,55,.35);
          background: linear-gradient(145deg, rgba(255,255,255,.07), rgba(255,255,255,.02));
          border-radius: 34px;
          padding: 34px;
          box-shadow: 0 28px 80px rgba(0,0,0,.45);
          animation: glowPulse 4s ease-in-out infinite;
        }

        .bs-logo-card img {
          width: 100%;
          max-width: 430px;
          display: block;
          margin: 0 auto;
          border-radius: 32px;
          animation: floatLogo 4.5s ease-in-out infinite;
        }

        .bs-section {
          padding: 54px 0;
          animation: fadeUp .8s ease both;
        }

        .bs-section h2 {
          margin: 0 0 22px;
          font-size: clamp(30px, 4vw, 48px);
          letter-spacing: -1.4px;
        }

        .bs-problems,
        .bs-benefits,
        .bs-steps,
        .bs-plans {
          display: grid;
          gap: 18px;
        }

        .bs-problems,
        .bs-benefits,
        .bs-steps,
        .bs-plans {
          grid-template-columns: repeat(3, 1fr);
        }

        .bs-card {
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(15, 23, 42, .82);
          border-radius: 18px;
          padding: 22px;
          box-shadow: 0 20px 60px rgba(0,0,0,.24);
          transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease;
        }

        .bs-card:hover {
          transform: translateY(-5px);
          border-color: rgba(212,175,55,.55);
          box-shadow: 0 24px 70px rgba(212,175,55,.12);
        }

        .bs-problem {
          color: #d6d9e6;
          min-height: 98px;
        }

        .bs-kicker {
          color: #ffe27a;
          font-weight: 900;
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: 1.6px;
          margin-bottom: 10px;
        }

        .bs-demo {
          display: grid;
          grid-template-columns: .72fr 1.28fr;
          gap: 28px;
          align-items: center;
        }

        .bs-demo-box h3 {
          font-size: 30px;
          line-height: 1.15;
          margin: 0 0 18px;
        }

        .bs-demo-box p {
          color: #d6d9e6;
          line-height: 1.6;
          margin: 0 0 22px;
        }

        .bs-dashboard {
          border: 1px solid rgba(212,175,55,.42);
          border-radius: 22px;
          overflow: hidden;
          background: #0f172a;
          box-shadow: 0 28px 86px rgba(0,0,0,.58);
          position: relative;
        }

        .bs-dashboard:before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(120deg, rgba(255,255,255,.12), transparent 18%, transparent 70%, rgba(212,175,55,.12));
        }

        .bs-dashboard img {
          width: 100%;
          display: block;
        }

        .bs-number {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ffe27a, #d4af37);
          color: #05070f;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          margin-bottom: 16px;
        }

        .bs-benefit h3 {
          margin: 0 0 10px;
          color: #ffe27a;
        }

        .bs-benefit p {
          color: #d6d9e6;
          line-height: 1.55;
          margin: 0;
        }

        .bs-step {
          display: flex;
          gap: 12px;
          align-items: center;
          font-weight: 900;
        }

        .bs-step b {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(212,175,55,.16);
          color: #ffe27a;
        }

        .bs-plan h3 {
          margin: 0 0 10px;
          font-size: 22px;
        }

        .bs-price {
          color: #ffe27a;
          font-size: 32px;
          font-weight: 900;
          margin-bottom: 18px;
        }

        .bs-plan ul {
          list-style: none;
          padding: 0;
          margin: 0;
          color: #d6d9e6;
          line-height: 1.9;
        }

        .bs-plan li::before {
          content: "✓";
          color: #ffe27a;
          margin-right: 8px;
          font-weight: 900;
        }

        .bs-featured {
          background: linear-gradient(145deg, #ffe27a, #d4af37);
          color: #05070f;
          transform: translateY(-12px);
          border-color: #ffe27a;
          box-shadow: 0 28px 70px rgba(212,175,55,.28);
        }

        .bs-featured:hover { transform: translateY(-17px); }

        .bs-featured .bs-price,
        .bs-featured ul,
        .bs-featured li::before {
          color: #05070f;
        }

        .bs-tag {
          display: inline-flex;
          background: #05070f;
          color: #ffe27a;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 12px;
        }

        .bs-setup {
          margin-top: 20px;
          border: 1px solid rgba(212,175,55,.35);
          background: rgba(212,175,55,.06);
          border-radius: 16px;
          padding: 16px;
          text-align: center;
          color: #ffe27a;
          font-weight: 900;
        }

        .bs-final {
          text-align: center;
          padding: 62px 0 90px;
        }

        .bs-final h2 { margin: 0 0 14px; }
        .bs-final p { color: #d6d9e6; margin-bottom: 28px; }

        .bs-floating {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 50;
          text-decoration: none;
          color: white;
          background: #22c55e;
          padding: 14px 18px;
          border-radius: 999px;
          font-weight: 900;
          box-shadow: 0 18px 44px rgba(34,197,94,.35);
          transition: transform .18s ease;
        }

        .bs-floating:hover { transform: scale(1.08); }

        @media (max-width: 900px) {
          .bs-wrap { width: min(100% - 28px, 1180px); }
          .bs-header {
            height: auto;
            padding: 16px 0;
            gap: 14px;
          }
          .bs-brand span { font-size: 15px; }
          .bs-brand img { width: 46px; height: 46px; }
          .bs-whats { padding: 12px 14px; font-size: 13px; }
          .bs-hero {
            grid-template-columns: 1fr;
            padding: 38px 0 34px;
            gap: 30px;
          }
          h1 {
            font-size: 42px;
            letter-spacing: -1.7px;
          }
          .bs-hero p, .bs-lead { font-size: 17px; }
          .bs-actions { flex-direction: column; }
          .bs-btn-primary, .bs-btn-secondary { width: 100%; }
          .bs-mini { gap: 12px; font-size: 14px; }
          .bs-logo-card { padding: 18px; border-radius: 24px; }
          .bs-problems,
          .bs-benefits,
          .bs-steps,
          .bs-plans,
          .bs-demo {
            grid-template-columns: 1fr;
          }
          .bs-section { padding: 36px 0; }
          .bs-section h2 { font-size: 32px; }
          .bs-featured { transform: none; }
          .bs-featured:hover { transform: translateY(-5px); }
          .bs-floating {
            right: 14px;
            bottom: 14px;
            padding: 12px 14px;
            font-size: 14px;
          }
        }
      `}</style>

      <div className="bs-wrap">
        <header className="bs-header">
          <div className="bs-brand">
            <img src="/logo-bi-service.png" alt="BI Service" />
            <span>BI Service</span>
          </div>
          <a className="bs-whats" href={whatsapp} target="_blank">Falar no WhatsApp</a>
        </header>

        <section className="bs-hero">
          <div className="bs-left">
            <div className="bs-badge">BI Service Agrícola</div>
            <h1>Tenha controle total dos custos da sua <span className="gold">lavoura</span></h1>
            <p>
              Transformamos sua planilha em um painel profissional para acompanhar custos,
              produção, insumos, mão de obra e rentabilidade com clareza.
            </p>
            <div className="bs-actions">
              <a className="bs-btn-primary" href={whatsapp} target="_blank">Quero uma demonstração</a>
              <a className="bs-btn-secondary" href="#planos">Ver planos</a>
            </div>
            <div className="bs-mini">
              <span>clareza nos custos</span>
              <span>controle na produção</span>
              <span>decisão com dados</span>
            </div>
          </div>

          <div className="bs-right bs-logo-card">
            <img src="/logo-bi-service.png" alt="Logo BI Service" />
          </div>
        </section>

        <section className="bs-section">
          <h2>Você tem dados... mas precisa de visão</h2>
          <div className="bs-problems">
            <div className="bs-card bs-problem">Não sabe quanto custa produzir por pé ou por caixa.</div>
            <div className="bs-card bs-problem">Não enxerga quais produtos mais pesam no custo.</div>
            <div className="bs-card bs-problem">Perde tempo analisando planilhas manualmente.</div>
          </div>
        </section>

        <section className="bs-section bs-demo">
          <div className="bs-card bs-demo-box">
            <div className="bs-kicker">A solução</div>
            <h3>Um dashboard visual, direto e pronto para apresentar</h3>
            <p>
              O produtor continua usando a planilha. O BI Service organiza os dados e
              transforma tudo em gráficos, filtros e indicadores de gestão.
            </p>
            <a className="bs-btn-primary" href={whatsapp} target="_blank">Solicitar modelo</a>
          </div>

          <div className="bs-dashboard">
            <img src="/dashboard-agricola.png" alt="Dashboard Agrícola BI Service" />
          </div>
        </section>

        <section className="bs-section">
          <div className="bs-benefits">
            <div className="bs-card bs-benefit">
              <div className="bs-number">1</div>
              <h3>Custo por caixa</h3>
              <p>Veja rapidamente quanto custa produzir cada caixa.</p>
            </div>
            <div className="bs-card bs-benefit">
              <div className="bs-number">2</div>
              <h3>Controle total</h3>
              <p>Insumos, mão de obra, produção e plantio em um só painel.</p>
            </div>
            <div className="bs-card bs-benefit">
              <div className="bs-number">3</div>
              <h3>Decisão rápida</h3>
              <p>Identifique desperdícios e pontos de atenção em segundos.</p>
            </div>
          </div>
        </section>

        <section className="bs-section">
          <h2>Como funciona</h2>
          <div className="bs-steps">
            <div className="bs-card bs-step"><b>1</b> Cliente envia a planilha</div>
            <div className="bs-card bs-step"><b>2</b> O BI Service organiza os dados</div>
            <div className="bs-card bs-step"><b>3</b> O painel mostra tudo em gráficos</div>
          </div>
        </section>

        <section className="bs-section" id="planos">
          <h2>Planos de investimento</h2>
          <div className="bs-plans">
            <div className="bs-card bs-plan">
              <h3>Básico</h3>
              <div className="bs-price">R$ 147/mês</div>
              <ul>
                <li>Dashboard padrão</li>
                <li>Upload manual</li>
                <li>Indicadores principais</li>
              </ul>
            </div>

            <div className="bs-card bs-plan bs-featured">
              <div className="bs-tag">Mais escolhido</div>
              <h3>Profissional</h3>
              <div className="bs-price">R$ 347/mês</div>
              <ul>
                <li>Dashboard completo</li>
                <li>Suporte WhatsApp</li>
                <li>Ajuste da planilha</li>
                <li>Atualização mensal</li>
              </ul>
            </div>

            <div className="bs-card bs-plan">
              <h3>Premium</h3>
              <div className="bs-price">R$ 697/mês</div>
              <ul>
                <li>Personalização</li>
                <li>Relatório PDF</li>
                <li>Comparativo de safra</li>
                <li>Modo TV</li>
              </ul>
            </div>
          </div>
          <div className="bs-setup">Implantação inicial a partir de R$ 500 — configuração, ajustes e primeira entrega.</div>
        </section>

        <section className="bs-final">
          <h2>Pare de adivinhar. Comece a controlar.</h2>
          <p>Leve gestão visual para sua lavoura e tome decisões com segurança.</p>
          <a className="bs-btn-primary" href={whatsapp} target="_blank">Falar com a BI Service</a>
        </section>
      </div>

      <a className="bs-floating" href={whatsapp} target="_blank">WhatsApp</a>
    </main>
  );
}
