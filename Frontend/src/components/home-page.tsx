import Link from "next/link";
import type { Category, HomepageSection, Product, PublicPromotion } from "@/lib/types";
import { HomeHero } from "./home-hero";
import { RecentlyViewedRail } from "./recently-viewed-rail";
import { ProductGrid } from "./product-grid";
import { PersonaCards } from "./persona-cards";
import { ProductShelf } from "./product-shelf";
import { CustomerProof } from "./customer-proof";
import { SourcingStories } from "./sourcing-stories";
import { ArrowRightIcon, HeadsetIcon, PackageIcon, RotateIcon, ShieldIcon, TruckIcon } from "./icons";
import { Lang } from "./lang";
import { banglaFallback } from "@/lib/i18n";
import { PaymentTrustBadges } from "./payment-trust-badges";

function productInCategory(product: Product, category: Category) {
  return product.categories?.some((item) => item.id === category.id || item.slug === category.slug) || product.primary_category?.slug === category.slug || product.primaryCategory?.slug === category.slug;
}

export function HomePage({ sections, categories, products, promotions }: { sections: HomepageSection[]; categories: Category[]; products: Product[]; promotions: PublicPromotion[] }) {
  const packageProducts = products.filter((product) => {
    const haystack = [product.name, product.name_bn, ...(product.categories || []).flatMap((category) => [category.name, category.name_bn, category.slug])].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes("package") || haystack.includes("bundle") || haystack.includes("প্যাকেজ");
  }).slice(0, 3);

  const shelves = categories
    .map((category) => ({ category, products: products.filter((product) => productInCategory(product, category)) }))
    .filter((shelf) => shelf.products.length > 0);

  return (
    <main>
      <HomeHero sections={sections} promotion={promotions[0] || null} />
      <PersonaCards products={products} />

      <section className="trust-bar" aria-label="কেন হজমার্ট থেকে কিনবেন / Why shop with HajjMart">
        <div className="container-wide grid grid-cols-2 divide-x divide-y divide-black/8 md:grid-cols-4 md:divide-y-0">
          {[
            { Icon: TruckIcon, titleBn: "সারা দেশে ডেলিভারি", titleEn: "Nationwide delivery", copyBn: "৬৪ জেলায়", copyEn: "All 64 districts" },
            { Icon: ShieldIcon, titleBn: "সহজ পেমেন্ট", titleEn: "Flexible payment", payment: true },
            { Icon: RotateIcon, titleBn: "সহজ এক্সচেঞ্জ", titleEn: "Easy exchange", copyBn: "পরিষ্কার বিক্রয়োত্তর সহায়তা", copyEn: "Clear after-sales support" },
            { Icon: HeadsetIcon, titleBn: "ফোনে অর্ডার সহায়তা", titleEn: "Order help by phone", copyBn: "01720 601515", copyEn: "01720 601515" },
          ].map(({ Icon, titleBn, titleEn, copyBn, copyEn, payment }) => <div key={titleEn} className="trust-item"><Icon size={26}/><div><strong><Lang bn={titleBn} en={titleEn}/></strong>{payment ? <PaymentTrustBadges compact/> : <span><Lang bn={copyBn || ""} en={copyEn || ""}/></span>}</div></div>)}
        </div>
      </section>

      <CustomerProof products={products}/>

      <section className="container-wide py-10 sm:py-14">
        <div className="guided-kit-banner">
          <div className="guided-kit-icon"><PackageIcon size={30}/></div>
          <div><p className="eyebrow"><span className="lang-bn">কী কী লাগবে বুঝতে পারছেন না?</span><span className="lang-en">Not sure what you need?</span></p><h2><span className="lang-bn">প্রশ্নের উত্তর দিয়ে নিজের হজ কিট বানান।</span><span className="lang-en">Build your Hajj kit with simple guided questions.</span></h2><p><span className="lang-bn">পণ্যের নাম জানা দরকার নেই—ইহরাম, জুতা, ভ্রমণ ও অতিরিক্ত জিনিস এক ধাপ করে বাছুন।</span><span className="lang-en">No product jargon required. Choose your core set, footwear, travel items and add-ons one step at a time.</span></p></div>
          <Link href="/build-your-package" className="button-gold shrink-0"><span className="lang-bn">কিট বানানো শুরু করুন</span><span className="lang-en">Build my kit</span><ArrowRightIcon size={17}/></Link>
        </div>
      </section>

      {packageProducts.length ? (
        <section className="section-space bg-[var(--mist)]">
          <div className="container-wide">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="eyebrow"><span className="lang-bn">সব কিছু একসাথে</span><span className="lang-en">Everything together</span></p><h2 className="mt-2 max-w-3xl text-4xl font-bold leading-tight text-[var(--ink)] sm:text-5xl"><span className="lang-bn">সম্পূর্ণ প্যাকেজ দিয়ে প্রস্তুতি সহজ করুন।</span><span className="lang-en">Start with a complete package and make preparation simpler.</span></h2><p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]"><span className="lang-bn">একবারে প্রয়োজনীয় কয়েকটি জিনিস বেছে নিলে শেষ মুহূর্তের দুশ্চিন্তা কমে। পণ্যের পাতায় প্যাকেজের বিস্তারিত দেখে নিশ্চিত করুন।</span><span className="lang-en">A complete starting set reduces last-minute decisions. Check each product page for the exact package details.</span></p></div>
              <Link href="/category/ihram-packages" className="text-link shrink-0"><span className="lang-bn">সব প্যাকেজ</span><span className="lang-en">View packages</span> <ArrowRightIcon size={15}/></Link>
            </div>
            <ProductGrid products={packageProducts} />
          </div>
        </section>
      ) : null}

      <div className="home-shelves">
        {shelves.map(({ category, products: shelfProducts }, index) => (
          <ProductShelf
            key={category.id}
            eyebrowBn={`${category.name_bn || banglaFallback(category.name)}${category.products_count !== undefined ? ` · ${category.products_count} পণ্য` : ""}`}
            eyebrowEn={`${category.name}${category.products_count !== undefined ? ` · ${category.products_count} products` : ""}`}
            titleBn={index === 0 ? "যা যা লাগবে" : category.name_bn || banglaFallback(category.name)}
            titleEn={index === 0 ? "Shop essentials" : category.name}
            href={`/category/${category.slug}`}
            products={shelfProducts}
          />
        ))}
      </div>

      <SourcingStories products={products}/>

      <section className="container-wide py-14 sm:py-20">
        <div className="call-order-strip">
          <div><p className="eyebrow"><span className="lang-bn">অনলাইনে অর্ডার করতে দ্বিধা হচ্ছে?</span><span className="lang-en">Prefer to speak to a person?</span></p><h2><span className="lang-bn">ফোন বা হোয়াটসঅ্যাপে অর্ডার নিশ্চিত করুন।</span><span className="lang-en">Confirm your order by phone or WhatsApp.</span></h2><p><Lang bn="পল্লবী, মিরপুর, ঢাকা · সকাল ১০টা–রাত ৯টা" en="Pallabi, Mirpur, Dhaka · 10:00 AM–9:00 PM"/></p></div>
          <div className="call-order-actions"><a href="tel:+8801720601515" className="button-primary"><span className="lang-bn">কল করুন</span><span className="lang-en">Call</span> · 01720 601515</a><a href="https://wa.me/8801720601515" target="_blank" rel="noreferrer" className="button-quiet"><Lang bn="হোয়াটসঅ্যাপ" en="WhatsApp"/></a></div>
        </div>
      </section>

      <section className="container-wide pb-16 sm:pb-24">
        <RecentlyViewedRail products={products}/>
      </section>
    </main>
  );
}
