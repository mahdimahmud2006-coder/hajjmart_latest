import React from "react";
import Link from "next/link";
import { getCategories, getHomepageSections, getProducts } from "@/lib/api";
import { HeroBanner } from "@/components/home/hero-banner";
import { TrustBar } from "@/components/home/trust-bar";
import { FeaturedCategories } from "@/components/home/featured-categories";
import { ProductCard } from "@/components/product/product-card";
import { CustomerTrust } from "@/components/home/customer-trust";
import { Flame, Award, Sparkles, ArrowRight } from "lucide-react";

export const revalidate = 60; // Revalidate data every minute

export default async function HomePage() {
  // Fetch homepage section data, categories, and products
  const [sections, categories, products] = await Promise.all([
    getHomepageSections().catch(() => []),
    getCategories().catch(() => []),
    getProducts().catch(() => []),
  ]);

  // Extract slides if present in section data
  const heroSection = sections.find((s) => s.kind === "hero");
  const slides = heroSection?.metadata?.slides as
    | Array<{
        headline: string;
        subheadline: string;
        cta_text: string;
        cta_link: string;
        image_url: string;
      }>
    | undefined;

  // Product merchandising slices
  const hotDeals = products.slice(0, 4);
  const bestSellers = products.slice(4, 12);
  const newArrivals = products.slice(12, 20);

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* 1. Hero Showcase Banner */}
      <HeroBanner slides={slides} />

      {/* 2. Reassurance & Trust Signals Bar */}
      <TrustBar />

      {/* 3. Featured Categories Grid */}
      {categories.length > 0 && <FeaturedCategories categories={categories} />}

      {/* 4. Dynamic Section: Hot Deals / Flash Sale */}
      {hotDeals.length > 0 && (
        <section className="py-6 px-4 max-w-7xl mx-auto w-full">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-[24px] sm:text-[28px] font-bold text-[#1A1A1A] flex items-center gap-2">
                <Flame className="w-6 h-6 text-[#B3261E]" />
                <span>হট ডিলস ও অফার</span>
              </h2>
              <p className="text-[18px] text-[#5B5650] mt-1">
                সীমিত সময়ের জন্য বিশেষ মূল্যে সেরা পণ্যসমূহ
              </p>
            </div>
            <Link
              href="/products?sort=price_asc"
              className="text-[18px] font-bold text-[#1F5D42] hover:underline flex items-center gap-1 shrink-0"
            >
              <span>সব অফার</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {hotDeals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* 5. Dynamic Section: Best Selling Products */}
      <section className="py-6 px-4 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[24px] sm:text-[28px] font-bold text-[#1A1A1A] flex items-center gap-2">
              <Award className="w-6 h-6 text-[#1F5D42]" />
              <span>সর্বোচ্চ বিক্রিত পণ্য</span>
            </h2>
            <p className="text-[18px] text-[#5B5650] mt-1">
              আমাদের ক্রেতাদের সবচেয়ে প্রিয় নির্বাচনসমূহ
            </p>
          </div>
          <Link
            href="/products"
            className="text-[18px] font-bold text-[#1F5D42] hover:underline flex items-center gap-1 shrink-0"
          >
            <span>সব দেখুন</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {(bestSellers.length > 0 ? bestSellers : products.slice(0, 8)).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* 6. Dynamic Section: New Arrivals */}
      {newArrivals.length > 0 && (
        <section className="py-6 px-4 max-w-7xl mx-auto w-full">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-[24px] sm:text-[28px] font-bold text-[#1A1A1A] flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-[#B8860B]" />
                <span>নতুন কালেকশন</span>
              </h2>
              <p className="text-[18px] text-[#5B5650] mt-1">
                সদ্য যুক্ত হওয়া হজ্জ ও ওমরাহ সামগ্রী
              </p>
            </div>
            <Link
              href="/products?sort=newest"
              className="text-[18px] font-bold text-[#1F5D42] hover:underline flex items-center gap-1 shrink-0"
            >
              <span>নতুন কালেকশন দেখুন</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* 7. Customer Reviews & Shariah Trust */}
      <CustomerTrust />
    </div>
  );
}
