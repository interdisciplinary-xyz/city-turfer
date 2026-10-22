import './branding.css';

import {
  ACCENT,
  contrastRatio,
  cssVariables,
  DARK,
  FONT_SIZE,
  LIGHT,
  MIN_CONTRAST,
  NAME,
  ON_ACCENT,
  ON_TIER,
  ON_TYPE_COLOR,
  PRIVACY_LINE,
  PROMO,
  RADIUS,
  SITE_SCHEME,
  SPACE,
  TAGLINES,
  TIER_COLOR,
  TIER_LABEL,
  TIER_ORDER,
  TYPE_COLOR,
} from '@cityturfer/brand';
import mark from '@cityturfer/brand/svg/mark.svg';
import markForeground from '@cityturfer/brand/svg/mark-foreground.svg';
import markMonochrome from '@cityturfer/brand/svg/mark-monochrome.svg';
import wordmark from '@cityturfer/brand/svg/wordmark.svg';
import wordmarkLight from '@cityturfer/brand/svg/wordmark-light.svg';
import Image, { type StaticImageData } from 'next/image';
import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import type { CSSProperties, ReactNode } from 'react';

import { AppHeader } from '../[locale]/app-header';
import { displayFont, numericFont } from '../fonts';
import { WAITLIST } from '../waitlist-config';
import { BrandNav } from './brand-nav';
import {
  ACTIVITY_LABEL,
  ALTERNATIVES_CHECK,
  ANDROID_CHECK,
  ASSETS,
  AUDIENCES,
  BRAND_LOCKUP_SELECTOR,
  BRANDING_DESCRIPTION,
  BRANDING_LOCALE,
  BRANDING_TITLE,
  CONTRAST_FIXES,
  CONTRAST_FIXES_NOTE,
  DECISION_DOC_URL,
  type FactCheck,
  FONTS,
  ICP_CONTEXT,
  ICP_DOC_URL,
  ICP_FIT,
  ICP_INTRO,
  ICP_NOT_FIT,
  ICP_NOT_NOW,
  ICP_NOTE,
  ICP_PRIMARY,
  ICP_TEST_SEGMENTS,
  ICP_TESTS,
  NAME_RULES,
  PERSONALITY,
  PILLAR_CHECK,
  PILLARS,
  POSITIONING,
  POSITIONING_CHECK,
  PRIVACY_LINE_CHECK,
  RENDER_COMMAND,
  SCALE_SAMPLE,
  SECTIONS,
  TIER_MEANING,
  TYPE_RULES,
  VISUAL_LANGUAGE,
} from './page.constants';

/**
 * /branding: the brand definition as one page, rendered from @cityturfer/brand so it can't drift
 * from the tokens. Outside `[locale]/` (English only, like the brand docs), so it renders its own
 * document; noindex and not in the sitemap. Linked from the dev toolbar.
 */
