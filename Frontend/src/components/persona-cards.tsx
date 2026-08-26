import Link from "next/link";
import type { Product } from "@/lib/types";
import { getProductImage } from "@/lib/utils";
import { AppImage } from "./app-image";
import { ArrowRightIcon } from "./icons";

const moments = [
  { key: "going", href: "/build-your-package", labelBn: "এ বছর যাচ্ছেন", labelEn: "Going this year", copyBn: "কী কী লাগবে—ধাপে ধাপে বাছুন", copyEn: "Build a guided checklist", fallbackImage: "/images/products/ihram-cloth.svg", terms: ["ihram", "ইহরাম"] },
  { key: "parent", href: "/shop?q=package", labelBn: "মা-বাবার জন্য", labelEn: "For a parent", copyBn: "সম্পূর্ণ প্যাকেজ ও সহজ প্রস্তুতি", copyEn: "Complete sets for easier preparation", fallbackImage: "/images/products/ihram-package.svg", terms: ["package", "bundle", "প্যাকেজ"] },
  { key: "spouse", href: "/shop", labelBn: "স্বামী/স্ত্রীর জন্য", labelEn: "For a spouse", copyBn: "আরাম, ভ্রমণ ও প্রয়োজনীয় জিনিস", copyEn: "Comfort and travel essentials", fallbackImage: "/images/products/travel-kit.svg", terms: ["travel", "care", "bag", "ভ্রমণ"] },
  { key: "family", href: "/category/ihram-packages", labelBn: "পরিবার / গ্রুপ", labelEn: "Family / group", copyBn: "একাধিক যাত্রীর প্রস্তুতি একসাথে", copyEn: "Prepare several travellers together", fallbackImage: "/images/products/prayer-mat.svg", terms: ["prayer", "mat", "package", "জায়নামাজ"] },
] as const;

function representativeImage(products: Product[], terms: readonly string[], fallback: string) {
  const product = products.find((item) => {
    const text = [item.name, item.name_bn, item.short_description, item.short_description_bn, ...(item.categories || []).flatMap((category) => [category.name, category.name_bn, category.slug])].filter(Boolean).join(" ").toLowerCase();
    return terms.some((term) => text.includes(term));
  });
  return product ? getProductImage(product) : fallback;
}

export function PersonaCards({ products = [] }: { products?: Product[] }) {
  return (
    <section className="persona-section" aria-labelledby="persona-heading">
      <div className="container-wide py-8 sm:py-10">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow"><span className="lang-bn">কার জন্য বা কেন কিনছেন?</span><span className="lang-en">Shop by person or moment</span></p>
            <h2 id="persona-heading" className="mt-2 text-2xl font-bold text-[var(--ink)] sm:text-3xl"><span className="lang-bn">আপনার অবস্থার সাথে মিলিয়ে শুরু করুন</span><span className="lang-en">Start with what fits your journey</span></h2>
          </div>
          <Link href="/shop" className="text-link hidden sm:inline-flex"><span className="lang-bn">সব পণ্য</span><span className="lang-en">View all</span> <ArrowRightIcon size={15}/></Link>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
          {moments.map((moment) => (
            <Link key={moment.key} href={moment.href} className="persona-card group" aria-label={`${moment.labelBn} / ${moment.labelEn}`}>
              <AppImage src={representativeImage(products, moment.terms, moment.fallbackImage)} alt="" className="persona-card-image" />
              <div className="persona-card-copy">
                <strong><span className="lang-bn">{moment.labelBn}</span><span className="lang-en">{moment.labelEn}</span></strong>
                <small><span className="lang-bn">{moment.copyBn}</span><span className="lang-en">{moment.copyEn}</span></small>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
