// Dev only: the table of contents beside the Swagger page (https://cityturfer.local/swagger).
// Served as ./ct-toc.mjs (a browser module). Built from the spec itself: the guide's headings
// (info.description), then every tag with its operations, then the schemas. Links scroll to
// Swagger UI's own elements and open the tag or operation they point at.
//
// The pure parts (tocEntries, swaggerDomId) run in Node too, for tools/__tests__.

/** Same breakpoint as the sticky column in swagger-theme.css. */
const WIDE = '(min-width: 1100px)';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

/** Swagger UI's element ids: whitespace becomes `_` (`operations-tag-Activity_Log`). */
export function swaggerDomId(name) {
  return String(name).trim().replace(/\s+/g, '_');
}

/** `## Getting started` lines of the guide (levels 1–3), without the hashes. */
export function guideHeadings(markdown = '') {
  return [...String(markdown).matchAll(/^#{1,3}\s+(.+?)\s*#*\s*$/gm)].map((match) => match[1]);
}

/**
 * The contents as plain data: `{ guide: string[], tags: [{ name, operations: [{ method, path,
 * summary, operationId }] }], schemas: number }`. Tags keep the spec's order (as Swagger UI shows
 * them); operations without a tag are left out, like in Swagger UI's tag list.
 */
export function tocEntries(spec) {
  const tagNames = (spec.tags ?? []).map((tag) => tag.name);
  const byTag = new Map(tagNames.map((name) => [name, []]));
  for (const [routePath, item] of Object.entries(spec.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = item?.[method];
      if (!operation?.operationId) {
        continue;
      }
      for (const tag of operation.tags ?? []) {
        if (!byTag.has(tag)) {
          byTag.set(tag, []);
        }
        byTag
          .get(tag)
          .push({ method, path: routePath, summary: operation.summary ?? '', operationId: operation.operationId });
      }
    }
  }
  return {
    guide: guideHeadings(spec.info?.description),
    tags: [...byTag]
      .filter(([, operations]) => operations.length > 0)
      .map(([name, operations]) => ({ name, operations })),
    schemas: Object.keys(spec.components?.schemas ?? {}).length,
  };
}

// ---- Browser ------------------------------------------------------------------------------

/** Element helper: `h('a', { href: '#' }, 'text', child)`. */
function h(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (name.startsWith('data-') || name.startsWith('aria-') || name === 'href' || name === 'class') {
      element.setAttribute(name, value);
    } else {
      element[name] = value;
    }
  }
  element.append(...children.filter((child) => child !== null && child !== undefined));
  return element;
}

/** Where a contents link points: found at click time, because Swagger UI re-renders freely. */
function findTarget(link) {
  const { kind, name, tag, op } = link.dataset;
  if (kind === 'overview') {
    return document.querySelector('.swagger-ui .information-container');
  }
  if (kind === 'servers') {
    return document.querySelector('.swagger-ui .scheme-container');
  }
  if (kind === 'schemas') {
    return document.querySelector('.swagger-ui section.models');
  }
  if (kind === 'guide') {
    return [...document.querySelectorAll('.swagger-ui .info .description :is(h1, h2, h3)')].find(
      (heading) => heading.textContent.trim() === name
    );
  }
  if (kind === 'tag') {
    return document.getElementById(`operations-tag-${swaggerDomId(tag)}`);
  }
  if (kind === 'op') {
    return document.getElementById(`operations-${swaggerDomId(tag)}-${swaggerDomId(op)}`);
  }
  return null;
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function go(ui, link) {
  const { kind, tag, op } = link.dataset;
  // Open what the link points at (a collapsed tag hides its operations), the way deep links do.
  if (tag) {
    ui.layoutActions.show(['operations-tag', tag], true);
  }
  if (kind === 'op') {
    ui.layoutActions.show(['operations', tag, op], true);
  }
  if (kind === 'schemas') {
    ui.layoutActions.show(['models'], true);
  }
  // (show() also writes Swagger's deep-link hash, so the address bar can be shared.)
  // Wait a frame: opening a tag renders its operations first.
  requestAnimationFrame(() => {
    findTarget(link)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  });
}

/** A path that may wrap after each `/` (never inside a segment): text and <wbr> nodes. */
function pathParts(routePath) {
  return routePath.split('/').flatMap((segment, index) => (index === 0 ? [segment] : [h('wbr'), `/${segment}`]));
}

/** Swagger's deep link for a tag or an operation (`#/Activity%20Log/uploadActivity`). */
export function deepLink(tag, operationId) {
  const parts = [tag, operationId].filter(Boolean).map((part) => encodeURIComponent(part));
  return `#/${parts.join('/')}`;
}

function entryLink(attributes, ...children) {
  const { 'data-tag': tag, 'data-op': op } = attributes;
  // Tags and operations carry their deep link (middle-click opens them in a new tab).
  const href = tag ? deepLink(tag, op) : '#';
  return h('a', { href, class: 'ct-toc-link', ...attributes }, ...children);
}

function render(nav, entries) {
  const list = h('ol', { class: 'ct-toc-list' });
  const section = (label, kind, extra = {}, children = null) =>
    h('li', { class: 'ct-toc-item' }, entryLink({ 'data-kind': kind, ...extra }, label), children);

  list.append(
    section(
      'Overview',
      'overview',
      {},
      entries.guide.length
        ? h(
            'ol',
            { class: 'ct-toc-sub' },
            ...entries.guide.map((name) => section(name, 'guide', { 'data-name': name }))
          )
        : null
    ),
    section('Servers & auth', 'servers')
  );

  for (const tag of entries.tags) {
    const operations = h(
      'ol',
      { class: 'ct-toc-sub ct-toc-ops' },
      ...tag.operations.map((operation) =>
        h(
          'li',
          { class: 'ct-toc-item' },
          entryLink(
            { 'data-kind': 'op', 'data-tag': tag.name, 'data-op': operation.operationId, title: operation.summary },
            h('span', { class: `ct-toc-method ct-toc-method-${operation.method}` }, operation.method.toUpperCase()),
            h('span', { class: 'ct-toc-path' }, ...pathParts(operation.path))
          )
        )
      )
    );
    list.append(
      section(
        h('span', {}, tag.name, ' ', h('span', { class: 'ct-toc-count' }, String(tag.operations.length))),
        'tag',
        { 'data-tag': tag.name },
        operations
      )
    );
  }
  if (entries.schemas > 0) {
    list.append(
      section(h('span', {}, 'Schemas ', h('span', { class: 'ct-toc-count' }, String(entries.schemas))), 'schemas')
    );
  }

  const details = h(
    'details',
    { class: 'ct-toc-details', open: window.matchMedia(WIDE).matches },
    h('summary', { class: 'ct-toc-summary' }, 'Contents'),
    list
  );
  nav.replaceChildren(details);
  nav.hidden = false;
  return details;
}

/** Highlights the section being read: the last link whose target starts above a line near the top. */
function trackCurrent(nav) {
  let queued = false;
  const update = () => {
    queued = false;
    const links = [...nav.querySelectorAll('.ct-toc-link')];
    let current = null;
    for (const link of links) {
      const target = findTarget(link);
      if (target && target.getBoundingClientRect().top < 120) {
        current = link;
      }
    }
    for (const link of links) {
      if (link === current) {
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }
    }
    if (current && window.matchMedia(WIDE).matches) {
      current.scrollIntoView({ block: 'nearest' });
    }
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
  update();
}

function mount(ui) {
  const nav = document.getElementById('ct-toc');
  const spec = ui.specSelectors.specJson().toJS();
  if (!nav || !spec?.paths) {
    return;
  }
  const details = render(nav, tocEntries(spec));
  nav.addEventListener('click', (event) => {
    const link = event.target.closest('.ct-toc-link');
    if (!link) {
      return;
    }
    // Also keep the click from Swagger UI's bundled smooth-scroll helper, which handles every
    // in-page link itself (href="#" → scroll to the top and reset the hash).
    event.preventDefault();
    event.stopPropagation();
    go(ui, link);
    // On a phone the contents sit above the page: fold them away once a link is chosen.
    if (!window.matchMedia(WIDE).matches) {
      details.open = false;
    }
  });
  // Beside the page (wide) the contents are always open; folded again when the window narrows.
  window.matchMedia(WIDE).addEventListener('change', (event) => {
    details.open = event.matches;
  });
  trackCurrent(nav);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // The page's inline script sets window.ctSwaggerReady and fires `ct:swagger-ready` from
  // Swagger UI's onComplete; this module may load before or after that.
  if (window.ctSwaggerReady) {
    mount(window.ui);
  } else {
    window.addEventListener('ct:swagger-ready', () => mount(window.ui), { once: true });
  }
}
