import { DOCUMENT, DestroyRef, Injectable, inject } from '@angular/core';

/** What changed, as the backend says it (fr.lescreationsdeyona.live.LiveTopic). */
export type LiveTopic = 'FEEDBACK' | 'ORDERS' | 'HISTORY' | 'TRASH' | 'LOGS' | 'MESSAGES';

const TOPICS = new Set<string>(['FEEDBACK', 'ORDERS', 'HISTORY', 'TRASH', 'LOGS', 'MESSAGES']);

/** Waits before connecting again, longer each time the backend is out of reach. */
const RETRY_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

/** Several changes at once (20 photos to the trash) give one question to the API. */
const GROUPED_MS = 300;

type Listener = (topic: LiveTopic) => void;

/**
 * The back-office in real time: one WebSocket per open back-office (/api/admin/live, the session's
 * cookie), told by the backend what another admin, a visitor or the site just changed. The badges of
 * the menu, and the page open when it is about it, ask their own counts and lists again. Connected
 * again on its own after a cut (phone asleep, backend restarted), every listener told then: what came
 * meanwhile was missed.
 */
@Injectable({ providedIn: 'root' })
export class AdminLive {
  private readonly document = inject(DOCUMENT);
  private readonly listeners = new Map<LiveTopic | '*', Set<Listener>>();
  private readonly waiting = new Map<LiveTopic, ReturnType<typeof setTimeout>>();
  private socket: WebSocket | null = null;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private attempts = 0;
  private started = false;

  /** Opened with the back-office; nothing in a browser without WebSocket (tests). */
  start(): void {
    if (this.started || typeof WebSocket === 'undefined') {
      return;
    }
    this.started = true;
    this.connect();
  }

  /** The back-office closed (signed out): no reconnection. */
  stop(): void {
    this.started = false;
    clearTimeout(this.retry);
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
    };
    socket.onmessage = (message: MessageEvent<string>) => {
      const topic = readTopic(message.data);
      if (topic) {
        this.changed(topic);
      }
    };
    socket.onclose = () => {
      if (this.socket !== socket || !this.started) {
        return;
      }
      this.socket = null;
      this.retryLater();
    };
  }

  private retryLater(): void {
    const delay = RETRY_MS[Math.min(this.attempts, RETRY_MS.length - 1)];
    this.attempts++;
    this.retry = setTimeout(() => this.connect(), delay);
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
