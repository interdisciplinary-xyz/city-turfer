import { headers } from 'next/headers';

import { DEV_LOCAL_CLIENT_HEADER } from '../protocol.js';

/**
 * Whether this request may see the dev toolbar: a development build AND a
 * request from this machine — marked by the dev server
 * (`../node/local-client.js`); other devices on the Portless `--lan`
 * host never get the mark, and a client-sent copy is stripped.
 *
 * `NODE_ENV` is inlined at build time, so a production build never reads
 * the header and never renders the toolbar.
 */
export async function shouldRenderDevToolbar(): Promise<boolean> {
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }
  return (await headers()).get(DEV_LOCAL_CLIENT_HEADER) === '1';
}
