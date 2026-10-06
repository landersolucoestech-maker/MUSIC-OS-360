import * as https from 'node:https';

export const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export interface PinnedHttpsOptions {
  /** Connect-time DNS lookup (see `createPublicOnlyLookup`): the validated address is the connected one. */
  lookup: NonNullable<https.RequestOptions['lookup']>;
  timeoutMs: number;
  maxBytes?: number;
}

/**
 * HTTPS request whose DNS resolution is decided by the caller at connect time. Redirects are never followed (a 3xx
 * answer is returned as is), the body is capped, and the result is a standard `Response` so callers keep the `fetch`
 * contract. Used for tenant-configured endpoints, where a plain `fetch` would resolve the name a second time.
 */
export function pinnedHttpsFetch(url: string, init: RequestInit, options: PinnedHttpsOptions): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const target = new URL(url);
    if (target.protocol !== 'https:') {
      reject(new Error('pinned fetch requires https'));
      return;
    }
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
    const request = https.request(target, {
      method: init.method ?? 'GET',
      headers: (init.headers ?? {}) as Record<string, string>,
      lookup: options.lookup,
      timeout: options.timeoutMs,
    }, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          request.destroy(new Error(`Response larger than ${maxBytes} bytes`));
          return;
        }
        chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => {
        const status = response.statusCode ?? 0;
        const headers = new Headers();
        for (const [name, value] of Object.entries(response.headers)) {
          if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
        }
        const emptyBody = status === 204 || status === 205 || status === 304;
        resolve(new Response(emptyBody ? null : Buffer.concat(chunks), { status, headers }));
      });
    });
    request.on('timeout', () => request.destroy(new Error(`Timeout after ${options.timeoutMs}ms calling ${target.origin}`)));
    request.on('error', reject);
    if (init.body != null) request.write(init.body as string);
    request.end();
  });
}
