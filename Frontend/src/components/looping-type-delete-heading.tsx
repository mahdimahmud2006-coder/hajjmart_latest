"use client";

import { useEffect, useRef, useState } from "react";

const TEXT = "Essentials worth making room for.";
const TYPE_SPEED = 38;
const DELETE_SPEED = 22;
const HOLD_FULL_MS = 1500;
const HOLD_EMPTY_MS = 320;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

export function LoopingTypeDeleteHeading() {
  const rootRef = useRef<HTMLHeadingElement>(null);
  const [visible, setVisible] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (reducedMotion) {
      setTyped(TEXT);
      return;
    }

    let timer: number | undefined;

    if (!deleting && typed.length < TEXT.length) {
      timer = window.setTimeout(() => {
        setTyped(TEXT.slice(0, typed.length + 1));
      }, TYPE_SPEED);
    } else if (!deleting && typed.length === TEXT.length) {
      timer = window.setTimeout(() => {
        setDeleting(true);
      }, HOLD_FULL_MS);
    } else if (deleting && typed.length > 0) {
      timer = window.setTimeout(() => {
        setTyped(TEXT.slice(0, typed.length - 1));
      }, DELETE_SPEED);
    } else if (deleting && typed.length === 0) {
      timer = window.setTimeout(() => {
        setDeleting(false);
      }, HOLD_EMPTY_MS);
    }

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [visible, reducedMotion, typed, deleting]);

  const showCursor = visible && !reducedMotion;
  const isTyping = showCursor && (!deleting || typed.length > 0);

  return (
    <h2 ref={rootRef} className="looping-type-delete-heading" aria-label={TEXT}>
      <span>{visible || reducedMotion ? typed : ""}</span>
      <span className={`looping-type-delete-cursor ${showCursor ? "is-visible" : ""} ${isTyping ? "is-typing" : ""}`} aria-hidden="true">|</span>
    </h2>
  );
}
