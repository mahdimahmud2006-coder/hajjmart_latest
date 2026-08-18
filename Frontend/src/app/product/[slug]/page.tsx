import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, getProducts } from "@/lib/api";
import { ProductDetail } from "@/components/product-detail";
import { ProductGrid } from "@/components/product-grid";
import { RecentlyViewedRail } from "@/components/recently-viewed-rail";
import { ChevronRightIcon } from "@/components/icons";
import { categoryName, stripHtml } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  return product ? { title: `${product.name} | HajjMart`, description: stripHtml(product.short_description || product.description).slice(0, 160) } : { title: "Product | HajjMart" };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  const category = product.categories?.[0];
  const related = (await getProducts({ category: category?.slug, per_page: 8 })).filter((item) => item.id !== product.id).slice(0, 4);

  return (
    <main className="bg-white">
      <div className="container-wide py-5 sm:py-7"><nav className="breadcrumb"><Link href="/">Home</Link><ChevronRightIcon size={12}/><Link href="/shop">Shop</Link><ChevronRightIcon size={12}/>{category ? <Link href={`/category/${category.slug}`}>{category.name}</Link> : <span>{categoryName(product)}</span>}<ChevronRightIcon size={12}/><span className="line-clamp-1">{product.name}</span></nav></div>
      <section className="container-wide pb-16 pt-2 sm:pb-24"><ProductDetail product={product}/></section>
      <section className="container-wide pb-16 sm:pb-24"><RecentlyViewedRail excludeId={product.id}/></section>
      {related.length ? <section className="section-space border-t border-black/8 bg-[var(--paper)]"><div className="container-wide"><p className="eyebrow">Complete the preparation</p><h2 className="section-title mt-3 mb-10">You may also need.</h2><ProductGrid products={related}/></div></section> : null}
    </main>
  );
}
