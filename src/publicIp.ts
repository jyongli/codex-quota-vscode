import { isIP } from 'node:net';

export const PUBLIC_IP_URL = 'https://api64.ipify.org';
type Fetcher = typeof fetch;

/** Each extension host keeps its own bounded, in-memory cache. */
export function createPublicIpLookup(fetcher: Fetcher = (...args) => fetch(...args), now = Date.now,
  options: { timeoutMs?: number; cacheMs?: number; failureCacheMs?: number } = {}) {
  let cache: { value?: string; expiresAt: number } | undefined;
  return async (signal?: AbortSignal): Promise<string | undefined> => {
    if (signal?.aborted) return undefined;
    if (cache && cache.expiresAt > now()) return cache.value;
    const controller = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let stop!: () => void;
    const stopped = new Promise<undefined>(resolve => { stop = () => {
      controller.abort();
      void reader?.cancel().catch(() => {});
      resolve(undefined);
    }; });
    const timer = setTimeout(stop, options.timeoutMs ?? 3000);
    signal?.addEventListener('abort', stop, { once: true });
    const lookup = async () => {
      const response = await fetcher(PUBLIC_IP_URL, { signal: controller.signal, redirect: 'error', credentials: 'omit' });
      if (!response.ok || !response.body || controller.signal.aborted) {
        void response.body?.cancel().catch(() => {});
        return undefined;
      }
      reader = response.body.getReader();
      const parts: Buffer[] = [];
      let size = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 128) return undefined;
          parts.push(Buffer.from(chunk.value));
        }
        const value = Buffer.concat(parts).toString('utf8').trim();
        return isIP(value) ? value : undefined;
      } finally { void reader.cancel().catch(() => {}); }
    };
    try {
      const value = await Promise.race([lookup().catch(() => undefined), stopped]);
      if (!signal?.aborted) cache = { value, expiresAt: now() + (value ? options.cacheMs ?? 300000 : options.failureCacheMs ?? 30000) };
      return signal?.aborted ? undefined : value;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', stop);
      controller.abort();
    }
  };
}

export const getPublicIp = createPublicIpLookup();
