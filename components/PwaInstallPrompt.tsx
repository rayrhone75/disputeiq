"use client";

import { useEffect, useState } from "react";

// PWA install prompt. Shows a floating "Install DisputeIQ" chip when the
// browser fires `beforeinstallprompt` (Android/Chrome/Edge). iOS Safari
// doesn't expose that event — we show a short instruction banner instead.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua);
    setIsIos(ios);
    if (localStorage.getItem("diq_pwa_dismissed") === "1") {
      setDismissed(true);
      return;
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    if (ios) setVisible(true);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible || dismissed) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
    }
  }

  function dismiss() {
    localStorage.setItem("diq_pwa_dismissed", "1");
    setDismissed(true);
  }

  return (
    <div className="fixed bottom-6 left-6 z-40 max-w-xs rounded-2xl border border-white/10 bg-[#0b0f1a]/95 p-4 text-xs text-white shadow-2xl backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">Install DisputeIQ</div>
          <p className="mt-1 text-white/70">
            {isIos
              ? "On iPhone/iPad: tap the Share icon, then 'Add to Home Screen'."
              : "Install DisputeIQ to your device for faster access and push-style notifications."}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-white/50 hover:text-white"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
      {!isIos && deferred && (
        <button
          type="button"
          onClick={install}
          className="mt-3 w-full rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 py-2 font-semibold"
        >
          Install app
        </button>
      )}
    </div>
  );
}
