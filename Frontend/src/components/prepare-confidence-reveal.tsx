import Link from "next/link";
import type { Category, HomepageSection } from "@/lib/types";
import { Reveal } from "./reveal";
import { AppImage } from "./app-image";
import { ArrowRightIcon } from "./icons";
import { Lang } from "./lang";
import { getCategoryImage } from "@/lib/utils";
import { hasBangla } from "@/lib/i18n";

const FALLBACKS = ["/images/products/ihram-package.svg", "/images/products/travel-kit.svg", "/images/products/sandal.svg"];
const FALLBACK_COPY = [
  { titleBn: "ইহরামের প্রয়োজনীয় সামগ্রী", titleEn: "Ihram essentials", eyebrowBn: "সহজভাবে শুরু করুন", eyebrowEn: "Begin simply" },
  { titleBn: "আরামদায়ক ভ্রমণ", titleEn: "Travel comfort", eyebrowBn: "আরামে ভ্রমণ করুন", eyebrowEn: "Travel comfortably" },
  { titleBn: "প্রস্তুত প্যাকেজ", titleEn: "Ready-to-go kits", eyebrowBn: "নিশ্চিন্তে গুছিয়ে নিন", eyebrowEn: "Pack with confidence" },
];

export function PrepareConfidenceReveal({ sections, categories }: { sections: HomepageSection[]; categories: Category[] }) {
  const sectionCards = sections.filter((section) => section.kind !== "hero" && section.kind !== "announcement").slice(0, 3);
  const cards = Array.from({ length: 3 }, (_, index) => {
    const section = sectionCards[index];
    const category = section?.category || categories[index];
    const fallback = FALLBACK_COPY[index];
    return {
      id: section?.id ?? category?.id ?? index,
      titleEn: section?.title || category?.name || fallback.titleEn,
      titleBn: section?.title_bn || category?.name_bn || undefined,
      descriptionEn: section?.description || category?.description || "A focused edit that keeps preparation clear, useful and calm.",
      descriptionBn: section?.description_bn && hasBangla(section.description_bn) ? section.description_bn : category?.description_bn && hasBangla(category.description_bn) ? category.description_bn : "প্রস্তুতি পরিষ্কার, প্রয়োজনীয় ও শান্ত রাখতে যত্ন করে বাছাই করা পণ্য।",
      href: section?.cta_url || (category ? `/category/${category.slug}` : "/shop"),
      image: section?.image_url || (category ? getCategoryImage(category) : null) || FALLBACKS[index],
      eyebrowEn: section?.eyebrow || fallback.eyebrowEn,
      eyebrowBn: section?.eyebrow_bn || fallback.eyebrowBn,
    };
  });

  return <section className="prepare-confidence section-space" aria-labelledby="prepare-confidence-title">
    <div className="container-wide">
      <Reveal><div className="prepare-confidence-head"><div><p className="eyebrow"><Lang bn="আত্মবিশ্বাসের সাথে প্রস্তুতি নিন" en="Prepare with confidence"/></p><h2 id="prepare-confidence-title" className="section-title mt-3"><Lang bn="গোছানো ব্যাগের পথে তিনটি সহজ ধাপ।" en="Three calmer steps toward a ready suitcase."/></h2></div><p><Lang bn="হজমার্টের পরিচিত সহজ ভাষা, প্রয়োজনীয় ক্যাটাগরি ও অপ্রয়োজনীয় ঝামেলাহীন নির্দেশনা দিয়ে তৈরি।" en="Built from the same journey language already used across HajjMart—quiet guidance, useful categories and no extra visual noise."/></p></div></Reveal>
      <div className="prepare-confidence-grid stagger-children">{cards.map((card, index) => <Reveal key={card.id} delay={index * 90}><Link href={card.href} className="prepare-confidence-card group"><AppImage src={card.image} alt={card.titleEn} className="prepare-confidence-image"/><div className="prepare-confidence-wash"/><span className="prepare-confidence-index">0{index + 1}</span><div className="prepare-confidence-copy"><p><Lang bn={card.eyebrowBn} en={card.eyebrowEn}/></p><h3><Lang bn={card.titleBn} en={card.titleEn}/></h3><span><Lang bn={card.descriptionBn} en={card.descriptionEn}/></span><b><Lang bn="দেখুন" en="Explore"/> <ArrowRightIcon size={15}/></b></div></Link></Reveal>)}</div>
    </div>
  </section>;
}
