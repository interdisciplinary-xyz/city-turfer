import { describe, expect, it } from 'vitest';

import en from '../../../messages/en.json';
import pl from '../../../messages/pl.json';
import { PORTAL_ERROR_CODES, PortalError } from '../errors';

type Tree = { [key: string]: string | Tree };

const keys = (tree: Tree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : keys(value, `${prefix}${key}.`)
  );

const lookup = (tree: Tree, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>((node, key) => (node && typeof node === 'object' ? (node as Tree)[key] : undefined), tree);

/** The plan's banned vocabulary ("What the user sees"). */
const BANNED = /\b(territor\w*|score\w*|points?|conquer\w*|rank\w*|profile\w*|dashboard\w*|sync\w*)\b/i;

describe('portal copy', () => {
  it('has the same keys in English and Polish', () => {
    expect(keys(pl.portal as Tree).sort()).toEqual(keys(en.portal as Tree).sort());
  });

  it.each([...PORTAL_ERROR_CODES, 'generic', 'unreachable', 'signed-out'] as const)(
    'has a message for the error code %s in both languages',
    (code) => {
      const key = new PortalError(code).messageKey;
      expect(typeof lookup(en.portal as Tree, key)).toBe('string');
      expect(typeof lookup(pl.portal as Tree, key)).toBe('string');
    }
  );

  it('uses none of the banned words in English', () => {
    for (const key of keys(en.portal as Tree)) {
      expect(String(lookup(en.portal as Tree, key)), key).not.toMatch(BANNED);
    }
  });
});
