/// <reference types="vite/client" />
// src/pwa.ts
// Everything about Share & Learn being an installed app rather than a tab: the
// service worker registration, and the small amount of state the UI needs to
// offer "Install" only when installing is actually possible.
import { useEffect, useState } from "react";

/** Chrome hands us this event when the app meets the install criteria. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function announce() {
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  // Captured at module load, because the browser fires this once and early —
  // often before the component that renders the install button has mounted.
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    announce();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    announce();
  });
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    // iOS Safari's own flag, which predates display-mode.
    ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

/**
 * On iOS there is no install event at all — the only way in is Share → Add to
 * Home Screen, so the UI explains that instead of offering a button.
 */
export type InstallState = "installed" | "prompt" | "ios-instructions" | "unavailable";

export function useInstall() {
  const [installed, setInstalled] = useState(isStandalone);
  const [canPrompt, setCanPrompt] = useState(() => deferredPrompt !== null);

  useEffect(() => {
    const update = () => {
      setCanPrompt(deferredPrompt !== null);
      setInstalled(isStandalone());
    };
    listeners.add(update);
    const media = window.matchMedia("(display-mode: standalone)");
    media.addEventListener("change", update);
    return () => {
      listeners.delete(update);
      media.removeEventListener("change", update);
    };
  }, []);

  const state: InstallState = installed
    ? "installed"
    : canPrompt
      ? "prompt"
      : isIos()
        ? "ios-instructions"
        : "unavailable";

  /** Returns true when the member accepted; false when they dismissed or it was not possible. */
  async function install(): Promise<boolean> {
    if (!deferredPrompt) return false;
    const event = deferredPrompt;
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      if (outcome === "accepted") {
        deferredPrompt = null;
        announce();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  return { state, install };
}

/**
 * Registered after load so it never competes with the first render. Only in a
 * production build: in `netlify dev` a cached shell just gets in the way of
 * live reloading.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // An unavailable service worker only costs offline support, so it stays quiet.
    });
  });
}
