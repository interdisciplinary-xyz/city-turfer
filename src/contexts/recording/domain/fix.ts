/** One raw location reading from the device, before filtering. */
export interface Fix {
  readonly lat: number;
  readonly lon: number;
  readonly t: number; // epoch ms
  readonly accuracy: number | null;
  readonly alt: number | null;
  readonly speed: number | null; // m/s; null when unknown
}
