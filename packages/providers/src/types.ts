/** Injectable clock returning epoch milliseconds. Never call Date.now in this package. */
export type Clock = () => number;

/** A single upstream data source. Implementations here are the only network I/O in the system. */
export interface DataProvider<Req, Res> {
  id: string;
  fetch(req: Req, opts?: { signal?: AbortSignal }): Promise<Res>;
}
