import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminSession } from '../auth/admin-session';
import { Toaster } from '../notifications/toaster';
import { adminErrorsInterceptor } from './admin-errors.interceptor';

describe('adminErrorsInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let toaster: Toaster;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([adminErrorsInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    toaster = TestBed.inject(Toaster);
  });

  async function failing(url: string, status: number, body: object | null = null): Promise<void> {
    const call = firstValueFrom(http.post(url, {})).catch(() => undefined);
    backend.expectOne(url).flush(body, { status, statusText: 'KO' });
    await call;
  }

  it('shows the API message of a back-office error, the messages included', async () => {
    await failing('/api/admin/messages', 429, { status: 429, detail: 'Beaucoup de messages d’un coup : patientez quelques secondes' });
    expect(toaster.toasts().map((toast) => toast.message)).toEqual(['Beaucoup de messages d’un coup : patientez quelques secondes']);
  });

  it('sends the admin back to the sign-in page when the session is over', async () => {
    const expire = vi.spyOn(TestBed.inject(AdminSession), 'expire').mockImplementation(() => undefined);
    await failing('/api/admin/messages/groups', 401);
    expect(expire).toHaveBeenCalled();
    expect(toaster.toasts()).toEqual([]);
  });

  it('leaves alone the session probe and the public API', async () => {
    const expire = vi.spyOn(TestBed.inject(AdminSession), 'expire');
    await failing('/api/admin/me', 401);
    await failing('/api/recipes', 500);
    expect(expire).not.toHaveBeenCalled();
    expect(toaster.toasts()).toEqual([]);
  });
});
