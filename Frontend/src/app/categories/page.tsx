import React from "react";
import { getCategories } from "@/lib/api";
import { FeaturedCategories } from "@/components/home/featured-categories";

export const revalidate = 60;

export default async function CategoriesPage() {
  const categories = await getCategories().catch(() => []);

  return (
    <main className="min-h-[60vh] py-6">
      <FeaturedCategories categories={categories} showAll />
    </main>
  );
}
