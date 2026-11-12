import { DOCUMENT, DestroyRef, ErrorHandler, Injectable, Injector, inject, signal } from '@angular/core';
import { Api } from '../../../core/api/generated/api';
import { sayMessageTyping } from '../../../core/api/generated/fn/admin-messages/say-message-typing';

/** What changed, as the backend says it (fr.lescreationsdeyona.live.LiveTopic). */
export type LiveTopic = 'FEEDBACK' | 'ORDERS' | 'HISTORY' | 'TRASH' | 'LOGS' | 'MESSAGES';

const TOPICS = new Set<string>(['FEEDBACK', 'ORDERS', 'HISTORY', 'TRASH', 'LOGS', 'MESSAGES']);

/** Waits before connecting again, longer each time the backend is out of reach. */
const RETRY_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

/** WebSocket.OPEN. */
const OPEN = 1;

/** The WebSocket cut: what changes is asked this often instead (the messages), and everything 8 times less often. */
const POLL_MS = 4_000;
const POLLS_PER_ROUND = 8;
/** The page out of sight (another tab): the messages every 16 seconds, for their sound. */
const HIDDEN_EVERY = 4;

/** Failed this many times in a row without ever opening: told in "Journaux", once. */
const FAILURES_TOLD = 3;

/** Several changes at once (20 photos to the trash) give one question to the API. */
const GROUPED_MS = 300;

type Listener = (topic: LiveTopic) => void;

/** "est en train d'écrire…": an admin writing in a group, as the backend tells the other members. */
export interface Typing {
  group: number;
  email: string;
  name: string | null;
}

type TypingListener = (typing: Typing) => void;

/**
 * The back-office in real time: one WebSocket per open back-office (/api/admin/live, the session's
 * cookie), told by the backend what another admin, a visitor or the site just changed. The badges of
 * the menu, and the page open when it is about it, ask their own counts and lists again. Connected
 * again on its own after a cut (phone asleep, backend restarted), every listener told then: what came
 * meanwhile was missed. While it is cut (or never connects: a proxy that refuses WebSockets), the
 * listeners are told every few seconds instead, as if something had changed, and "est en train
 * d'écrire" goes over HTTP: the page stays up to date, a little later.
 */
@Injectable({ providedIn: 'root' })
export class AdminLive {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  /** The WebSocket open: changes told at once. */
  readonly connected = signal(false);
  private readonly listeners = new Map<LiveTopic | '*', Set<Listener>>();
  private readonly typingListeners = new Set<TypingListener>();
  private readonly waiting = new Map<LiveTopic, ReturnType<typeof setTimeout>>();
  private socket: WebSocket | null = null;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private attempts = 0;
  private started = false;
  private poll: ReturnType<typeof setInterval> | undefined;
  private polls = 0;
  private everOpened = false;
  private failuresTold = false;

  /** Opened with the back-office; nothing in a browser without WebSocket (tests). */
  start(): void {
    if (this.started || typeof WebSocket === 'undefined') {
      return;
    }
    this.started = true;
    this.connect();
    this.poll = setInterval(() => this.pollWhileCut(), POLL_MS);
  }

  /** The back-office closed (signed out): no reconnection. */
  stop(): void {
    this.started = false;
    this.connected.set(false);
    clearTimeout(this.retry);
    clearInterval(this.poll);
    this.waiting.forEach((timer) => clearTimeout(timer));
    this.waiting.clear();
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }

  /**
   * {@code listener} called after each change of {@code topic} ("*" for every one), until the
   * component or service it is called from is destroyed.
   */
  on(topic: LiveTopic | '*', listener: Listener, destroyRef = inject(DestroyRef)): void {
    const set = this.listeners.get(topic) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(topic, set);
    destroyRef.onDestroy(() => set.delete(listener));
  }

  /** Each "est en train d'écrire…" of another admin, as it comes (not grouped), until destroyed. */
  onTyping(listener: TypingListener, destroyRef = inject(DestroyRef)): void {
    this.typingListeners.add(listener);
    destroyRef.onDestroy(() => this.typingListeners.delete(listener));
  }

  /** This admin writes in a group: told to its other members, through the WebSocket or else over HTTP. */
  typing(group: number): void {
    if (this.socket?.readyState === OPEN) {
      this.socket.send(JSON.stringify({ typing: group }));
    } else {
      this.injector.get(Api).invoke(sayMessageTyping, { group }).catch(() => undefined);
    }
  }

