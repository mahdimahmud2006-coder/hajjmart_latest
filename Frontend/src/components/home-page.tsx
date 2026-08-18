import Link from "next/link";
import type { Category, HomepageSection, Product } from "@/lib/types";
import { HomeHero } from "./home-hero";
import { ScrollJourneyReveal } from "./scroll-journey-reveal";
import { PrepareConfidenceReveal } from "./prepare-confidence-reveal";
import { RecentlyViewedRail } from "./recently-viewed-rail";
import { ProductGrid } from "./product-grid";
import { Reveal } from "./reveal";
import { AppImage } from "./app-image";
import { ArrowRightIcon, HeadsetIcon, PackageIcon, RotateIcon, ShieldIcon, TruckIcon } from "./icons";

function SectionTitle({ eyebrow, title, copy, link }: { eyebrow: string; title: string; copy?: string; link?: { href: string; label: string } }) {
  return (
    <div className="mb-9 flex flex-col gap-5 sm:mb-12 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl"><p className="eyebrow">{eyebrow}</p><h2 className="section-title mt-3">{title}</h2>{copy ? <p className="section-copy mt-4">{copy}</p> : null}</div>
      {link ? <Link href={link.href} className="text-link shrink-0">{link.label}<ArrowRightIcon size={16}/></Link> : null}
    </div>
  );
}

