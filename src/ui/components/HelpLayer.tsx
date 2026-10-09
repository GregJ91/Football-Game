import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Press and hold anything with a `data-help` attribute (or right-click it)
 * and a bubble explains what it does. The tap that would normally follow
 * the hold is swallowed, so holding a button never presses it.
 */
const HOLD_MS = 450;
const MOVE_PX = 10;

interface Bubble {
  text: string;
  title?: string;
  left: number;
  width: number;
  y: number;
  below: boolean;
}

function helpTarget(el: EventTarget | null): HTMLElement | null {
  return el instanceof Element ? (el.closest('[data-help]') as HTMLElement | null) : null;
}

function bubbleFor(el: HTMLElement): Bubble {
  const r = el.getBoundingClientRect();
  const below = r.top < 200;
  const width = Math.min(320, window.innerWidth - 24);
  const centre = r.left + r.width / 2;
  return {
    text: el.dataset.help ?? '',
    title: el.dataset.helpTitle,
    left: Math.min(Math.max(centre - width / 2, 12), window.innerWidth - width - 12),
    width,
    y: below ? Math.min(r.bottom, window.innerHeight - 160) + 10 : r.top - 10,
    below,
  };
}

export function HelpLayer() {
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const hold = useRef<{ timer: number; x: number; y: number } | null>(null);
  const swallowUntil = useRef(0);

  useEffect(() => {
    const cancel = () => {
      if (hold.current) window.clearTimeout(hold.current.timer);
      hold.current = null;
    };
    const show = (el: HTMLElement) => {
      setBubble(bubbleFor(el));
      // Swallow the tap that follows, however long the finger stays down.
      swallowUntil.current = Number.POSITIVE_INFINITY;
      navigator.vibrate?.(12);
    };
    const up = () => {
      cancel();
      if (swallowUntil.current === Number.POSITIVE_INFINITY) swallowUntil.current = Date.now() + 400;
    };
    const down = (e: PointerEvent) => {
      // Any touch closes an open bubble first.
      setBubble(null);
      if (!e.isPrimary || e.button > 0) return;
      const el = helpTarget(e.target);
      if (!el) return;
      cancel();
      hold.current = { timer: window.setTimeout(() => show(el), HOLD_MS), x: e.clientX, y: e.clientY };
    };
    const move = (e: PointerEvent) => {
      if (hold.current && Math.hypot(e.clientX - hold.current.x, e.clientY - hold.current.y) > MOVE_PX) cancel();
    };
    const click = (e: MouseEvent) => {
      if (Date.now() < swallowUntil.current) {
        e.preventDefault();
        e.stopPropagation();
        swallowUntil.current = 0;
      }
    };
    const menu = (e: MouseEvent) => {
      const el = helpTarget(e.target);
      if (!el) return;
      // Long-press on Android and right-click on a computer both land here.
      e.preventDefault();
      cancel();
      show(el);
    };
    const close = () => setBubble(null);
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
    window.addEventListener('click', click, true);
    window.addEventListener('contextmenu', menu, true);
    window.addEventListener('scroll', close, true);
    return () => {
      cancel();
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('click', click, true);
      window.removeEventListener('contextmenu', menu, true);
      window.removeEventListener('scroll', close, true);
    };
  }, []);

  if (!bubble) return null;
  return createPortal(
    <div
      className={`help-bubble ${bubble.below ? 'below' : 'above'}`}
      role="tooltip"
      style={{ left: bubble.left, width: bubble.width, top: bubble.y }}
      onPointerDown={() => setBubble(null)}
    >
      {bubble.title && <strong>{bubble.title}</strong>}
      <span>{bubble.text}</span>
    </div>,
    document.body,
  );
}
