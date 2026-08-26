import Link from "next/link";
import type { Product } from "@/lib/types";
import { StarIcon } from "./icons";
import { AppImage } from "./app-image";
import { getProductImage } from "@/lib/utils";
import { Lang } from "./lang";
import { Reveal } from "./reveal";

export function CustomerProof({ products }: { products: Product[] }) {
  const reviewed = [...products]
    .filter((product) => Number(product.average_rating || 0) > 0 && Number(product.review_count || 0) > 0)
    .sort((a, b) => Number(b.review_count || 0) - Number(a.review_count || 0))
    .slice(0, 3);
  if (!reviewed.length) return null;

  return <section className="customer-proof" aria-labelledby="customer-proof-heading"><div className="container-wide py-8 sm:py-10"><div className="mb-5"><p className="eyebrow"><span className="lang-bn">ক্রেতাদের পছন্দ</span><span className="lang-en">Customer favourites</span></p><h2 id="customer-proof-heading" className="customer-proof-heading mt-2 font-bold"><span className="lang-bn">রেটিং ও রিভিউ থেকে জনপ্রিয় পণ্য</span><span className="lang-en">Popular products, backed by catalogue reviews</span></h2></div><Reveal className="customer-proof-grid">{reviewed.map((product) => <Link key={product.id} href={`/product/${product.slug || product.id}`} className="customer-proof-card"><span className="customer-proof-image"><AppImage src={getProductImage(product)} alt="" className="h-full w-full object-cover" /></span><span className="customer-proof-copy"><span className="customer-proof-stars">{Array.from({ length: 5 }).map((_, index) => <StarIcon key={index} size={15} fill={index < Math.round(Number(product.average_rating)) ? "currentColor" : "none"}/>)}</span><strong>{Number(product.average_rating).toFixed(1)} / 5</strong><p><Lang bn={product.name_bn} en={product.name}/></p><small>{product.review_count} <span className="lang-bn">টি রিভিউ</span><span className="lang-en">reviews</span></small></span></Link>)}</Reveal></div></section>;
}
