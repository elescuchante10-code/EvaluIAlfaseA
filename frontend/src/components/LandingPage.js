import React, { useMemo, useState, useCallback, useEffect } from 'react';
import './LandingPage.css';

const WHATSAPP_URL = 'https://wa.me/573108688648';

/** CRA `homepage` / despliegue en subruta: mismos archivos que en `public/`. */
function publicAsset(path) {
  const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * Hero video (público /assets/…):
 * - evaluai-dashboard-demo.mp4 (recomendado: Safari y muchos móviles no reproducen WebM)
 * - evaluai-dashboard-demo.webm
 * - evaluai-dashboard-demo-poster.jpg y .vtt opcionales
 */
const DEMO_MP4 = publicAsset('/assets/evaluai-dashboard-demo.mp4');
const DEMO_WEBM = publicAsset('/assets/evaluai-dashboard-demo.webm');
const DEMO_POSTER = publicAsset('/assets/evaluai-dashboard-demo-poster.jpg');
const DEMO_VTT = publicAsset('/assets/evaluai-dashboard-demo.vtt');

async function probeAsset(url) {
  try {
    const head = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (head.ok) return true;
    // Varios servidores / proxies responden 404 o 501 a HEAD aunque GET funcione.
    if (head.status === 405 || head.status === 404 || head.status === 501) {
      const r = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, cache: 'no-store' });
      return r.ok || r.status === 206;
    }
    return false;
  } catch {
    return false;
  }
}

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

