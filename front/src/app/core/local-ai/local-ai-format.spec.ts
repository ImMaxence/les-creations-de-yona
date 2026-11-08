import { afterEach, describe, expect, it, vi } from 'vitest';
import { TransferRate, formatDuration, isPhoneOrTablet } from './local-ai-format';

describe('formatDuration', () => {
  it('writes seconds, then minutes', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(120)).toBe('2 min');
    expect(formatDuration(185)).toBe('3 min 05');
  });
});

describe('TransferRate', () => {
  it('waits to have seen enough', () => {
    const rate = new TransferRate();
    rate.add(0, 0);
    rate.add(100, 1000);

    expect(rate.perSecond()).toBeNull();
  });

  it('measures the last seconds only', () => {
    const rate = new TransferRate();
    rate.add(0, 0);
    rate.add(1000, 1_000_000);
    // Slower from here: the first second is forgotten
    rate.add(7000, 2_000_000);
    rate.add(8000, 2_100_000);

    expect(rate.perSecond()).toBe(100_000);
  });
});

describe('isPhoneOrTablet', () => {
  afterEach(() => vi.unstubAllGlobals());

  const browser = (userAgent: string, platform: string, maxTouchPoints: number) => vi.stubGlobal('navigator', { userAgent, platform, maxTouchPoints });

  it('knows a phone', () => {
    browser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'iPhone', 5);
    expect(isPhoneOrTablet()).toBe(true);
  });

  it('knows an iPad, which says it is a Mac', () => {
    browser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5);
    expect(isPhoneOrTablet()).toBe(true);
  });

  it('leaves a Mac alone', () => {
    browser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0);
    expect(isPhoneOrTablet()).toBe(false);
  });
});
