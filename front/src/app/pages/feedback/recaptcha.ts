const READY_CALLBACK = 'yonaRecaptchaReady';
const SCRIPT = `https://www.google.com/recaptcha/api.js?render=explicit&hl=fr&onload=${READY_CALLBACK}`;

/** Its second script can be blocked with no error on the first one: nothing would ever say so. */
export const LOAD_TIMEOUT_MS = 15_000;

export interface RecaptchaOptions {
  sitekey: string;
  theme: 'light' | 'dark';
  size: 'normal' | 'compact';
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
}

export interface Recaptcha {
  render(container: HTMLElement, options: RecaptchaOptions): number;
  reset(widget: number): void;
}

type RecaptchaWindow = Window & { grecaptcha?: Recaptcha; [READY_CALLBACK]?: () => void };

let loading: Promise<Recaptcha> | null = null;

/** Google's script, added once per visit; tried again after a failure. */
export function loadRecaptcha(document: Document): Promise<Recaptcha> {
  loading ??= new Promise<Recaptcha>((resolve, reject) => {
    const view = document.defaultView as RecaptchaWindow;
    const script = document.createElement('script');
    const fail = () => {
      view.clearTimeout(timer);
      loading = null;
      script.remove();
      reject(new Error('reCAPTCHA could not be loaded'));
    };
    const timer = view.setTimeout(fail, LOAD_TIMEOUT_MS);
    view[READY_CALLBACK] = () => {
      view.clearTimeout(timer);
      resolve(view.grecaptcha!);
    };
    script.async = true;
    script.src = SCRIPT;
    script.onerror = fail;
    document.head.append(script);
  });
  return loading;
}
