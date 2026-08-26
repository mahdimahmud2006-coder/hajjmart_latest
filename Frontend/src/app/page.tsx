import { HomePage } from "@/components/home-page";
import { getCategories, getHomepageSections, getProducts, getPublicPromotions } from "@/lib/api";

export default async function Home() {
  const [sections, categories, products, promotions] = await Promise.all([
    getHomepageSections(),
    getCategories(),
    getProducts({ per_page: 72, sort: "best_selling" }),
    getPublicPromotions(),
  ]);
  return <HomePage sections={sections} categories={categories} products={products} promotions={promotions} />;
}