export default async function BrandingPage() {
  setRequestLocale(BRANDING_LOCALE);
  // Dev toolbar, same guard as [locale]/layout.tsx: development build + this machine only, dynamic
  // imports inside the NODE_ENV branch so nothing reaches the static export.
  let devToolbar: ReactNode = null;
  if (process.env.NODE_ENV === 'development') {
    const { shouldRenderDevToolbar } = await import('@interdisciplinary/dev-toolbar/next');
    if (await shouldRenderDevToolbar()) {
      const { DevToolbarWithApp } = await import('../dev-toolbar-with-app');
      devToolbar = <DevToolbarWithApp />;
    }
  }

  return (
    <html
      lang='en'
      className={`${displayFont.variable} ${numericFont.variable}`}
      style={cssVariables(SITE_SCHEME) as CSSProperties}
    >
      <head>
        <title>{`${BRANDING_TITLE} · ${NAME}`}</title>
        <meta name='description' content={BRANDING_DESCRIPTION} />
        <meta name='robots' content='noindex' />
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <link rel='icon' href={mark.src} />
      </head>
      <body className='brand'>
        {/* The site's header (same as /en), so /branding reads as part of the site. */}
        <NextIntlClientProvider locale={BRANDING_LOCALE}>
          <AppHeader
            locale={BRANDING_LOCALE}
            waitlist={Boolean(WAITLIST)}
            waitlistHref={`/${BRANDING_LOCALE}#waitlist`}
            lockupSelector={BRAND_LOCKUP_SELECTOR}
          />
        </NextIntlClientProvider>
        <header className='brand-hero'>
          <div className='brand-wrap'>
            <p className='brand-kicker'>{BRANDING_TITLE}</p>
            <Image src={wordmarkLight} alt={NAME} width={420} height={73} priority className='brand-hero-wordmark' />
            <p className='brand-tagline'>{TAGLINES[0]}</p>
            <p className='brand-lede'>{PROMO}</p>
          </div>
        </header>
        <BrandNav sections={SECTIONS} />

        <main className='brand-wrap'>
          <Section id='positioning' title='Positioning' note='Draft for founder review'>
            <p className='brand-statement'>{POSITIONING}</p>
            <Check check={POSITIONING_CHECK} />
            <Check check={ALTERNATIVES_CHECK} />
            <div className='brand-table-scroll'>
              <table className='brand-table'>
                <thead>
                  <tr>
                    <th>Audience</th>
                    <th>What they want</th>
                    <th>Lead with</th>
                  </tr>
                </thead>
                <tbody>
                  {AUDIENCES.map((a) => (
                    <tr key={a.name}>
                      <td>{a.name}</td>
                      <td>{a.want}</td>
                      <td className='brand-quote'>{a.lead}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id='icp' title='Ideal customer profile' note={ICP_NOTE}>
            <p className='brand-statement'>{ICP_INTRO}</p>

            <article className='brand-card brand-icp'>
              <span className='brand-label'>Primary</span>
              <h3 className='brand-icp-name'>{ICP_PRIMARY.name}</h3>
              <p>{ICP_PRIMARY.summary}</p>
              <blockquote className='brand-icp-job'>
                <span className='brand-label'>Job to be done</span>
                <p className='brand-quote'>“{ICP_PRIMARY.job}”</p>
              </blockquote>
              <dl className='brand-icp-fields'>
                {ICP_PRIMARY.fields.map((f) => (
                  <div key={f.label}>
                    <dt className='brand-label'>{f.label}</dt>
                    <dd>{f.text}</dd>
                  </div>
                ))}
              </dl>
            </article>

            <div className='brand-grid brand-grid-2'>
              <div className='brand-card'>
                <h3 className='brand-card-title'>Fit signals</h3>
                <ul className='brand-rules'>
                  {ICP_FIT.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div className='brand-card'>
                <h3 className='brand-card-title'>Not a fit</h3>
                <ul className='brand-rules brand-icp-not'>
                  {ICP_NOT_FIT.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className='brand-muted'>{ICP_CONTEXT}</p>
            <Check check={ANDROID_CHECK} />

            <h3>Segments to test</h3>
            <p className='brand-muted'>Recruit interviewees from these; don’t build for them yet.</p>
            <div className='brand-grid brand-grid-2'>
              {ICP_TEST_SEGMENTS.map((seg) => (
                <div key={seg.name} className='brand-card'>
                  <h3 className='brand-card-title'>{seg.name}</h3>
                  <p>{seg.who}</p>
                  <p className='brand-icp-gap'>
                    <span className='brand-label'>Gap</span> {seg.gap}
                  </p>
                </div>
              ))}
            </div>

            <h3>Not for now</h3>
            <ul className='brand-rules'>
              {ICP_NOT_NOW.map((n) => (
                <li key={n.label}>
                  <strong>{n.label}.</strong> {n.text}
                </li>
              ))}
            </ul>

            <h3>How we’ll know</h3>
            <div className='brand-table-scroll'>
              <table className='brand-table'>
                <thead>
                  <tr>
                    <th>Assumption</th>
                    <th>Test</th>
                    <th>Pass bar</th>
                  </tr>
                </thead>
                <tbody>
                  {ICP_TESTS.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <span className='brand-num'>{t.id}</span> {t.claim}
                      </td>
                      <td>{t.test}</td>
                      <td>{t.bar}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className='brand-muted'>
              Source: <a href={ICP_DOC_URL}>ideal customer profile</a> and the discovery board.
            </p>
          </Section>

          <Section id='personality' title='Personality'>
            <div className='brand-grid brand-grid-2'>
              {PERSONALITY.map((t) => (
                <div key={t.we} className='brand-card'>
                  <p className='brand-yes'>
                    <strong>{t.we}</strong> · {t.weAre}
                  </p>
                  <p className='brand-no'>
                    Not {t.notName.toLowerCase()} · {t.weAreNot}
                  </p>
                </div>
              ))}
            </div>
            <h3>Pillars</h3>
            <div className='brand-grid brand-grid-3'>
              {PILLARS.map((p) => (
                <div key={p.name} className='brand-card brand-pillar'>
                  <p className='brand-pillar-name'>{p.name}</p>
                  <p>{p.text}</p>
                </div>
              ))}
            </div>
            <Check check={PILLAR_CHECK} />
          </Section>

          <Section id='voice' title='Name & voice'>
            <ul className='brand-taglines'>
              {TAGLINES.map((line, i) => (
                <li key={line}>
                  <span className='brand-label'>{i === 0 ? 'Tagline' : `Alternative ${i}`}</span>
                  <span className='brand-tagline-item'>{line}</span>
                </li>
              ))}
              <li>
                <span className='brand-label'>Privacy line</span>
                <span className='brand-tagline-item'>{PRIVACY_LINE}</span>
              </li>
            </ul>
            <Check check={PRIVACY_LINE_CHECK} />
            <ul className='brand-rules'>
              {NAME_RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </Section>

          <Section id='logo' title='Logo'>
            <div className='brand-grid brand-grid-3'>
              <LogoTile src={mark} label='Mark' file='mark.svg' />
              <LogoTile src={markForeground} label='Mark foreground (adaptive icon)' file='mark-foreground.svg' />
              <LogoTile src={markMonochrome} label='Monochrome (themed icon)' file='mark-monochrome.svg' />
              <LogoTile src={wordmark} label='Wordmark on night (maps, dark panels)' file='wordmark.svg' wide night />
              <LogoTile src={wordmarkLight} label='Wordmark on light (the website)' file='wordmark-light.svg' wide />
            </div>
            <p className='brand-muted'>
              The wordmark is outlined Archivo Expanded (“City” Medium, “Turfer” Black), generated by a script: never
              edit the SVGs by hand. Keep clear space of at least half a hexagon side around the mark. Don’t recolour
              the hexagon, rotate the mark, put it on busy photos or add drop shadows.
            </p>
          </Section>

          <Section id='colour' title='Colour' note='The palette is the turf strength ramp'>
            <div className='brand-ramp' aria-hidden='true' />
            <div className='brand-grid brand-grid-4'>
              {TIER_ORDER.map((tier) => (
                <Swatch
                  key={tier}
                  name={TIER_LABEL[tier]}
                  token={tier === 'glowing' ? 'glow · accent' : tier}
                  hex={TIER_COLOR[tier]}
                  on={ON_TIER[tier]}
                  note={TIER_MEANING[tier]}
                />
              ))}
            </div>
            <h3>Activity colours</h3>
            <p className='brand-muted'>Tracks only; never for turf.</p>
            <div className='brand-grid brand-grid-3'>
              {(['walk', 'run', 'cycle'] as const).map((type) => (
                <Swatch
                  key={type}
                  name={ACTIVITY_LABEL[type]}
                  token={type === 'cycle' ? 'ride' : type}
                  hex={TYPE_COLOR[type]}
                  on={ON_TYPE_COLOR[type]}
                />
              ))}
            </div>
            <h3>Themes</h3>
            <div className='brand-grid brand-grid-2'>
              <ThemeCard name='Dark (the app, the Turf Map, splash)' theme={DARK} />
              <ThemeCard name='Light (website, Swagger, Storybook: SITE_SCHEME)' theme={LIGHT} />
            </div>
          </Section>

          <Section id='type' title='Typography' note='Archivo (SIL Open Font License)'>
            <div className='brand-stack'>
              {FONTS.map((f) => (
                <div key={f.role} className='brand-card brand-type'>
                  <div className='brand-type-meta'>
                    <span className='brand-label'>{f.role}</span>
                    <span>{f.family}</span>
                    <span className='brand-muted'>{f.use}</span>
                  </div>
                  <p className='brand-type-sample' style={{ fontFamily: `var(${f.cssVar})` }}>
                    {f.sample}
                  </p>
                </div>
              ))}
            </div>
            <h3>Type scale</h3>
            <div className='brand-card'>
              {(Object.keys(FONT_SIZE) as (keyof typeof FONT_SIZE)[]).map((key) => (
                <div key={key} className='brand-scale-row'>
                  <span className='brand-label'>
                    {key} · {FONT_SIZE[key]}
                  </span>
                  <span className={SCALE_SAMPLE[key].className} style={{ fontSize: `min(${FONT_SIZE[key]}px, 11vw)` }}>
                    {SCALE_SAMPLE[key].text}
                  </span>
                </div>
              ))}
            </div>
            <ul className='brand-rules'>
              {TYPE_RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </Section>

          <Section id='layout' title='Spacing & radii'>
            <div className='brand-grid brand-grid-2'>
              <div className='brand-card'>
                <h3 className='brand-card-title'>Spacing</h3>
                {Object.entries(SPACE).map(([key, value]) => (
                  <div key={key} className='brand-space-row'>
                    <span className='brand-label'>
                      {key} · {value}
                    </span>
                    <span className='brand-space-bar' style={{ width: value * 4 }} />
                  </div>
                ))}
              </div>
              <div className='brand-card'>
                <h3 className='brand-card-title'>Radii</h3>
                <div className='brand-radii'>
                  {Object.entries(RADIUS).map(([key, value]) => (
                    <div key={key} className='brand-radius'>
                      <span className='brand-radius-box' style={{ borderRadius: Math.min(value, 32) }} />
                      <span className='brand-label'>
                        {key} · {value === RADIUS.full ? 'full' : value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section id='visual' title='Visual language'>
            <div className='brand-grid brand-grid-2'>
              {VISUAL_LANGUAGE.map((v) => (
                <div key={v.name} className='brand-card'>
                  <h3 className='brand-card-title'>{v.name}</h3>
                  <p>{v.text}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section
            id='a11y'
            title='Accessibility'
            note={`WCAG 2.2 AA: ${MIN_CONTRAST.text}:1 text, ${MIN_CONTRAST.ui}:1 UI`}
          >
            <div className='brand-table-scroll'>
              <table className='brand-table'>
                <thead>
                  <tr>
                    <th>Pair</th>
                    <th>Ratio</th>
                    <th>Needs</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  <ContrastRow name='Text on light' fg={LIGHT.text} bg={LIGHT.bg} min={MIN_CONTRAST.text} />
                  <ContrastRow name='Muted on light card' fg={LIGHT.muted} bg={LIGHT.card} min={MIN_CONTRAST.text} />
                  <ContrastRow
                    name='Link / pink text on light'
                    fg={LIGHT.accentText}
                    bg={LIGHT.bg}
                    min={MIN_CONTRAST.text}
                  />
                  <ContrastRow
                    name='Night label on glow button'
                    fg={LIGHT.onAccent}
                    bg={ACCENT}
                    min={MIN_CONTRAST.text}
                  />
                  <ContrastRow name='Danger on light' fg={LIGHT.danger} bg={LIGHT.bg} min={MIN_CONTRAST.text} />
                  <ContrastRow
                    name='Input edge on light'
                    fg={LIGHT.borderControl}
                    bg={LIGHT.bg}
                    min={MIN_CONTRAST.ui}
                  />
                  {(['walk', 'run', 'cycle'] as const).map((type) => (
                    <ContrastRow
                      key={type}
                      name={`${ACTIVITY_LABEL[type]} line on light`}
                      fg={LIGHT[`${type}Graphic`]}
                      bg={LIGHT.bg}
                      min={MIN_CONTRAST.ui}
                    />
                  ))}
                  <ContrastRow name='Text on night' fg={DARK.text} bg={DARK.bg} min={MIN_CONTRAST.text} />
                  <ContrastRow name='Muted on night card' fg={DARK.muted} bg={DARK.card} min={MIN_CONTRAST.text} />
                  <ContrastRow name='Glow on night' fg={ACCENT} bg={DARK.bg} min={MIN_CONTRAST.text} />
                  <ContrastRow name='Faint turf on night' fg={TIER_COLOR.faint} bg={DARK.bg} min={MIN_CONTRAST.ui} />
                  <ContrastRow name='White label on glow (app)' fg={ON_ACCENT} bg={ACCENT} min={MIN_CONTRAST.text} />
                </tbody>
              </table>
            </div>
            <h3>Known failures (app side, unchanged)</h3>
            <p className='brand-muted'>{CONTRAST_FIXES_NOTE}</p>
            <div className='brand-table-scroll'>
              <table className='brand-table'>
                <thead>
                  <tr>
                    <th>Pair</th>
                    <th>Today</th>
                    <th>Suggested fix</th>
                  </tr>
                </thead>
                <tbody>
                  {CONTRAST_FIXES.map((f) => (
                    <tr key={f.pair}>
                      <td>{f.pair}</td>
                      <td className='brand-num'>{f.today}</td>
                      <td>{f.fix}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id='assets' title='Assets'>
            <Image src='/og-image.png' alt='Social image' width={1200} height={630} className='brand-og' />
            <div className='brand-table-scroll'>
              <table className='brand-table'>
                <tbody>
                  {ASSETS.map((a) => (
                    <tr key={a.name}>
                      <td>{a.name}</td>
                      <td>
                        <code>{a.where}</code>
                      </td>
                      <td className='brand-muted'>{a.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className='brand-muted'>
              Render everything with <code>{RENDER_COMMAND}</code>. Full rationale:{' '}
              <a href={DECISION_DOC_URL}>brand foundations decision</a>.
            </p>
          </Section>
        </main>
        {devToolbar}
      </body>
    </html>
  );
}

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} className='brand-section' aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      {note ? <p className='brand-note'>{note}</p> : null}
      {children}
    </section>
  );
}

function Check({ check }: { check: FactCheck }) {
  return (
    <aside className='brand-check' aria-label='Fact check'>
      <p>
        <span className='brand-label'>Fact check · {check.line}</span>
      </p>
      <p>{check.today}</p>
      <p>
        <strong>Proposed:</strong> {check.proposal}
      </p>
    </aside>
  );
}

function LogoTile({
  src,
  label,
  file,
  wide,
  night,
}: {
  src: StaticImageData;
  label: string;
  file: string;
  wide?: boolean;
  night?: boolean;
}) {
  return (
    <figure className={`brand-logo${wide ? ' brand-logo-wide' : ''}`}>
      <div className='brand-logo-art' style={night ? { background: DARK.bg } : undefined}>
        <Image src={src} alt={label} className={wide ? 'brand-logo-img-wide' : 'brand-logo-img'} />
      </div>
      <figcaption>
        <span>{label}</span>
        <a href={src.src} download={file}>
          {file}
        </a>
      </figcaption>
    </figure>
  );
}

function Swatch({
  name,
  token,
  hex,
  on,
  note,
}: {
  name: string;
  token: string;
  hex: string;
  on: string;
  note?: string;
}) {
  return (
    <div className='brand-swatch'>
      <div className='brand-swatch-chip' style={{ background: hex, color: on }}>
        <span className='brand-swatch-name'>{name}</span>
        <span className='brand-num'>
          {contrastRatio(on, hex).toFixed(1)}:1
          {contrastRatio(on, hex) < MIN_CONTRAST.text ? ' · fails AA' : ''}
        </span>
      </div>
      <div className='brand-swatch-meta'>
        <code>{hex}</code>
        <span className='brand-label'>{token}</span>
        {note ? <span className='brand-muted'>{note}</span> : null}
      </div>
    </div>
  );
}

function ThemeCard({ name, theme }: { name: string; theme: typeof DARK }) {
  return (
    <div className='brand-theme' style={{ background: theme.bg, color: theme.text, borderColor: theme.border }}>
      <p className='brand-theme-name'>{name}</p>
      <div className='brand-theme-card' style={{ background: theme.card, borderColor: theme.border }}>
        {Object.entries(theme).map(([key, hex]) => (
          <div key={key} className='brand-theme-row'>
            <span className='brand-theme-dot' style={{ background: hex, borderColor: theme.border }} />
            <span>{key}</span>
            <code style={{ color: theme.muted }}>{hex}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContrastRow({ name, fg, bg, min }: { name: string; fg: string; bg: string; min: number }) {
  const ratio = contrastRatio(fg, bg);
  const pass = ratio >= min;
  return (
    <tr>
      <td>
        <span className='brand-pair' style={{ background: bg, color: fg }}>
          Aa
        </span>{' '}
        {name}
      </td>
      <td className='brand-num'>{ratio.toFixed(1)}:1</td>
      <td className='brand-num'>{min}:1</td>
      <td className={pass ? 'brand-pass' : 'brand-fail'}>{pass ? 'Pass' : 'Fail'}</td>
    </tr>
  );
}
