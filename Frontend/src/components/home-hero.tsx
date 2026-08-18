"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { HomepageSection } from "@/lib/types";
import { AppImage } from "./app-image";
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";

const FALLBACK_IMAGE = "/images/decor/madina-watercolor.jpg";

export function HomeHero({ sections }: { sections: HomepageSection[] }) {
  const slides = useMemo(() => sections.filter((section) => section.kind === "hero"), [sections]);
  const usable = slides.length ? slides : sections.slice(0, 1);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (usable.length < 2) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % usable.length), 7200);
    return () => window.clearInterval(timer);
  }, [usable.length]);

  const slide = usable[active] || {
    title: "Everything for the journey of a lifetime.",
    description: "Thoughtfully selected Hajj and Umrah essentials, delivered across Bangladesh with care.",
    eyebrow: "Prepared with intention",
    cta_label: "Explore essentials",
    cta_url: "/shop",
    image_url: FALLBACK_IMAGE,
  };

  return (
    <section className={`hero-shell theme-${slide.theme || "forest"}`}>
      <div className="hero-pattern" aria-hidden="true" />
      <div className="hero-ring ring-one" aria-hidden="true" />
      <div className="hero-ring ring-two" aria-hidden="true" />
      <div className="container-wide relative z-10 grid min-h-[690px] items-center gap-6 py-12 lg:grid-cols-[1.03fr_.97fr] lg:py-16 xl:min-h-[740px]">
        <div className="relative z-20 max-w-[680px] pt-6 lg:pt-0">
          <p key={`${active}-eyebrow`} className="hero-eyebrow hero-enter">{slide.eyebrow || "Prepared with intention"}</p>
          <h1 key={`${active}-title`} className="hero-title hero-enter delay-1">{slide.title}</h1>
          <p key={`${active}-description`} className="hero-copy hero-enter delay-2">{slide.description}</p>
          <div key={`${active}-actions`} className="hero-enter delay-3 mt-8 flex flex-wrap items-center gap-3">
            <Link href={slide.cta_url || "/shop"} className="button-gold">{slide.cta_label || "Shop the collection"}<ArrowRightIcon size={17}/></Link>
            <Link href="/faq" className="button-ghost-light">Pilgrim preparation guide</Link>
          </div>
          <div className="mt-12 grid max-w-xl grid-cols-3 gap-5 border-t border-white/15 pt-6 text-white/72">
            <div><strong className="hero-stat">500+</strong><span>journey essentials</span></div>
            <div><strong className="hero-stat">64</strong><span>district delivery</span></div>
            <div><strong className="hero-stat">2</strong><span>Dhaka stores</span></div>
          </div>
        </div>

        <div className="relative mx-auto h-[440px] w-full max-w-[570px] sm:h-[540px] lg:h-[590px]">
          <div className="hero-image-frame">
            <AppImage key={`${active}-image`} src={slide.image_url || FALLBACK_IMAGE} fallback={FALLBACK_IMAGE} alt={slide.title} className="hero-main-image hero-image-enter" />
            <div className="hero-image-wash" />
          </div>
          <div className="hero-floating-card">
            <span className="block text-[10px] uppercase tracking-[.24em] text-[var(--gold-dark)]">HajjMart promise</span>
            <strong className="mt-2 block font-serif text-xl text-[var(--ink)]">Chosen for comfort, dignity and peace of mind.</strong>
          </div>
          <div className="hero-calligraphy" aria-hidden="true">لَبَّيْكَ</div>
        </div>
      </div>

      {usable.length > 1 ? (
        <div className="container-wide absolute inset-x-0 bottom-6 z-20 flex items-center justify-between">
          <div className="flex gap-2">{usable.map((item, index) => <button key={item.id} onClick={() => setActive(index)} className={`hero-dot ${index === active ? "active" : ""}`} aria-label={`Show slide ${index + 1}`} />)}</div>
          <div className="flex gap-2"><button className="hero-arrow" onClick={() => setActive((active - 1 + usable.length) % usable.length)} aria-label="Previous slide"><ChevronLeftIcon size={18}/></button><button className="hero-arrow" onClick={() => setActive((active + 1) % usable.length)} aria-label="Next slide"><ChevronRightIcon size={18}/></button></div>
        </div>
      ) : null}
    </section>
  );
}
