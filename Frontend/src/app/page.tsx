import { HomePage } from "@/components/home-page";
import { getCategories, getHomepageSections, getProducts } from "@/lib/api";

export default async function Home() {
  const [sections, categories, products] = await Promise.all([
    getHomepageSections(),
    getCategories(),
    getProducts({ per_page: 24, sort: "best_selling" }),
  ]);
  return <HomePage sections={sections} categories={categories} products={products} />;
}
