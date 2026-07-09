import { ProviderFailureError } from './errors.js';

/** Identifies this project to OSM-based public APIs, per their usage policies. */
export const USER_AGENT =
  'lboa/0.1 (github.com/ClaudeTest008/local-business-profitability-analyzer-V2)';

export interface FetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

export interface FetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/** Structural fetch so tests inject a plain function; no DOM lib types required. */
export type FetchLike = (url: string, init: FetchInit) => Promise<FetchResponse>;

export const defaultFetch: FetchLike = (url, init) => {
  const f = (globalThis as { fetch?: FetchLike }).fetch;
  if (!f) throw new ProviderFailureError('global fetch is unavailable; inject fetchFn');
  return f(url, init);
};

/** Shared HTTP-to-JSON helper: sets the User-Agent, applies a timeout, checks the status. */
export async function fetchJson(
  fetchFn: FetchLike,
  url: string,
  init: FetchInit,
  timeoutMs: number,
  label: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const res = await fetchFn(url, {
    ...init,
    headers: { 'User-Agent': USER_AGENT, ...init.headers },
    signal: combined,
  });
  if (!res.ok) throw new ProviderFailureError(`${label}: HTTP ${res.status} from ${url}`);
  return res.json();
}
