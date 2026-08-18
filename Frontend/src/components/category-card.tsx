import Link from "next/link";
import type { Category } from "@/lib/types";
import { AppImage } from "./app-image";
import { ArrowRightIcon } from "./icons";
import { getCategoryImage } from "@/lib/utils";

export function CategoryCard({ category, index }: { category: Category; index: number }) {
  const fallbackImages = ["/images/products/ihram-package.svg", "/images/products/travel-kit.svg", "/images/products/sandal.svg", "/images/products/neck-bag.svg", "/images/products/prayer-mat.svg", "/images/products/umbrella.svg"];
  return (
    <Link href={`/category/${category.slug}`} className="category-card group">
      <AppImage src={getCategoryImage(category) || fallbackImages[index % fallbackImages.length]} alt={category.name} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.055]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#092f2a]/90 via-[#092f2a]/15 to-transparent" />
      <span className="absolute left-5 top-5 text-xs tracking-[.2em] text-white/70">0{index + 1}</span>
      <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
        <h3 className="font-serif text-2xl leading-tight sm:text-[28px]">{category.name}</h3>
        <p className="mt-2 line-clamp-2 max-w-xs text-sm leading-6 text-white/65">{category.description || "Thoughtfully chosen essentials for the sacred journey."}</p>
        <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em]">Explore <ArrowRightIcon size={15} className="transition group-hover:translate-x-1" /></span>
      </div>
    </Link>
  );
}
