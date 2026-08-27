import React, { Suspense } from "react";
import { getCategoryProducts } from "@/lib/api";
import { CatalogView } from "@/components/catalog/catalog-view";
import { notFound } from "next/navigation";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps) {
  const { slug } = await params;
  const data = await getCategoryProducts(slug).catch(() => null);
  if (!data) return { title: "ক্যাটাগরি" };
  return {
    title: `${data.category.name} — হজ্জমার্ট`,
    description: data.category.description || `${data.category.name} কালেকশন`,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const data = await getCategoryProducts(slug).catch(() => null);

  if (!data) {
    notFound();
  }

  return (
    <Suspense fallback={<div className="p-8 text-center text-[18px]">লোড হচ্ছে...</div>}>
      <CatalogView
        initialCategorySlug={data.category.slug}
        initialCategoryName={data.category.name}
      />
    </Suspense>
  );
}
