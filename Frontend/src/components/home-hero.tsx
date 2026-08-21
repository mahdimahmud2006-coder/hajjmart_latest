"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { HomepageSection } from "@/lib/types";
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { AppImage } from "./app-image";

type MosaicTile = {
  src: string;
  srcSetWidths: readonly number[];
  width: number;
  height: number;
  alt: string;
  gridArea: string;
  position?: string;
  sizes: string;
  tabletHidden?: boolean;
};

type MosaicSlide = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  layout: "layout-a" | "layout-b" | "layout-c";
  tiles: MosaicTile[];
  mobileTiles: MosaicTile[];
};

const MOSAIC_ASSETS = {
  nabawiGoldenUmbrellas: {
    src: "/images/hero-mosaic/nabawi-golden-umbrellas-1920.webp",
    srcSetWidths: [640, 960, 1440, 1920],
    width: 736,
    height: 414,
    alt: "Al-Masjid an-Nabawi at golden hour, framed by courtyard umbrellas",
    position: "center center",
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 62vw, 34vw",
  },
  clocktowerBirdsPortrait: {
    src: "/images/hero-mosaic/clocktower-birds-portrait-1080.webp",
    srcSetWidths: [480, 720, 1080],
    width: 736,
    height: 1307,
    alt: "Makkah Clock Tower rising into the sky with birds in flight",
    position: "center 38%",
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 38vw, 28vw",
  },
  kaabaSkylineSquare: {
    src: "/images/hero-mosaic/kaaba-skyline-square-1080.webp",
    srcSetWidths: [480, 720, 1080],
    width: 640,
    height: 640,
    alt: "The Kaaba before the Makkah Clock Tower skyline",
    position: "center 55%",
    sizes: "(max-width: 1024px) 62vw, 34vw",
  },
  nabawiBluehourReflection: {
    src: "/images/hero-mosaic/nabawi-bluehour-reflection-1920.webp",
    srcSetWidths: [640, 960, 1440, 1920],
    width: 736,
    height: 414,
    alt: "Al-Masjid an-Nabawi illuminated at blue hour with reflections across the courtyard",
    position: "center center",
    sizes: "(max-width: 1024px) 62vw, 33vw",
  },
  kaabaArchwayCrowd: {
    src: "/images/hero-mosaic/kaaba-archway-crowd-1080.webp",
    srcSetWidths: [480, 720, 1080],
    width: 720,
    height: 615,
    alt: "The Kaaba and pilgrims framed through the Grand Mosque arches",
    position: "center 58%",
    sizes: "32.5vw",
  },
  clocktowerMoonPortrait: {
    src: "/images/hero-mosaic/clocktower-moon-portrait-1080.webp",
    srcSetWidths: [480, 720, 1080],
    width: 736,
    height: 1241,
    alt: "Makkah Clock Tower beneath a full moon",
    position: "center 38%",
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 38vw, 35vw",
  },
  kaabaCalligraphyMacro1: {
    src: "/images/hero-mosaic/kaaba-calligraphy-macro-1-1080.webp",
    srcSetWidths: [480, 720, 1080],
    width: 708,
    height: 1280,
    alt: "Close view of the Kaaba kiswa and its gold embroidered calligraphy",
    position: "center 42%",
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 38vw, 32vw",
  },
  nabawiSunsetWide: {
    src: "/images/hero-mosaic/nabawi-sunset-wide-1920.webp",
    srcSetWidths: [640, 960, 1440, 1920],
    width: 736,
    height: 414,
    alt: "Al-Masjid an-Nabawi and the Green Dome at sunset",
    position: "center center",
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 62vw, 65vw",
  },
  kaabaCalligraphyMacro2: {
    src: "/images/hero-mosaic/kaaba-calligraphy-macro-2-1080.webp",
    srcSetWidths: [480, 720, 1080],
    width: 1080,
    height: 1920,
    alt: "The Kaaba corner with intricate gold calligraphy and a minaret beyond",
    position: "center 46%",
    sizes: "(max-width: 640px) 100vw, 28vw",
  },
  nabawiSunbeamsBirds: {
    src: "/images/hero-mosaic/nabawi-sunbeams-birds-1920.webp",
    srcSetWidths: [640, 960, 1440, 1920],
    width: 736,
    height: 414,
    alt: "Sunbeams and birds above Al-Masjid an-Nabawi",
    position: "center center",
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 62vw, 44vw",
  },
  pilgrimKaabaSunset: {
    src: "/images/hero-mosaic/pilgrim-kaaba-sunset-1920.webp",
    srcSetWidths: [640, 960, 1440, 1920],
    width: 735,
    height: 420,
    alt: "A pilgrim praying before the Kaaba at sunset",
    position: "center center",
    sizes: "(max-width: 640px) 100vw, 68vw",
  },
} as const;

