import Link from "next/link";
import type { Category } from "@/lib/types";
import { AppImage } from "./app-image";
import { ArrowRightIcon } from "./icons";
import { Lang } from "./lang";
import { getCategoryImage } from "@/lib/utils";
import { hasBangla } from "@/lib/i18n";

export function CategoryCard({ category, index }: { category: Category; index: number }) {
  const fallbackImages = ["/images/products/ihram-package.svg", "/images/products/travel-kit.svg", "/images/products/sandal.svg", "/images/products/neck-bag.svg", "/images/products/prayer-mat.svg", "/images/products/umbrella.svg"];
  return (
    <Link href={`/category/${category.slug}`} className="category-card group">
      <AppImage src={getCategoryImage(category) || fallbackImages[index % fallbackImages.length]} alt={category.name} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.055]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#092f2a]/90 via-[#092f2a]/15 to-transparent" />
      <span className="absolute left-5 top-5 text-xs tracking-[.2em] text-white/70">0{index + 1}</span>
      {category.products_count !== undefined ? <span className="category-card-badge"><span className="lang-bn">{category.products_count} পণ্য</span><span className="lang-en">{category.products_count} products</span></span> : null}
      <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
        <h3 className="font-serif text-2xl leading-tight sm:text-[28px]"><Lang bn={category.name_bn} en={category.name}/></h3>
        <p className="mt-2 line-clamp-2 max-w-xs text-sm leading-6 text-white/70"><Lang bn={category.description_bn && hasBangla(category.description_bn) ? category.description_bn : "হজ ও উমরাহর প্রয়োজনীয় পণ্য।"} en={category.description || "Hajj and Umrah essentials."}/></p>
        <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em]"><Lang bn="দেখুন" en="Explore"/> <ArrowRightIcon size={15} className="transition group-hover:translate-x-1" /></span>
      </div>
    </Link>
  );
}
