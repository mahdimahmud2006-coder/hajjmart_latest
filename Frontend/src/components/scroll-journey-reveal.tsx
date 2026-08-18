"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { Category } from "@/lib/types";
import { getCategoryImage } from "@/lib/utils";
import { AppImage } from "./app-image";
import { ArrowRightIcon } from "./icons";

const FALLBACK_IMAGES = [
  "/images/products/ihram-package.svg",
  "/images/products/travel-kit.svg",
  "/images/products/sandal.svg",
  "/images/products/neck-bag.svg",
  "/images/products/prayer-mat.svg",
  "/images/products/umbrella.svg",
];

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (value: number) => value * value * (3 - 2 * value);
const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

export function ScrollJourneyReveal({ categories }: { categories: Category[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const eyebrowRef = useRef<HTMLParagraphElement>(null);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const cards = categories.slice(0, 3);

  useEffect(() => {
    const section = sectionRef.current;
    const title = titleRef.current;
    if (!section || !title || cards.length === 0) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compactViewport = window.matchMedia("(max-width: 767px)");
    let raf = 0;

    const setCopyNode = (node: HTMLElement | null, progress: number, offset = 22) => {
      if (!node) return;
      node.style.opacity = progress.toFixed(4);
      node.style.transform = `translate3d(${((1 - progress) * -offset).toFixed(2)}px, ${(1 - progress) * 8}px, 0)`;
    };

    const paintStatic = () => {
      section.style.setProperty("--journey-progress", "1");
      section.style.setProperty("--journey-green-opacity", "1");
      section.style.setProperty("--journey-pattern-opacity", ".075");
      title.style.clipPath = "inset(0 0 0 0)";
      title.style.transform = "none";
      title.style.opacity = "1";
      title.style.filter = "none";
      setCopyNode(eyebrowRef.current, 1);
      setCopyNode(descriptionRef.current, 1);
      setCopyNode(linkRef.current, 1);
      cardRefs.current.forEach((node) => {
        if (!node) return;
        node.style.transform = "none";
        node.style.opacity = "1";
      });
    };

    const paint = () => {
      raf = 0;

      if (reducedMotion.matches || compactViewport.matches) {
        paintStatic();
        return;
      }

      const rect = section.getBoundingClientRect();
      const scrollDistance = Math.max(1, section.offsetHeight - window.innerHeight);
      const progress = clamp(-rect.top / scrollDistance);
      section.style.setProperty("--journey-progress", progress.toFixed(4));

      // Phase 1: the light page slowly floods into the HajjMart forest palette.
      // The longer section makes this feel scrubbed by the user's hand/wheel,
      // rather than like a timed animation that races ahead.
      const green = smoothstep(clamp((progress - 0.015) / 0.30));
      section.style.setProperty("--journey-green-opacity", green.toFixed(4));
      section.style.setProperty("--journey-pattern-opacity", (green * 0.075).toFixed(4));

      // Phase 2: heading enters from the left while a right-side mask opens.
      // A very light saturation ramp adds the requested "coming into colour"
      // feeling without animating blur or doing costly layout work.
      const titleLocal = clamp((progress - 0.105) / 0.30);
      const titleEase = smoothstep(titleLocal);
      title.style.clipPath = `inset(0 ${((1 - titleEase) * 100).toFixed(3)}% 0 0)`;
      title.style.transform = `translate3d(${((1 - titleEase) * -72).toFixed(2)}px, 0, 0)`;
      title.style.opacity = clamp(titleLocal * 1.45).toFixed(4);
      title.style.filter = `saturate(${(0.28 + titleEase * 0.72).toFixed(3)}) contrast(${(0.94 + titleEase * 0.06).toFixed(3)})`;

      const eyebrow = smoothstep(clamp((progress - 0.075) / 0.18));
      const copy = smoothstep(clamp((progress - 0.235) / 0.22));
      const link = smoothstep(clamp((progress - 0.29) / 0.20));
      setCopyNode(eyebrowRef.current, eyebrow, 18);
      setCopyNode(descriptionRef.current, copy, 28);
      setCopyNode(linkRef.current, link, 18);

      // Phase 3: products/categories begin only after the environment and title
      // have resolved. Each card gets a generous scroll range so fast scrolls
      // advance fast, but normal scrolling feels intentionally paced.
      cardRefs.current.forEach((node, index) => {
        if (!node) return;

        const start = 0.395 + index * 0.105;
        const duration = 0.36;
        const local = clamp((progress - start) / duration);
        const eased = easeOutCubic(local);
        const viewportLift = Math.min(window.innerHeight * 0.78, 760);
        const y = (1 - eased) * viewportLift;
        const scale = 0.89 + eased * 0.11;
        const rotation = (index - (cards.length - 1) / 2) * (1 - eased) * 1.8;
        node.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(4)}) rotate(${rotation.toFixed(3)}deg)`;
        node.style.opacity = clamp(local * 1.35).toFixed(4);
      });
    };

    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(paint);
    };

    paint();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    reducedMotion.addEventListener("change", schedule);
    compactViewport.addEventListener("change", schedule);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reducedMotion.removeEventListener("change", schedule);
      compactViewport.removeEventListener("change", schedule);
    };
  }, [cards.length]);

  if (cards.length === 0) return null;

  return (
    <section ref={sectionRef} className="journey-scroll-story" aria-labelledby="journey-scroll-title">
      <div className="journey-scroll-sticky">
        <div className="journey-scroll-green-layer" aria-hidden="true" />
        <div className="journey-scroll-pattern" aria-hidden="true" />
        <div className="journey-scroll-orb journey-scroll-orb-one" aria-hidden="true" />
        <div className="journey-scroll-orb journey-scroll-orb-two" aria-hidden="true" />

        <div className="container-wide journey-scroll-inner">
          <div className="journey-scroll-copy">
            <div>
              <p ref={eyebrowRef} className="eyebrow journey-scroll-eyebrow">Shop by journey need</p>
              <h2 ref={titleRef} id="journey-scroll-title" className="journey-scroll-title">Preparation, organised beautifully.</h2>
              <p ref={descriptionRef} className="journey-scroll-description">A calmer way to build your list—from Ihram and travel documents to worship, comfort and care.</p>
            </div>
            <Link ref={linkRef} href="/shop" className="journey-scroll-link">
              View every category <ArrowRightIcon size={16} />
            </Link>
          </div>

          <div className="journey-scroll-stage" aria-label="Journey categories">
            {cards.map((category, index) => (
              <div
                key={category.id}
                ref={(node) => { cardRefs.current[index] = node; }}
                className="journey-scroll-card-shell"
              >
                <Link href={`/category/${category.slug}`} className="journey-scroll-card group">
                  <AppImage
                    src={getCategoryImage(category) || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length]}
                    alt={category.name}
                    className="journey-scroll-image"
                  />
                  <div className="journey-scroll-card-wash" />
                  <span className="journey-scroll-number">0{index + 1}</span>
                  <div className="journey-scroll-card-copy">
                    <p className="journey-scroll-kicker">Journey essential</p>
                    <h3>{category.name}</h3>
                    <p>{category.description || "Thoughtfully chosen essentials for the sacred journey."}</p>
                    <span className="journey-scroll-explore">Explore <ArrowRightIcon size={15} /></span>
                  </div>
                </Link>
              </div>
            ))}
          </div>

          <div className="journey-scroll-progress" aria-hidden="true">
            <span />
          </div>
          <p className="journey-scroll-hint">Scroll to reveal the collection</p>
        </div>
      </div>
    </section>
  );
}
