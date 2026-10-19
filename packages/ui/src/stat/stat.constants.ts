export type StatProps = {
  /** Uppercase caption under the number, e.g. "Distance". */
  label: string;
  /** Already formatted (units converted in the app's formatting, not here). */
  value: string;
  unit?: string;
  /** The hero number of a screen (live recording). */
  big?: boolean;
  testID?: string;
};