const MOSAIC_SLIDES: MosaicSlide[] = [
  {
    id: "nabawi-golden-hour",
    eyebrow: "Madina · calm · reflection",
    title: "Prepare with calm. Travel with purpose.",
    description: "A quieter hero moment built around the sacred cities, with the same dependable products, search, pricing and checkout flows beneath.",
    ctaLabel: "Shop essentials",
    ctaHref: "/shop",
    secondaryLabel: "Pilgrim journal",
    secondaryHref: "/guides",
    layout: "layout-a",
    tiles: [
      { ...MOSAIC_ASSETS.nabawiSunsetWide, gridArea: "wide" },
      { ...MOSAIC_ASSETS.clocktowerMoonPortrait, gridArea: "tall" },
      { ...MOSAIC_ASSETS.kaabaArchwayCrowd, gridArea: "med1", tabletHidden: true },
      { ...MOSAIC_ASSETS.nabawiBluehourReflection, gridArea: "med2" },
    ],
    mobileTiles: [
      { ...MOSAIC_ASSETS.nabawiSunsetWide, gridArea: "wide" },
      { ...MOSAIC_ASSETS.clocktowerMoonPortrait, gridArea: "tall" },
    ],
  },
  {
    id: "kaaba-close-and-wide",
    eyebrow: "Makkah · devotion · focus",
    title: "Sacred travel essentials, curated with clarity.",
    description: "An intimate view of the Kaaba paired with a wider sense of place for practical preparation grounded in purpose.",
    ctaLabel: "Explore best sellers",
    ctaHref: "/shop?sort=best_selling",
    secondaryLabel: "Preparation guides",
    secondaryHref: "/guides",
    layout: "layout-b",
    tiles: [
      { ...MOSAIC_ASSETS.kaabaCalligraphyMacro1, gridArea: "tall" },
      { ...MOSAIC_ASSETS.pilgrimKaabaSunset, gridArea: "wide" },
      { ...MOSAIC_ASSETS.kaabaSkylineSquare, gridArea: "sq" },
      { ...MOSAIC_ASSETS.nabawiGoldenUmbrellas, gridArea: "small", tabletHidden: true },
    ],
    mobileTiles: [
      { ...MOSAIC_ASSETS.pilgrimKaabaSunset, gridArea: "wide" },
      { ...MOSAIC_ASSETS.kaabaCalligraphyMacro1, gridArea: "tall" },
    ],
  },
  {
    id: "clocktower-and-sunbeams",
    eyebrow: "Makkah · Madina · light",
    title: "Useful preparation, presented with a quieter sense of place.",
    description: "Landmarks, sacred detail and warm light come together while the core HajjMart journey stays familiar and functional.",
    ctaLabel: "Browse collections",
    ctaHref: "/shop",
    secondaryLabel: "Our story",
    secondaryHref: "/about",
    layout: "layout-c",
    tiles: [
      { ...MOSAIC_ASSETS.clocktowerBirdsPortrait, gridArea: "tallA" },
      { ...MOSAIC_ASSETS.nabawiSunbeamsBirds, gridArea: "wideMid" },
      { ...MOSAIC_ASSETS.kaabaCalligraphyMacro2, gridArea: "tallB", tabletHidden: true },
    ],
    mobileTiles: [
      { ...MOSAIC_ASSETS.nabawiSunbeamsBirds, gridArea: "wide" },
      { ...MOSAIC_ASSETS.kaabaCalligraphyMacro2, gridArea: "tall" },
    ],
  },
];

