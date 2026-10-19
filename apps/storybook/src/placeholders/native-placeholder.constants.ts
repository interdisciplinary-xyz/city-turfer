export type NativePlaceholderProps = {
  /** What the real thing is, e.g. "Turf Map". */
  title: string;
  /** The native module it needs, e.g. "MapLibre". */
  module: string;
  /** Where it lives in the app and how to see it for real. */
  note: string;
  /** Height in points of the area it stands in for. */
  height?: number;
};
