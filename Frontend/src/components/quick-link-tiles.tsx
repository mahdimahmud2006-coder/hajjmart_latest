import Link from "next/link";
import type { Category } from "@/lib/types";
import { sacredQuickLinks } from "@/lib/sacred-media";
import { AppImage } from "./app-image";
import { ArrowRightIcon } from "./icons";
import { Reveal } from "./reveal";

export function QuickLinkTiles({ categories }: { categories: Category[] }) {
  const linkedTiles = sacredQuickLinks.map((tile) => {
    const matchingCategory = categories.find((category) => `${category.slug} ${category.name}`.toLowerCase().includes(tile.label.split(" ")[0].toLowerCase()));
    return {
      ...tile,
      href: matchingCategory ? `/category/${matchingCategory.slug}` : tile.href,
    };
  });

  return (
    <section className="quick-link-section container-wide pb-12 sm:pb-20">
      <Reveal>
        <div className="quick-link-heading">
          <div><p className="eyebrow">Curated paths</p><h2 className="mt-3 font-serif text-4xl sm:text-5xl">Start inside the parts of the journey that matter most.</h2></div>
          <p>Collection shortcuts rebuilt around your chosen spiritual and architectural imagery, while still linking into the live HajjMart catalogue.</p>
        </div>
      </Reveal>
      <div className="quick-link-grid">
        {linkedTiles.map((tile, index) => (
          <Reveal key={tile.label} delay={index * 60}>
            <Link href={tile.href} className="quick-link-tile group">
              <AppImage src={tile.image} alt={tile.label} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.055]" />
              <span className="quick-link-shade" aria-hidden="true" />
              <span className="quick-link-content"><small>0{index + 1}</small><strong>{tile.label}</strong><b>{tile.caption}</b><em>Explore <ArrowRightIcon size={15} /></em></span>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
