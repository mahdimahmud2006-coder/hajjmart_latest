import Link from "next/link";
import type { Category, HomepageSection, Product } from "@/lib/types";
import { HomeHero } from "./home-hero";
import { HomePromoBanners } from "./home-promo-banners";
import { ProductGrid } from "./product-grid";
import { ProductRail } from "./product-rail";
import { QuickLinkTiles } from "./quick-link-tiles";
import { EditorialRail } from "./editorial-rail";
import { NewsletterCapture } from "./newsletter-capture";
import { ScrollStory } from "./scroll-story";
import { SacredMarquee } from "./sacred-marquee";
import { AppImage } from "./app-image";
import { PurposeTypewriter } from "./purpose-typewriter";
import { LoopingTypeDeleteHeading } from "./looping-type-delete-heading";
import { HeadsetIcon, RotateIcon, ShieldIcon, TruckIcon } from "./icons";

export function HomePage({ sections, categories, products }: { sections: HomepageSection[]; categories: Category[]; products: Product[] }) {
  const featured = products.filter((product) => product.is_featured).slice(0, 8);
  const primaryProducts = featured.length >= 4 ? featured : products.slice(0, 8);
  const carriedProducts = products.slice().sort((a, b) => Number(b.sold_count || 0) - Number(a.sold_count || 0)).slice(0, 10);

  return (
    <main className="sunnah-storefront-home">
      <HomeHero sections={sections} />
      <SacredMarquee />

      <section className="sunnah-trust-strip">
        <div className="container-wide sunnah-trust-grid">
          {[
            [TruckIcon, "Nationwide delivery", "Across all 64 districts"],
            [ShieldIcon, "Pilgrim-ready quality", "Selected for practical use"],
            [RotateIcon, "Easy exchange", "Clear after-sales support"],
            [HeadsetIcon, "Real guidance", "Talk to HajjMart care"],
          ].map(([Icon, title, copy]) => {
            const TrustIcon = Icon as typeof TruckIcon;
            return <div key={String(title)}><TrustIcon size={20}/><span><strong>{String(title)}</strong><small>{String(copy)}</small></span></div>;
          })}
        </div>
      </section>

      <HomePromoBanners sections={sections} />

      <ProductRail
        products={carriedProducts.length ? carriedProducts : primaryProducts}
        eyebrow="Best sellers"
        title="Most carried by pilgrims"
        copy="The HajjMart pieces customers choose most often for a calmer, more practical journey."
        href="/shop?sort=best_selling"
      />

      <ScrollStory />

      <QuickLinkTiles categories={categories} />


      <section className="sunnah-favourites-section">
        <div className="container-wide">
          <div className="sunnah-section-heading">
            <div><span>HajjMart edit</span><LoopingTypeDeleteHeading /></div>
            <Link href="/shop">Shop all products →</Link>
          </div>
          <ProductGrid products={primaryProducts} />
        </div>
      </section>

      <section className="sunnah-purpose-section">
        <div className="container-wide sunnah-purpose-grid">
          <div className="sunnah-purpose-image"><AppImage src="/images/motion-v2/madina-sunset.jpg" alt="Watercolour illustration of Madina" className="h-full w-full object-cover" /></div>
          <PurposeTypewriter />
        </div>
      </section>

      <EditorialRail />
      <NewsletterCapture />
    </main>
  );
}
