import Link from "next/link";
import type { Product } from "@/lib/types";
import { COPY } from "@/lib/i18n";
import { ProductCard } from "./product-card";
import { ArrowRightIcon } from "./icons";
import { Lang } from "./lang";
import { Reveal } from "./reveal";

export function ProductShelf({ titleBn, titleEn, eyebrowBn, eyebrowEn, href, products }: { titleBn: string; titleEn: string; eyebrowBn: string; eyebrowEn: string; href: string; products: Product[] }) {
  if (!products.length) return null;
  return (
    <section className="product-shelf-section">
      <Reveal className="container-wide">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div><p className="eyebrow"><Lang bn={eyebrowBn} en={eyebrowEn}/></p><h2 className="mt-2 text-3xl font-bold leading-tight text-[var(--ink)] sm:text-4xl"><Lang bn={titleBn} en={titleEn}/></h2></div>
          <Link href={href} className="text-link shrink-0"><Lang {...COPY.viewAll}/> <ArrowRightIcon size={15}/></Link>
        </div>
        <div className="product-shelf" role="list">
          {products.slice(0, 12).map((product) => <div role="listitem" key={product.id} className="product-shelf-item"><ProductCard product={product}/></div>)}
        </div>
      </Reveal>
    </section>
  );
}
