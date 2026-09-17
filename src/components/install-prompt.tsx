import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Extend the browser's BeforeInstallPromptEvent (not in TS's DOM lib). */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

/**
 * Registers the service worker and offers an "Install app" prompt when the
 * browser supports PWA installation. Keeps the prompt (and its state) so the
 * user can install later from a button if they dismissed it.
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only attempt registration in a secure context with a real (non-Electron) browser.
    if (!("serviceWorker" in navigator)) return;
    if (window.location.protocol === "file:") return;

    navigator.serviceWorker
      .register("./sw.js")
      .catch((error) => console.warn("Service worker registration failed:", error));
  }, []);

  useEffect(() => {
    const onPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault(); // Stop the default mini-infobar; we show our own UI.
      setDeferredPrompt(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Already running as an installed PWA — nothing to show.
  if (installed) return null;
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;
  if (isStandalone) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      setDeferredPrompt(null);
    }
  }

  if (!deferredPrompt && !dismissed) {
    return null; // Browser doesn't offer install (or not eligible yet) — stay silent.
  }
  if (dismissed && !deferredPrompt) return null;
  // Fallback: allow the user to re-open the offer if it was dismissed but still available.
  if (dismissed && deferredPrompt) {
    return (
      <button
        type="button"
        onClick={() => {
          setDismissed(false);
          void handleInstall();
        }}
        className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60"
      >
        <Download className="h-4 w-4" />
        Install app
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
      <Download className="h-5 w-5 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Install Study Hub on this device</p>
        <p className="text-xs text-muted-foreground">
          Get it as an app — launches fullscreen and works offline.
        </p>
      </div>
      <Button size="sm" onClick={handleInstall}>
        Install
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss install prompt"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}