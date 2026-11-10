import { shareBarWidth, shareText } from '../district-share';

describe('shareText', () => {
  it('reads none as 0% and a sliver as <1%, never as none', () => {
    expect(shareText(0, 'en')).toBe('0%');
    expect(shareText(0.0004, 'en')).toBe('<1%');
  });

  it('rounds to whole percent, capped at 100%', () => {
    expect(shareText(0.044, 'en')).toBe('4%');
    expect(shareText(0.125, 'pl')).toBe('13%');
    expect(shareText(1.2, 'en')).toBe('100%');
  });

  it('treats NaN as none', () => {
    expect(shareText(Number.NaN, 'en')).toBe('0%');
  });
});

describe('shareBarWidth', () => {
  it('fills by share, with a minimum sliver for any turf and none without', () => {
    expect(shareBarWidth(0, 2)).toBe('0%');
    expect(shareBarWidth(0.001, 2)).toBe('2%');
    expect(shareBarWidth(0.25, 2)).toBe('25%');
    expect(shareBarWidth(3, 2)).toBe('100%');
  });
});
