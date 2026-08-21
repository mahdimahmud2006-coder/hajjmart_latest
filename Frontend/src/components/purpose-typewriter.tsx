"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon } from "./icons";

const TITLE = "Preparation should feel immersive, purposeful and beautifully guided.";
const COPY = "This redesigned HajjMart storefront keeps your real commerce functionality intact while introducing a more atmospheric, image-led experience built from your sacred visual references.";

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

export function PurposeTypewriter() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [typed, setTyped] = useState("");
  const [decoded, setDecoded] = useState("WHY HAJJMART");
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
      { threshold: 0.34 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (reducedMotion) {
      setTyped(TITLE);
      setDecoded("WHY HAJJMART");
      return;
    }

    let index = 0;
    let typeTimer: number | undefined;
    const start = window.setTimeout(() => {
      typeTimer = window.setInterval(() => {
        index += 1;
        setTyped(TITLE.slice(0, index));
        if (index >= TITLE.length && typeTimer !== undefined) window.clearInterval(typeTimer);
      }, 24);
    }, 80);

    const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ·—0123456789";
    let frame = 0;
    const decodeTimer = window.setInterval(() => {
      frame += 1;
      const target = "WHY HAJJMART";
      const reveal = Math.floor((frame / 11) * target.length);
      setDecoded(
        Array.from(target)
          .map((char, charIndex) => {
            if (char === " " || charIndex < reveal) return char;
            return glyphs[Math.floor(Math.random() * glyphs.length)];
          })
          .join(""),
      );
      if (frame >= 11) {
        window.clearInterval(decodeTimer);
        setDecoded(target);
      }
    }, 34);

    return () => {
      window.clearTimeout(start);
      if (typeTimer !== undefined) window.clearInterval(typeTimer);
      window.clearInterval(decodeTimer);
    };
  }, [visible, reducedMotion]);

  const typing = typed.length < TITLE.length;

  return (
    <div ref={rootRef} className={`sunnah-purpose-copy purpose-typewriter ${visible ? "is-visible" : ""}`}>
      <span className="purpose-decode" aria-label="Why HajjMart">{decoded}</span>
      <h2 aria-label={TITLE}>
        <span>{visible ? typed : ""}</span>
        <span className={`purpose-type-cursor ${typing && visible ? "is-typing" : ""}`} aria-hidden="true">|</span>
      </h2>
      <div className="purpose-pulse-dots" aria-hidden="true"><i/><i/><i/></div>
      <p className="purpose-copy-reveal">{COPY}</p>
      <Link href="/about" className="purpose-link-reveal">Our story <ArrowRightIcon size={15}/></Link>
    </div>
  );
}