const SCRAMBLE_GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789·—";
const TRANSITION_DURATION_MS = 1050;
const ACTIVE_DURATION_MS = 5850;
function mosaicSrcSet(src: string, widths: readonly number[]) {
  const base = src.replace(/-\d+\.webp$/, "");
  return widths.map((width) => `${base}-${width}.webp ${width}w`).join(", ");
}

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

function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  return isMobile;
}

function useTypewriter(value: string, key: string, reduced: boolean) {
  const [text, setText] = useState(value);
  useEffect(() => {
    if (reduced) {
      setText(value);
      return;
    }
    setText("");
    let index = 0;
    let timer: number | undefined;
    const start = window.setTimeout(() => {
      timer = window.setInterval(() => {
        index += 1;
        setText(value.slice(0, index));
        if (index >= value.length && timer !== undefined) window.clearInterval(timer);
      }, 22);
    }, 20);
    return () => {
      window.clearTimeout(start);
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [value, key, reduced]);
  return text;
}

function useScrambledText(value: string, key: string, reduced: boolean) {
  const [text, setText] = useState(value);
  useEffect(() => {
    if (reduced) {
      setText(value);
      return;
    }
    let frame = 0;
    const totalFrames = 8;
    const timer = window.setInterval(() => {
      frame += 1;
      const reveal = Math.floor((frame / totalFrames) * value.length);
      const next = Array.from(value)
        .map((char, index) => {
          if (char === " " || char === "·" || index < reveal) return char;
          return SCRAMBLE_GLYPHS[Math.floor(Math.random() * SCRAMBLE_GLYPHS.length)];
        })
        .join("");
      setText(frame >= totalFrames ? value : next);
      if (frame >= totalFrames) window.clearInterval(timer);
    }, 24);
    return () => window.clearInterval(timer);
  }, [value, key, reduced]);
  return text;
}

export function HomeHero({ sections }: { sections: HomepageSection[] }) {
  const primaryHero = sections.find((section) => section.kind === "hero");
  const slides = useMemo(
    () =>
      MOSAIC_SLIDES.map((slide, index) =>
        index === 0
          ? {
              ...slide,
              ctaLabel: primaryHero?.cta_label || slide.ctaLabel,
              ctaHref: primaryHero?.cta_url || slide.ctaHref,
            }
          : slide,
      ),
    [primaryHero],
  );
  const [active, setActive] = useState(0);
  const [outgoing, setOutgoing] = useState<number | null>(null);
  const transitionTimer = useRef<number | null>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (reducedMotion || event.pointerType === "touch" || window.matchMedia("(pointer: coarse)").matches) return;
    const media = mediaRef.current;
    if (!media) return;
    const rect = media.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    media.style.transform = `perspective(1200px) rotateY(${x * 3}deg) rotateX(${-y * 3}deg) scale(1.025)`;
  }

  function resetTilt() {
    if (mediaRef.current) mediaRef.current.style.transform = "";
  }

  const transitionTo = useCallback(
    (next: number) => {
      const normalized = (next + slides.length) % slides.length;
      if (normalized === active) return;
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
      if (!reducedMotion) setOutgoing(active);
      setActive(normalized);
      transitionTimer.current = window.setTimeout(() => {
        setOutgoing(null);
        transitionTimer.current = null;
      }, reducedMotion ? 0 : TRANSITION_DURATION_MS);
    },
    [active, slides.length, reducedMotion],
  );

  useEffect(
    () => () => {
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (slides.length < 2 || reducedMotion) return;
    const timer = window.setTimeout(() => transitionTo(active + 1), ACTIVE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [active, slides.length, reducedMotion, transitionTo]);

  const slide = slides[active];
  const typedTitle = useTypewriter(slide.title, slide.id, reducedMotion);
  const scrambledEyebrow = useScrambledText(slide.eyebrow, slide.id, reducedMotion);
  const typing = typedTitle.length < slide.title.length;

  return (
    <section className="hm-pan-hero hm-pan-hero-v12" onPointerMove={handlePointerMove} onPointerLeave={resetTilt}>
      <div ref={mediaRef} className="hm-pan-media hm-pan-media-tilt">
        {slides.map((item, index) => {
          const state = index === active ? "is-active" : index === outgoing ? "is-outgoing" : "";
          const tiles = isMobile === false ? item.tiles : item.mobileTiles;
          return (
            <div
              key={item.id}
              className={`hm-pan-frame ${state} hm-mosaic-${item.layout}`}
              data-slide-id={item.id}
              aria-hidden={index !== active}
            >
              <div className="hm-mosaic-grid">
                {tiles.map((tile, tileIndex) => (
                  <div
                    key={`${tile.src}-${tile.gridArea}`}
                    className="hm-mosaic-tile"
                    style={{ gridArea: tile.gridArea }}
                    data-tablet-hidden={tile.tabletHidden || undefined}
                  >
                    <AppImage
                      src={tile.src}
                      srcSet={mosaicSrcSet(tile.src, tile.srcSetWidths)}
                      sizes={tile.sizes}
                      width={tile.width}
                      height={tile.height}
                      loading={index === 0 ? "eager" : "lazy"}
                      alt={tile.alt}
                      className="hm-mosaic-image"
                      style={{ objectPosition: tile.position ?? "center center" }}
                      decoding="async"
                      fetchPriority={index === 0 && tileIndex === 0 ? "high" : "auto"}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div className="hm-pan-overlay" />
      </div>

      <div className="container-wide hm-pan-shell">
        <div className="hm-pan-copy" key={slide.id}>
          <p className="sunnah-hero-kicker hm-scramble-kicker" aria-label={slide.eyebrow}>
            {scrambledEyebrow}
          </p>
          <h1 aria-label={slide.title}>
            <span>{typedTitle}</span>
            <span className={`hm-type-cursor ${typing ? "is-typing" : ""}`} aria-hidden="true">
              |
            </span>
          </h1>
          <p className="hm-hero-description-reveal">{slide.description}</p>
          <div className="sunnah-hero-actions hm-hero-actions-reveal">
            <Link href={slide.ctaHref} className="sunnah-solid-cta">
              {slide.ctaLabel}
              <ArrowRightIcon size={15} />
            </Link>
            <Link href={slide.secondaryHref} className="sunnah-text-cta">
              {slide.secondaryLabel} →
            </Link>
          </div>
          <div className="hm-pan-pills hm-hero-pills-reveal">
            <span>Nationwide delivery</span>
            <span>Retail &amp; wholesale</span>
            <span>Support before &amp; after purchase</span>
          </div>
        </div>

        <div className="hm-pan-controls" aria-label="Hero composition controls">
          <button type="button" onClick={() => transitionTo(active - 1)} aria-label="Previous composition">
            <ChevronLeftIcon size={16} />
          </button>
          <div className="hm-pan-dots">
            {slides.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => transitionTo(index)}
                className={index === active ? "is-active" : ""}
                aria-label={`Show composition ${index + 1}`}
                aria-pressed={index === active}
              />
            ))}
          </div>
          <button type="button" onClick={() => transitionTo(active + 1)} aria-label="Next composition">
            <ChevronRightIcon size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
