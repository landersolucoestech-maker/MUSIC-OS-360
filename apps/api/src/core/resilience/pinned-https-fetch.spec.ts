import * as net from 'node:net';
import { EventEmitter } from 'node:events';
import { createPublicOnlyLookup, UnsafeInputError } from './safe-url';
import { pinnedHttpsFetch } from './pinned-https-fetch';

const lookupOf = (resolve: (name: string) => Promise<string[]>) => createPublicOnlyLookup(resolve);
const callLookup = (lookup: ReturnType<typeof createPublicOnlyLookup>, options: unknown) =>
  new Promise<{ error: Error | null; address?: unknown; family?: number }>((done) => {
    const cb = (error: Error | null, address?: unknown, family?: number) => done({ error, address, family });
    if (options === undefined) lookup('abramus.example.test', cb as never);
    else lookup('abramus.example.test', options, cb);
  });

describe('createPublicOnlyLookup', () => {
  it('returns the validated public address with its family', async () => {
    expect(await callLookup(lookupOf(async () => ['93.184.216.34']), {})).toMatchObject({ error: null, address: '93.184.216.34', family: 4 });
    expect(await callLookup(lookupOf(async () => ['2606:4700::1111']), {})).toMatchObject({ address: '2606:4700::1111', family: 6 });
  });

  it('supports the callback-only and the all-addresses forms', async () => {
    expect(await callLookup(lookupOf(async () => ['93.184.216.34']), undefined)).toMatchObject({ address: '93.184.216.34' });
    const all = await callLookup(lookupOf(async () => ['93.184.216.34', '2606:4700::1111']), { all: true });
    expect(all.address).toEqual([{ address: '93.184.216.34', family: 4 }, { address: '2606:4700::1111', family: 6 }]);
  });

  it.each([['a private address', ['10.0.0.5']], ['one private among public answers', ['93.184.216.34', '169.254.169.254']], ['no answer', []]])(
    'refuses %s', async (_label, answers) => {
      const result = await callLookup(lookupOf(async () => answers), {});
      expect(result.error).toBeInstanceOf(UnsafeInputError);
      expect(result.address).toBeUndefined();
    });

  it('propagates a resolver failure', async () => {
    const result = await callLookup(lookupOf(async () => { throw new Error('ENOTFOUND'); }), {});
    expect(result.error?.message).toBe('ENOTFOUND');
  });

  it('judges every resolution: a name that answers public once and private next time is refused the second time', async () => {
    const answers = [['93.184.216.34'], ['127.0.0.1']];
    const lookup = lookupOf(async () => answers.shift() ?? []);
    expect((await callLookup(lookup, {})).error).toBeNull();
    expect((await callLookup(lookup, {})).error).toBeInstanceOf(UnsafeInputError);
  });
});

describe('pinnedHttpsFetch: a private resolution never opens a connection', () => {
  it('rejects and the loopback server receives nothing', async () => {
    let connections = 0;
    const server = net.createServer((socket) => { connections += 1; socket.destroy(); });
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
    const { port } = server.address() as net.AddressInfo;
    try {
      await expect(pinnedHttpsFetch(`https://rebind.example.test:${port}/x`, { method: 'POST', body: '{}' }, {
        lookup: lookupOf(async () => ['127.0.0.1']) as never,
        timeoutMs: 2000,
      })).rejects.toBeInstanceOf(UnsafeInputError);
      expect(connections).toBe(0);
    } finally {
      await new Promise<void>((ok) => server.close(() => ok()));
    }
  });

  it('refuses a non-https URL', async () => {
    await expect(pinnedHttpsFetch('http://abramus.example.test', {}, { lookup: lookupOf(async () => ['93.184.216.34']) as never, timeoutMs: 1000 }))
      .rejects.toThrow('https');
  });
});

