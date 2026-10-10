import { useEffect, useState } from 'react';

/**
 * Playing with no signal: the service worker keeps every file of the game on
 * the phone once it has loaded online, and saves live in IndexedDB, so the
 * installed app runs on a plane. This module reports whether that's ready,
 * offers the install prompt, and asks the browser to keep the saves.
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
  // Ask the browser not to clear the saves when the phone runs low on space.
  void navigator.storage?.persist?.().catch(() => undefined);
}

/** Running as an installed app (home-screen icon), not in a browser tab. */
export function isInstalled(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Samsung Internet, the browser that comes on Samsung phones. */
export function isSamsungBrowser(): boolean {
  return /SamsungBrowser/i.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** True once every file is stored on the phone (the service worker is active). */
export function useOfflineReady(): boolean | null {
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setReady(false);
      return;
    }
    let live = true;
    void navigator.serviceWorker.getRegistration().then((reg) => {
      if (!live) return;
      if (!reg) return setReady(false);
      if (reg.active) setReady(true);
      else void navigator.serviceWorker.ready.then(() => live && setReady(true));
    });
    return () => {
      live = false;
    };
  }, []);
  return ready;
}

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  }, []);
  return {
    canPrompt: deferredPrompt !== null,
    install: async () => {
      if (!deferredPrompt) return;
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => undefined);
      deferredPrompt = null;
      force((n) => n + 1);
    },
  };
}
