import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  linkedSignal,
  signal,
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

  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  constructor() {
    afterNextRender(() => this.hydrated.set(true));
  }

  protected install(): void {
    void this.installPrompt.prompt();
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
