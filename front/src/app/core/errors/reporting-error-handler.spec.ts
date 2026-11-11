import { HttpErrorResponse } from '@angular/common/http';
import { browserError } from './reporting-error-handler';

describe('browserError', () => {
  it('sends the message, the stack and the page', () => {
    const error = new TypeError('x is undefined');

    const report = browserError(error, '/recettes/tartes/tarte-au-citron');

    expect(report?.message).toBe('TypeError: x is undefined');
    expect(report?.detail).toContain('x is undefined');
    expect(report?.page).toBe('/recettes/tartes/tarte-au-citron');
  });

  it('leaves the failed requests to the backend', () => {
    expect(browserError(new HttpErrorResponse({ status: 500 }), '/')).toBeNull();
  });

  it('names what is not an Error', () => {
    expect(browserError('broken', '/')?.message).toBe('broken');
    expect(browserError('x'.repeat(3000), '/')?.message).toHaveLength(2000);
  });
});
