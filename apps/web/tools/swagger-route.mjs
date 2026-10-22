// Dev only: the API's docs on the local site (https://cityturfer.local/swagger) and a same-origin
// proxy to the API's dev server (https://cityturfer.local/api/* → http://localhost:8787/*), so
// Swagger's "Try it out" works from the HTTPS page without CORS or mixed content.
//
// Swagger UI comes from swagger-ui-dist; the spec is the generated apps/api/openapi.json
// (`pnpm --filter @cityturfer/api run openapi`). The API itself: `pnpm --filter @cityturfer/api dev`.
//
// The page wears the brand like /branding: ./brand.css is the @cityturfer/brand token variables
// (handed in by server.mjs) plus tools/swagger-brand.css, and ./brand/{fonts,svg}/* are the brand
// package's own font and logo files.
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import path from 'node:path';

import { contentTypeOf } from './storybook-route.mjs';

export const SWAGGER_PREFIX = '/swagger';
export const API_PREFIX = '/api';
export const DEFAULT_API_URL = 'http://localhost:8787';

const BRAND_STYLES = new URL('./swagger-brand.css', import.meta.url);
/** Brand files the page may load: a font or an SVG straight inside packages/brand/{fonts,svg}. */
const BRAND_FILE = /^\/brand\/((?:fonts|svg)\/[\w-]+\.(?:woff2|svg))$/;

/** The Swagger UI page: assets next to it, the spec at ./openapi.json. */
export function swaggerHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>API reference · CityTurfer</title>
    <link rel="icon" href="./brand/svg/mark.svg" />
    <link rel="stylesheet" href="./swagger-ui.css" />
    <link rel="stylesheet" href="./brand.css" />
  </head>
  <body>
    <header class="ct-hero">
      <div class="ct-wrap">
        <p class="ct-kicker">API reference</p>
        <img class="ct-wordmark" src="./brand/svg/wordmark.svg" alt="CityTurfer" width="300" height="52" />
        <nav class="ct-nav" aria-label="Dev pages">
          <a href="./openapi.json">openapi.json</a>
          <a href="/branding">Branding</a>
          <a href="/storybook/">Storybook</a>
          <a href="/en">Website</a>
        </nav>
      </div>
    </header>
    <div id="swagger-ui"></div>
    <script src="./swagger-ui-bundle.js"></script>
    <script src="./swagger-ui-standalone-preset.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: './openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        displayRequestDuration: true,
        persistAuthorization: true,
        showExtensions: true,
        docExpansion: 'list',
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'StandaloneLayout',
      });
    </script>
  </body>
</html>
`;
}

/**
 * The page's brand stylesheet: `variables` (from @cityturfer/brand `cssVariables('dark')`) on
 * :root, @font-face rules for the brand fonts (`fontFamily`, from `FONT_FAMILY`; each file is
 * named after its font), then `styles` (tools/swagger-brand.css).
 */
export function brandCss({ variables = {}, fontFamily = {} } = {}, styles = '') {
  const vars = Object.entries(variables)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
  const faces = Object.values(fontFamily)
    .map(
      (font) =>
        `@font-face {\n  font-family: '${font}';\n  src: url('./brand/fonts/${font}.woff2') format('woff2');\n  font-display: swap;\n}`
    )
    .join('\n');
  return `${faces}\n:root {\n${vars}\n}\n${styles}`;
}

/**
 * What a /swagger path asks for: the page, the spec, the brand stylesheet, a brand font or logo,
 * an asset file inside `distRoot`, or null when it isn't a Swagger path or tries to leave
 * `distRoot`.
 */
export function swaggerTarget(distRoot, urlPath) {
  if (urlPath !== SWAGGER_PREFIX && !urlPath.startsWith(`${SWAGGER_PREFIX}/`)) {
    return null;
  }
  let rest;
  try {
    rest = decodeURIComponent(urlPath.slice(SWAGGER_PREFIX.length));
  } catch {
    return null;
  }
  if (rest === '' || rest === '/' || rest === '/index.html') {
    return { kind: 'page' };
  }
  if (rest === '/openapi.json') {
    return { kind: 'spec' };
  }
  if (rest === '/brand.css') {
    return { kind: 'theme' };
  }
  const brandFile = BRAND_FILE.exec(rest);
  if (brandFile) {
    return { kind: 'brand', file: brandFile[1] };
  }
  const resolved = path.resolve(distRoot, rest.replace(/^\/+/, ''));
  if (!resolved.startsWith(`${distRoot}${path.sep}`)) {
    return null;
  }
  return { kind: 'asset', file: resolved };
}

/** `/api/v1/health?x=1` → `/v1/health?x=1`; null for other paths. */
export function apiPath(url) {
  if (url !== API_PREFIX && !url.startsWith(`${API_PREFIX}/`) && !url.startsWith(`${API_PREFIX}?`)) {
    return null;
  }
  const rest = url.slice(API_PREFIX.length);
  return rest.startsWith('/') ? rest : `/${rest}`;
}

function problem(res, status, code, title, detail) {
  res.writeHead(status, { 'Content-Type': 'application/problem+json' });
  res.end(JSON.stringify({ type: `https://cityturfer.app/problems/${code}`, title, status, code, detail }));
}

