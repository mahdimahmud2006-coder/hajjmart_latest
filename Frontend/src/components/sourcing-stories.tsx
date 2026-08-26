import Link from "next/link";
import type { Product } from "@/lib/types";
import { getProductImage, stripHtml } from "@/lib/utils";
import { AppImage } from "./app-image";
import { ArrowRightIcon } from "./icons";
import { Lang } from "./lang";
import { hasBangla } from "@/lib/i18n";

export function SourcingStories({ products }: { products: Product[] }) {
  const stories = products.filter((product) => product.brand && (product.short_description || product.short_description_bn || product.description || product.description_bn)).slice(0, 3);
  if (stories.length < 2) return null;

  return <section className="sourcing-stories"><div className="container-wide py-14 sm:py-20"><div className="mb-7 max-w-3xl"><p className="eyebrow"><span className="lang-bn">যত্ন করে বাছাই</span><span className="lang-en">Sourced with care</span></p><h2 className="mt-2 text-3xl font-bold sm:text-4xl"><span className="lang-bn">ব্র্যান্ড ও পণ্যের পেছনের তথ্য</span><span className="lang-en">The brands and details behind selected products</span></h2><p className="mt-3 text-[15px] leading-7 text-[var(--muted)]"><span className="lang-bn">ক্যাটালগে যে ব্র্যান্ড ও পণ্যের তথ্য দেওয়া আছে, এখানেও সেটিই দেখানো হয়—অতিরিক্ত দাবি যোগ করা হয় না।</span><span className="lang-en">This section only surfaces brand and product information already supplied by the catalogue.</span></p></div><div className="sourcing-story-grid">{stories.map((product) => <Link href={`/product/${product.slug || product.id}`} key={product.id} className="sourcing-story-card"><div className="sourcing-story-image"><AppImage src={getProductImage(product)} alt={product.name} className="h-full w-full object-cover"/></div><div><span>{product.brand}</span><strong><Lang bn={product.name_bn} en={product.name}/></strong><p><Lang bn={hasBangla(stripHtml(product.short_description_bn || product.description_bn)) ? stripHtml(product.short_description_bn || product.description_bn).slice(0, 150) : "পণ্যটির ব্যবহার, উপকরণ ও যাত্রায় কাজে লাগার দিকগুলো জানতে বিস্তারিত পাতাটি দেখুন।"} en={stripHtml(product.short_description || product.description).slice(0, 150)}/></p><small><span className="lang-bn">পণ্য দেখুন</span><span className="lang-en">View product</span> <ArrowRightIcon size={14}/></small></div></Link>)}</div></div></section>;
}
