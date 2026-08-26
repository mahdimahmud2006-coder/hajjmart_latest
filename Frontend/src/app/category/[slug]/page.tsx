import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryProducts } from "@/lib/api";
import { ProductGrid } from "@/components/product-grid";
import { ProductPagination } from "@/components/product-pagination";
import { ArrowRightIcon, ChevronRightIcon, PackageIcon } from "@/components/icons";
import { AppImage } from "@/components/app-image";
import { getCategoryImage, productAudience, productKind, productPackageType } from "@/lib/utils";
import { Lang } from "@/components/lang";
import { hasBangla } from "@/lib/i18n";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCategoryProducts(slug);
  return { title: data ? `${data.category.name} | HajjMart` : "Collection | HajjMart", description: data?.category.description || "Shop this HajjMart collection." };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const query = await searchParams;
  const isIhram = slug === "ihram-packages";
  const rawPage = first(query.page);
  const page = Math.max(1, Number.parseInt(rawPage || "1", 10) || 1);
  const data = await getCategoryProducts(slug, isIhram ? 1 : page, isIhram ? 96 : 24);
  if (!data) notFound();
  const { category, products, currentPage, lastPage, total } = data;
  const fallback = slug.includes("travel") ? "/images/products/travel-kit.svg" : slug.includes("foot") ? "/images/products/sandal.svg" : "/images/products/ihram-package.svg";

  const trackValue = first(query.track);
  const audienceValue = first(query.audience);
  const tripValue = first(query.trip);
  const track = trackValue === "items" ? "items" : "packages";
  const audience = audienceValue === "men" || audienceValue === "women" || audienceValue === "kids" ? audienceValue : "all";
  const trip = tripValue === "umrah" || tripValue === "hajj" ? tripValue : "all";
  const filteredProducts = isIhram ? products.filter((product) => {
    if (track === "packages" && productKind(product) !== "package") return false;
    if (track === "items" && productKind(product) !== "single") return false;
    if (audience !== "all" && productAudience(product) !== audience) return false;
    if (track === "packages" && trip !== "all" && productPackageType(product) !== trip) return false;
    return true;
  }) : products;

  function filterHref(values: { track?: string; audience?: string; trip?: string }) {
    const search = new URLSearchParams();
    const nextTrack = values.track ?? track;
    const nextAudience = values.audience ?? audience;
    const nextTrip = values.trip ?? trip;
    if (nextTrack !== "packages") search.set("track", nextTrack);
    if (nextAudience !== "all") search.set("audience", nextAudience);
    if (nextTrack === "packages" && nextTrip !== "all") search.set("trip", nextTrip);
    return `/category/${slug}${search.size ? `?${search}` : ""}`;
  }

  return (
    <main className="category-page-bg">
      <section className="category-masthead">
        <div className="container-wide grid min-h-[470px] items-center gap-8 py-12 lg:grid-cols-[1fr_.8fr]">
          <div className="relative z-10">
            <nav className="breadcrumb"><Link href="/"><Lang bn="হোম" en="Home"/></Link><ChevronRightIcon size={12}/><Link href="/shop"><Lang bn="পণ্য" en="Shop"/></Link><ChevronRightIcon size={12}/><span><Lang bn={category.name_bn} en={category.name}/></span></nav>
            <p className="eyebrow mt-9"><Lang bn="হজমার্ট সংগ্রহ" en="HajjMart collection"/></p>
            <h1 className="mt-3 max-w-3xl font-serif text-5xl leading-[1.03] text-[var(--ink)] sm:text-6xl lg:text-7xl"><Lang bn={category.name_bn} en={category.name}/></h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-[var(--muted)]"><Lang bn={category.description_bn && hasBangla(category.description_bn) ? category.description_bn : "প্রস্তুতি পরিষ্কার, ভ্রমণ হালকা ও প্রতিটি ধাপ সহজ করতে যত্ন করে বাছাই করা প্রয়োজনীয় সামগ্রী।"} en={category.description || "Thoughtfully selected essentials that make preparation clearer, travel lighter and every step more considered."}/></p>
            <p className="mt-7 text-xs font-semibold uppercase tracking-[.18em] text-[var(--gold-dark)]"><Lang bn={`এই সংগ্রহে ${total}টি পণ্য`} en={`${total} products in this collection`}/></p>
          </div>
          <div className="relative h-[350px] overflow-hidden rounded-[2rem] bg-[var(--mist)] lg:h-[410px]">
            <AppImage src={getCategoryImage(category) || fallback} fallback={fallback} alt={category.name} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--forest)]/25 to-transparent" />
          </div>
        </div>
      </section>

      {isIhram ? <section className="container-wide pt-10 sm:pt-14">
        <div className="ihram-filter-panel">
          <div className="ihram-track-switch" aria-label="Ihram product type">
            <Link href={filterHref({ track: "packages", trip: "all" })} className={track === "packages" ? "active" : ""}><PackageIcon size={18}/><span><strong><Lang bn="রেডি-মেড প্যাকেজ" en="Ready-made Packages"/></strong><small><Lang bn="গোছানো, আইটেমভিত্তিক সম্পূর্ণ সেট" en="Complete, itemised bundles"/></small></span></Link>
            <Link href={filterHref({ track: "items", trip: "all" })} className={track === "items" ? "active" : ""}><span className="ihram-track-dot"/><span><strong><Lang bn="একক ইহরাম পণ্য" en="Individual Ihram Items"/></strong><small><Lang bn="কাপড়, বেল্ট ও আলাদা প্রয়োজনীয় জিনিস" en="Cloth, belts and individual essentials"/></small></span></Link>
          </div>

          <div className="ihram-filter-row">
            <span className="ihram-filter-label"><Lang bn="কার জন্য" en="Audience"/></span>
            <div className="ihram-pills">
              {(["all", "men", "women", "kids"] as const).map((value) => <Link key={value} href={filterHref({ audience: value })} className={audience === value ? "active" : ""}><span className="lang-bn">{value === "all" ? "সব" : value === "men" ? "পুরুষ" : value === "women" ? "নারী" : "শিশু"}</span><span className="lang-en">{value === "all" ? "All" : value === "men" ? "Men" : value === "women" ? "Women" : "Kids"}</span></Link>)}
            </div>
          </div>

          {track === "packages" ? <div className="ihram-filter-row">
            <span className="ihram-filter-label"><Lang bn="প্যাকেজ ধরন" en="Package type"/></span>
            <div className="ihram-pills">
              {(["all", "umrah", "hajj"] as const).map((value) => <Link key={value} href={filterHref({ trip: value })} className={trip === value ? "active" : ""}><span className="lang-bn">{value === "all" ? "সব" : value === "umrah" ? "উমরাহ" : "হজ"}</span><span className="lang-en">{value === "all" ? "All" : value === "umrah" ? "Umrah" : "Hajj"}</span></Link>)}
            </div>
          </div> : null}

          <div className="ihram-builder-link"><div><strong><Lang bn="নিজে প্যাকেজ বানাতে চান?" en="Prefer to build your own?"/></strong><p><Lang bn="ইহরাম থেকে অ্যাড-অন—ধাপে ধাপে বেছে নিন।" en="Choose from ihram through add-ons, step by step."/></p></div><Link href="/build-your-package"><Lang bn="প্যাকেজ বানান" en="Build your package"/><ArrowRightIcon size={16}/></Link></div>
        </div>
      </section> : null}

      <section className={`category-results-shell container-wide section-space ${isIhram ? "pt-8 sm:pt-10" : "pt-10 sm:pt-14"}`}>
        {isIhram ? <div className="mb-7 flex items-center justify-between gap-4"><div><p className="eyebrow"><Lang bn={track === "packages" ? "প্যাকেজ তুলনা" : "একক পণ্য"} en={track === "packages" ? "Compare packages" : "Individual items"}/></p><p className="mt-2 text-sm text-[var(--muted)]"><Lang bn={`${filteredProducts.length}টি ফলাফল`} en={`${filteredProducts.length} results`}/></p></div></div> : null}
        {filteredProducts.length ? <ProductGrid products={filteredProducts} priorityCount={4}/> : <div className="ihram-empty"><PackageIcon size={30}/><h2><Lang bn="এই ফিল্টারে এখন কোনো পণ্য নেই" en="No products match these filters yet"/></h2><p><Lang bn="অন্য অডিয়েন্স বা প্যাকেজ ধরন বেছে দেখুন।" en="Try another audience or package type."/></p><Link href={`/category/${slug}`} className="button-quiet"><Lang bn="সব প্যাকেজ দেখুন" en="View all packages"/></Link></div>}
        {!isIhram ? <ProductPagination basePath={`/category/${slug}`} currentPage={currentPage} lastPage={lastPage} searchParams={query}/> : null}
      </section>
    </main>
  );
}
