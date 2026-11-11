import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminLive, LiveTopic, readTopic } from './admin-live';

/** A WebSocket the test opens, sends through and cuts. */
class FakeSocket {
  static opened: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;

  constructor(readonly url: string) {
    FakeSocket.opened.push(this);
  }

  close(): void {
    this.closed = true;
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
});
