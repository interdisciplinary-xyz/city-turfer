import { defaultName, ENGLISH_DEFAULT_NAME_WORDS, partOfDay } from '../activity';

/** Local time today, like the phone reads it. */
const at = (h: number, m = 0) => new Date(2026, 0, 1, h, m).getTime();

describe('defaultName', () => {
  it('stays English by default, with the same hours as before', () => {
    expect(defaultName('run', at(4, 59))).toBe('Night run');
    expect(defaultName('run', at(5))).toBe('Morning run');
    expect(defaultName('walk', at(11, 59))).toBe('Morning walk');
    expect(defaultName('walk', at(12))).toBe('Afternoon walk');
    expect(defaultName('cycle', at(16, 59))).toBe('Afternoon ride');
    expect(defaultName('cycle', at(17))).toBe('Evening ride');
    expect(defaultName('run', at(20, 59))).toBe('Evening run');
    expect(defaultName('walk', at(21))).toBe('Night walk');
  });

  it('names the part of the day', () => {
    expect([at(0), at(6), at(13), at(18), at(23)].map(partOfDay)).toEqual([
      'night',
      'morning',
      'afternoon',
      'evening',
      'night',
    ]);
  });

  it('uses the words it is given, trimmed', () => {
    const calls: string[] = [];
    const words = (part: string, type: string) => {
      calls.push(`${part}/${type}`);
      return ` ${part}-${type} `;
    };
    expect(defaultName('cycle', at(22), words)).toBe('night-cycle');
    expect(calls).toEqual(['night/cycle']);
  });

  it('falls back to English when the words fail or give no usable name', () => {
    const throwing = () => {
      throw new Error('no catalogue');
    };
    expect(defaultName('run', at(7), throwing)).toBe('Morning run');
    expect(defaultName('run', at(7), () => '  ')).toBe('Morning run');
    expect(defaultName('run', at(7), () => 'x'.repeat(81))).toBe('Morning run');
  });

  it('exposes the English words', () => {
    expect(ENGLISH_DEFAULT_NAME_WORDS('evening', 'cycle')).toBe('Evening ride');
  });
});
