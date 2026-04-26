import React, { useMemo, useState, useCallback, useEffect } from 'react';
import './LandingPage.css';

const WHATSAPP_URL = 'https://wa.me/573108688648';

// Nota: la landing actual no muestra captura del dashboard ni vídeo (se removió el hero-shot).

// (helpers de probeAsset removidos junto con el bloque de vídeo/captura)

function setupReveals() {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const nodes = Array.from(document.querySelectorAll('[data-reveal]'));
  if (nodes.length === 0) return () => {};

  if (prefersReducedMotion) {
    nodes.forEach((el) => el.classList.add('is-visible'));
    return () => {};
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      }
    },
    { root: null, threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
  );

  nodes.forEach((el) => io.observe(el));
  return () => io.disconnect();
}

function Badge({ children }) {
  return <span className="lp-pill lp-pill--muted">{children}</span>;
}

function PrimaryButton({ children, onClick, disabled, ariaLabel }) {
  return (
    <button
      type="button"
      className="lp-btn lp-btn--primary"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

function TextLink({ children, onClick, href }) {
  if (href) {
    return (
      <a className="lp-textlink" href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return (
    <button type="button" className="lp-textlink lp-textlink--btn" onClick={onClick}>
      {children}
    </button>
  );
}

function NavAnchor({ href, children }) {
  return (
    <a className="lp-navlink" href={href}>
      {children}
    </a>
  );
}

function FeatureItem({ title, children }) {
  return (
    <div className="lp-feat lp-reveal" data-reveal>
      <h3 className="lp-feat__title">{title}</h3>
      <p className="lp-feat__body">{children}</p>
    </div>
  );
}

function MiniFAQ({ items }) {
  return (
    <div className="lp-faq">
      {items.map((item) => (
        <details key={item.q} className="lp-faq__item lp-reveal" data-reveal>
          <summary className="lp-faq__q">{item.q}</summary>
          <div className="lp-faq__a">{item.a}</div>
        </details>
      ))}
    </div>
  );
}

// Nota: se removió la captura/hero-shot para evitar un bloque difuso y redundante en la landing.

function SectionHeader({ kicker, title, subtitle }) {
  return (
    <header className="lp-secHead lp-reveal" data-reveal>
      {kicker ? <p className="lp-secHead__k">{kicker}</p> : null}
      <h2 className="lp-secHead__t">{title}</h2>
      {subtitle ? <p className="lp-secHead__s">{subtitle}</p> : null}
    </header>
  );
}

export default function LandingPage({
  onGoLogin,
  onGoRegister,
  onSubscribe,
  subscribeState,
  isAuthenticated,
  notice,
}) {
  useEffect(() => setupReveals(), []);

  const [isAuthTransitioning, setIsAuthTransitioning] = useState(false);
  const [runHeroTextReveal, setRunHeroTextReveal] = useState(false);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const runAuthTransition = useCallback(
    (next) => {
      if (prefersReducedMotion) {
        next();
        return;
      }
      setIsAuthTransitioning(true);
      window.setTimeout(() => {
        next();
      }, 320);
      window.setTimeout(() => {
        setIsAuthTransitioning(false);
      }, 700);
    },
    [prefersReducedMotion]
  );

  useEffect(() => {
    if (prefersReducedMotion) return;
    const t = window.setTimeout(() => setRunHeroTextReveal(true), 60);
    return () => window.clearTimeout(t);
  }, [prefersReducedMotion]);

  const faq = useMemo(
    () => [
      {
        q: '¿Qué archivos puedo subir?',
        a: (
          <p className="lp-prose">
            Puedes subir documentos reales en formatos comunes (Word, PDF y texto). En PDFs escaneados o fotografías, el
            resultado depende de la legibilidad del archivo.
          </p>
        ),
      },
      {
        q: '¿La IA decide la nota final?',
        a: (
          <p className="lp-prose">
            No. La IA te ayuda a revisar y redactar feedback, pero tú decides la evaluación final en el editor: puedes
            seleccionar fragmentos, añadir notas y validar el resumen antes de entregar.
          </p>
        ),
      },
      {
        q: '¿Mi Espacio IB y Evaluar son lo mismo?',
        a: (
          <p className="lp-prose">
            No. Mi Espacio IB organiza material y subidas sin imponerte el flujo de evaluación. Evaluar concentra
            rúbrica, documento, evaluador, lotes y chats del flujo.
          </p>
        ),
      },
      {
        q: '¿Cómo pago o compro créditos?',
        a: (
          <p className="lp-prose">
            El pago se realiza por Wompi cuando ya tienes sesión iniciada. Si aún no has entrado, primero inicia sesión
            o crea tu cuenta y luego continúa con planes y créditos.
          </p>
        ),
      },
      {
        q: '¿Puedo evaluar varios archivos?',
        a: (
          <p className="lp-prose">
            Sí: en Evaluar hay procesamiento por lotes (hasta 10 documentos) además del flujo uno a uno.
          </p>
        ),
      },
      {
        q: '¿Se puede usar en colegios?',
        a: (
          <p className="lp-prose">
            Sí. Hay una modalidad institucional para equipos de profesores, con bolsa de créditos compartida y
            acompañamiento de implementación.
          </p>
        ),
      },
      {
        q: '¿Privacidad y datos sensibles?',
        a: (
          <p className="lp-prose">
            Evita datos personales innecesarios. Esta página no ofrece certificaciones legales: acuerdos institucionales
            se coordinan por el canal de contacto.
          </p>
        ),
      },
      {
        q: '¿Cómo funciona el sistema de créditos para evaluar exámenes?',
        a: (
          <p className="lp-prose">
            En términos generales: 5 créditos para calificar un documento completo de texto digital (Word/PDF), 10
            créditos para exámenes a mano o con imágenes/gráficas/fórmulas, y 1–2 créditos para evaluar un fragmento
            corto seleccionado o hacer preguntas al chat asistente.
          </p>
        ),
      },
      {
        q: '¿Hay informes o analítica avanzada?',
        a: (
          <p className="lp-prose">
            El foco actual es evaluación, material IB y facturación por créditos. Informes ampliados, si aplican, se
            definen aparte con el equipo.
          </p>
        ),
      },
    ],
    []
  );

  const subscribeLabel =
    subscribeState?.status === 'loading' ? 'Generando enlace…' : 'Planes y créditos';

  return (
    <div className="lp">
      <div className="lp-bg" aria-hidden="true" />
      <div className="lp-mesh" aria-hidden="true" />
      {isAuthTransitioning ? <div className="lp-authOverlay" aria-hidden="true" /> : null}

      <a href="#main" className="lp-skip">
        Ir al contenido
      </a>

      <header className="lp-top">
        <div className="lp-bar">
          <div className="lp-brand" aria-label="EvaluAI inicio">
            <span className="lp-brand__mark" aria-hidden="true">
              E
            </span>
            <span className="lp-brand__name">EvaluAI</span>
          </div>
          <nav className="lp-bar__nav" aria-label="Secciones de la página">
            <NavAnchor href="#pasos">Cómo funciona</NavAnchor>
            <NavAnchor href="#features">Funciones</NavAnchor>
            <NavAnchor href="#pricing">Precios</NavAnchor>
            <NavAnchor href="#faq">FAQ</NavAnchor>
          </nav>
          <div className="lp-bar__cta">
            <button
              type="button"
              className="lp-textlink lp-textlink--btn"
              onClick={() => runAuthTransition(onGoLogin)}
              disabled={isAuthTransitioning}
              aria-busy={isAuthTransitioning ? 'true' : 'false'}
            >
              Entrar
            </button>
            <button
              type="button"
              className="lp-btn lp-btn--sm lp-btn--primary"
              onClick={() => runAuthTransition(onGoRegister)}
              disabled={isAuthTransitioning}
              aria-busy={isAuthTransitioning ? 'true' : 'false'}
            >
              Crear cuenta
            </button>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="lp-hero" aria-labelledby="hero-title">
          <div className="lp-wrap">
            <div className="lp-hero__intro">
              <Badge>Evaluación IB con rúbrica y documentos reales</Badge>
              <h1 id="hero-title" className={`lp-title${runHeroTextReveal ? ' lp-textReveal' : ''}`}>
                Evaluaciones IB más claras, más rápidas y con tu criterio al centro
              </h1>
              <p className={`lp-lead${runHeroTextReveal ? ' lp-textReveal' : ''}`}>
                EvaluAI conecta tu rúbrica con el documento del estudiante: organizas material IB, evalúas en Word o
                PDF, apoyas el feedback con IA y cierras con un resumen que puedes revisar y ajustar antes de entregar.
              </p>
              {notice ? (
                <div className="lp-alert" role="status" aria-live="polite">
                  <strong className="lp-alert__t">{notice.title}</strong>
                  <div className="lp-alert__b">{notice.body}</div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="lp-band" aria-label="Enfoque del producto">
          <div className="lp-wrap lp-band__inner lp-reveal" data-reveal>
            <span className="lp-chip">Enfoque IB</span>
            <span className="lp-chip">Rúbricas personalizadas</span>
            <span className="lp-chip">Feedback anclado al texto</span>
            <span className="lp-chip">Lotes hasta 10</span>
            <span className="lp-chip">Pago con Wompi</span>
          </div>
        </section>

        <section className="lp-section lp-section--alt" id="pasos">
          <div className="lp-wrap">
            <SectionHeader
              kicker="Flujo en Evaluar"
              title="Cómo funciona"
              subtitle="Tres pasos guiados en la interfaz: rúbrica activa, documento del estudiante y evaluación con cierre."
            />
            <ol className="lp-steps">
              <li className="lp-reveal" data-reveal>
                <span className="lp-steps__n" aria-hidden="true">
                  1
                </span>
                <div>
                  <h3 className="lp-h3">Rúbrica activa</h3>
                  <p className="lp-prose">
                    Crea o ajusta tu rúbrica en el editor y déjala activa para que el flujo siga tu criterio, no una
                    plantilla genérica.
                  </p>
                </div>
              </li>
              <li className="lp-reveal" data-reveal>
                <span className="lp-steps__n" aria-hidden="true">
                  2
                </span>
                <div>
                  <h3 className="lp-h3">Documento</h3>
                  <p className="lp-prose">
                    Sube el documento del estudiante (Word, PDF o texto) y ábrelo en el evaluador para revisar con
                    contexto completo.
                  </p>
                </div>
              </li>
              <li className="lp-reveal" data-reveal>
                <span className="lp-steps__n" aria-hidden="true">
                  3
                </span>
                <div>
                  <h3 className="lp-h3">Evaluación y cierre</h3>
                  <p className="lp-prose">
                    Apóyate en la IA para acelerar criterios y feedback. Ajusta con selección de texto, notas y resumen.
                    Exporta o entrega cuando tu proceso lo requiera.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section className="lp-section" id="features">
          <div className="lp-wrap">
            <SectionHeader
              kicker="Funciones"
              title="Lo esencial que verás en la app"
              subtitle="Superficies y rutas reales de hoy: sin prometer módulos que aún no existan en la interfaz."
            />
            <div className="lp-grid3">
              <FeatureItem title="Documentos reales">
                Sube Word, PDF o texto y trabaja con el documento en el evaluador sin copiar y pegar entre ventanas.
              </FeatureItem>
              <FeatureItem title="Evaluación asistida">
                La IA acompaña tu criterio y tu rúbrica activa; tú mantienes el control en el editor y en el resumen.
              </FeatureItem>
              <FeatureItem title="Chat contextual">
                Un copiloto dentro del documento para aclarar criterios y redactar feedback sin salir del flujo.
              </FeatureItem>
              <FeatureItem title="Asistente IA">
                Un espacio aparte para planeación IB y consultas amplias, separado del chat del evaluador.
              </FeatureItem>
              <FeatureItem title="Lotes">
                Procesamiento por lotes (hasta 10 documentos) cuando trabajas varios entregables parecidos.
              </FeatureItem>
              <FeatureItem title="Facturación">
                Suscripción o recargas por créditos; el pago se realiza por Wompi cuando estás autenticado.
              </FeatureItem>
            </div>
          </div>
        </section>

        <section className="lp-section" id="pricing">
          <div className="lp-wrap">
            <SectionHeader
              kicker="Precios"
              title="Planes y créditos"
              subtitle="Planes mensuales y recargas. Para pagar necesitas haber iniciado sesión."
            />
            <div className="lp-prices">
              <article className="lp-card lp-reveal" data-reveal aria-labelledby="plan-estandar">
                <h3 id="plan-estandar" className="lp-card__h">
                  Plan Estándar (Profe Pionero) 🚀
                </h3>
                <p className="lp-card__price">$40.000 COP / mes</p>
                <ul className="lp-list">
                  <li>
                    <strong>Créditos incluidos:</strong> 500 créditos IA
                  </li>
                  <li>
                    <strong>¿Para qué te alcanza?</strong> Área Humanidades: hasta 100 exámenes de texto (PDF/Word). Área
                    Ciencias/Matemáticas: hasta 50 exámenes con gráficas, fórmulas o a mano (o una combinación).
                  </li>
                  <li>
                    <strong>Incluye:</strong> chat interactivo con los documentos y rúbricas personalizadas
                  </li>
                </ul>
                <PrimaryButton
                  onClick={onSubscribe}
                  disabled={subscribeState?.status === 'loading'}
                  ariaLabel="Abrir planes y créditos (checkout)"
                >
                  {subscribeState?.status === 'loading' ? 'Generando…' : subscribeLabel}
                </PrimaryButton>
                <p className="lp-micro">
                  {isAuthenticated ? 'Listo para continuar al checkout.' : 'Requiere iniciar sesión o registrarse.'}
                </p>
              </article>
              <article className="lp-card lp-card--accent lp-reveal" data-reveal aria-labelledby="plan-institucional">
                <h3 id="plan-institucional" className="lp-card__h">
                  Plan Institucional (Colegios — hasta 30 profesores) 🏫
                </h3>
                <p className="lp-card__price">$2.000.000 COP / mes (aprox.)</p>
                <ul className="lp-list">
                  <li>
                    <strong>Créditos incluidos:</strong> bolsa compartida de 20.000 créditos IA
                  </li>
                  <li>
                    <strong>¿Para qué le alcanza al colegio?</strong> Humanidades (15 profes): ~1.500 exámenes de texto al
                    mes. Ciencias/Matemáticas (15 profes): ~1.200 exámenes a mano con fórmulas o gráficas.
                  </li>
                </ul>
                <p className="lp-micro">Contacto comercial vía WhatsApp para ajustar cupos y facturación.</p>
              </article>
              <article className="lp-card lp-reveal" data-reveal aria-labelledby="plan-payg">
                <h3 id="plan-payg" className="lp-card__h">
                  Pago por uso (pay-as-you-go) 🔋
                </h3>
                <p className="lp-card__price">Recargas desde $20.000 COP</p>
                <ul className="lp-list">
                  <li>Sin mensualidad. Recargas desde $20.000 COP</li>
                  <li>$20.000 = 200 créditos</li>
                  <li>$50.000 = 500 créditos</li>
                  <li>Los créditos no vencen</li>
                </ul>
                <PrimaryButton
                  onClick={onSubscribe}
                  disabled={subscribeState?.status === 'loading'}
                  ariaLabel="Recargar créditos (checkout)"
                >
                  {subscribeState?.status === 'loading' ? 'Generando…' : subscribeLabel}
                </PrimaryButton>
              </article>
            </div>
          </div>
        </section>

        <section className="lp-section lp-section--alt" id="faq">
          <div className="lp-wrap lp-wrap--narrow">
            <SectionHeader
              kicker="Ayuda"
              title="Preguntas frecuentes"
              subtitle="Respuestas breves y alineadas al producto actual."
            />
            <MiniFAQ items={faq} />
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot__grid">
          <div>
            <div className="lp-foot__brand">EvaluAI</div>
            <p className="lp-foot__meta">
              Diseñado por{' '}
              <a
                className="lp-textlink"
                href="https://elescuchante10-code.github.io/SOLUCIONES-DE-IA/"
                target="_blank"
                rel="noreferrer"
              >
                SOLUCIONES DE IA
              </a>
              · © {new Date().getFullYear()}
            </p>
          </div>
          <nav className="lp-foot__links" aria-label="Enlaces pie de página">
            <TextLink onClick={onGoLogin}>Entrar</TextLink>
            <TextLink onClick={onGoRegister}>Registro</TextLink>
            <a className="lp-textlink" href="#pricing">
              Precios
            </a>
            <a className="lp-textlink" href="#faq">
              FAQ
            </a>
          </nav>
        </div>
      </footer>

      <a
        className="lp-whatsappFab"
        href={WHATSAPP_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="Contactar por WhatsApp (se abre en una pestaña nueva)"
      >
        WhatsApp
      </a>
    </div>
  );
}
