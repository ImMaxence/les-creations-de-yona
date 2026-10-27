import { KitchenAlarm } from './kitchen-alarm';

describe('KitchenAlarm', () => {
  const vibrate = vi.fn();

  beforeEach(() => {
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
  });

  afterEach(() => vibrate.mockReset());

  it('buzzes three times at each ring, for half a minute, within what browsers accept', () => {
    new KitchenAlarm().vibrate();
    const pattern = vibrate.mock.calls[0][0] as number[];
    // Chrome ignores a pattern of more than 128 values
    expect(pattern.length).toBeLessThanOrEqual(128);
    expect(pattern.slice(0, 6)).toEqual([60, 90, 60, 90, 60, 1140]);
    const total = pattern.reduce((sum, ms) => sum + ms, 0);
    expect(total).toBeGreaterThan(28_000);
    expect(total).toBeLessThanOrEqual(30_000);
  });

  it('stops buzzing', () => {
    new KitchenAlarm().stopVibrating();
    expect(vibrate).toHaveBeenCalledWith(0);
  });

  it('does nothing without the Web Audio API', () => {
    const alarm = new KitchenAlarm();
    expect(() => {
      alarm.unlock();
      alarm.schedule(0, 1000);
      alarm.ringNow(0);
      alarm.cancel(0);
      alarm.close();
    }).not.toThrow();
  });
});
