import Link from "next/link";
import type { Category, HomepageSection } from "@/lib/types";
import { Reveal } from "./reveal";
import { AppImage } from "./app-image";
import { ArrowRightIcon } from "./icons";
import { getCategoryImage } from "@/lib/utils";

const FALLBACKS = ["/images/products/ihram-package.svg", "/images/products/travel-kit.svg", "/images/products/sandal.svg"];

export function PrepareConfidenceReveal({ sections, categories }: { sections: HomepageSection[]; categories: Category[] }) {
  const sectionCards = sections.filter((section) => section.kind !== "hero" && section.kind !== "announcement").slice(0, 3);
  const cards = Array.from({ length: 3 }, (_, index) => {
    const section = sectionCards[index];
    const category = section?.category || categories[index];
    return {
      id: section?.id ?? category?.id ?? index,
      title: section?.title || category?.name || ["Ihram essentials", "Travel comfort", "Ready-to-go kits"][index],
      description: section?.description || category?.description || "A focused edit that keeps preparation clear, useful and calm.",
      href: section?.cta_url || (category ? `/category/${category.slug}` : "/shop"),
      image: section?.image_url || (category ? getCategoryImage(category) : null) || FALLBACKS[index],
      eyebrow: section?.eyebrow || ["Begin simply", "Travel comfortably", "Pack with confidence"][index],
    };
  });

  return <section className="prepare-confidence section-space" aria-labelledby="prepare-confidence-title">
    <div className="container-wide">
      <Reveal><div className="prepare-confidence-head"><div><p className="eyebrow">Prepare with confidence</p><h2 id="prepare-confidence-title" className="section-title mt-3">Three calmer steps toward a ready suitcase.</h2></div><p>Built from the same journey language already used across HajjMart—quiet guidance, useful categories and no extra visual noise.</p></div></Reveal>
      <div className="prepare-confidence-grid stagger-children">{cards.map((card, index) => <Reveal key={card.id} delay={index * 90}><Link href={card.href} className="prepare-confidence-card group"><AppImage src={card.image} alt={card.title} className="prepare-confidence-image"/><div className="prepare-confidence-wash"/><span className="prepare-confidence-index">0{index + 1}</span><div className="prepare-confidence-copy"><p>{card.eyebrow}</p><h3>{card.title}</h3><span>{card.description}</span><b>Explore <ArrowRightIcon size={15}/></b></div></Link></Reveal>)}</div>
    </div>
  </section>;
}