async function sendFile(res, file, contentType) {
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) {
    return false;
  }
  res.writeHead(200, { 'Content-Type': contentType ?? contentTypeOf(file), 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
  return true;
}

/** Forwards the request to the API dev server, streaming both ways. Never logs bodies. */
function proxy(req, res, apiUrl, targetPath) {
  const target = new URL(targetPath, apiUrl);
  const headers = { ...req.headers, host: target.host };
  const upstream = httpRequest(target, { method: req.method, headers }, (up) => {
    res.writeHead(up.statusCode ?? 502, up.headers);
    up.pipe(res);
  });
  upstream.on('error', () => {
    if (!res.headersSent) {
      problem(
        res,
        502,
        'api-not-running',
        'The API dev server is not running',
        'Start it with: pnpm --filter @cityturfer/api dev'
      );
    } else {
      res.end();
    }
  });
  req.pipe(upstream);
}

/**
 * Wraps a request handler: /swagger serves Swagger UI and the spec, /api proxies to the API dev
 * server, everything else goes to `next`. `brand` = { root (packages/brand), variables,
 * fontFamily } styles the page; without it the page falls back to Swagger UI's own look.
 */
export function withSwagger(next, { distRoot, specFile, apiUrl = DEFAULT_API_URL, brand }) {
  const absDist = path.resolve(distRoot);
  return async (req, res) => {
    const url = req.url ?? '/';
    const forwarded = apiPath(url);
    if (forwarded !== null) {
      proxy(req, res, apiUrl, forwarded);
      return undefined;
    }
    const urlPath = url.split('?')[0];
    const target = swaggerTarget(absDist, urlPath);
    if (target === null) {
      return next(req, res);
    }
    // Relative asset URLs need the trailing slash.
    if (urlPath === SWAGGER_PREFIX) {
      res.writeHead(308, { Location: `${SWAGGER_PREFIX}/` });
      res.end();
      return undefined;
    }
    if (target.kind === 'page') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(swaggerHtml());
      return undefined;
    }
    if (target.kind === 'theme') {
      // Read per request so edits to swagger-brand.css show on reload.
      const styles = brand ? await readFile(BRAND_STYLES, 'utf8') : '';
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(brand ? brandCss(brand, styles) : '');
      return undefined;
    }
    if (target.kind === 'brand') {
      if (!brand?.root || !(await sendFile(res, path.join(brand.root, target.file)))) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found in @cityturfer/brand.\n');
      }
      return undefined;
    }
    const file = target.kind === 'spec' ? specFile : target.file;
    if (!(await sendFile(res, file, target.kind === 'spec' ? 'application/json; charset=utf-8' : undefined))) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(
        target.kind === 'spec'
          ? 'No spec yet. Generate it: pnpm --filter @cityturfer/api run openapi\n'
          : 'Not found in swagger-ui-dist.\n'
      );
    }
    return undefined;
  };
}
