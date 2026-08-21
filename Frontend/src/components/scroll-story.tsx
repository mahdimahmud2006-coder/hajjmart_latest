"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AppImage } from "./app-image";
import { ArrowRightIcon } from "./icons";

const scenes = [
  {
    number: "01",
    eyebrow: "Prepare",
    title: "Begin with clarity.",
    copy: "Move from product overload to a calmer edit of what matters: clothing, comfort, documents, travel and devotional essentials.",
    image: "/images/refined-v3/madina-lantern-architecture.jpg",
    href: "/shop",
    cta: "Build your list",
  },
  {
    number: "02",
    eyebrow: "Move",
    title: "Designed around long days.",
    copy: "Practical merchandising keeps repeat-use items close at hand while the visual story carries the feeling of movement, crowds and sacred travel.",
    image: "/images/motion-v2/pilgrim-passage.jpg",
    href: "/shop?q=travel",
    cta: "Explore travel essentials",
  },
  {
    number: "03",
    eyebrow: "Reflect",
    title: "Leave space for meaning.",
    copy: "Editorial pauses, devotional imagery and preparation guides break up the catalogue so shopping does not flatten the journey into transactions.",
    image: "/images/refined-v3/madina-striped-arch.jpg",
    href: "/guides",
    cta: "Read the pilgrim journal",
  },
  {
    number: "04",
    eyebrow: "Return",
    title: "Bring something meaningful home.",
    copy: "Giftable pieces, reminders and thoughtful essentials sit within the same HajjMart cart and checkout flow — now presented with a more considered visual rhythm.",
    image: "/images/refined-v3/madina-geometric-lantern.jpg",
    href: "/shop?q=gift",
    cta: "Explore gifts",
  },
];

export function ScrollStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / travel));
      section.style.setProperty("--story-progress", progress.toFixed(4));
      const next = Math.min(scenes.length - 1, Math.floor(progress * scenes.length));
      if (next !== activeRef.current) {
        activeRef.current = next;
        setActive(next);
      }
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section ref={sectionRef} className="motion-story" aria-label="HajjMart preparation journey">
      <div className="motion-story-sticky container-wide">
        <div className="motion-story-visual" aria-hidden="true">
          {scenes.map((scene, index) => (
            <div key={scene.title} className={`motion-story-frame ${index === active ? "is-active" : ""} ${index < active ? "is-past" : ""}`}>
              <AppImage src={scene.image} alt="" className="h-full w-full object-cover" />
              <span className="motion-story-image-shade" />
              <span className="motion-story-index">{scene.number}</span>
            </div>
          ))}
          <div className="motion-story-orbit" />
        </div>

        <div className="motion-story-copy-shell">
          <div className="motion-story-progress" aria-hidden="true">
            <span style={{ height: `${((active + 1) / scenes.length) * 100}%` }} />
          </div>
          <div className="motion-story-copy">
            <span className="eyebrow">Scroll through preparation</span>
            <div className="motion-story-copy-stage">
              {scenes.map((scene, index) => (
                <article key={scene.title} className={`motion-story-panel ${index === active ? "is-active" : ""}`} aria-hidden={index !== active}>
                  <small>{scene.number} · {scene.eyebrow}</small>
                  <h2>{scene.title}</h2>
                  <p>{scene.copy}</p>
                  <Link href={scene.href}>{scene.cta}<ArrowRightIcon size={15} /></Link>
                </article>
              ))}
            </div>
            <div className="motion-story-dots" aria-label="Story progress">
              {scenes.map((scene, index) => (
                <button key={scene.number} type="button" className={index === active ? "is-active" : ""} onClick={() => {
                  const section = sectionRef.current;
                  if (!section) return;
                  const target = section.offsetTop + ((index + 0.05) / scenes.length) * Math.max(1, section.offsetHeight - window.innerHeight);
                  window.scrollTo({ top: target, behavior: "smooth" });
                }} aria-label={`Jump to ${scene.eyebrow}`} aria-pressed={index === active} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
