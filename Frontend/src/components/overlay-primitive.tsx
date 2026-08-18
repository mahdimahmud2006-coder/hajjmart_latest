"use client";

import { useEffect, useRef } from "react";

let overlayLocks = 0;

function lockBody() {
  overlayLocks += 1;
  document.body.style.overflow = "hidden";
}

function unlockBody() {
  overlayLocks = Math.max(0, overlayLocks - 1);
  if (overlayLocks === 0) document.body.style.overflow = "";
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function useOverlayPrimitive(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLElement | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lockBody();

    const focusFirst = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>(FOCUSABLE);
      (first || panel).focus({ preventScroll: true });
    };
    const frame = window.requestAnimationFrame(focusFirst);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = (Array.from(panel.querySelectorAll(FOCUSABLE)) as HTMLElement[])
        .filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      unlockBody();
      previousFocus.current?.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  return panelRef;
}
