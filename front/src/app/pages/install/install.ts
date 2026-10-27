import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  linkedSignal,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { DevicePlatform, InstallPrompt } from '../../core/pwa/install-prompt';
import { Button } from '../../shared/ui/button/button';
import { NotifyButton } from '../../shared/ui/notify-button/notify-button';
import { Icon } from '../../shared/ui/icon/icon';

interface PlatformTab {
  id: DevicePlatform;
  label: string;
}

@Component({
  selector: 'yona-install',
  imports: [Icon, Button, NotifyButton],
  templateUrl: './install.html',
  styleUrl: './install.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Install {
  private readonly installPrompt = inject(InstallPrompt);

  protected readonly tabs: PlatformTab[] = [
    { id: 'ios', label: 'iPhone et iPad' },
    { id: 'android', label: 'Android' },
    { id: 'desktop', label: 'Ordinateur' },
  ];

  /** Browser state is only read once hydrated: the first render matches the server's. */
  private readonly hydrated = signal(false);
  protected readonly installed = computed(() => this.hydrated() && this.installPrompt.installed());
  protected readonly canPrompt = computed(() => this.hydrated() && this.installPrompt.canPrompt());
  /** The visitor's own device first, once known. */
  protected readonly activeTab = linkedSignal<DevicePlatform>(() =>
    this.hydrated() ? (this.installPrompt.platform() ?? 'ios') : 'ios',
  );

  protected readonly inAppBrowser = computed(() => (this.hydrated() ? this.installPrompt.inAppBrowser() : null));
  /** Shown under the big button when the browser cannot install in one tap: the steps follow. */
  protected readonly guideHint = signal<string | null>(null);

  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');
  private readonly guide = viewChild.required<ElementRef<HTMLElement>>('guide');

  constructor() {
    afterNextRender(() => this.hydrated.set(true));
  }

  /**
   * "Télécharger l'application": the browser's own install window where it has one (Chrome, Edge,
   * Android), the app then lands on the home screen. Safari has none, nor any way for a site to
   * open it: the steps for the visitor's device are shown instead, two taps.
   */
  protected async install(): Promise<void> {
    if (this.canPrompt()) {
      this.guideHint.set(null);
      await this.installPrompt.prompt();
      return;
    }
    const platform = this.installPrompt.platform() ?? 'desktop';
    this.activeTab.set(platform);
    const app = this.inAppBrowser();
    this.guideHint.set(
      app
        ? `Vous êtes dans le navigateur d'${app}, qui ne sait pas installer d'application : ouvrez d'abord cette page dans ${platform === 'ios' ? 'Safari' : 'Chrome'}, puis suivez les étapes ci-dessous`
        : platform === 'ios'
          ? "Sur iPhone et iPad, Apple ne permet pas l'installation en un seul bouton : deux gestes dans Safari suffisent, expliqués ci-dessous"
          : 'Votre navigateur ne propose pas encore l’installation directe : suivez les étapes ci-dessous, cela prend dix secondes',
    );
    const guide = this.guide().nativeElement;
    guide.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    guide.focus({ preventScroll: true });
  }

  /** ARIA tabs: arrows move between tabs, Home and End go to the first and last one. */
  protected onTabKeydown(event: KeyboardEvent, index: number): void {
    const last = this.tabs.length - 1;
    const targets: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const target = targets[event.key];
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    this.activeTab.set(this.tabs[target].id);
    this.tabButtons()[target].nativeElement.focus();
  }
}
