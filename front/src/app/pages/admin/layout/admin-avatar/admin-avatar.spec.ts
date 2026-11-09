import { TestBed } from '@angular/core/testing';
import { AdminAvatar, initialOf } from './admin-avatar';

describe('initialOf', () => {
  it('gives the first letter in capitals', () => {
    expect(initialOf('maxence')).toBe('M');
    expect(initialOf('  élodie')).toBe('É');
  });

  it('has something to show without a name', () => {
    expect(initialOf('   ')).toBe('?');
  });
});

describe('AdminAvatar', () => {
  async function avatar(picture: string | null) {
    const fixture = TestBed.createComponent(AdminAvatar);
    fixture.componentRef.setInput('name', 'yona');
    fixture.componentRef.setInput('picture', picture);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('shows the photo of the account', async () => {
    const { element } = await avatar('https://lh3.googleusercontent.com/a/photo');
    const image = element.querySelector('img')!;
    expect(image.getAttribute('src')).toBe('https://lh3.googleusercontent.com/a/photo');
    expect(image.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('shows the first letter without a photo', async () => {
    const { element } = await avatar(null);
    expect(element.querySelector('img')).toBeNull();
    expect(element.textContent?.trim()).toBe('Y');
  });

  it('falls back on the first letter when the photo does not load', async () => {
    const { fixture, element } = await avatar('https://lh3.googleusercontent.com/a/photo');
    element.querySelector('img')!.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(element.querySelector('img')).toBeNull();
    expect(element.textContent?.trim()).toBe('Y');
  });
});
