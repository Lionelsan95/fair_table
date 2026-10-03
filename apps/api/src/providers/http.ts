import { setTimeout as delay } from 'node:timers/promises';
export class ProviderError extends Error {
  constructor(public code: 'timeout' | 'unavailable' | 'invalid' | 'busy') {
    super(`Provider ${code}`);
  }
}
/** Shared per-process queue. Every attempt (including retries) obtains a slot. */
export class Limiter {
  private tail: Promise<unknown> = Promise.resolve();
  private nextStart = 0;
  private pending = 0;
  constructor(
    private intervalMs = 300,
    private maxQueue = 80,
  ) {}
  async run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (this.pending >= this.maxQueue) throw new ProviderError('busy');
    this.pending++;
    const work = this.tail
      .catch(() => undefined)
      .then(async () => {
        signal?.throwIfAborted();
        await delay(Math.max(0, this.nextStart - Date.now()), undefined, {
          signal,
        });
        this.nextStart = Date.now() + this.intervalMs;
        signal?.throwIfAborted();
        return task();
      });
    this.tail = work;
    try {
      return await work;
    } finally {
      this.pending--;
    }
  }
}
export async function fetchJson(
  url: string | URL,
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
    init?: RequestInit;
    limiter?: Limiter;
  } = {},
): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    options.signal?.throwIfAborted();
    let retryMs = 500 * 2 ** attempt;
    try {
      const response = await (options.limiter
        ? options.limiter.run(() => request(), options.signal)
        : request());
      if (response.ok) {
        try {
          return await response.json();
        } catch {
          throw new ProviderError('invalid');
        }
      }
      if (response.status !== 429 && response.status < 500)
        throw new ProviderError('unavailable');
      const retryAfter = response.headers.get('retry-after');
      if (retryAfter) {
        const seconds = Number(retryAfter);
        retryMs = Number.isFinite(seconds)
          ? seconds * 1000
          : Date.parse(retryAfter) - Date.now();
        if (retryMs > 3000) throw new ProviderError('busy');
        retryMs = Math.max(500, retryMs || 500);
      }
      if (attempt === 1)
        throw new ProviderError(
          response.status === 429 ? 'busy' : 'unavailable',
        );
    } catch (error) {
      if (options.signal?.aborted) throw options.signal.reason;
      if (error instanceof ProviderError) throw error;
      if (attempt === 1)
        throw new ProviderError(
          error instanceof Error &&
            ['TimeoutError', 'AbortError'].includes(error.name)
            ? 'timeout'
            : 'unavailable',
        );
    }
    await delay(retryMs, undefined, { signal: options.signal });
  }
  throw new ProviderError('unavailable');
  function request() {
    const timeout = AbortSignal.timeout(options.timeoutMs ?? 6000);
    return fetch(url, {
      ...options.init,
      signal: options.signal
        ? AbortSignal.any([options.signal, timeout])
        : timeout,
      headers: { Accept: 'application/json', ...options.init?.headers },
    });
  }
}
