import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { YouTubeService } from './youtube.service';

/**
 * find-fec66ce8: YouTubeService called raw global fetch() with no timeout —
 * a hanging YouTube API call would block the request indefinitely. Now
 * routed through resilientFetch (10s AbortController + circuit breaker).
 */
describe('YouTubeService — guarded fetch (find-fec66ce8)', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ statistics: {}, snippet: {} }] }),
    });
    (global as any).fetch = fetchMock;
  });

  it('passes an AbortSignal to fetch (proves resilientFetch, not raw fetch, is used)', async () => {
    const config = { get: jest.fn().mockReturnValue('yt-key') } as unknown as ConfigService;
    const service = new YouTubeService(config);

    await service.getChannelStats('channel-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});
