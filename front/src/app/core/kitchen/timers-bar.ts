import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Icon } from '../../shared/ui/icon/icon';
import { KitchenTimers, formatClock } from './kitchen-timers';

/**
 * The cooking mode closed, or left for another page, while timers run: they are shown at the
 * bottom of every page, each one back to its recipe and step with a tap, and the one ringing
 * stopped or given another minute from there.
 */
@Component({
  selector: 'yona-timers-bar',
  imports: [Icon],
  template: `
    @if (shown()) {
      <aside class="timers-bar" aria-label="Minuteurs du mode cuisine">
        <!-- After a reload: the timers go on, but the browser waits for a tap to play a sound -->
        @if (timers.soundAsleep()) {
          <button type="button" class="timers-bar__wake" (click)="timers.wakeSound()">
            <svg yonaIcon="bell-off" [size]="18"></svg>
            Touchez pour réactiver la sonnerie
          </button>
        }
        @if (timers.ringing(); as ringing) {
          <div class="timers-bar__ringing" role="alert">
            <svg yonaIcon="bell-ring" [size]="20"></svg>
            <span class="timers-bar__label">{{ ringing.title }} · étape {{ ringing.stepIndex + 1 }} : c'est prêt !</span>
            <div class="timers-bar__actions">
              <button type="button" class="timers-bar__more" (click)="timers.addMinute(ringing.key)">+ 1 min</button>
              <button type="button" class="timers-bar__stop" (click)="timers.stopRinging()">Arrêter</button>
            </div>
          </div>
        }
        @for (timer of timers.running(); track timer.key) {
          <button type="button" class="timers-bar__timer" (click)="timers.resume(timer)">
            <svg yonaIcon="timer" [size]="16"></svg>
            <span class="timers-bar__label">
              <span class="timers-bar__recipe">{{ timer.title }}</span>
              Étape {{ timer.stepIndex + 1 }} : {{ clock(timers.remainingMs(timer)) }}
            </span>
            <span class="timers-bar__resume">Reprendre</span>
          </button>
        }
      </aside>
    }
  `,
  styleUrl: './timers-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimersBar {
  protected readonly timers = inject(KitchenTimers);
  protected readonly clock = formatClock;
  protected readonly shown = computed(
    () => !this.timers.modeOpen() && (this.timers.running().length > 0 || this.timers.ringing() !== null),
  );
}
