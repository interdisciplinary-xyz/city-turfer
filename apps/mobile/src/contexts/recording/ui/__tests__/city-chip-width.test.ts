import { CITY_CHIP_MAX_SHARE, cityChipMaxWidth } from '../record-view.constants';

describe('cityChipMaxWidth', () => {
  it('keeps the 55% share on 375 pt and wider with the turf chip', () => {
    expect(cityChipMaxWidth(375, 125)).toBeCloseTo(375 * CITY_CHIP_MAX_SHARE);
    expect(cityChipMaxWidth(430, 125)).toBeCloseTo(430 * CITY_CHIP_MAX_SHARE);
  });

  it('leaves room for the chip column on a 320 pt screen', () => {
    const max = cityChipMaxWidth(320, 125);
    expect(max).toBe(320 - 12 - 12 - 8 - 125);
    expect(12 + max + 8 + 125 + 12).toBeLessThanOrEqual(320);
  });

  it('uses the share before the column has been laid out', () => {
    expect(cityChipMaxWidth(320, 0)).toBeCloseTo(320 * CITY_CHIP_MAX_SHARE);
  });

  it('never goes below zero', () => {
    expect(cityChipMaxWidth(200, 400)).toBe(0);
  });
});
