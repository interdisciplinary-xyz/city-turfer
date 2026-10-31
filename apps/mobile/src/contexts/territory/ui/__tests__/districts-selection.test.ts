import { SPACE } from '@cityturfer/brand';

import { districtItemLayout, districtRowHeight, districtSelectionReducer } from '../districts-selection';
import { type DistrictSelection, NO_DISTRICT_SELECTED } from '../districts-selection.constants';
import { DISTRICT_ROW } from '../districts-view.constants';

const DISTRICTS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('districtSelectionReducer (Districts screen selection)', () => {
  it('opens on the whole city, nothing to scroll to', () => {
    expect(NO_DISTRICT_SELECTED).toEqual({ selected: null, scrollTo: null });
  });

  it('a row tap selects the row without scrolling (it is on screen)', () => {
    expect(districtSelectionReducer(NO_DISTRICT_SELECTED, { type: 'toggle-row', id: 'b' })).toEqual({
      selected: 'b',
      scrollTo: null,
    });
  });

  it('a second tap on the selected row goes back to the city', () => {
    const s: DistrictSelection = { selected: 'b', scrollTo: null };
    expect(districtSelectionReducer(s, { type: 'toggle-row', id: 'b' })).toEqual(NO_DISTRICT_SELECTED);
  });

  it('a tap on another row moves the selection', () => {
    const s: DistrictSelection = { selected: 'b', scrollTo: null };
    expect(districtSelectionReducer(s, { type: 'toggle-row', id: 'c' }).selected).toBe('c');
  });

  it('a map tap selects the district and asks the list for its row', () => {
    expect(districtSelectionReducer(NO_DISTRICT_SELECTED, { type: 'tap-map', id: 'c', districts: DISTRICTS })).toEqual({
      selected: 'c',
      scrollTo: { index: 2 },
    });
  });

  it('a map tap on the selected district goes back to the city and scrolls nowhere', () => {
    const s: DistrictSelection = { selected: 'c', scrollTo: { index: 2 } };
    expect(districtSelectionReducer(s, { type: 'tap-map', id: 'c', districts: DISTRICTS })).toEqual(
      NO_DISTRICT_SELECTED
    );
  });

  it('picking the same district again asks for a fresh jump (a new request object)', () => {
    const first = districtSelectionReducer(NO_DISTRICT_SELECTED, { type: 'tap-map', id: 'a', districts: DISTRICTS });
    const off = districtSelectionReducer(first, { type: 'tap-map', id: 'a', districts: DISTRICTS });
    const again = districtSelectionReducer(off, { type: 'tap-map', id: 'a', districts: DISTRICTS });
    expect(again.scrollTo).toEqual({ index: 0 });
    expect(again.scrollTo).not.toBe(first.scrollTo);
  });

  it('a map tap on a district missing from the list selects it but scrolls nowhere', () => {
    expect(districtSelectionReducer(NO_DISTRICT_SELECTED, { type: 'tap-map', id: 'zz', districts: DISTRICTS })).toEqual(
      {
        selected: 'zz',
        scrollTo: null,
      }
    );
  });

  it('never changes the state it was given', () => {
    const s: DistrictSelection = { selected: 'a', scrollTo: { index: 0 } };
    const frozen = JSON.stringify(s);
    districtSelectionReducer(s, { type: 'tap-map', id: 'b', districts: DISTRICTS });
    districtSelectionReducer(s, { type: 'toggle-row', id: 'a' });
    expect(JSON.stringify(s)).toBe(frozen);
  });
});

describe('district row layout (getItemLayout)', () => {
  const base = 2 * (DISTRICT_ROW.border + DISTRICT_ROW.paddingVertical) + 2 * DISTRICT_ROW.nameLine;

  it('holds two lines of the name, growing with the text size but never below scale 1', () => {
    expect(districtRowHeight(1)).toBe(base);
    expect(districtRowHeight(0.8)).toBe(base);
    expect(districtRowHeight(1.5)).toBe(Math.ceil(base + DISTRICT_ROW.nameLine));
  });

  it('places row n after the top padding, the header and n slots of row + gap', () => {
    const row = districtRowHeight(1);
    const slot = row + DISTRICT_ROW.gap;
    expect(districtItemLayout(0, row, 80)).toEqual({ length: slot, offset: SPACE.md + 80, index: 0 });
    expect(districtItemLayout(7, row, 80)).toEqual({ length: slot, offset: SPACE.md + 80 + 7 * slot, index: 7 });
  });
});
