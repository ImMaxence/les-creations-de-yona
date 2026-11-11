import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { isPhoneOrTablet } from '../../../core/local-ai/local-ai-format';
import { SPEECH_MODEL } from '../../../core/local-ai/local-models';
import { missingFiles, webGpuProblem } from '../../../core/local-ai/model-store';
import { Recording, SpeechProgress, transcribeLocally } from '../../../core/local-ai/transcribe-locally';
import { AiLogo } from '../ai-logo/ai-logo';
import { Button } from '../button/button';
import { Icon } from '../icon/icon';
import { LocalModelSetup } from '../local-model-setup/local-model-setup';

/** A dictation stops by itself after that: Whisper hears it all, the computer stays responsive. */
const MAX_SECONDS = 5 * 60;

type State = 'idle' | 'setup' | 'recording' | 'transcribing';

/** Bars of the spectrum drawn while it records. */
const BARS = 28;

/** The bands the bars are made of: the voice, up to about 6 kHz (the first one, the hum, left out). */
const VOICE_BANDS = 32;

/** Below this, a bar is silence (0 to 1). */
const QUIET_LEVEL = 0.08;

/** Silence that long: the microphone probably hears nothing. */
const QUIET_MS = 3000;

/**
 * The height of each bar, from 0 to 1: the bands of the voice (the first ones), grouped evenly,
 * each bar the average of its group.
 */
export function spectrumBars(frequencies: ArrayLike<number>, bars = BARS, voiceBands = VOICE_BANDS): number[] {
  const usable = Math.min(voiceBands, frequencies.length - 1);
  return Array.from({ length: bars }, (_, bar) => {
    const from = 1 + Math.floor((bar * usable) / bars);
    const to = Math.max(from + 1, 1 + Math.floor(((bar + 1) * usable) / bars));
    let sum = 0;
    for (let band = from; band < to; band++) {
      sum += frequencies[band] ?? 0;
    }
    return sum / (to - from) / 255;
  });
}

/** "Le micro est refusé…": why the microphone could not be used, in French. */
export function microphoneProblem(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Le micro est refusé : autorisez-le pour ce site (icône à gauche de l’adresse), puis réessayez';
  }
  if (name === 'NotFoundError') {
    return 'Aucun micro trouvé sur cet ordinateur';
  }
  return 'La dictée n’a pas pu être écrite : réessayez, en fermant les applications lourdes';
}

/**
 * "Dicter": the admin speaks, Whisper writes it down on this computer (nothing leaves it), and the
 * text goes into the field; the AI chosen reads it when asked, as typed text. The model is
 * downloaded once (about 570 MB). On a phone, the microphone of the keyboard does the same.
 */
