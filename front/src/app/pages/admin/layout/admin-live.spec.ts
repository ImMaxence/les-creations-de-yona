import { Component, ErrorHandler, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../../../core/api/generated/api';
import { AdminLive, LiveTopic, LiveUnreachable, Typing, readTopic, readTyping } from './admin-live';

/** A WebSocket the test opens, sends through and cuts. */
class FakeSocket {
  static opened: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;
  readyState = 1;
  readonly sent: string[] = [];

  constructor(readonly url: string) {
    FakeSocket.opened.push(this);
  }

  close(): void {
    this.closed = true;
  }

  send(data: string): void {
    this.sent.push(data);
  }

  receive(data: string): void {
    this.onmessage?.({ data });
  }
}

@Component({ template: '' })
class Listening {
  readonly heard: LiveTopic[] = [];

  constructor() {
    inject(AdminLive).on('TRASH', (topic) => this.heard.push(topic));
  }
}

describe('readTyping', () => {
  it('reads who writes in which group, and nothing else', () => {
    expect(readTyping('{"topic":"TYPING","group":3,"email":"a@b.fr","name":null}')).toEqual({ group: 3, email: 'a@b.fr', name: null });
    expect(readTyping('{"topic":"MESSAGES"}')).toBeNull();
    expect(readTyping('{"topic":"TYPING","group":"3"}')).toBeNull();
  });
});

describe('readTopic', () => {
  it('reads the topic told by the backend, and nothing else', () => {
    expect(readTopic('{"topic":"HISTORY"}')).toBe('HISTORY');
    expect(readTopic('{"topic":"PING"}')).toBeNull();
    expect(readTopic('pas du JSON')).toBeNull();
    expect(readTopic(42)).toBeNull();
  });
});

describe('AdminLive', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.opened = [];
    vi.stubGlobal('WebSocket', FakeSocket);
  });

  afterEach(() => {
    TestBed.inject(AdminLive).stop();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('connects to the WebSocket of the back-office, on the same host', () => {
    TestBed.inject(AdminLive).start();

    expect(FakeSocket.opened).toHaveLength(1);
    expect(FakeSocket.opened[0]!.url).toMatch(/^ws:\/\/[^/]+\/api\/admin\/live$/);
  });

  it('tells the listeners of a topic once for changes close together', () => {
    const live = TestBed.inject(AdminLive);
    const listening = TestBed.createComponent(Listening).componentInstance;
    live.start();
    const socket = FakeSocket.opened[0]!;

    socket.receive('{"topic":"TRASH"}');
    socket.receive('{"topic":"TRASH"}');
    socket.receive('{"topic":"HISTORY"}');
    vi.advanceTimersByTime(400);

    expect(listening.heard).toEqual(['TRASH']);
  });

  it('forgets a listener once its component is gone', () => {
    const live = TestBed.inject(AdminLive);
    const fixture = TestBed.createComponent(Listening);
    const listening = fixture.componentInstance;
    live.start();
    fixture.destroy();

    FakeSocket.opened[0]!.receive('{"topic":"TRASH"}');
    vi.advanceTimersByTime(400);

    expect(listening.heard).toEqual([]);
  });

  it('connects again after a cut, and tells every topic then: what came meanwhile was missed', () => {
    const live = TestBed.inject(AdminLive);
    const listening = TestBed.createComponent(Listening).componentInstance;
    live.start();
    FakeSocket.opened[0]!.onclose?.();

    vi.advanceTimersByTime(1_000);
    expect(FakeSocket.opened).toHaveLength(2);
    FakeSocket.opened[1]!.onopen?.();
    vi.advanceTimersByTime(400);

    expect(listening.heard).toEqual(['TRASH']);
  });

  it('leaves the back-office alone when the browser refuses the connection, and tries again later', () => {
    let refusals = 0;
    vi.stubGlobal(
      'WebSocket',
      class {
        constructor() {
          refusals++;
          throw new DOMException('Refused by the security rules', 'SecurityError');
        }
      },
    );
    const live = TestBed.inject(AdminLive);

    expect(() => live.start()).not.toThrow();
    vi.advanceTimersByTime(1_000);

    expect(refusals).toBe(2);
  });

  it('cut, tells the messages every few seconds and everything every half-minute, then stops once connected', () => {
    const heard: LiveTopic[] = [];
    @Component({ template: '' })
    class Polled {
      constructor() {
        inject(AdminLive).on('*', (topic) => heard.push(topic));
      }
    }
    const live = TestBed.inject(AdminLive);
    TestBed.createComponent(Polled);
    live.start();

    vi.advanceTimersByTime(4_300);
    expect(heard).toEqual(['MESSAGES']);
    vi.advanceTimersByTime(28_000);
    expect(new Set(heard)).toEqual(new Set(['MESSAGES', 'FEEDBACK', 'ORDERS', 'HISTORY', 'TRASH', 'LOGS', 'PRESENCE', 'SEEN']));

    FakeSocket.opened.at(-1)!.onopen?.();
    expect(live.connected()).toBe(true);
    vi.advanceTimersByTime(1_000);
    heard.length = 0;
    vi.advanceTimersByTime(12_000);
    expect(heard).toEqual([]);
  });

  it('says it is writing over HTTP while cut', () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({ providers: [{ provide: Api, useValue: { invoke } }] });
    const live = TestBed.inject(AdminLive);
    live.start();
    FakeSocket.opened[0]!.readyState = 0;

    live.typing(12);

    expect(invoke).toHaveBeenCalledWith(expect.any(Function), { group: 12 });
    expect(FakeSocket.opened[0]!.sent).toEqual([]);
  });

  it('says in "Journaux", once, that it never connects', () => {
    const reported: unknown[] = [];
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => reported.push(error) } }] });
    const live = TestBed.inject(AdminLive);
    live.start();

    for (let cut = 0; cut < 5; cut++) {
      FakeSocket.opened.at(-1)!.onclose?.();
      vi.advanceTimersByTime(30_000);
    }

    expect(reported).toHaveLength(1);
    expect(reported[0]).toBeInstanceOf(LiveUnreachable);
  });

  it('stays closed once stopped', () => {
    const live = TestBed.inject(AdminLive);
    live.start();
    const socket = FakeSocket.opened[0]!;

    live.stop();
    socket.onclose?.();
    vi.advanceTimersByTime(60_000);

    expect(socket.closed).toBe(true);
    expect(FakeSocket.opened).toHaveLength(1);
  });

  it('tells at once who writes in a group, and says when this admin writes', () => {
    const heard: Typing[] = [];
    @Component({ template: '' })
    class Reading {
      constructor() {
        inject(AdminLive).onTyping((typing) => heard.push(typing));
      }
    }
    const live = TestBed.inject(AdminLive);
    TestBed.createComponent(Reading);
    live.start();
    const socket = FakeSocket.opened[0]!;

    socket.receive('{"topic":"TYPING","group":12,"email":"yona@site.fr","name":"Yona"}');
    live.typing(12);

    expect(heard).toEqual([{ group: 12, email: 'yona@site.fr', name: 'Yona' }]);
    expect(socket.sent).toEqual(['{"typing":12}']);
  });
});
