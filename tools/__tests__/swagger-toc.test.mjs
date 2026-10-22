import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { deepLink, guideHeadings, swaggerDomId, tocEntries } from '../../apps/web/tools/swagger-toc.mjs';

const SPEC = {
  info: { description: '# Title\n\nIntro\n\n## Getting started\n\ntext\n\n### Every day after\n\n#### Too deep\n' },
  tags: [{ name: 'Platform' }, { name: 'Activity Log' }, { name: 'Unused' }],
  paths: {
    '/v1/health': { get: { operationId: 'getHealth', summary: 'Liveness', tags: ['Platform'] } },
    '/v1/activities/{id}': {
      parameters: [],
      put: { operationId: 'putActivity', summary: 'Upload', tags: ['Activity Log'] },
      delete: { operationId: 'deleteActivity', tags: ['Activity Log'] },
    },
    '/v1/untagged': { get: { operationId: 'untagged' } },
  },
  components: { schemas: { A: {}, B: {} } },
};

test('guide headings are levels 1 to 3, without hashes', () => {
  assert.deepEqual(guideHeadings(SPEC.info.description), ['Title', 'Getting started', 'Every day after']);
  assert.deepEqual(guideHeadings(undefined), []);
});

test('Swagger UI ids turn whitespace into underscores', () => {
  assert.equal(swaggerDomId('Activity Log'), 'Activity_Log');
  assert.equal(swaggerDomId('getHealth'), 'getHealth');
});

test('deep links match Swagger UI deep linking', () => {
  assert.equal(deepLink('Activity Log', 'uploadActivity'), '#/Activity%20Log/uploadActivity');
  assert.equal(deepLink('Platform'), '#/Platform');
});

test('contents: guide, tags in spec order with their operations, schema count', () => {
  assert.deepEqual(tocEntries(SPEC), {
    guide: ['Title', 'Getting started', 'Every day after'],
    tags: [
      {
        name: 'Platform',
        operations: [{ method: 'get', path: '/v1/health', summary: 'Liveness', operationId: 'getHealth' }],
      },
      {
        name: 'Activity Log',
        operations: [
          { method: 'put', path: '/v1/activities/{id}', summary: 'Upload', operationId: 'putActivity' },
          { method: 'delete', path: '/v1/activities/{id}', summary: '', operationId: 'deleteActivity' },
        ],
      },
    ],
    schemas: 2,
  });
});

test('the real spec: every operation is in the contents once', async () => {
  const spec = JSON.parse(await readFile(new URL('../../apps/api/openapi.json', import.meta.url), 'utf8'));
  const { guide, tags } = tocEntries(spec);
  assert.ok(guide.includes('Getting started'));
  const listed = tags.flatMap((tag) => tag.operations.map((operation) => operation.operationId));
  const all = Object.values(spec.paths).flatMap((item) =>
    Object.values(item).filter((operation) => operation?.operationId && operation.tags?.length)
  );
  assert.equal(listed.length, all.length);
});
