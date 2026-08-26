"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { HomepageSection, PublicPromotion } from "@/lib/types";
import { AppImage } from "./app-image";
import { Lang } from "./lang";
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { banglaFallback, hasBangla } from "@/lib/i18n";

const FALLBACK_IMAGE = "/images/decor/madina-watercolor.jpg";


function heroBangla(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const translated = banglaFallback(value);
  return hasBangla(translated) && !/[A-Za-z]{2,}/.test(translated) ? translated : fallback;
}

export function HomeHero({ sections, promotion }: { sections: HomepageSection[]; promotion?: PublicPromotion | null }) {
  const slides = useMemo(() => sections.filter((section) => section.kind === "hero"), [sections]);
  const usable = slides.length ? slides : sections.slice(0, 1);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!promotion?.expires_at) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, [promotion?.expires_at]);

  useEffect(() => {
    if (usable.length < 2 || paused) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % usable.length), 7200);
    return () => window.clearInterval(timer);
  }, [paused, usable.length]);

  const slide: HomepageSection = usable[active] || {
    id: -1,
    kind: "hero",
    eyebrow: "Easy preparation",
    eyebrow_bn: "সহজ প্রস্তুতি",
    title: "Everything you need for Hajj and Umrah, in one place.",
    title_bn: "হজ ও উমরাহর জন্য যা যা লাগবে, এক জায়গায়।",
    description: "Ihram, bags, sandals and travel essentials, delivered across Bangladesh.",
    description_bn: "ইহরাম, ব্যাগ, স্যান্ডেল ও ভ্রমণের প্রয়োজনীয় পণ্য—সারা বাংলাদেশে ডেলিভারি।",
    cta_label: "Shop essentials",
    cta_label_bn: "পণ্য দেখুন",
    cta_url: "/shop",
    image_url: FALLBACK_IMAGE,
  };

  const metadataOfferTag = typeof slide.metadata?.offer_tag === "string" ? slide.metadata.offer_tag : null;
  const promotionLabel = promotion?.title || promotion?.code || null;
  const offerTag = metadataOfferTag || promotionLabel;
  let countdown: string | null = null;
  let countdownBn: string | null = null;
  if (promotion?.expires_at && now) {
    const expiryValue = /^\d{4}-\d{2}-\d{2}$/.test(promotion.expires_at) ? `${promotion.expires_at}T23:59:59+06:00` : promotion.expires_at;
    const remaining = Date.parse(expiryValue) - now;
    if (remaining > 0) {
      const hours = Math.ceil(remaining / 3_600_000);
      const days = Math.floor(hours / 24);
      countdown = days > 0 ? `${days}d ${hours % 24}h left` : `${hours}h left`;
      countdownBn = days > 0 ? `${days} দিন ${hours % 24} ঘণ্টা বাকি` : `${hours} ঘণ্টা বাকি`;
    }
  }

  return (
    <section
      className={`hero-shell theme-${slide.theme || "forest"}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false); }}
    >
      <div className="hero-pattern" aria-hidden="true" />
      <div className="hero-ring ring-one" aria-hidden="true" />
      <div className="hero-ring ring-two" aria-hidden="true" />
      <div className="container-wide relative z-10 grid min-h-[690px] items-center gap-6 py-12 lg:grid-cols-[1.03fr_.97fr] lg:py-16 xl:min-h-[740px]">
        <div className="relative z-20 max-w-[680px] pt-6 lg:pt-0">
          {offerTag ? <p className="hero-offer-tag"><Lang bn={banglaFallback(offerTag)} en={offerTag}/>{countdown ? <span> · <Lang bn={countdownBn || undefined} en={countdown}/></span> : null}</p> : null}
          <p key={`${active}-eyebrow`} className="hero-eyebrow hero-enter"><Lang bn={slide.eyebrow_bn && hasBangla(slide.eyebrow_bn) ? slide.eyebrow_bn : heroBangla(slide.eyebrow, "সহজ প্রস্তুতি")} en={slide.eyebrow || "Easy preparation"}/></p>
          <h1 key={`${active}-title`} className="hero-title hero-enter delay-1"><Lang bn={slide.title_bn && hasBangla(slide.title_bn) ? slide.title_bn : heroBangla(slide.title, "হজ ও উমরাহর প্রস্তুতির প্রয়োজনীয় পণ্য")} en={slide.title}/></h1>
          <p key={`${active}-description`} className="hero-copy hero-enter delay-2"><Lang bn={slide.description_bn && hasBangla(slide.description_bn) ? slide.description_bn : heroBangla(slide.description, "বাংলাদেশি হজ ও উমরাহ যাত্রীদের জন্য যত্ন করে বাছাই করা প্রয়োজনীয় সামগ্রী।")} en={slide.description || ""}/></p>
          <div key={`${active}-actions`} className="hero-enter delay-3 mt-8 flex flex-wrap items-center gap-3">
            <Link href={slide.cta_url || "/shop"} className="button-gold"><Lang bn={slide.cta_label_bn && hasBangla(slide.cta_label_bn) ? slide.cta_label_bn : heroBangla(slide.cta_label, "পণ্য দেখুন")} en={slide.cta_label || "Shop essentials"}/><ArrowRightIcon size={17}/></Link>
            <Link href="/faq" className="button-ghost-light"><Lang bn="হজ প্রস্তুতি গাইড" en="Pilgrim guide"/></Link>
          </div>
          <div className="mt-12 grid max-w-xl grid-cols-3 gap-5 border-t border-white/15 pt-6 text-white/72">
            <div><strong className="hero-stat">500+</strong><span><Lang bn="প্রয়োজনীয় পণ্য" en="essential products"/></span></div>
            <div><strong className="hero-stat">64</strong><span><Lang bn="জেলায় ডেলিভারি" en="districts delivered"/></span></div>
            <div><strong className="hero-stat">01720</strong><span><Lang bn="ফোনে অর্ডার সহায়তা" en="phone order help"/></span></div>
          </div>
        </div>

        <div className="relative mx-auto h-[440px] w-full max-w-[570px] sm:h-[540px] lg:h-[590px]">
          <div className="hero-image-frame">
            <AppImage key={`${active}-image`} src={slide.image_url || FALLBACK_IMAGE} fallback={FALLBACK_IMAGE} alt={slide.title} className="hero-main-image hero-image-enter" />
            <div className="hero-image-wash" />
          </div>
          <div className="hero-floating-card">
            <span className="block text-xs font-bold text-[var(--gold-dark)]"><Lang bn="হজমার্ট সহায়তা" en="HajjMart support"/></span>
            <strong className="mt-2 block text-lg font-bold text-[var(--ink)]"><Lang bn="কী কিনবেন বুঝতে না পারলে ফোন করুন—আমরা সাহায্য করব।" en="Not sure what to buy? Call us and we will help."/></strong>
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
