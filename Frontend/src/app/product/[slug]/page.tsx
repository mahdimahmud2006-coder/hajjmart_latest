import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, getProducts } from "@/lib/api";
import { ProductDetail } from "@/components/product-detail";
import { ProductGrid } from "@/components/product-grid";
import { RecentlyViewedRail } from "@/components/recently-viewed-rail";
import { ChevronRightIcon } from "@/components/icons";
import { formatPrice, packageItemCount, productAudience, productKind, productPrice, stripHtml } from "@/lib/utils";
import { Lang } from "@/components/lang";

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
  const categoryProducts = await getProducts({ category: category?.slug, per_page: 12 });
  const related = categoryProducts.filter((item) => item.id !== product.id).slice(0, 4);
  const audience = productAudience(product);
  const compare = productKind(product) === "package" ? categoryProducts
    .filter((item) => item.id !== product.id && productKind(item) === "package" && (!audience || productAudience(item) === audience))
    .sort((a, b) => productPrice(a) - productPrice(b))
    .slice(0, 4) : [];

  return (
    <main className="product-page-bg">
      <div className="container-wide py-5 sm:py-7"><nav className="breadcrumb"><Link href="/"><Lang bn="হোম" en="Home"/></Link><ChevronRightIcon size={12}/><Link href="/shop"><Lang bn="পণ্য" en="Shop"/></Link><ChevronRightIcon size={12}/>{category ? <Link href={`/category/${category.slug}`}><Lang bn={category.name_bn} en={category.name}/></Link> : <span><Lang bn="হজ ও উমরাহর প্রয়োজনীয় পণ্য" en="Hajj & Umrah Essentials"/></span>}<ChevronRightIcon size={12}/><span className="line-clamp-1"><Lang bn={product.name_bn} en={product.name}/></span></nav></div>
      <section className="product-primary-section container-wide pb-16 pt-2 sm:pb-24"><ProductDetail product={product}/></section>
      {compare.length ? <section className="package-compare-section container-wide pb-16 sm:pb-24"><div className="package-compare-head"><div><p className="eyebrow"><Lang bn="এক নজরে তুলনা" en="Compare at a glance"/></p><h2><Lang bn="অন্যান্য প্যাকেজের সাথে তুলনা করুন" en="Compare with other packages"/></h2></div><Link href="/category/ihram-packages"><Lang bn="সব প্যাকেজ" en="All packages"/> <span aria-hidden="true">→</span></Link></div><div className="package-compare-grid">{compare.map((item) => <Link key={item.id} href={`/product/${item.slug || item.id}`}><span className="package-compare-count"><span className="lang-bn">{packageItemCount(item) || "—"}টি পণ্য</span><span className="lang-en">{packageItemCount(item) || "—"} items</span></span><strong><Lang bn={item.name_bn} en={item.name}/></strong><b>{formatPrice(productPrice(item))}</b></Link>)}</div></section> : null}
      <section className="container-wide pb-16 sm:pb-24"><RecentlyViewedRail excludeId={product.id}/></section>
      {related.length ? <section className="related-products-section section-space border-t border-black/8 bg-[var(--paper)]"><div className="container-wide"><p className="eyebrow"><Lang bn="প্রস্তুতি সম্পূর্ণ করুন" en="Complete the preparation"/></p><h2 className="section-title mt-3 mb-10"><Lang bn="আরও যা লাগতে পারে।" en="You may also need."/></h2><ProductGrid products={related}/></div></section> : null}
    </main>
  );
}
