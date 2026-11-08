import { describe, expect, it } from 'vitest';
import { Recaptcha, loadRecaptcha } from './recaptcha';

const scripts = () => [...document.head.querySelectorAll<HTMLScriptElement>('script[src*="recaptcha"]')];

describe('loadRecaptcha', () => {
  it('tries again after a failure', async () => {
    const failed = loadRecaptcha(document);
    scripts()[0].dispatchEvent(new Event('error'));

    await expect(failed).rejects.toThrow();
    expect(scripts()).toHaveLength(0);
  });

  it('adds the script once and gives Google once it is ready', async () => {
    const first = loadRecaptcha(document);
    const second = loadRecaptcha(document);
    const fake = { render: () => 1, reset: () => undefined } as Recaptcha;
    const view = window as unknown as { grecaptcha: Recaptcha; yonaRecaptchaReady: () => void };

    view.grecaptcha = fake;
    view.yonaRecaptchaReady();

    expect(scripts()).toHaveLength(1);
    expect(scripts()[0].src).toContain('render=explicit');
    expect(await first).toBe(fake);
    expect(await second).toBe(fake);
  });
});
