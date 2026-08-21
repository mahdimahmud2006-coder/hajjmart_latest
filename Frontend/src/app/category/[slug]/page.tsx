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
    <main className="sunnah-collection-page">
      <section className="container-wide sunnah-collection-heading">
        <nav className="breadcrumb"><Link href="/">Home</Link><ChevronRightIcon size={12}/><Link href="/shop">Shop</Link><ChevronRightIcon size={12}/><span>{category.name}</span></nav>
        <div className="sunnah-collection-hero">
          <div>
            <p className="eyebrow">HajjMart collection</p>
            <h1>{category.name}</h1>
            <p>{category.description || "Thoughtfully selected essentials that make preparation clearer, travel lighter and every step more considered."}</p>
            <span>{products.length} products</span>
          </div>
          <div className="sunnah-collection-image"><AppImage src={getCategoryImage(category) || fallback} fallback={fallback} alt={category.name} className="h-full w-full object-cover" /></div>
        </div>
        {category.children?.length ? <div className="sunnah-collection-tabs" aria-label={`${category.name} subcategories`}><Link href={`/category/${category.slug}`}>All {category.name}</Link>{category.children.map((child) => <Link key={child.id} href={`/category/${child.slug}`}>{child.name}</Link>)}</div> : null}
      </section>
      <section className="container-wide pb-20 pt-10 sm:pt-14"><ProductGrid products={products} priorityCount={4}/></section>
    </main>
  );
}
