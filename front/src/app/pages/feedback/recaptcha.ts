const READY_CALLBACK = 'yonaRecaptchaReady';
const SCRIPT = `https://www.google.com/recaptcha/api.js?render=explicit&hl=fr&onload=${READY_CALLBACK}`;

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

/** Google's script, added on the visitor's click only, once per visit; tried again after a failure. */
export function loadRecaptcha(document: Document): Promise<Recaptcha> {
  loading ??= new Promise<Recaptcha>((resolve, reject) => {
    const view = document.defaultView as RecaptchaWindow;
    view[READY_CALLBACK] = () => resolve(view.grecaptcha!);
    const script = document.createElement('script');
    script.async = true;
    script.src = SCRIPT;
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error('reCAPTCHA could not be loaded'));
    };
    document.head.append(script);
  });
  return loading;
}
