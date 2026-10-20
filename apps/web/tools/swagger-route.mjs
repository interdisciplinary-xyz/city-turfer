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

/** The Swagger UI page: assets next to it, the spec at ./openapi.json. */
export function swaggerHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CityTurfer API</title>
    <link rel="stylesheet" href="./swagger-ui.css" />
    <style>body { margin: 0; } .swagger-ui .topbar { display: none; }</style>
  </head>
  <body>
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
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'StandaloneLayout',
      });
    </script>
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
 * server, everything else goes to `next`.
 */
export function withSwagger(next, { distRoot, specFile, apiUrl = DEFAULT_API_URL }) {
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