export function HomePage({ sections, categories, products }: { sections: HomepageSection[]; categories: Category[]; products: Product[] }) {
  const bannerSections = sections.filter((section) => section.kind !== "hero" && section.kind !== "announcement");
  const categoryBanner = bannerSections.find((section) => section.kind === "category_banner") || bannerSections[0];
  const editorial = bannerSections.find((section) => section.kind === "editorial_banner") || bannerSections[1];
  const featured = products.filter((product) => product.is_featured).slice(0, 8);
  const primaryProducts = featured.length >= 4 ? featured : products.slice(0, 8);
  const newProducts = products.slice().reverse().slice(0, 4);

  return (
    <main>
      <HomeHero sections={sections} />

      <section className="trust-bar">
        <div className="container-wide grid grid-cols-2 divide-x divide-y divide-black/8 md:grid-cols-4 md:divide-y-0">
          {[
            [TruckIcon, "Delivery nationwide", "Carefully packed for all 64 districts", "Clear delivery expectations before you place the order."],
            [ShieldIcon, "Quality considered", "Selected for the realities of pilgrimage", "Practical selection stays ahead of unnecessary extras."],
            [RotateIcon, "Easy exchange", "Clear, respectful after-sales support", "Exchange guidance stays close when a size or item needs changing."],
            [HeadsetIcon, "Real guidance", "Talk to our HajjMart care team", "Ask the care team when a product choice feels unclear."],
          ].map(([Icon, title, copy, more]) => {
            const TrustIcon = Icon as typeof TruckIcon;
            return <div key={String(title)} className="trust-item" tabIndex={0}><TrustIcon size={25}/><div><strong>{String(title)}</strong><span>{String(copy)}</span><small className="trust-more">{String(more)}</small></div></div>;
          })}
        </div>
      </section>

      <ScrollJourneyReveal categories={categories} />
      <PrepareConfidenceReveal sections={sections} categories={categories} />

      <section className="section-space favourites-architectural">
        <div className="favourites-architectural-panels" aria-hidden="true" />
        <div className="favourites-architectural-texture" aria-hidden="true" />
        <div className="container-wide favourites-architectural-inner">
          <Reveal><SectionTitle eyebrow="HajjMart favourites" title="Essentials pilgrims return for." copy="Reliable, useful pieces that earn their place in the suitcase." link={{ href: "/shop?sort=best_selling", label: "Shop all favourites" }} /></Reveal>
          <ProductGrid products={primaryProducts} />
        </div>
      </section>

      {categoryBanner ? (
        <section className="container-wide pb-8 sm:pb-14">
          <Reveal>
            <div className={`feature-banner theme-${categoryBanner.theme || "sand"}`}>
              <div className="feature-banner-pattern" aria-hidden="true" />
              <div className="relative z-10 max-w-xl py-14 pl-7 pr-7 sm:py-20 sm:pl-12 lg:py-28 lg:pl-20">
                <p className="eyebrow text-current/65">{categoryBanner.eyebrow || "Complete preparation"}</p>
                <h2 className="mt-4 font-serif text-4xl leading-[1.04] sm:text-5xl lg:text-6xl">{categoryBanner.title}</h2>
                <p className="mt-5 max-w-lg text-[15px] leading-7 opacity-70 sm:text-base">{categoryBanner.description}</p>
                <Link href={categoryBanner.cta_url || "/shop"} className="button-dark mt-8">{categoryBanner.cta_label || "Explore collection"}<ArrowRightIcon size={17}/></Link>
              </div>
              <div className="feature-banner-image-wrap"><AppImage src={categoryBanner.image_url || "/images/products/ihram-package.svg"} alt={categoryBanner.title} className="h-full w-full object-cover" /></div>
            </div>
          </Reveal>
        </section>
      ) : null}

      <section className="section-space overflow-hidden bg-[var(--forest)] text-white">
        <div className="container-wide grid items-center gap-12 lg:grid-cols-[.9fr_1.1fr]">
          <Reveal className="relative min-h-[460px]">
            <div className="absolute inset-0 overflow-hidden rounded-[2rem] bg-white/5">
              <AppImage src="/images/decor/madina-watercolor.jpg" alt="Watercolour illustration of Madina" className="h-full w-full object-cover mix-blend-screen" />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--forest)]/70 via-transparent to-transparent" />
            </div>
            <div className="absolute -bottom-7 -right-5 hidden h-44 w-44 rounded-full border border-[var(--gold-light)]/35 sm:block" />
          </Reveal>
          <Reveal delay={120}>
            <p className="eyebrow text-[var(--gold-light)]">A store with a purpose</p>
            <h2 className="mt-4 max-w-2xl font-serif text-4xl leading-[1.08] sm:text-5xl lg:text-6xl">Less worry in the suitcase. More space in the heart.</h2>
            <p className="mt-6 max-w-xl text-base leading-8 text-white/68">HajjMart began with a simple belief: sacred travel preparation should feel clear, dignified and human. We combine practical products with guidance that understands Bangladeshi pilgrims.</p>
            <div className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="journey-number"><strong>01</strong><span>Choose with confidence</span></div>
              <div className="journey-number"><strong>02</strong><span>Pack with simplicity</span></div>
              <div className="journey-number col-span-2 sm:col-span-1"><strong>03</strong><span>Travel with focus</span></div>
            </div>
            <Link href="/about" className="button-outline-light mt-9">Discover our story<ArrowRightIcon size={17}/></Link>
          </Reveal>
        </div>
      </section>

      <section className="section-space bg-[var(--paper)]">
        <div className="container-wide">
          <Reveal><SectionTitle eyebrow="Newly considered" title="Fresh additions for a smoother journey." link={{ href: "/shop?sort=newest", label: "See new arrivals" }} /></Reveal>
          <ProductGrid products={newProducts} />
        </div>
      </section>

      <section className="container-wide pb-16 sm:pb-24">
        <RecentlyViewedRail products={products}/>
      </section>

      <section className="section-space bg-white">
        <div className="container-wide">
          <Reveal><SectionTitle eyebrow="The pilgrim journal" title="Useful knowledge, before departure." copy="Practical preparation notes, product guidance and thoughtful reminders for Hajj and Umrah from Bangladesh." link={{ href: "/faq", label: "Open the guide" }} /></Reveal>
          <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
            <Reveal>
              <Link href="/faq" className="journal-main group">
                <AppImage src={editorial?.image_url || "/images/decor/mosque-collage.jpg"} fallback="/images/decor/mosque-collage.jpg" alt="Pilgrim preparation guide" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-7 text-white sm:p-10"><p className="eyebrow text-[var(--gold-light)]">Featured guide</p><h3 className="mt-3 max-w-2xl font-serif text-3xl leading-tight sm:text-4xl">{editorial?.title || "The thoughtful Hajj and Umrah packing list."}</h3><p className="mt-3 max-w-xl text-sm leading-6 text-white/68">{editorial?.description || "A clear starting point for what matters, what helps and what can stay home."}</p><span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em]">Read guide <ArrowRightIcon size={15}/></span></div>
              </Link>
            </Reveal>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
              <Reveal delay={80}><Link href="/faq" className="journal-small group"><span className="journal-number">01</span><div><p className="eyebrow">Footwear</p><h3>Which sandals work best during Ihram?</h3><span>Read in 4 min →</span></div></Link></Reveal>
              <Reveal delay={140}><Link href="/faq" className="journal-small dark group"><span className="journal-number">02</span><div><p className="eyebrow text-[var(--gold-light)]">Health & comfort</p><h3>A practical care kit for hot, crowded days.</h3><span>Read in 6 min →</span></div></Link></Reveal>
            </div>
          </div>
        </div>
      </section>

      <section className="newsletter-section">
        <div className="newsletter-pattern" aria-hidden="true" />
        <div className="container-narrow relative z-10 py-16 text-center sm:py-20">
          <PackageIcon className="mx-auto text-[var(--gold)]" size={31}/>
          <p className="eyebrow mt-5">Journey notes</p>
          <h2 className="mx-auto mt-3 max-w-3xl font-serif text-4xl leading-tight sm:text-5xl">Gentle reminders and useful preparation, delivered occasionally.</h2>
          <form className="mx-auto mt-8 flex max-w-xl flex-col gap-2 sm:flex-row"><input type="email" required placeholder="Your email address" className="newsletter-input"/><button className="button-primary shrink-0" type="submit">Join the journal</button></form>
          <p className="mt-3 text-xs text-[var(--muted)]">No noise. Only considered updates from HajjMart.</p>
        </div>
      </section>
    </main>
  );
}
