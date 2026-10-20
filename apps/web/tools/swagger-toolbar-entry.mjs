// Dev only: bundled by swagger-toolbar.mjs into the script the Swagger page loads. Mounts the
// website's dev toolbar (the same DevToolbar component and props as
// src/app/dev-toolbar-with-app) outside Next.
import { DevToolbar } from '@interdisciplinary/dev-toolbar/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

const host = document.getElementById('dev-toolbar-root');
if (host) {
  createRoot(host).render(
    createElement(DevToolbar, {
      user: null,
      brandLabel: 'CityTurfer',
      locale: 'en',
      locales: ['en', 'pl'],
      defaultLocale: 'en',
      links: [
        { label: 'GitHub', href: 'https://github.com/interdisciplinary-xyz/city-turfer' },
        { label: 'Pull requests', href: 'https://github.com/interdisciplinary-xyz/city-turfer/pulls' },
        { label: 'Vercel', href: 'https://vercel.com/micha-dopieralskis-projects' },
      ],
      storagePrefix: 'cityturfer',
    })
  );
}