@Component({
  selector: 'yona-dictation',
  imports: [AiLogo, Button, Icon, LocalModelSetup],
  template: `
    @if (!onPhone) {
      <div class="dictation">
        @switch (state()) {
          @case ('recording') {
            <button yonaButton type="button" (click)="stop()"><svg yonaIcon="square"></svg>Terminer la dictée</button>
            <span class="dictation__live" role="status"><span class="dictation__dot" aria-hidden="true"></span>J’écoute… {{ elapsed() }}</span>
            <!-- What the microphone hears, live: the bars move with the voice -->
            <canvas #spectrum class="dictation__spectrum" aria-hidden="true"></canvas>
            <button yonaButton variant="ghost" type="button" (click)="cancel()">Annuler</button>
          }
          @case ('transcribing') {
            <span class="dictation__live" role="status"><svg yonaIcon="loader-circle" class="spin" [size]="18"></svg>{{ progressText() }}</span>
            <button yonaButton variant="ghost" type="button" (click)="cancel()">Arrêter</button>
          }
          @default {
            <button yonaButton variant="secondary" type="button" [disabled]="disabled()" (click)="start()">
              <svg yonaIcon="mic"></svg>Dicter
            </button>
            <span class="dictation__by"><yona-ai-logo name="openai" [size]="14" />{{ model.name }}, sur cet ordinateur : rien n’est envoyé</span>
          }
        }
      </div>
      @if (state() === 'recording' && quiet()) {
        <p class="dictation__hint" role="status">Le micro ne capte rien : vérifiez qu’il est branché, pas coupé, et que c’est le bon (icône à gauche de l’adresse)</p>
      }
      @if (state() === 'setup') {
        <yona-local-model-setup [localModel]="model" [(ready)]="ready" />
      }
      @if (problem(); as message) {
        <p class="dictation__problem" role="alert"><svg yonaIcon="circle-alert" [size]="16"></svg>{{ message }}</p>
      }
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-2);
    }

    .dictation {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2) var(--space-3);
    }

    .dictation__by {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .dictation__live {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-sm);
      font-weight: 600;
    }

    /* The red of a recording, breathing */
    .dictation__dot {
      width: 0.65rem;
      height: 0.65rem;
      border-radius: 50%;
      background-color: var(--color-danger);
      animation: breathe 1s var(--ease-in-out) infinite alternate;
    }

    @keyframes breathe {
      to {
        opacity: 0.35;
      }
    }

    /* The bars, in the accent colour (read by the drawing as the canvas's colour) */
    .dictation__spectrum {
      width: 9rem;
      height: 2rem;
      color: var(--color-accent);
    }

    .dictation__hint {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .dictation__problem {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-sm);
      color: var(--color-danger);
    }

    .spin {
      animation: spin 900ms linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dictation {
  /** While the AI works: no dictation. */
  readonly disabled = input(false);
  /** What was said, written down: added to the field. */
  readonly transcribed = output<string>();

  protected readonly onPhone = isPhoneOrTablet();
  protected readonly model = SPEECH_MODEL;
  protected readonly state = signal<State>('idle');
  protected readonly ready = signal(false);
  protected readonly problem = signal<string | null>(null);
  private readonly seconds = signal(0);
  private readonly progress = signal<SpeechProgress | null>(null);
  /** Nothing heard for a few seconds while it records. */
  protected readonly quiet = signal(false);
  private readonly spectrum = viewChild<ElementRef<HTMLCanvasElement>>('spectrum');
  private frame = 0;
  private lastSoundAt = 0;
  protected readonly elapsed = computed(() => {
    const seconds = this.seconds();
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  });
  protected readonly progressText = computed(() => {
    const progress = this.progress();
    if (progress?.type === 'files' && progress.share < 1) {
      return `Ouverture du modèle, ${Math.round(progress.share * 100)} %`;
    }
    return progress?.type === 'listening' ? 'Écriture de ce que vous avez dit…' : 'Installation dans la carte graphique…';
  });

  private recording: Recording | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private controller: AbortController | null = null;

  constructor() {
    // Downloaded: back to "Dicter", the next tap records
    effect(() => {
      if (this.ready() && untracked(() => this.state()) === 'setup') {
        untracked(() => this.state.set('idle'));
      }
    });
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  protected async start(): Promise<void> {
    this.problem.set(null);
    const unsupported = await webGpuProblem();
    if (unsupported) {
      this.problem.set(unsupported);
      return;
    }
    if ((await missingFiles(SPEECH_MODEL)).length) {
      this.state.set('setup');
      return;
    }
    try {
      this.recording = await Recording.start();
    } catch (error) {
      this.problem.set(microphoneProblem(error));
      return;
    }
    this.seconds.set(0);
    this.quiet.set(false);
    this.lastSoundAt = Date.now();
    this.state.set('recording');
    this.frame = requestAnimationFrame(() => this.draw());
    this.timer = setInterval(() => {
      this.seconds.update((seconds) => seconds + 1);
      if (this.seconds() >= MAX_SECONDS) {
        void this.stop();
      }
    }, 1000);
  }

  /** One frame of the spectrum, then the next, while it records. */
  private draw(): void {
    const recording = this.recording;
    if (!recording || this.state() !== 'recording') {
      return;
    }
    this.frame = requestAnimationFrame(() => this.draw());
    const canvas = this.spectrum()?.nativeElement;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      // Not drawn yet: the next frame will find it
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const frequencies = new Uint8Array(recording.bands);
    recording.frequencies(frequencies);
    const bars = spectrumBars(frequencies);
    if (bars.some((level) => level > QUIET_LEVEL)) {
      this.lastSoundAt = Date.now();
    }
    this.quiet.set(Date.now() - this.lastSoundAt > QUIET_MS);
    context.clearRect(0, 0, width, height);
    context.fillStyle = getComputedStyle(canvas).color;
    const slot = width / bars.length;
    const barWidth = Math.max(1, slot * 0.6);
    bars.forEach((level, index) => {
      // Never quite flat: a row of dots says it listens, even in silence
      const barHeight = Math.max(barWidth, level * height);
      context.beginPath();
      context.roundRect(index * slot + (slot - barWidth) / 2, (height - barHeight) / 2, barWidth, barHeight, barWidth / 2);
      context.fill();
    });
  }

  protected async stop(): Promise<void> {
    const recording = this.recording;
    clearInterval(this.timer);
    cancelAnimationFrame(this.frame);
    if (!recording) {
      return;
    }
    this.recording = null;
    this.state.set('transcribing');
    this.progress.set(null);
    this.controller = new AbortController();
    try {
      const audio = await recording.stop();
      const text = await transcribeLocally(audio, (progress) => this.progress.set(progress), this.controller.signal);
      if (text) {
        this.transcribed.emit(text);
      } else {
        this.problem.set('Rien entendu : parlez plus près du micro, puis réessayez');
      }
    } catch (error) {
      if (!this.controller.signal.aborted) {
        console.error(error);
        this.problem.set(microphoneProblem(error));
      }
    } finally {
      this.controller = null;
      this.state.set('idle');
    }
  }

  protected cancel(): void {
    clearInterval(this.timer);
    cancelAnimationFrame(this.frame);
    this.recording?.release();
    this.recording = null;
    this.controller?.abort();
    if (this.state() !== 'setup') {
      this.state.set('idle');
    }
  }
}
