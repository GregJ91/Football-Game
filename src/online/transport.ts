/**
 * How phones talk to each other in an online Legends game. The real thing is
 * peer to peer over WebRTC (Trystero finds the other phones through public
 * relays; no server of our own). A BroadcastChannel version links tabs in one
 * browser, for testing on one device.
 */

export interface Message {
  t: string;
  d?: unknown;
}

export interface Transport {
  selfId: string;
  /** Send to one peer, or to everyone in the room. */
  send(msg: Message, to?: string): void;
  onMessage(cb: (msg: Message, from: string) => void): void;
  onPeerJoin(cb: (peer: string) => void): void;
  onPeerLeave(cb: (peer: string) => void): void;
  leave(): void;
}

const APP_ID = 'fm-journey-legends';

/** Codes avoid letters and numbers that are easy to mix up. */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newRoomCode(): string {
  return Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
}

export function normaliseCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
}

/** Use the local (same-browser) transport, for testing: add ?local to the address. */
export function useLocalTransport(): boolean {
  return typeof location !== 'undefined' && new URLSearchParams(location.search).has('local');
}

export async function openTransport(code: string): Promise<Transport> {
  return useLocalTransport() ? localTransport(code) : trysteroTransport(code);
}

async function trysteroTransport(code: string): Promise<Transport> {
  const { joinRoom, selfId } = await import('trystero');
  const room = joinRoom({ appId: APP_ID }, code);
  // Messages are plain JSON (game state travels as gzipped base64).
  const action = room.makeAction<never>('msg');
  let handler: (msg: Message, from: string) => void = () => {};
  action.onMessage = (data, ctx) => handler(data as Message, (ctx as { peerId: string }).peerId);
  return {
    selfId,
    send: (msg, to) => void action.send(msg as never, to ? ({ target: to } as never) : undefined).catch(() => undefined),
    onMessage: (cb) => {
      handler = cb;
    },
    onPeerJoin: (cb) => {
      room.onPeerJoin = cb;
    },
    onPeerLeave: (cb) => {
      room.onPeerLeave = cb;
    },
    leave: () => void room.leave(),
  };
}

/** Tabs in the same browser, via BroadcastChannel. */
export function localTransport(code: string): Transport {
  const selfId = Math.random().toString(36).slice(2, 10);
  const channel = new BroadcastChannel(`${APP_ID}-${code}`);
  let onMsg: (msg: Message, from: string) => void = () => {};
  let onJoin: (peer: string) => void = () => {};
  let onLeave: (peer: string) => void = () => {};
  const known = new Set<string>();
  type Wire = { from: string; to?: string; kind: 'hello' | 'bye' | 'msg'; msg?: Message };
  const post = (w: Omit<Wire, 'from'>) => channel.postMessage({ ...w, from: selfId });
  channel.onmessage = (e: MessageEvent<Wire>) => {
    const w = e.data;
    if (w.from === selfId || (w.to && w.to !== selfId)) return;
    if (w.kind === 'hello') {
      if (!known.has(w.from)) {
        known.add(w.from);
        post({ kind: 'hello', to: w.from });
        onJoin(w.from);
      }
    } else if (w.kind === 'bye') {
      known.delete(w.from);
      onLeave(w.from);
    } else if (w.msg) onMsg(w.msg, w.from);
  };
  setTimeout(() => post({ kind: 'hello' }), 0);
  return {
    selfId,
    send: (msg, to) => post({ kind: 'msg', to, msg }),
    onMessage: (cb) => {
      onMsg = cb;
    },
    onPeerJoin: (cb) => {
      onJoin = cb;
    },
    onPeerLeave: (cb) => {
      onLeave = cb;
    },
    leave: () => {
      post({ kind: 'bye' });
      channel.close();
    },
  };
}

// ---------------------------------------------------------------- game state on the wire

/** The whole game, gzipped and base64'd (about 175 KB for a Legends season). */
export async function packState(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  const zipped = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (let i = 0; i < zipped.length; i += 0x8000) bin += String.fromCharCode(...zipped.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function unpackState<T>(packed: string): Promise<T> {
  const bin = atob(packed);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text()) as T;
}
