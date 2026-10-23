/** A check that cannot run yet against this server (route not built, or the fake lacks it). */
export interface Pending {
  pending: string;
}

export const isPending = (x: unknown): x is Pending => typeof x === 'object' && x != null && 'pending' in x;
