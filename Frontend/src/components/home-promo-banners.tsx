import Link from "next/link";
import type { HomepageSection } from "@/lib/types";
import { AppImage } from "./app-image";
import { ArrowRightIcon } from "./icons";

const PROMOS = [
  {
    eyebrow: "Madina details",
    title: "Preparation can be practical without feeling ordinary.",
    description: "Shop travel, comfort and devotional essentials through a calmer visual rhythm shaped by sacred architecture and warm material detail.",
    image: "/images/hero-v4/calligraphy-ceiling.jpg",
    href: "/shop?sort=best_selling",
    label: "Shop the HajjMart edit",
  },
  {
    eyebrow: "Makkah details",
    title: "Small things carried with intention.",
    description: "Move from inspiration to the live catalogue with real pricing, stock, cart, checkout and after-sales support kept fully intact.",
    image: "/images/hero-v4/kaaba-kiswa-detail.jpg",
    href: "/shop?q=travel",
    label: "Explore preparation essentials",
  },
];

export function HomePromoBanners({ sections }: { sections: HomepageSection[] }) {
  const configured = sections.filter((section) => section.kind !== "hero" && section.kind !== "announcement" && !/prepare your bag|question before checkout|keep your packing simple/i.test(`${section.title || ""} ${section.description || ""}`));
  const promos = PROMOS.map((promo, index) => ({
    ...promo,
    title: configured[index]?.title || promo.title,
    description: configured[index]?.description || promo.description,
    href: configured[index]?.cta_url || promo.href,
    label: configured[index]?.cta_label || promo.label,
    eyebrow: configured[index]?.eyebrow || promo.eyebrow,
  }));

  return (
    <section className="sunnah-promo-stack container-wide">
      {promos.map((promo, index) => (
        <article key={`${promo.title}-${index}`} className={`sunnah-promo-banner ${index % 2 ? "is-reversed" : ""}`}>
          <div className="sunnah-promo-image"><AppImage src={promo.image} alt={promo.title} className="h-full w-full object-cover" /></div>
          <div className="sunnah-promo-copy">
            <span>{promo.eyebrow}</span>
            <h2>{promo.title}</h2>
            <p>{promo.description}</p>
            <Link href={promo.href}>{promo.label}<ArrowRightIcon size={15} /></Link>
          </div>
        </article>
      ))}
    </section>
  );
}
