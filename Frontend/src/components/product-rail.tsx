"use client";

import { useRef } from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { ProductCard } from "./product-card";
import { Reveal } from "./reveal";

export function ProductRail({
  products,
  eyebrow = "Most carried by pilgrims",
  title = "Proven essentials for the journey.",
  copy = "A quick-moving edit of practical pieces pilgrims choose again and again.",
  href = "/shop?sort=best_selling",
}: {
  products: Product[];
  eyebrow?: string;
  title?: string;
  copy?: string;
  href?: string;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  function move(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.max(280, rail.clientWidth * 0.78), behavior: "smooth" });
  }

  if (!products.length) return null;

  return (
    <section className="product-rail-section section-space">
      <div className="container-wide">
        <div className="product-rail-heading">
          <div className="max-w-2xl">
            <p className="eyebrow">{eyebrow}</p>
            <h2 className="section-title mt-3">{title}</h2>
            <p className="section-copy mt-4">{copy}</p>
          </div>
          <div className="product-rail-actions">
            <button type="button" className="product-rail-arrow" onClick={() => move(-1)} aria-label="Scroll products left"><ChevronLeftIcon size={18}/></button>
            <button type="button" className="product-rail-arrow" onClick={() => move(1)} aria-label="Scroll products right"><ChevronRightIcon size={18}/></button>
            <Link href={href} className="text-link">View all<ArrowRightIcon size={16}/></Link>
          </div>
        </div>
        <div ref={railRef} className="product-rail" tabIndex={0} aria-label={`${title} product rail`}>
          {products.map((product, index) => <Reveal className="product-rail-reveal" delay={index * 115} key={product.id}><div className="product-rail-item"><ProductCard product={product} priority={index < 2}/></div></Reveal>)}
        </div>
      </div>
    </section>
  );
}
