import { SPACE } from '@cityturfer/brand';

import type { DistrictSelection, DistrictSelectionAction } from './districts-selection.constants';
import { DISTRICT_ROW } from './districts-view.constants';

/** The Districts screen's selection and list jumps (`useReducer`): pure, so Jest covers it. */
export function districtSelectionReducer(state: DistrictSelection, action: DistrictSelectionAction): DistrictSelection {
  const selected = state.selected === action.id ? null : action.id;
  if (action.type === 'toggle-row') {
    return { selected, scrollTo: null };
  }
  const index = selected ? action.districts.findIndex((d) => d.id === selected) : -1;
  return { selected, scrollTo: index >= 0 ? { index } : null };
}

/** A row's fixed height: border, padding and two lines of the name at the text size (`fontScale`). */
export function districtRowHeight(fontScale: number): number {
  return Math.ceil(
    2 * (DISTRICT_ROW.border + DISTRICT_ROW.paddingVertical) + 2 * DISTRICT_ROW.nameLine * Math.max(1, fontScale)
  );
}

/**
 * Where row `index` sits in the list (`getItemLayout`): after the list's top padding and the
 * measured header, one fixed slot (row and gap) per row, so `scrollToIndex` reaches any row.
 */
export function districtItemLayout(
  index: number,
  rowHeight: number,
  headerHeight: number
): { length: number; offset: number; index: number } {
  const slot = rowHeight + DISTRICT_ROW.gap;
  return { length: slot, offset: SPACE.md + headerHeight + slot * index, index };
}
