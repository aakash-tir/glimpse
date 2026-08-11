import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchWithTimeout,
  DEFAULT_FETCH_TIMEOUT_MS,
} from '../../src/main/data/http';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchWithTimeout', () => {
  it('passes an AbortSignal to the underlying fetch and forwards the url', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', spy);

    await fetchWithTimeout('https://example.test/data.json', 5000);

    expect(spy).toHaveBeenCalledTimes(1);
    const [url, opts] = spy.mock.calls[0];
    expect(url).toBe('https://example.test/data.json');
    expect(opts.signal).toBeInstanceOf(AbortSignal);
    expect(opts.signal.aborted).toBe(false);
  });

  it('aborts the signal once the timeout elapses (hung request)', async () => {
    let captured: AbortSignal | undefined;
    // Never-resolving fetch to simulate a hung connection.
    vi.stubGlobal('fetch', (_url: string, opts: { signal: AbortSignal }) => {
      captured = opts.signal;
      return new Promise(() => {});
    });

    void fetchWithTimeout('https://example.test/hang', 10);
    await new Promise((r) => setTimeout(r, 30));

    expect(captured).toBeDefined();
    expect(captured?.aborted).toBe(true);
  });

  it('defaults to a 10s timeout', () => {
    expect(DEFAULT_FETCH_TIMEOUT_MS).toBe(10_000);
  });
});