function HeroDemo() {
  const [mode, setMode] = useState('checking'); // checking | video | fallback
  const [fallbackKind, setFallbackKind] = useState('missing'); // missing | decode
  const [hasMp4, setHasMp4] = useState(false);
  const [hasWebm, setHasWebm] = useState(false);
  const [hasPoster, setHasPoster] = useState(false);
  const [hasVtt, setHasVtt] = useState(false);

  const onVideoError = useCallback(() => {
    setFallbackKind('decode');
    setMode('fallback');
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [mp4, webm] = await Promise.all([probeAsset(DEMO_MP4), probeAsset(DEMO_WEBM)]);
      if (cancel) return;
      if (mp4 || webm) {
        const [poster, vtt] = await Promise.all([probeAsset(DEMO_POSTER), probeAsset(DEMO_VTT)]);
        if (cancel) return;
        setHasMp4(mp4);
        setHasWebm(webm);
        setHasPoster(poster);
        setHasVtt(vtt);
        setMode('video');
      } else {
        setFallbackKind('missing');
        setMode('fallback');
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <div className="lp-heroShot lp-heroDemo">
      <div className="lp-heroShot__radial" aria-hidden="true" />
      <div className="lp-heroShot__frame">
        <div className="lp-heroShot__shine" aria-hidden="true" />
        {mode === 'checking' ? <div className="lp-demoSkeleton" aria-hidden="true" /> : null}
        {mode === 'video' ? (
          <div className="lp-heroVideoWrap">
            <video
              className="lp-heroVideo"
              poster={hasPoster ? DEMO_POSTER : undefined}
              controls
              playsInline
              preload="metadata"
              muted
              aria-label="Recorrido del dashboard de EvaluAI"
              onError={onVideoError}
            >
              {hasMp4 ? <source src={DEMO_MP4} type="video/mp4" /> : null}
              {hasWebm ? <source src={DEMO_WEBM} type="video/webm" /> : null}
              {hasVtt ? (
                <track kind="captions" src={DEMO_VTT} srcLang="es" label="Español" default />
              ) : null}
              <p className="lp-videoFallback">Tu navegador no soporta video HTML5.</p>
            </video>
          </div>
        ) : null}
        {mode === 'fallback' ? (
          <div className="lp-demoEmpty" role="status">
            <p className="lp-demoEmpty__text">
              {fallbackKind === 'decode'
                ? 'No se pudo reproducir este vídeo en este navegador. Prueba con Chrome o Firefox.'
                : 'No hay vídeo de demostración disponible.'}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

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
          <nav className="lp-bar__nav" aria-label="Secciones">
            <NavAnchor href="#pasos">Flujo</NavAnchor>
            <NavAnchor href="#features">Capacidades</NavAnchor>
            <NavAnchor href="#workspace">Workspace</NavAnchor>
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
        {/* —— Hero (patrón visual tipo Astra: grid + glow + marco app) —— */}
        <section className="lp-hero" aria-labelledby="hero-title">
          <div className="lp-wrap">
            <div className="lp-hero__intro">
              <Badge>Evaluación IB con rúbrica y documentos reales</Badge>
              <h1 id="hero-title" className={`lp-title${runHeroTextReveal ? ' lp-textReveal' : ''}`}>
                Deja de perder tus noches corrigiendo. Evalúa con la precisión de un experto en segundos.
              </h1>
              <p className={`lp-lead${runHeroTextReveal ? ' lp-textReveal' : ''}`}>
                EvaluAI elimina la fricción entre tu rúbrica y el feedback. Organiza tu material, evalúa documentos en
                cualquier formato y potencia tu criterio con IA que realmente entiende tus necesidades. Menos clics, más
                feedback de calidad sin fricción.
              </p>
              <div className="lp-hero__actions">
                <a className="lp-btn lp-btn--primary" href="#pricing" aria-label="Ir a planes y créditos">
                  {subscribeLabel}
                </a>
              </div>
              {notice ? (
                <div className="lp-alert" role="status" aria-live="polite">
                  <strong className="lp-alert__t">{notice.title}</strong>
                  <div className="lp-alert__b">{notice.body}</div>
                </div>
              ) : null}
            </div>
            <HeroDemo />
          </div>
        </section>

        {/* Social proof ligero (sin marcas inventadas) */}
        <section className="lp-band" aria-label="Enfoque del producto">
          <div className="lp-wrap lp-band__inner lp-reveal" data-reveal>
            <span className="lp-chip">Enfoque IB</span>
            <span className="lp-chip">Rúbricas personalizadas</span>
            <span className="lp-chip">Feedback anclado</span>
            <span className="lp-chip">Lotes hasta 10</span>
            <span className="lp-chip">Pago con Wompi</span>
          </div>
        </section>

        <section className="lp-section" id="pasos">
          <div className="lp-wrap">
            <SectionHeader
              kicker="Flujo en Evaluar"
              title="Cómo funciona"
              subtitle="Tres pasos guiados en la UI: rúbrica activa → documento → evaluación y corrección."
            />
            <ol className="lp-steps">
              <li className="lp-reveal" data-reveal>
                <span className="lp-steps__n">1</span>
                <div>
                  <h3 className="lp-h3">Rúbrica activa</h3>
                  <p className="lp-prose">
                    Crea o ajusta tu rúbrica en el editor y déjala activa para que el flujo siga tu criterio, no una
                    plantilla genérica.
                  </p>
                </div>
              </li>
              <li className="lp-reveal" data-reveal>
                <span className="lp-steps__n">2</span>
                <div>
                  <h3 className="lp-h3">Documento</h3>
                  <p className="lp-prose">
                    Sube el documento del estudiante (Word, PDF o texto) y ábrelo en el evaluador para revisar con
                    contexto.
                  </p>
                </div>
              </li>
              <li className="lp-reveal" data-reveal>
                <span className="lp-steps__n">3</span>
                <div>
                  <h3 className="lp-h3">Evaluación y cierre</h3>
                  <p className="lp-prose">
                    Apóyate en la IA para acelerar criterios y feedback. Ajusta con selección de texto, notas y resumen.
                    Exporta o entrega cuando tu flujo lo requiera.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section className="lp-section lp-section--alt" id="features">
          <div className="lp-wrap">
            <SectionHeader
              kicker="Capacidades"
              title="Lo esencial del producto"
              subtitle="Superficies y rutas que verás en la app hoy; sin prometer módulos que no existan en la UI."
            />
            <div className="lp-grid3">
              <FeatureItem title="Documentos reales">
                Sube Word, PDF o texto y trabaja con el documento en el evaluador sin copiar y pegar.
              </FeatureItem>
              <FeatureItem title="Evaluación asistida">
                La IA acompaña tu criterio y tu rúbrica activa; tú mantienes control total en el editor.
              </FeatureItem>
              <FeatureItem title="Chat contextual">
                Un copiloto dentro del documento para aclarar criterios y redactar feedback sin salir del flujo.
              </FeatureItem>
              <FeatureItem title="Asistente IA">
                Un espacio aparte para planeación IB y consultas amplias, sin mezclarlo con la corrección.
              </FeatureItem>
              <FeatureItem title="Lotes">
                Procesamiento por lotes (hasta 10 documentos) cuando trabajas varios entregables similares.
              </FeatureItem>
              <FeatureItem title="Facturación">
                Suscripción o recargas por créditos; el pago se realiza por Wompi cuando estás autenticado.
              </FeatureItem>
            </div>
          </div>
        </section>

        <section className="lp-section" id="workspace">
          <div className="lp-wrap">
            <SectionHeader
              kicker="Navegación"
              title="Workspace: tres entradas"
              subtitle="Un mismo shell: Mi Espacio IB, Evaluar, Asistente IA y Configuración."
            />
            <div className="lp-scroll">
              <table className="lp-table">
                <caption className="lp-sr">
                  Comparación Mi Espacio IB, Evaluar y Asistente IA
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Sección</th>
                    <th scope="col">Rol</th>
                    <th scope="col">En la UI</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Mi Espacio IB</th>
                    <td>Material y archivos de referencia.</td>
                    <td>Organiza tu material sin forzar el flujo de evaluación.</td>
                  </tr>
                  <tr>
                    <th scope="row">Evaluar</th>
                    <td>Centro de trabajo de corrección.</td>
                    <td>
                      Flujo rúbrica → documento → evaluador, BatchProcessor, Chat principal, ChatBubble, panel de
                      resumen.
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Asistente IA</th>
                    <td>Consultas y planeación.</td>
                    <td>Chat amplio; el ChatBubble del evaluador no se muestra aquí.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="lp-section lp-section--alt" id="pricing">
          <div className="lp-wrap">
            <SectionHeader
              kicker="Precios"
              title="Planes y créditos"
              subtitle="Planes mensuales y recargas. Para pagar necesitas sesión iniciada."
            />
            <div className="lp-prices">
              <article className="lp-card lp-reveal" data-reveal>
                <h3 className="lp-card__h">Plan Estándar (Profe Pionero) 🚀</h3>
                <p className="lp-card__price">$40.000 COP / mes</p>
                <ul className="lp-list">
                  <li><strong>Créditos incluidos:</strong> 500 Créditos IA</li>
                  <li>
                    <strong>¿Para qué te alcanza?</strong> Área Humanidades: hasta 100 exámenes de texto (PDF/Word). Área
                    Ciencias/Matemáticas: hasta 50 exámenes con gráficas, fórmulas o a mano (o una combinación).
                  </li>
                  <li><strong>Incluye:</strong> chat interactivo con los documentos y rúbricas personalizadas</li>
                </ul>
                <PrimaryButton
                  onClick={onSubscribe}
                  disabled={subscribeState?.status === 'loading'}
                  ariaLabel="Planes y créditos (checkout)"
                >
                  {subscribeState?.status === 'loading' ? 'Generando…' : subscribeLabel}
                </PrimaryButton>
                <p className="lp-micro">
                  {isAuthenticated ? 'Listo para continuar al checkout.' : 'Requiere login o registro.'}
                </p>
              </article>
              <article className="lp-card lp-card--accent lp-reveal" data-reveal>
                <h3 className="lp-card__h">Plan Institucional (Colegios - Hasta 30 Profesores) 🏫</h3>
                <p className="lp-card__price">$2.000.000 COP / mes (aprox)</p>
                <ul className="lp-list">
                  <li><strong>Créditos incluidos:</strong> Bolsa compartida de 20.000 Créditos IA</li>
                  <li>
                    <strong>¿Para qué le alcanza al colegio?</strong> Humanidades (15 profes): ~1.500 exámenes de texto/mes.
                    Ciencias/Matemáticas (15 profes): ~1.200 exámenes a mano con fórmulas/gráficas.
                  </li>
                </ul>
              </article>
              <article className="lp-card lp-reveal" data-reveal>
                <h3 className="lp-card__h">Pago por Uso (Pay-As-You-Go) 🔋</h3>
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
                  ariaLabel="Recargar créditos"
                >
                  {subscribeState?.status === 'loading' ? 'Generando…' : subscribeLabel}
                </PrimaryButton>
              </article>
            </div>
          </div>
        </section>

        <section className="lp-section" id="faq">
          <div className="lp-wrap lp-wrap--narrow">
            <SectionHeader kicker="Ayuda" title="Preguntas frecuentes" subtitle="Respuestas breves y alineadas al producto actual." />
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
          <div className="lp-foot__links">
            <TextLink onClick={onGoLogin}>Entrar</TextLink>
            <TextLink onClick={onGoRegister}>Registro</TextLink>
            <a className="lp-textlink" href="#pricing">
              Precios
            </a>
            <a className="lp-textlink" href="#faq">
              FAQ
            </a>
          </div>
        </div>
      </footer>

      <a
        className="lp-whatsappFab"
        href={WHATSAPP_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="Abrir WhatsApp"
      >
        WhatsApp
      </a>
    </div>
  );
}
