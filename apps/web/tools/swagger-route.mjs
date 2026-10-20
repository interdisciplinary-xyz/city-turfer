// Dev only: the API's docs on the local site (https://cityturfer.local/swagger) and a same-origin
// proxy to the API's dev server (https://cityturfer.local/api/* → http://localhost:8787/*), so
// Swagger's "Try it out" works from the HTTPS page without CORS or mixed content.
//
// Swagger UI comes from swagger-ui-dist; the spec is the generated apps/api/openapi.json
// (`pnpm --filter @cityturfer/api run openapi`). The API itself: `pnpm --filter @cityturfer/api dev`.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import path from 'node:path';

import { contentTypeOf } from './storybook-route.mjs';

export const SWAGGER_PREFIX = '/swagger';
export const API_PREFIX = '/api';
export const DEFAULT_API_URL = 'http://localhost:8787';

/** Brand files the page may load (packages/brand/svg): the header and the tab icon. */
export const BRAND_FILES = ['mark.svg', 'wordmark.svg'];

/**
 * The Swagger UI page: assets next to it, the spec at ./openapi.json. `toolbar` adds the dev
 * toolbar (only for requests from this machine, see withSwagger).
 */
export function swaggerHtml({ toolbar = false } = {}) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>CityTurfer API</title>
    <link rel="icon" type="image/svg+xml" href="./brand/mark.svg" />
    <link rel="stylesheet" href="./swagger-ui.css" />
    <link rel="stylesheet" href="./ct-theme.css" />${toolbar ? '\n    <link rel="stylesheet" href="./__toolbar.css" />' : ''}
  </head>
  <body>
    <header class="ct-header">
      <div class="ct-header-inner">
        <h1>
          <img class="ct-mark" src="./brand/mark.svg" alt="" width="44" height="44" />
          <img class="ct-wordmark" src="./brand/wordmark.svg" alt="CityTurfer" height="22" />
          <span>API</span>
        </h1>
        <p class="ct-tagline">Local docs. Routes stay on your phone.</p>
      </div>
    </header>
    <div id="swagger-ui"></div>${toolbar ? '\n    <div id="dev-toolbar-root"></div>' : ''}
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
    </script>${toolbar ? '\n    <script src="./__toolbar.js"></script>' : ''}
  </body>
</html>
`;
}

/**
 * What a /swagger path asks for: the page, the spec, an asset file inside `distRoot`, or null when
 * it isn't a Swagger path or tries to leave `distRoot`.
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
  if (rest === '/ct-theme.css') {
    return { kind: 'theme' };
  }
  if (rest === '/__toolbar.js' || rest === '/__toolbar.css') {
    return { kind: 'toolbar', ext: rest.slice(rest.lastIndexOf('.') + 1) };
  }
  if (rest.startsWith('/brand/')) {
    const name = rest.slice('/brand/'.length);
    return BRAND_FILES.includes(name) ? { kind: 'brand', name } : null;
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

function send(res, contentType, body) {
  res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  res.end(body);
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
 * server, everything else goes to `next`.
 *
 * - `webRoot` (apps/web) and `brandDir` (packages/brand/svg) feed the CityTurfer skin and logos.
 * - `isLocal(req)` says whether the request comes from this machine (the dev-toolbar package's
 *   `isLocalClient`, the rule the site uses); only then is the dev toolbar injected and served.
 * - `loadTheme()` / `loadToolbar()` default to ./swagger-brand.mjs and ./swagger-toolbar.mjs,
 *   loaded on first use; tests pass fakes.
 */
export function withSwagger(
  next,
  {
    distRoot,
    specFile,
    apiUrl = DEFAULT_API_URL,
    webRoot = process.cwd(),
    brandDir,
    isLocal = () => false,
    loadTheme = async () => (await import('./swagger-brand.mjs')).swaggerThemeCss(webRoot),
    loadToolbar = async () => (await import('./swagger-toolbar.mjs')).toolbarAssets(webRoot),
  }
) {
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
      res.end(swaggerHtml({ toolbar: isLocal(req) }));
      return undefined;
    }
    if (target.kind === 'theme') {
      send(res, 'text/css; charset=utf-8', await loadTheme());
      return undefined;
    }
    if (target.kind === 'toolbar') {
      if (!isLocal(req)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found.\n');
        return undefined;
      }
      const assets = await loadToolbar();
      send(res, target.ext === 'js' ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8', assets[target.ext]);
      return undefined;
    }
    if (target.kind === 'brand') {
      if (!brandDir || !(await sendFile(res, path.join(brandDir, target.name), 'image/svg+xml'))) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found.\n');
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
