import { routing } from '@/i18n/routing';

/**
 * `/` has no content of its own. The root layout only passes through, so this page renders a
 * complete document that sends the visitor to the default language: a meta refresh (works in the
 * static export on any host, without JavaScript) plus a plain link. On Vercel, vercel.json
 * redirects `/` first and sends Polish browsers to `/pl`.
 */
export default function RootPage() {
  const target = `/${routing.defaultLocale}`;
  return (
    <html lang={routing.defaultLocale}>
      <head>
        <meta httpEquiv='refresh' content={`0; url=${target}`} />
        <link rel='canonical' href={target} />
        <meta name='robots' content='noindex' />
      </head>
      <body>
        <a href={target}>CityTurfer</a>
      </body>
    </html>
  );
}