  private connect(): void {
    const location = this.document.location;
    let socket: WebSocket;
    try {
      socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/admin/live`);
    } catch {
      // Refused at once (a browser's security rules): the badges still follow the pages, tried again later
      this.retryLater();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      // Connected again after a cut: what changed meanwhile was not told
      if (this.attempts > 0) {
        TOPICS.forEach((topic) => this.changed(topic as LiveTopic));
      }
      this.attempts = 0;
      this.everOpened = true;
      this.connected.set(true);
    };
    socket.onmessage = (message: MessageEvent<string>) => {
      const typing = readTyping(message.data);
      if (typing) {
        this.typingListeners.forEach((listener) => listener(typing));
        return;
      }
      const topic = readTopic(message.data);
      if (topic) {
        this.changed(topic);
      }
    };
    socket.onclose = (event?: CloseEvent) => {
      if (this.socket !== socket || !this.started) {
        return;
      }
      this.socket = null;
      this.connected.set(false);
      this.retryLater(event?.code);
    };
  }

  private retryLater(code?: number): void {
    const delay = RETRY_MS[Math.min(this.attempts, RETRY_MS.length - 1)];
    this.attempts++;
    if (this.attempts >= FAILURES_TOLD && !this.everOpened && !this.failuresTold) {
      // Never connected on this page: seen in "Journaux" (a proxy that refuses WebSockets, for instance)
      this.failuresTold = true;
      this.injector.get(ErrorHandler).handleError(new LiveUnreachable(this.attempts, code));
    }
    this.retry = setTimeout(() => this.connect(), delay);
  }

  /** Cut, the page in sight: the messages asked every few seconds, the rest every half-minute; out of sight, the messages now and then. */
  private pollWhileCut(): void {
    if (this.connected()) {
      return;
    }
    this.polls++;
    if (this.document.visibilityState !== 'visible') {
      // Out of sight: the messages only, less often, for their sound
      if (this.polls % HIDDEN_EVERY === 0) {
        this.changed('MESSAGES');
      }
      return;
    }
    if (this.polls % POLLS_PER_ROUND === 0) {
      TOPICS.forEach((topic) => this.changed(topic as LiveTopic));
    } else {
      this.changed('MESSAGES');
    }
  }

  private changed(topic: LiveTopic): void {
    clearTimeout(this.waiting.get(topic));
    this.waiting.set(
      topic,
      setTimeout(() => {
        this.waiting.delete(topic);
        for (const listener of [...(this.listeners.get(topic) ?? []), ...(this.listeners.get('*') ?? [])]) {
          listener(topic);
        }
      }, GROUPED_MS),
    );
  }
}

/** The WebSocket of the back-office never opened: what "Journaux" shows. */
export class LiveUnreachable extends Error {
  constructor(attempts: number, code?: number) {
    super(`Le temps réel du back-office ne se connecte pas (${attempts} essais, WebSocket /api/admin/live, code ${code ?? 'aucun'}) : les pages se mettent à jour toutes les 4 secondes à la place`);
    this.name = 'LiveUnreachable';
  }
}

/** {"topic":"TYPING","group":12,"email":"…","name":"Yona"}; null for anything else. */
export function readTyping(data: unknown): Typing | null {
  if (typeof data !== 'string' || !data.includes('"TYPING"')) {
    return null;
  }
  try {
    const told = JSON.parse(data) as { topic?: unknown; group?: unknown; email?: unknown; name?: unknown };
    return told.topic === 'TYPING' && typeof told.group === 'number' && typeof told.email === 'string'
      ? { group: told.group, email: told.email, name: typeof told.name === 'string' ? told.name : null }
      : null;
  } catch {
    return null;
  }
}

/** {"topic":"HISTORY"}; null for the heartbeat, or anything else. */
export function readTopic(data: unknown): LiveTopic | null {
  if (typeof data !== 'string') {
    return null;
  }
  try {
    const topic: unknown = (JSON.parse(data) as { topic?: unknown }).topic;
    return typeof topic === 'string' && TOPICS.has(topic) ? (topic as LiveTopic) : null;
  } catch {
    return null;
  }
}