describe('pinnedHttpsFetch: request and response handling', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const https = require('node:https') as typeof import('node:https');

  function fakeRequest(status: number, headers: Record<string, string | string[]>, body: Buffer[], mode: 'respond' | 'timeout' | 'hang' = 'respond') {
    const request = new EventEmitter() as EventEmitter & { write: jest.Mock; end: jest.Mock; destroy: jest.Mock };
    request.write = jest.fn();
    request.destroy = jest.fn((error?: Error) => { if (error) request.emit('error', error); });
    request.end = jest.fn();
    const spy = jest.spyOn(https, 'request').mockImplementation(((_url: unknown, _options: unknown, onResponse: (r: unknown) => void) => {
      const response = new EventEmitter() as EventEmitter & { statusCode: number; headers: Record<string, string | string[]> };
      response.statusCode = status;
      response.headers = headers;
      request.end.mockImplementation(() => {
        if (mode === 'timeout') { request.emit('timeout'); return; }
        if (mode === 'hang') return;
        onResponse(response);
        body.forEach((chunk) => response.emit('data', chunk));
        response.emit('end');
      });
      return request;
    }) as never);
    return { request, spy };
  }
  const options = { lookup: lookupOf(async () => ['93.184.216.34']) as never, timeoutMs: 1000 };
  afterEach(() => jest.restoreAllMocks());

  it('passes the lookup, method, headers and body through and returns a standard Response', async () => {
    const { request, spy } = fakeRequest(200, { 'content-type': 'application/json' }, [Buffer.from('{"token":'), Buffer.from('"t"}')]);
    const res = await pinnedHttpsFetch('https://abramus.example.test/api', { method: 'POST', headers: { a: 'b' }, body: '{"x":1}' }, options);
    const requestOptions = spy.mock.calls[0][1] as { lookup: unknown; method: string; headers: unknown; timeout: number };
    expect(requestOptions).toMatchObject({ lookup: options.lookup, method: 'POST', headers: { a: 'b' }, timeout: 1000 });
    expect(request.write).toHaveBeenCalledWith('{"x":1}');
    expect(res.ok).toBe(true);
    expect(await res.json()).toEqual({ token: 't' });
  });

  it('sends the body with its byte length, never chunked', async () => {
    const { spy } = fakeRequest(200, {}, [Buffer.from('{}')]);
    await pinnedHttpsFetch('https://abramus.example.test/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"name":"çã"}' }, options);
    const sent = (spy.mock.calls[0][1] as { headers: Record<string, string> }).headers;
    expect(sent['Content-Length']).toBe(String(Buffer.byteLength('{"name":"çã"}')));
    expect(sent['Content-Type']).toBe('application/json');
  });

  it('sends no Content-Length without a body', async () => {
    const { spy } = fakeRequest(200, {}, []);
    await pinnedHttpsFetch('https://abramus.example.test/api', { method: 'GET' }, options);
    expect((spy.mock.calls[0][1] as { headers: Record<string, string> }).headers['Content-Length']).toBeUndefined();
  });

  it('returns a redirect answer as is and never follows it', async () => {
    fakeRequest(307, { location: 'http://169.254.169.254/' }, []);
    const res = await pinnedHttpsFetch('https://abramus.example.test/api', {}, options);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://169.254.169.254/');
    expect(https.request).toHaveBeenCalledTimes(1);
  });

  it('handles an empty-body status', async () => {
    fakeRequest(204, {}, []);
    expect((await pinnedHttpsFetch('https://abramus.example.test/api', {}, options)).status).toBe(204);
  });

  it('aborts a response above the size cap', async () => {
    const { request } = fakeRequest(200, {}, [Buffer.alloc(20)]);
    await expect(pinnedHttpsFetch('https://abramus.example.test/api', {}, { ...options, maxBytes: 10 })).rejects.toThrow('larger than 10 bytes');
    expect(request.destroy).toHaveBeenCalled();
  });

  it('turns a socket timeout into a timeout error', async () => {
    fakeRequest(200, {}, [], 'timeout');
    await expect(pinnedHttpsFetch('https://abramus.example.test/api', {}, options)).rejects.toThrow('Timeout after 1000ms');
  });

  it.each([[100], [700]])('rejects an unsupported status %i', async (status) => {
    fakeRequest(status, {}, []);
    await expect(pinnedHttpsFetch('https://abramus.example.test/api', {}, options)).rejects.toThrow('Unsupported response status');
  });

  it('enforces a total deadline, so a slow drip cannot hold the request open', async () => {
    jest.useFakeTimers();
    try {
      const { request } = fakeRequest(200, {}, [], 'hang'); // the server never finishes and never goes idle
      const pending = pinnedHttpsFetch('https://abramus.example.test/api', {}, options);
      const assertion = expect(pending).rejects.toThrow('Timeout after 1000ms');
      jest.advanceTimersByTime(1001);
      await assertion;
      expect(request.destroy).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
