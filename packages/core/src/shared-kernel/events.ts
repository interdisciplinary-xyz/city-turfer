/** Published-language event: plain JSON, versioned, never carries entity instances. */
export interface DomainEvent<TType extends string = string> {
  readonly type: TType;
  readonly v: 1;
  readonly at: number; // epoch ms
}
