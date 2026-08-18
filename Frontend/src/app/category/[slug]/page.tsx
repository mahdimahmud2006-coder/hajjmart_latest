import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryProducts } from "@/lib/api";
import { ProductGrid } from "@/components/product-grid";
import { ChevronRightIcon } from "@/components/icons";
import { AppImage } from "@/components/app-image";
import { getCategoryImage } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCategoryProducts(slug);
  return { title: data ? `${data.category.name} | HajjMart` : "Collection | HajjMart", description: data?.category.description || "Shop this HajjMart collection." };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getCategoryProducts(slug);
  if (!data) notFound();
  const { category, products } = data;
  const fallback = slug.includes("travel") ? "/images/products/travel-kit.svg" : slug.includes("foot") ? "/images/products/sandal.svg" : "/images/products/ihram-package.svg";

  return (
    <main>
      <section className="category-masthead">
        <div className="container-wide grid min-h-[470px] items-center gap-8 py-12 lg:grid-cols-[1fr_.8fr]">
          <div className="relative z-10">
            <nav className="breadcrumb"><Link href="/">Home</Link><ChevronRightIcon size={12}/><Link href="/shop">Shop</Link><ChevronRightIcon size={12}/><span>{category.name}</span></nav>
            <p className="eyebrow mt-9">HajjMart collection</p>
            <h1 className="mt-3 max-w-3xl font-serif text-5xl leading-[1.03] text-[var(--ink)] sm:text-6xl lg:text-7xl">{category.name}</h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-[var(--muted)]">{category.description || "Thoughtfully selected essentials that make preparation clearer, travel lighter and every step more considered."}</p>
            <p className="mt-7 text-xs font-semibold uppercase tracking-[.18em] text-[var(--gold-dark)]">{products.length} products in this collection</p>
          </div>
          <div className="relative h-[350px] overflow-hidden rounded-[2rem] bg-[var(--mist)] lg:h-[410px]">
            <AppImage src={getCategoryImage(category) || fallback} fallback={fallback} alt={category.name} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--forest)]/25 to-transparent" />
          </div>
        </div>
      </section>
      <section className="container-wide section-space pt-10 sm:pt-14"><ProductGrid products={products} priorityCount={4}/></section>
    </main>
  );
}
